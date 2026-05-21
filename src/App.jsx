// Wizard Graduation — STS-inspired single-player roguelike deckbuilder.
//
// MVP5: Verbal combat. Cards are word-fragments and effect-seals; you
// build up a spell by playing words that contribute stat points across
// three traits (Chutzpah / Wit / Jnsq), then play an Effect card to
// fire the spell against the enemy's Composure (or, for physical
// effects, their HP). Enemies have per-stat `effectiveness` —
// multipliers, with 0 meaning "completely immune to this kind of
// argument" (a Lich, for example, does not laugh). Defense (Block) is
// unchanged; physical damage from enemies still hits HP.
//
// Card shapes:
//   - WORD   ({ stats: { chutzpah?, wit?, jnsq? }, phrase: '...' }) —
//            contributes stat points to the spell tray for this turn.
//            May also carry `effects` for an on-play side-bonus.
//   - EFFECT ({ effect: { scaleBy, base, multiplier, damageType,
//            rider?, exhaust? }, phrase: '...' }) — fires the spell.
//            Damage = (base + tray[scaleBy] * multiplier) * effectiveness.
//            Vulnerable/Weak ride after damage.
//   - SKILL  — utility (block, draw, energy, heal). No stat contribution.
//   - POWER  — installs on the field and triggers per turn hook.
//
// Effect dispatcher keys recognised at on-play time:
//   block / draw / vulnerable / weak / energy / hp / exhaust   (skill side)
//   stats: { chutzpah, wit, jnsq }                             (word)
//   effect: { ... }                                            (effect-seal)
//
// Power trigger hooks:
//   startOfTurn / endOfTurn / onEffectCardPlayed
//
// Equipment-bonus keys read at the right hooks (start-of-combat, etc.):
//   strikeBonus            — +N base damage on any Strike-named effect card
//   startBlock             — +N Block at start of every combat
//   energyOnCombatStart    — +N energy on turn 1 of each combat (one-shot)
//   permanentEnergyBonus   — +N energy refilled EVERY turn (perm)
//   maxHp                  — +N max HP (applied once at install)
//   healOnCombatStart      — +N HP at start of every combat
//   extraStartHand         — +N to the turn-1 draw (per combat)

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { logEvent, logError, getStats, exportAllSessions, clearTelemetry, TelemetryEvents as TE } from './telemetry.js';
import { WIT_V2, WIT_V2_BY_SLOT } from './cards/wit-v2.js';
import { CHUTZPAH_V2, CHUTZPAH_V2_BY_SLOT } from './cards/chutzpah-v2.js';
import { JNSQ_V2, JNSQ_V2_BY_SLOT } from './cards/jnsq-v2.js';
import { TIER_MULTIPLIER, computeSpellTier, computeSpellDamage, composeSpellText, sharedTagCount } from './cards/shared.js';

// v2 card-pool lookup table keyed by lane.
const LANE_POOL = { wit: WIT_V2, chutzpah: CHUTZPAH_V2, jnsq: JNSQ_V2 };
const LANE_POOL_BY_SLOT = { wit: WIT_V2_BY_SLOT, chutzpah: CHUTZPAH_V2_BY_SLOT, jnsq: JNSQ_V2_BY_SLOT };
const ALL_V2_CARDS = [...WIT_V2, ...CHUTZPAH_V2, ...JNSQ_V2];

// =============================================================================
// 1. DATA
// =============================================================================
const CARDS = [
  // v2 sentence-engine cards: imported from src/cards/{wit,chutzpah,jnsq}-v2.js.
  ...ALL_V2_CARDS,

  // =============================================================================
  // SKILL CARDS — no stat contribution, no spell sealing. Pure utility.
  // =============================================================================
  // ---- BASIC (starter) ----
  { id: 'c-defend', name: 'Defend', cost: 1, type: 'skill', rarity: 'basic',
    effects: { block: 5 }, upgrade: { effects: { block: 8 } },
    desc: 'Gain 5 Block.' },

  // ---- COMMON ----
  { id: 'c-mend', name: 'Mend', cost: 1, type: 'skill', rarity: 'common',
    effects: { block: 7 }, upgrade: { effects: { block: 10 } },
    desc: 'Gain 7 Block.' },
  { id: 'c-acuity', name: 'Acuity', cost: 1, type: 'skill', rarity: 'common',
    effects: { draw: 2 }, upgrade: { effects: { draw: 3 } },
    desc: 'Draw 2 cards.' },
  { id: 'c-channel', name: 'Channel', cost: 0, type: 'skill', rarity: 'common',
    effects: { draw: 1, energy: 1, exhaust: true }, upgrade: { effects: { draw: 2, energy: 1, exhaust: true } },
    desc: '+1 Energy. Draw 1. Exhaust.' },

  // ---- UNCOMMON ----
  { id: 'c-bulwark', name: 'Bulwark', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 10 }, upgrade: { effects: { block: 14 } },
    desc: 'Gain 10 Block.' },
  { id: 'c-meditate', name: 'Meditate', cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { energy: 1, draw: 1, exhaust: true }, upgrade: { effects: { energy: 1, draw: 1 } },
    desc: 'Gain 1 Energy. Draw 1. Exhaust.' },
  { id: 'c-warding', name: 'Warding Glyph', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 4, vulnerable: 1 }, upgrade: { effects: { block: 6, vulnerable: 2 } },
    desc: 'Gain 4 Block. Apply 1 Vulnerable.' },
  { id: 'c-clarity', name: 'Clarity', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { draw: 3, exhaust: true }, upgrade: { effects: { draw: 4, exhaust: true } },
    desc: 'Draw 3 cards. Exhaust.' },
  // Cycle 4 batch 3: chutzpah sustain + next-cast boost. Pairs with
  // Don't Hold Back / Go For The Throat / Corner Them — heal the chip
  // damage your own deck inflicts, then go big on the next chutzpah cast.
  { id: 'c-iron-stomach', name: 'Iron Stomach', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { heal: 5, boostNextChutzpahCast: 0.5 },
    upgrade: { effects: { heal: 8, boostNextChutzpahCast: 0.5 } },
    desc: 'Heal 5 HP. Your next Chutzpah Effect this turn deals +50% damage.',
    flavor: 'You\'ve digested worse. You\'ll digest this.' },
  // Cycle 3: resistance-pierce tech card. The committed deck's answer
  // to a hostile matchup — your next Effect ignores the enemy's
  // effectiveness multiplier on the relevant stat. Composure damage only.
  // One-shot per turn, exhausts.
  { id: 'c-read-the-room', name: 'Read the Room', cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { pierceNextCast: true, exhaust: true },
    upgrade: { effects: { pierceNextCast: true, draw: 1, exhaust: true } },
    desc: 'Your next Effect this turn ignores enemy resistance. Exhaust.',
    flavor: 'You speak their language, briefly. They flinch in it.' },

  // ---- RARE ----
  { id: 'c-aegis', name: 'Aegis', cost: 2, type: 'skill', rarity: 'rare',
    effects: { block: 16 }, upgrade: { effects: { block: 21 } },
    desc: 'Gain 16 Block.' },

  // ---- MODIFIER SKILLS — stacking toward [0.5, 1.5] caps ----
  // Dedicated stack-builders for the multiplier system that replaced
  // Weak/Vulnerable. Each application shifts a multiplier by 0.25;
  // two stacks reach the cap. Drift toward 1.0 by 0.5/turn keeps
  // things bounded.
  { id: 'c-sap', name: 'Sap', cost: 1, type: 'skill', rarity: 'common',
    effects: { enemyDmgMod: -0.25 },
    upgrade: { effects: { enemyDmgMod: -0.25, draw: 1 } },
    desc: 'Reduce enemy attack damage by 25% (stacks; caps at −50%).',
    flavor: 'You did not finish your sentence. They did not finish theirs, either.' },
  { id: 'c-amplify', name: 'Amplify', cost: 1, type: 'skill', rarity: 'common',
    effects: { playerDmgMod: +0.25 },
    upgrade: { effects: { playerDmgMod: +0.25, draw: 1 } },
    desc: 'Increase your spell potency by 25% (stacks; caps at +50%). Each play this combat costs +1 energy more than the last.',
    flavor: 'You feel taller. It is, demonstrably, a feeling.' },
  { id: 'c-dispel', name: 'Dispel', cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { enemyDmgMod: -0.25, playerDmgMod: +0.25, exhaust: true },
    upgrade: { effects: { enemyDmgMod: -0.5, playerDmgMod: +0.5, exhaust: true } },
    desc: 'Enemy attack −25%, your potency +25%. Exhaust.',
    flavor: 'You wave a hand. Several small certainties fall out of the air.' },

  // =============================================================================
  // POWERS — install on the field, trigger via turn hooks.
  // =============================================================================
  { id: 'p-borrowed-confidence', name: 'Borrowed Confidence',
    cost: 1, type: 'power', rarity: 'common',
    power: { startOfTurn: { block: 2 } }, upgrade: { power: { startOfTurn: { block: 3 } } },
    desc: 'At the start of each turn, gain 2 Block.',
    flavor: 'On loan from someone who needed it less.' },
  { id: 'p-mildly-threatening', name: 'Mildly Threatening Demeanour',
    cost: 1, type: 'power', rarity: 'common',
    power: { endOfTurn: { weak: 1 } }, upgrade: { power: { endOfTurn: { weak: 2 } } },
    desc: 'At the end of each turn, apply 1 Weak.',
    flavor: "You haven't done anything yet. But you might." },
  { id: 'p-strongly-worded', name: 'A Strongly Worded Letter',
    cost: 1, type: 'power', rarity: 'uncommon',
    power: { endOfTurn: { vulnerable: 1 } }, upgrade: { power: { endOfTurn: { vulnerable: 2 } } },
    desc: 'At the end of each turn, apply 1 Vulnerable.',
    flavor: 'You will hear from the Bursar. Probably. He hasn\'t replied yet either.' },
  { id: 'p-inadvisable-acceleration', name: 'Inadvisable Acceleration',
    cost: 2, type: 'power', rarity: 'uncommon',
    power: { startOfTurn: { draw: 1 } }, upgrade: { power: { startOfTurn: { draw: 2 } } },
    desc: 'At the start of each turn, draw 1 extra card.',
    flavor: 'The faster you go, the more there is to look at. Look anyway.' },
  { id: 'p-significant-pause', name: 'The Significant Pause',
    cost: 2, type: 'power', rarity: 'uncommon',
    power: { startOfTurn: { energy: 1 } }, upgrade: { cost: 1 },
    desc: 'At the start of each turn, gain 1 Energy.',
    flavor: 'Wait. …Now.' },
  { id: 'p-ostensible-inferno', name: 'Ostensible Inferno',
    cost: 2, type: 'power', rarity: 'rare',
    power: { endOfTurn: { composure: 4 } }, upgrade: { power: { endOfTurn: { composure: 6 } } },
    desc: 'At the end of each turn, deal 4 Composure damage.',
    flavor: 'The fire is technically there. The fire-flavoured atmosphere certainly is.' },
  { id: 'p-octarine-squint', name: 'Octarine Squint',
    cost: 2, type: 'power', rarity: 'rare',
    power: { onEffectCardPlayed: { vulnerable: 1 } }, upgrade: { power: { onEffectCardPlayed: { vulnerable: 2 } } },
    desc: 'Each Effect you cast also applies 1 Vulnerable.',
    flavor: 'You\'re looking at the colour magic comes from. Don\'t blink.' },
];

// Relics — passive items earned from elites / bosses / events. Persist
// across combats AND across acts (whole-run). Effect hooks read by the
// combat loop at the right moments:
//   passiveStrikeBonus: N   — flat +N base on Strike-named effect cards
//   permanentEnergyBonus: N — +N to every-turn energy refill
//   onCombatStart: { effects } — applied once at start of every combat
//   onEnemyDefeated: { effects } — fires when an enemy (non-boss) dies
//   onCombatEnd: { effects }   — fires when a combat resolves to victory
//   everyNthEffect: { n, extraDamage } — every Nth Effect card cast gets
//                                        +N flat damage (composure OR phys)
// Pratchett tone — pompous artifacts of an over-administered school.
const RELICS = [
  // ---- COMMON ----
  { id: 'r-lecturers-pointer', name: "Lecturer's Pointer", rarity: 'common',
    effect: { passiveStrikeBonus: 1 },
    desc: 'Your Strikes deal +1 damage.',
    flavor: 'Frequently lost. Always returns.' },
  { id: 'r-hat-pin', name: 'Hat Pin of Persistence', rarity: 'common',
    effect: { onCombatStart: { block: 3 } },
    desc: 'At the start of every combat, gain 3 Block.',
    flavor: 'Holds the hat. Holds the dignity.' },
  { id: 'r-pocket-familiar', name: 'Pocket Familiar', rarity: 'common',
    effect: { onCombatStart: { draw: 1 } },
    desc: 'At the start of every combat, draw 1 extra card.',
    flavor: "It's a beetle. The beetle is on its third career." },

  // ---- UNCOMMON ----
  { id: 'r-deans-half-coat', name: "Dean's Half-Coat", rarity: 'uncommon',
    effect: { onEnemyDefeated: { heal: 4 } },
    desc: 'Whenever you defeat an enemy, heal 4 HP.',
    flavor: 'The other half is on the Dean.' },
  { id: 'r-sigil-orders', name: 'Sigil of Standing Orders', rarity: 'uncommon',
    effect: { onCombatEnd: { heal: 6 } },
    desc: 'At the end of every combat you win, heal 6 HP.',
    flavor: 'Filed in triplicate. Refiled if necessary.' },
  { id: 'r-brass-owl', name: 'Brass Owl, Polished', rarity: 'uncommon',
    effect: { everyNthEffect: { n: 5, extraDamage: 5 } },
    desc: 'Every 5th Effect you cast deals +5 damage.',
    flavor: 'Watches everything. Pretends it isn\'t.' },

  // ---- RARE / BOSS ----
  { id: 'r-inverted-hourglass', name: 'Inverted Hourglass', rarity: 'rare',
    effect: { permanentEnergyBonus: 1 },
    desc: '+1 Energy every turn (permanent).',
    flavor: "The sand falls upward. Don't comment." },
  { id: 'r-lockbox', name: 'Lockbox of Examinations', rarity: 'rare',
    effect: { onCombatStart: { draw: 2 } },
    desc: 'At the start of every combat, draw 2 extra cards.',
    flavor: 'Locked. Possibly empty. Definitely locked.' },
];
const RELICS_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]));

// Familiars — chosen at the familiar shop in town before the first map.
// Each grants a passive `bonus` (same effect-shape as relics, plus three
// new keys defined below) AND adds a signature `card` to the player's
// deck. The player names the familiar afterward; the name appears in
// chips, logs, and the run summary.
//
// New effect keys introduced by familiars (in addition to all the relic
// keys: passiveStrikeBonus, permanentEnergyBonus, onCombatStart,
// onEnemyDefeated, onCombatEnd, everyNthAttack, maxHp):
//   damageReduction: N        — flat -N from each incoming attack (min 1
//                               total damage taken, never reduces to 0)
//   startOfTurnBlock: N       — gain N Block at the start of every player
//                               turn (different from onCombatStart.block
//                               which fires once per combat)
//   startCombatVulnerable: N  — apply N Vulnerable to the enemy at combat
//                               start
const FAMILIARS = [
  {
    id: 'fam-raven', species: 'Raven', emoji: '🐦‍⬛',
    desc: 'At the start of every combat, draw 1 extra card.',
    flavor: 'It has read several of your books. Two of them.',
    bonus: { onCombatStart: { draw: 1 } },
    card: { id: 'f-quoth', name: 'Quoth', cost: 0, type: 'skill', rarity: 'basic',
      effects: { draw: 2, exhaust: true },
      upgrade: { effects: { draw: 3, exhaust: true } },
      desc: 'Draw 2. Exhaust.',
      flavor: 'It said something. You half-heard.' },
  },
  {
    id: 'fam-cat', species: 'Cat', emoji: '🐈',
    desc: 'At the start of every combat, gain 3 Block.',
    flavor: 'The cat knows where it is. The cat refuses to discuss it.',
    bonus: { onCombatStart: { block: 3 } },
    card: { id: 'f-stare', name: 'Indifferent Stare', cost: 1, type: 'effect', rarity: 'basic',
      effect: { scaleBy: 'chutzpah', base: 5, multiplier: 1, damageType: 'composure',
                rider: { weak: 1 }, resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } },
      phrase: '(the cat refuses to be impressed)',
      upgrade: { effect: { scaleBy: 'chutzpah', base: 7, multiplier: 2, damageType: 'composure',
                rider: { weak: 2 }, resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } } },
      desc: 'Cast: 5 + Chutzpah Composure. Apply 1 Weak. Resonates: dismissive, petty.',
      flavor: 'It is unimpressed.' },
  },
  {
    id: 'fam-toad', species: 'Toad', emoji: '🐸',
    desc: 'At the end of every combat you win, heal 3 HP.',
    flavor: 'It hums when you cook. It hums anyway.',
    bonus: { onCombatEnd: { heal: 3 } },
    card: { id: 'f-sip', name: 'Sip', cost: 0, type: 'skill', rarity: 'basic',
      effects: { hp: 2, energy: 1, exhaust: true },
      upgrade: { effects: { hp: 4, energy: 1, exhaust: true } },
      desc: '+2 HP. +1 Energy. Exhaust.',
      flavor: 'The toad knows several recipes. You have learned one.' },
  },
  {
    id: 'fam-mouse', species: 'Mouse', emoji: '🐭',
    desc: '+1 Energy on turn 1 of every combat.',
    flavor: 'Where there is a small space, there is a mouse. There is always a small space.',
    bonus: { onCombatStart: { energy: 1 } },
    card: { id: 'f-scurry', name: 'Scurry', cost: 0, type: 'skill', rarity: 'basic',
      effects: { block: 4, draw: 1, exhaust: true },
      upgrade: { effects: { block: 6, draw: 1, exhaust: true } },
      desc: 'Gain 4 Block. Draw 1. Exhaust.',
      flavor: 'It went under something. You did too.' },
  },
  {
    id: 'fam-owl', species: 'Owl', emoji: '🦉',
    desc: '+8 max HP.',
    flavor: 'It judges your reading speed. Privately. At length.',
    bonus: { maxHp: 8 },
    card: { id: 'f-hoo', name: 'Hoo', cost: 1, type: 'skill', rarity: 'basic',
      effects: { draw: 2 },
      upgrade: { effects: { draw: 3 } },
      desc: 'Draw 2.',
      flavor: 'It is a question. It is always a question.' },
  },
  {
    id: 'fam-beetle', species: 'Beetle', emoji: '🪲',
    desc: 'Take 1 less damage from every incoming attack (combats always cost at least 1).',
    flavor: 'It is on its third career. The first two were also waiting.',
    bonus: { damageReduction: 1 },
    card: { id: 'f-clatter', name: 'Clatter', cost: 1, type: 'effect', rarity: 'basic',
      effect: { scaleBy: 'jnsq', base: 3, multiplier: 1, damageType: 'composure',
                rider: { block: 3 }, resonatesWith: ['chaotic', 'absurd'], resonanceBonus: { perTag: 2 } },
      phrase: '(the beetle, briefly, expresses itself)',
      upgrade: { effect: { scaleBy: 'jnsq', base: 5, multiplier: 1, damageType: 'composure',
                rider: { block: 4 }, resonatesWith: ['chaotic', 'absurd'], resonanceBonus: { perTag: 2 } } },
      desc: 'Cast: 3 + Jnsq Composure. Gain 3 Block. Resonates: chaotic, absurd.',
      flavor: 'The beetle is angry. In its way.' },
  },
  {
    id: 'fam-hedgehog', species: 'Hedgehog', emoji: '🦔',
    desc: 'At the start of every turn, gain 2 Block.',
    flavor: 'It does not move when you call it. You have called it.',
    bonus: { startOfTurnBlock: 2 },
    card: { id: 'f-bristle', name: 'Bristle', cost: 1, type: 'skill', rarity: 'basic',
      effects: { block: 5, vulnerable: 1 },
      upgrade: { effects: { block: 7, vulnerable: 1 } },
      desc: 'Gain 5 Block. Apply 1 Vulnerable.',
      flavor: 'Touch at your own risk. Touching has been factored in.' },
  },
  {
    id: 'fam-crow', species: 'Crow', emoji: '🦅',
    desc: 'Whenever you defeat an enemy, heal 2 HP.',
    flavor: 'It has a collection. The collection has a collection.',
    bonus: { onEnemyDefeated: { heal: 2 } },
    card: { id: 'f-pilfer', name: 'Pilfer', cost: 1, type: 'effect', rarity: 'basic',
      effect: { scaleBy: 'jnsq', base: 4, multiplier: 1, damageType: 'composure',
                rider: { draw: 1 }, resonatesWith: ['petty', 'chaotic'], resonanceBonus: { perTag: 2 } },
      phrase: '(the crow takes something while you talk)',
      upgrade: { effect: { scaleBy: 'jnsq', base: 6, multiplier: 1, damageType: 'composure',
                rider: { draw: 1 }, resonatesWith: ['petty', 'chaotic'], resonanceBonus: { perTag: 2 } } },
      desc: 'Cast: 4 + Jnsq Composure. Draw 1. Resonates: petty, chaotic.',
      flavor: 'It brought you something. You did not ask.' },
  },
  {
    id: 'fam-snake', species: 'Snake', emoji: '🐍',
    desc: 'At the start of every combat, apply 2 Vulnerable to the enemy.',
    flavor: 'It is patient. You are not. This is the arrangement.',
    bonus: { startCombatVulnerable: 2 },
    card: { id: 'f-coil', name: 'Coil', cost: 1, type: 'effect', rarity: 'basic',
      effect: { scaleBy: 'chutzpah', base: 5, multiplier: 1, damageType: 'composure',
                rider: { vulnerable: 1 }, resonatesWith: ['threatening'], resonanceBonus: { perTag: 2 } },
      phrase: '(a small green warning slides into view)',
      upgrade: { effect: { scaleBy: 'chutzpah', base: 7, multiplier: 1, damageType: 'composure',
                rider: { vulnerable: 2 }, resonatesWith: ['threatening'], resonanceBonus: { perTag: 2 } } },
      desc: 'Cast: 5 + Chutzpah Composure. Apply 1 Vulnerable. Resonates: threatening.',
      flavor: 'A small green warning.' },
  },
  {
    id: 'fam-rabbit', species: 'Rabbit', emoji: '🐇',
    desc: 'Your Strikes deal +1 damage.',
    flavor: 'Direction was secondary. Speed was the trick.',
    bonus: { passiveStrikeBonus: 1 },
    card: { id: 'f-bolt', name: 'Bolt', cost: 0, type: 'effect', rarity: 'basic',
      effect: { scaleBy: 'chutzpah', base: 4, multiplier: 1, damageType: 'composure', exhaust: true,
                resonatesWith: ['petty'], resonanceBonus: { perTag: 2 } },
      phrase: '(it is gone — so is the apple)',
      upgrade: { effect: { scaleBy: 'chutzpah', base: 6, multiplier: 1, damageType: 'composure', exhaust: true,
                resonatesWith: ['petty'], resonanceBonus: { perTag: 2 } } },
      desc: 'Cast: 4 + Chutzpah Composure. Exhaust. Resonates: petty.',
      flavor: 'It was gone. So was the apple.' },
  },
];
const FAMILIARS_BY_ID = Object.fromEntries(FAMILIARS.map(f => [f.id, f]));
const CARDS_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

// 11-card starter. One word per stat (chutzpah / wit / jnsq), one
// composure effect per stat (Bluster / Persuade / Bewilder), Spark for
// a guaranteed physical option against verbal-immune enemies, Channel
// for tempo/draw cycling, and three Defends. The starter word tags
// (formal / sarcastic / dismissive / chaotic) intentionally overlap
// with the basic effects' widened resonance lists so resonance can
// fire even before the player picks up reward cards.
// Slim, neutral starter — covers Chutzpah and Wit shallowly so the
// player doesn't feel "already well-rounded" before deck-building begins.
// Jnsq is intentionally NOT here — it's the branch-out direction the
// player opens via the Starting Picks screen at game start (or via
// reward picks later). Old starter had 11 cards spanning all three stats
// + two physical effects; that made archetype commitment feel pointless
// because the deck was already a sampler.
// v2 starter deck — character-specific. Each character begins with a small
// lane-themed deck of basics: 3 intros + 3 subjects + 2 targets + 2 utility
// skills (defend + channel) for a 10-card opening hand pool. The basic
// rarity cards lock the player into Tier 1 spells until rewards bring in
// higher-tier intros / subjects / targets.
function buildStarterDeckForLane(lane) {
  const pool = LANE_POOL_BY_SLOT[lane];
  if (!pool) return [];
  const basics = (arr) => arr.filter(c => c.rarity === 'basic');
  const firstNCommons = (arr, n) => arr.filter(c => c.rarity === 'common').slice(0, n);
  // Starter deck shape: 3 intros + 3 subjects + 3 targets + 1 utility.
  // With a 5-card hand from this 10-card deck, the chance of drawing
  // at least one of each slot lands at ~75% — playable from turn 1.
  // (Previously was 3+3+2+2 = ~62% hit rate; targets were the bottleneck.)
  const ids = [
    ...basics(pool.intro).slice(0, 3).map(c => c.id),
    ...basics(pool.subject).slice(0, 3).map(c => c.id),
    ...firstNCommons(pool.target, 3).map(c => c.id),
    'c-defend',
  ];
  return ids;
}

// STARTER_DECK is now a function of character. Kept as a const for any v1
// references that still grep for it — they'll get the wit-scholar default.
const STARTER_DECK = buildStarterDeckForLane('wit');

// Starting Picks pool is unused now — character-select pre-stages the lane
// commitment. Kept as the basic intros so the existing screen doesn't blank.
const STARTING_PICKS_POOL = [
  ...LANE_POOL_BY_SLOT.wit.intro.slice(0, 2).map(c => c.id),
  ...LANE_POOL_BY_SLOT.chutzpah.intro.slice(0, 2).map(c => c.id),
  ...LANE_POOL_BY_SLOT.jnsq.intro.slice(0, 2).map(c => c.id),
];

// Enemies. `act` filters which act they appear in. `tier` ∈ normal / elite / boss.
// Verbal-combat fields:
//   composureMax — verbal HP. Drains to 0 = enemy concedes / backs off.
//   hpMax        — physical HP. Most enemies effectively physical-immune
//                  (very high). A few (Living Thicket, Crystal Beetle…)
//                  have low hp — physical effects are the fast path on
//                  them.
//   effectiveness — multiplier per stat. 1.0 = baseline. 0 = HARD immune
//                   (a Lich does not laugh). Values >1 = susceptible.
// behaviors[*]: { kind, value, weight, telegraph, count? } — unchanged.
const ENEMIES = [
  // ===== ACT 1 — The Staff Path =====
  { id: 'e1-acolyte', act: 4, name: 'Lost Acolyte', composureMax: 20, hpMax: 18, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    softSpot: 'logic', // Wants someone to explain what they're doing here.
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
      { kind: 'attack', value: 3, weight: 2, telegraph: '⚔ 3 (faltering)' },
    ] },
  { id: 'e1-imp', act: 4, name: 'Pact Imp', composureMax: 18, hpMax: 999, tier: 'normal',
    // Cycle 4 batch 3: chutzpah floor 0.5 → 0.7 (lane-equalization).
    effectiveness: { chutzpah: 0.7, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    softSpot: 'threat', // Bullies fold the moment you don't.
    behaviors: [
      { kind: 'attack', value: 4, weight: 3, telegraph: '⚔ 4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '⛧ Weak 1' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🩸 Vuln 1' },
    ] },
  { id: 'e1-shrine-rat', act: 4, name: 'Shrine Rat Pack', composureMax: 16, hpMax: 12, tier: 'normal',
    // Cycle 4 batch 4: physical 2.0 → 1.5. Pure-physical was at 64%
    // partly because Shrine Rat and Thicket were freebies for it.
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.0, physical: 1.5 },
    softSpot: 'threat', // Bigger predator energy = scatter.
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3, telegraph: '⚔ 2×3' },
      { kind: 'block',  value: 4, weight: 1, telegraph: '🛡 4' },
      { kind: 'attack', value: 5, weight: 2, telegraph: '⚔ 5 (lunging)' },
    ] },
  { id: 'e1-tutor', act: 4, name: 'Stern Tutor', composureMax: 32, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 2.0, physical: 0.5 },
    softSpot: 'logic', // Will argue the methodology over the outcome.
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (cutting remark)' },
    ] },
  { id: 'e1-thicket', act: 4, name: 'Living Thicket', composureMax: 55, hpMax: 38, tier: 'elite',
    // Cycle 4 batch 4: physical 1.5 → 1.0. The "physical-only" theme stays
    // (verbal at 0.5) but no longer hands pure-physical a 1.5× freebie.
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 0.5, physical: 1.0 },
    softSpot: 'confusion', // It is mostly bramble. It has thoughts about that.
    behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'block',  value: 9, weight: 2, telegraph: '🛡 9' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🌀 Vuln' },
    ] },
  { id: 'e1-boss-thornlord', act: 4, name: 'The Thornlord', composureMax: 100, hpMax: 120, tier: 'boss',
    // Cycle 4 batch 3: chutzpah 0.5 → 0.7 (same fix as Anvil — chutzpah
    // shouldn't be structurally walled by 2/4 act bosses).
    effectiveness: { chutzpah: 0.7, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    softSpot: 'flattery', // Apex predator; flatter the apex.
    insultVulnerabilities: ['petty', 'dismissive', 'sarcastic'], // Apex; cuts most when made small.
    behaviors: [
      { kind: 'attack', value: 15, weight: 2, telegraph: '⚔ 15' },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, telegraph: '⚔ 5×4 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'block',  value: 16, weight: 1, telegraph: '🛡 16' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 (bramble-whisper)' },
    ] },

  // ===== ACT 2 — The Thread Path =====
  { id: 'e2-hollow-weaver', act: 1, name: 'Hollow Weaver', composureMax: 22, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.5, physical: 1.0 },
    softSpot: 'logic', // Half-finished thoughts; finish them and it folds.
    behaviors: [
      { kind: 'attack', value: 5, weight: 2, telegraph: '⚔ 5 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'weak',   value: 1, weight: 1, telegraph: '⛧ Weak 1' },
    ] },
  { id: 'e2-silk-wraith', act: 1, name: 'Silk Wraith', composureMax: 18, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 0.7, wit: 1.0, jnsq: 1.5, physical: 0.5 },
    softSpot: 'confusion', // Already half-there. Push it further.
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3, telegraph: '⚔ 2×3' },
      { kind: 'block',  value: 6, weight: 1, telegraph: '🛡 6' },
      { kind: 'vulnerable', value: 1, weight: 2, telegraph: '🩸 Vuln 1 (silken whisper)' },
    ] },
  { id: 'e2-loom-familiar', act: 1, name: 'Loom Familiar', composureMax: 24, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    softSpot: 'flattery', // Misses its weaver. Speak as if it still mattered.
    behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'block',  value: 8, weight: 2, telegraph: '🛡 8' },
      { kind: 'attack', value: 4, weight: 2, telegraph: '⚔ 4 + ⛧ Weak 1 (thread-tangle)', riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 1, telegraph: '⛧ Weak 1' },
    ] },
  { id: 'e2-pattern-maker', act: 1, name: 'The Pattern-Maker', composureMax: 34, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.5, physical: 1.0 },
    softSpot: 'confusion', // Patterns hate exceptions.
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1, telegraph: '🎭 5 (pattern-wrong)' },
    ] },
  { id: 'e2-silent-spinner', act: 1, name: 'The Silent Spinner', composureMax: 38, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.5, wit: 0.5, jnsq: 1.0, physical: 1.0 },
    softSpot: 'threat', // The vow of silence has limits.
    behaviors: [
      { kind: 'block',  value: 8, weight: 2, telegraph: '🛡 8 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 7, weight: 2, telegraph: '⚔ 7 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 9, weight: 1, telegraph: '⚔ 9' },
    ] },
  { id: 'e2-boss-tapestry', act: 1, name: 'The Tapestry Walker', composureMax: 52, hpMax: 999, tier: 'boss',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 1.0, physical: 0.5 },
    softSpot: 'flattery', // Vain creator. Praise the work to crack the maker.
    insultVulnerabilities: ['dismissive', 'petty', 'sarcastic'], // Vain — hates being trivialized.
    behaviors: [
      { kind: 'attack', value: 10, weight: 2, telegraph: '⚔ 10 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, telegraph: '⚔ 4×4' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 (loom-song)' },
      { kind: 'block',  value: 10, weight: 1, telegraph: '🛡 10' },
    ] },

  // ===== ACT 3 — The Stone Path =====
  { id: 'e3-geode-crab', act: 2, name: 'Geode Crab', composureMax: 35, hpMax: 22, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.6, jnsq: 0.5, physical: 1.0 },
    softSpot: 'threat', // Hard shell, soft instinct. Loom over it.
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 8,  weight: 1, telegraph: '🛡 8' },
      { kind: 'attack', value: 7, weight: 1, telegraph: '⚔ 7 (claw-snap)' },
    ] },
  { id: 'e3-glow-mite', act: 2, name: 'Glow Mite Swarm', composureMax: 26, hpMax: 26, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.5, physical: 1.0 },
    softSpot: 'confusion', // A swarm of small minds is easily scattered.
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 4, weight: 2, telegraph: '⚔ 2×4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack-multi', value: 2, count: 4, weight: 1, telegraph: '⚔ 2×4' },
      { kind: 'weak',   value: 1, weight: 1, telegraph: '⛧ Weak 1' },
    ] },
  { id: 'e3-crystal-beetle', act: 2, name: 'Crystal Beetle', composureMax: 35, hpMax: 22, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.6, jnsq: 0.6, physical: 1.0 },
    softSpot: 'threat', // Slow, certain, intimidatable.
    behaviors: [
      { kind: 'attack', value: 6, weight: 3, telegraph: '⚔ 6' },
      { kind: 'attack', value: 8, weight: 1, telegraph: '⚔ 8' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5 (carapace)' },
    ] },
  { id: 'e3-quartz-sentinel', act: 2, name: 'Quartz Sentinel', composureMax: 40, hpMax: 40, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 0.5, physical: 1.0 },
    softSpot: 'logic', // Constructs respond to the logic they were built with.
    behaviors: [
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'block',  value: 10, weight: 2, telegraph: '🛡 10 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
    ] },
  { id: 'e3-vein-devourer', act: 2, name: 'Vein Devourer', composureMax: 75, hpMax: 50, tier: 'elite',
    // Cycle 3 batch 2: composureMax 999 → 75. The 0.5 verbal floor was
    // meaningless when the pool was unreachable. Now physical decks
    // finish fast (50 HP), committed verbal decks grind slower but win.
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 0.6, physical: 1.0 },
    softSpot: 'confusion', // Doesn't think. Only confusion can confuse it.
    insultVulnerabilities: [], // Mindless. Cannot be insulted. ALL insults backfire on it.
    behaviors: [
      { kind: 'attack', value: 13, weight: 2, telegraph: '⚔ 13 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 5, count: 3, weight: 1, telegraph: '⚔ 5×3' },
      { kind: 'attack', value: 14, weight: 1, telegraph: '⚔ 14' },
    ] },
  { id: 'e3-boss-anvil', act: 2, name: 'The Anvil-Forged', composureMax: 78, hpMax: 75, tier: 'boss',
    // Cycle 4 batch 3: chutzpah 0.5 → 0.7. Lane was getting structurally
    // walled by 2/4 bosses resisting chutzpah at half damage. Still
    // jnsq-favored (1.5) — anvil prefers wild + improvised — but committed
    // chutzpah can swing.
    effectiveness: { chutzpah: 0.7, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    softSpot: 'logic', // Rule-bound smithcraft; argue the specification.
    insultVulnerabilities: ['dismissive', 'petty', 'absurd'], // Rule-bound; absurdity unmoors them.
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1, telegraph: '⚔ 4×4' },
      { kind: 'block',  value: 12, weight: 1, telegraph: '🛡 12' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (hammer-rhythm)' },
    ] },

  // ===== ACT 4 — The Forge Path =====
  { id: 'e4-apprentice-shade', act: 3, name: "Apprentice's Shade", composureMax: 42, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 0.5, physical: 0.5 },
    softSpot: 'flattery', // Failed apprentice. Pretend the work was good.
    behaviors: [
      { kind: 'attack', value: 10, weight: 3, telegraph: '⚔ 10' },
      { kind: 'block',  value: 10, weight: 2, telegraph: '🛡 10' },
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 + ⛧ Weak 1 (resentful)', riders: { weak: 1 } },
    ] },
  { id: 'e4-failed-initiate', act: 3, name: 'Failed Initiate', composureMax: 38, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 0.5, jnsq: 1.0, physical: 1.0 },
    softSpot: 'flattery', // Same shape, fresher wound.
    behaviors: [
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, telegraph: '⚔ 4×4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1, telegraph: '⚔ 4×4' },
      { kind: 'weak',   value: 2, weight: 1, telegraph: '⛧ Weak 2' },
    ] },
  { id: 'e4-mirror-past', act: 3, name: 'Mirror of the Past', composureMax: 44, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 0.7, wit: 1.5, jnsq: 1.0, physical: 0.5 },
    softSpot: 'logic', // Reflects what you ARE. Reason at it, see yourself.
    behaviors: [
      { kind: 'attack', value: 12, weight: 2, telegraph: '⚔ 12 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'vulnerable', value: 2, weight: 2, telegraph: '🩸 Vuln 2' },
      { kind: 'block',  value: 8, weight: 1, telegraph: '🛡 8 + ⛧ Weak 1', riders: { weak: 1 } },
    ] },
  { id: 'e4-forgotten-master', act: 3, name: 'The Forgotten Master', composureMax: 55, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 0.7, wit: 1.0, jnsq: 1.5, physical: 0.5 },
    softSpot: 'flattery', // Forgotten = wants to be remembered. Name him.
    behaviors: [
      { kind: 'attack', value: 12, weight: 2, telegraph: '⚔ 12 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, telegraph: '⚔ 4×4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1, telegraph: '🎭 5 (corrects your form)' },
    ] },
  { id: 'e4-test-wraith', act: 3, name: 'The Test Wraith', composureMax: 50, hpMax: 999, tier: 'elite',
    // Cycle 3 floor bump: wit 0 → 0.5. Still wit-resistant (jnsq 1.5 is the
    // intended channel) but committed wit decks have a path.
    effectiveness: { chutzpah: 1.0, wit: 0.5, jnsq: 1.5, physical: 0.5 },
    softSpot: 'logic', // It IS a test. Show your work.
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11 + ⛧ Weak 1 + 🩸 Vuln 1', riders: { weak: 1, vulnerable: 1 } },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (impossible question)' },
      { kind: 'weak',   value: 2, weight: 1, telegraph: '⛧ Weak 2' },
      { kind: 'attack-multi', value: 3, count: 4, weight: 1, telegraph: '⚔ 3×4' },
    ] },
  { id: 'e4-boss-headmasters-hat', act: 3, name: "The Headmaster's Hat", composureMax: 88, hpMax: 999, tier: 'boss',
    // Cycle 3 floor bump: physical 0 → 0.4. Still verbal-favored (wit 1.5)
    // but physical-built decks aren't shut out entirely.
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.5, physical: 0.4 },
    softSpot: 'flattery', // It is a HAT that wants to be the headmaster. Acknowledge that.
    insultVulnerabilities: ['dismissive', 'petty', 'absurd'], // Vain authority; mocking the hat-ness lands.
    behaviors: [
      { kind: 'attack', value: 12, weight: 2, telegraph: '⚔ 12' },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, telegraph: '⚔ 4×4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 8, pool: 'composure', weight: 1, telegraph: '🎭 8 (withering remark)' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🩸 Vuln 2' },
    ] },

  // ===== TUTORIAL =====
  // Low-stakes practice partner. All-baseline effectiveness so the
  // player sees clean numbers. Light incoming damage so they learn
  // Block without ever being in danger.
  // ===== SIDEQUEST ENEMIES — gated by sidequest combat nodes =====
  { id: 'sq-critical-apparition', act: 0, name: 'Prof. Augustus Hewn-Greaves (deceased, 1893)', composureMax: 60, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.5, physical: 0 },
    softSpot: 'logic',
    insultVulnerabilities: ['dismissive', 'absurd'], // Pedant; absurdity destabilizes him most.
    behaviors: [
      { kind: 'attack', value: 8, pool: 'composure', weight: 2, telegraph: '🎭 8 (citing 1894 paper)', riders: { vulnerable: 1 } },
      { kind: 'attack', value: 6, pool: 'composure', weight: 2, telegraph: '🎭 6 (clearing throat audibly)' },
      { kind: 'weak', value: 1, weight: 2, telegraph: '⛧ Weak 1 (sighs at your argument)' },
      { kind: 'block', value: 12, weight: 1, telegraph: '🛡 12 (citing himself)' },
    ] },

  { id: 'tutorial-bursar', act: 0, name: 'The Bursar (Practice Match)', composureMax: 24, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    softSpot: 'logic',
    behaviors: [
      { kind: 'attack', value: 3, weight: 2, telegraph: '⚔ 3 (gentle)' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
    ] },
];
const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

// Equipment per slot with full tier ladders. `bonus` keys are read by the
// combat loop at appropriate hooks (start-of-combat, damage calc, etc.).
// Equipment data — placeholder Master-tier entries used by the
// current boss-grant flow. These exist as stat-stick fallbacks while
// the new crafting system is being built; once Commit 3 lands the
// boss flow routes through the crafting screen instead and these
// entries are reduced to "if the player skipped everything" defaults.
// `gem` data is kept as an orphan reference (no act maps to it).
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
  ring: {
    basic:  { id: 'eq-ring-basic',   name: 'Apprentice Ring',   bonus: { extraStartHand: 1 }, desc: 'Draw 1 extra card on turn 1.' },
    fine:   { id: 'eq-ring-fine',    name: 'Journeyman Ring',   bonus: { energyOnCombatStart: 1 }, desc: '+1 Energy on turn 1 of every combat.' },
    master: { id: 'eq-ring-master',  name: 'Master Ring',       bonus: { permanentEnergyBonus: 1 }, desc: '+1 Energy every turn (permanent).' },
  },
  hat: {
    basic:  { id: 'eq-hat-basic',    name: 'Apprentice Cap',    bonus: { extraStartHand: 1 }, desc: 'Draw 1 extra card on turn 1.' },
    fine:   { id: 'eq-hat-fine',     name: 'Journeyman Hat',    bonus: { healOnCombatStart: 2 }, desc: 'Heal 2 HP at start of every combat.' },
    master: { id: 'eq-hat-master',   name: 'Master Hat',        bonus: { healOnCombatStart: 4, extraStartHand: 1 }, desc: 'Heal 4 HP and draw +1 on turn 1 of every combat.' },
  },
  // Orphan — the gem slot was retired in favour of ring/hat. Data kept
  // for possible future reuse (alternate equipment paths, etc.).
  gem: {
    basic:  { id: 'eq-gem-basic',    name: 'Rough Gem',         bonus: { maxHp: 8 }, desc: '+8 max HP.' },
    fine:   { id: 'eq-gem-fine',     name: 'Cut Gem',           bonus: { maxHp: 15 }, desc: '+15 max HP.' },
    master: { id: 'eq-gem-master',   name: 'Master Gem',        bonus: { maxHp: 20, healOnCombatStart: 3 }, desc: '+20 max HP. Heal 3 HP at start of every combat.' },
  },
};

// Events. `effects` keys handled by resolveEventChoice.
// Severity pass: every upside option carries a real, often-permanent cost
// (max HP loss, big HP scratch, a random card culled from the deck). The
// "walk away" option is intentionally a pittance or nothing — its value is
// situational. When you're already at 8 HP, "decline" IS the play.
const EVENTS = [
  {
    id: 'ev-old-tome',
    title: 'An Old Tome',
    flavor: 'A leather-bound book lies open on a rock. The page reads, in fading copperplate: BORROWED — RETURN BY THE EQUINOX OR FACE THE STACK CRONE. There is no further explanation, which is somehow more concerning.',
    choices: [
      { label: 'Read on. The pages bite back. (gain a Rare card, -2 max HP)', effects: { gainRareCard: 1, maxHp: -2 } },
      { label: 'Tear a page out. Pocket it. (gain a Common card, -5 HP)', effects: { gainCommonCard: 1, loseHp: 5 } },
      { label: 'Pretend you saw nothing.', effects: {} },
    ],
  },
  {
    id: 'ev-spring',
    title: 'Quiet Spring',
    flavor: 'A small spring bubbles between two stones. The water is cold, clear, and almost certainly not deliberately enchanted.',
    choices: [
      { label: 'Drink to the last drop. (heal to full, -3 max HP)', effects: { healFull: true, maxHp: -3 } },
      { label: 'Fill a flask. The flask leaks something else. (+8 HP, lose a random card)', effects: { heal: 8, loseRandomCard: true } },
      { label: 'Leave it for the next traveller.', effects: {} },
    ],
  },
  {
    id: 'ev-stranger',
    title: 'The Stranger',
    flavor: 'A figure in slightly-too-grey robes waits at a fork in the path. They produce a card from a satchel with the air of someone who has rehearsed this. Twice.',
    choices: [
      { label: 'Accept the card. The price is small, until it isn\'t. (gain Uncommon, -6 HP)', effects: { gainUncommonCard: 1, loseHp: 6 } },
      { label: 'Bargain hard. They take it out of your bones. (gain Rare, -3 max HP)', effects: { gainRareCard: 1, maxHp: -3 } },
      { label: 'Refuse politely. They expected this.', effects: {} },
    ],
  },
  {
    id: 'ev-shrine',
    title: 'Roadside Shrine',
    flavor: 'A weathered stone shrine to no god in particular. The donations bowl has been emptied recently. The donations bowl is, you suspect, emptied daily.',
    choices: [
      { label: 'Pray sincerely. The god takes a memory. (heal 10, lose a random card)', effects: { heal: 10, loseRandomCard: true } },
      { label: 'Pray sarcastically. The god is petty AND powerful. (+5 max HP, -12 HP)', effects: { maxHp: 5, loseHp: 12 } },
      { label: 'Walk on without looking.', effects: {} },
    ],
  },
  {
    id: 'ev-snake',
    title: 'Coiled Adder',
    flavor: 'A small green snake watches you pass. Its eyes are bright, deliberate, and noticeably more focused than yours have been all morning.',
    choices: [
      { label: 'Pick it up. It teaches you the hard way. (gain Rare, -8 HP)', effects: { gainRareCard: 1, loseHp: 8 } },
      { label: 'Offer it a crumb. It remembers your face. (gain Common, -1 max HP)', effects: { gainCommonCard: 1, maxHp: -1 } },
      { label: 'Step around it, politely.', effects: {} },
    ],
  },
  {
    id: 'ev-mirror',
    title: 'A Shard of Mirror',
    flavor: 'A piece of broken mirror, propped against a stump. The version of you in the glass is harder around the eyes. They are not exactly your eyes. You are pretty sure.',
    choices: [
      { label: 'Study it. The reflection takes your name. (gain Uncommon, lose a random card)', effects: { gainUncommonCard: 1, loseRandomCard: true } },
      { label: 'Break it further. The breaking shatters something else. (+6 max HP, -13 HP)', effects: { maxHp: 6, loseHp: 13 } },
      { label: 'Leave the shard. Leave quickly.', effects: {} },
    ],
  },
  {
    id: 'ev-pilgrim',
    title: 'Pilgrim on the Path',
    flavor: 'An old pilgrim sets out half a meal between you. "Eat," they say, "the path is longer than you think. Everybody\'s path is longer than they think. That\'s the trick of paths."',
    choices: [
      { label: 'Eat. The road takes back what it gives. (heal to full, -3 max HP)', effects: { healFull: true, maxHp: -3 } },
      { label: 'Trade words. The pilgrim\'s wisdom cuts. (gain Uncommon, -6 HP)', effects: { gainUncommonCard: 1, loseHp: 6 } },
      { label: 'Decline politely and continue.', effects: {} },
    ],
  },
  {
    id: 'ev-vow',
    title: 'A Vow Offered',
    flavor: 'A stone altar, carved with a single grand line: STRENGTH FOR STILLNESS. Beneath it, in much smaller letters: TERMS APPLY. CONSULT THE STELE.',
    choices: [
      { label: 'Take the full vow. (gain Rare, +7 max HP, -15 HP, lose a random card)', effects: { gainRareCard: 1, maxHp: 7, loseHp: 15, loseRandomCard: true } },
      { label: 'Read the small print, decline most. (gain Common, -2 max HP)', effects: { gainCommonCard: 1, maxHp: -2 } },
      { label: 'Walk away. The altar is unmoved.', effects: {} },
    ],
  },
];

// =============================================================================
// SIDEQUESTS — 4-7 node arcs the player can be pulled into off the main map.
// Triggered from the Town node (first arrival, one per act). Each has a list
// of `nodes`, each node either a `choice` (modal with options), a `combat`
// (enemy fight that routes back to next node on win), `narrative` (terse
// scene with one continue), or `boss` (transitions directly to act boss).
// Approximately 40% have `canAbandon: true` on a middle node, letting the
// player bail without finishing. Boss-shortcut quests CANNOT be abandoned.
// =============================================================================
const SIDEQUEST_TEMPLATES = {
  'sq-hot-mess': { id: 'sq-hot-mess', title: 'Citation Needed', act: 1,
    intro: 'A woman by the road, surrounded by floating paper arranged in defensive APA formation.',
    nodes: [
      { kind: 'choice', title: 'The Encounter',
        flavor: 'Persimmon "Sim" Quill is openly distressed. As you speak, a transparent man in a tweed jacket manifests and corrects your pronunciation of her name.',
        choices: [
          { label: 'Girl, I LIVE for drama.', effects: { loseHp: 4 } },
          { label: 'I\'m more than involved, and I\'m ready to be part of the problem.', effects: { loseHp: 4 } },
          { label: 'Whoever has you like this doesn\'t deserve you. You\'re too amazing for this. Remind me your name?', effects: { loseHp: 4 } },
        ] },
      { kind: 'choice', title: 'The Library That Reorders Itself',
        flavor: 'The library rearranges itself alphabetically every 30 seconds. The card catalog is screaming. You need Hewn-Greaves\'s 1893 notes.',
        choices: [
          { label: 'Search the stacks methodically. (-2 HP)', effects: { loseHp: 2 } },
          { label: 'Argue the library into submission. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Bribe the librarian. (lose a card)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'combat', enemyId: 'sq-critical-apparition',
        flavor: 'A small lecture hall has manifested in the middle of the road. Sim watches from the back, mouthing every counterargument a half-second after you make it.' },
      { kind: 'choice', title: 'The Compromise',
        flavor: 'Hewn-Greaves concedes one point. He proposes co-authorship. Sim is devastated. She has won and lost at the same time, which, as Hewn-Greaves notes, is an excellent thesis subject.',
        choices: [
          { label: 'The thesis is better for it. Take the deal.', effects: { gainCommonCard: 1 } },
          { label: 'He\'s wrong. Haunt him right back.', effects: { heal: 4 } },
          { label: 'Persimmon, you ARE the protagonist of your own life.', effects: { maxHp: 2, loseRandomCard: true } },
        ] },
    ] },

  'sq-jazz-cafe': { id: 'sq-jazz-cafe', title: 'A Small Cafe', act: 1,
    intro: 'You step out of a forest clearing onto a quiet Japanese street. A cafe is open, with only a few patrons inside.',
    nodes: [
      { kind: 'choice', title: 'The Cafe',
        flavor: 'Jazz drifts from a record player. The barista looks up, polite, waiting. Soft light. Wooden counter. Two patrons not looking up.',
        choices: [
          { label: 'Order a small drink. (+4 HP)', effects: { heal: 4 } },
          { label: 'Order a small meal. (+8 HP)', effects: { heal: 8 } },
          { label: 'Just sit. You\'re fine. (no heal)', effects: {} },
        ] },
      { kind: 'choice', title: 'The Cat',
        flavor: 'A cat at the next seat looks at you. Just looks. Patiently. It is, in some way you cannot articulate, asking a question.',
        choices: [
          { label: 'Look away. Finish your drink and leave.', effects: { endSpurEarly: true } },
          { label: 'Stare it down. (-5 HP, hold your nerve)', effects: { loseHp: 5 } },
        ] },
      { kind: 'narrative', title: 'The Man at the Counter',
        flavor: '"I should explain," says a man at the counter, "the cat is not, technically, mine. I am responsible for it. I am sorry for the bother. It is, regrettably, a life-stealing cat. You did well not to look away first."',
        next: { effects: {} } },
      { kind: 'narrative', title: 'About the Man',
        flavor: '"My life has been complicated. My right arm, you see, is actually my left arm. My left, my right. They look correct. They are not. I learned the guitar by mounting a left-handed neck on a right-handed body and tuning each peg the wrong direction. Allow me to play you a song."',
        next: { effects: {} } },
      { kind: 'narrative', title: 'Timber from Norway',
        flavor: 'He plays a song called Timber from Norway. It is beautiful in a way that suggests it should not be. As he leaves, he asks one thing of you — a postcard, every five nodes, with one specific five-word phrase written on it, blank otherwise. He will know if you forget. He gives you the phrase.',
        next: { effects: { grantPostcardPhrase: true } } },
    ] },

  'sq-goose': { id: 'sq-goose', title: 'The Goose', act: 1,
    intro: 'A villager weeps. Her prize goose has gone missing. The goose, you suspect, had opinions.',
    nodes: [
      { kind: 'choice', title: 'Margie\'s Plea',
        flavor: 'Margie Tellwright clutches a small empty wicker pen. The goose, named Constance, is by goose standards exceptional.',
        choices: [
          { label: 'I\'ll find her.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Chase',
        flavor: 'Constance is fast and has political opinions. She does not want to come back.',
        choices: [
          { label: 'Corner her. (-4 HP from goose bite)', effects: { loseHp: 4 } },
          { label: 'Reason with her. (she finds you condescending; lose a card)', effects: { loseRandomCard: true } },
          { label: 'Feed her bread. (lose Common card representing the bread)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'choice', title: 'The Return',
        flavor: 'Constance refuses to return unless you tell Margie she is, in fact, not a prize goose. Just a goose.',
        choices: [
          { label: 'Tell Margie the truth.', effects: { maxHp: 2 } },
          { label: 'Lie. Say Constance forgave her.', effects: { loseHp: 4 } },
          { label: 'Leave Constance somewhere quiet.', effects: { gainCommonCard: 1 } },
        ] },
    ] },

  'sq-cursed-letter': { id: 'sq-cursed-letter', title: 'The Cursed Letter', act: 2,
    intro: 'A courier hands you a sealed envelope. He apologises before you accept it.',
    nodes: [
      { kind: 'choice', title: 'Yves the Courier',
        flavor: 'Yves Marrow says: don\'t read it. Definitely don\'t read it. Then he runs.',
        choices: [
          { label: 'Take the letter.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Walk', canAbandon: true,
        flavor: 'The letter starts whispering. The whispers escalate.',
        choices: [
          { label: 'Suppress the whispers. (-3 HP)', effects: { loseHp: 3 } },
          { label: 'Open the letter. (lose a card to the curse)', effects: { loseRandomCard: true } },
          { label: 'Bury the letter. (-1 max HP, the ground complains)', effects: { maxHp: -1 } },
        ] },
      { kind: 'choice', title: 'The Fiancée',
        flavor: 'She takes the letter without reading it. She files it. She invites you in for terrible tea. The letter was technically a wedding invitation, but she was already engaged to someone else.',
        choices: [
          { label: 'Accept the tea graciously.', effects: { maxHp: 2 } },
          { label: 'Accept the unused engagement gift.', effects: { gainUncommonCard: 1 } },
        ] },
    ] },

  'sq-last-will-sneeze': { id: 'sq-last-will-sneeze', title: 'The Last Will of a Sneeze', act: 4,
    intro: 'A thin man in a suit is representing a sneeze. The sneeze is forty years old. The sneeze has assets.',
    nodes: [
      { kind: 'choice', title: 'The Hearing',
        flavor: 'You witness a divorce between an elderly Sneeze and an elderly Cough. You choose which keeps the property.',
        choices: [
          { label: 'Side with the Sneeze. (Cough curses you)', effects: { loseHp: 3 } },
          { label: 'Side with the Cough. (Sneeze curses you)', effects: { loseHp: 3 } },
        ] },
      { kind: 'choice', title: 'The Aftermath',
        flavor: 'The loser sues you. The winner blesses you.',
        choices: [
          { label: 'Pay the legal fees. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Pay the legal fees the other way. (-2 max HP)', effects: { maxHp: -2 } },
        ] },
    ] },

  'sq-wishful-beggar': { id: 'sq-wishful-beggar', title: 'The Wishful Beggar', act: 3,
    intro: 'An old woman on a milestone. She wishes for nothing in particular. She asks for the same.',
    nodes: [
      { kind: 'choice', title: 'The Search',
        flavor: 'Old Penny wants, specifically, nothing in particular. Acquiring this is harder than expected.',
        choices: [
          { label: 'Pay a vendor for empty air. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Consult a metaphysicist. (-1 max HP from confusion)', effects: { maxHp: -1 } },
          { label: 'Steal an empty pocket from a pickpocket. (-3 HP)', effects: { loseHp: 3 } },
        ] },
      { kind: 'choice', title: 'The Gift',
        flavor: 'Penny accepts the nothing. She blesses you. The blessing has a shape.',
        choices: [
          { label: 'Receive the blessing.', effects: { heal: 3 } },
        ] },
    ] },

  'sq-twins': { id: 'sq-twins', title: 'The Twins', act: 1,
    intro: 'Twin sisters insist the other is impersonating them. Both are impersonating each other.',
    nodes: [
      { kind: 'choice', title: 'Vera & Vere',
        flavor: 'They speak over each other. They finish each other\'s sentences. Both look hopeful at you.',
        choices: [
          { label: 'I\'ll help.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Test', canAbandon: true,
        flavor: 'Each gives "proof of identity." Vera\'s is a childhood scar. Vere\'s is the same scar in the same place.',
        choices: [
          { label: 'Trust Vera.', effects: {} },
          { label: 'Trust Vere.', effects: {} },
        ] },
      { kind: 'combat', enemyId: 'e2-pattern-maker',
        flavor: 'You arrive at an empty room. They were colluding. The pattern-maker steps out from behind a curtain.' },
      { kind: 'choice', title: 'Aftermath',
        flavor: 'You saw the pattern eventually.',
        choices: [
          { label: 'Take the reward.', effects: { maxHp: 1, gainCommonCard: 1 } },
        ] },
    ] },

  'sq-bridge-toll': { id: 'sq-bridge-toll', title: 'The Bridge Toll', act: 2,
    intro: 'A small troll under a bridge. He wants three reasons. He won\'t say what for.',
    nodes: [
      { kind: 'choice', title: 'Karst Underbridge',
        flavor: 'Karst is polite but firm. Three reasons. Doesn\'t matter what for. Choose three.',
        choices: [
          { label: 'A truth, a joke, and a confession.', effects: { loseRandomCard: true, heal: 2, loseHp: 3, maxHp: 1 } },
          { label: 'A lie, a lie, and another lie.', effects: { loseHp: 6 } },
          { label: 'Three philosophical observations.', effects: {} },
        ] },
      { kind: 'narrative', title: 'The Crossing',
        flavor: 'Karst writes all three down in a small notebook. He steps aside. He had no purpose for them. He\'s a collector.',
        next: { effects: { gainCommonCard: 1 } } },
    ] },

  'sq-inheriting-spider': { id: 'sq-inheriting-spider', title: 'The Inheriting Spider', act: 3,
    intro: 'A spider has been named sole heir to a small fortune. Multiple humans are contesting in court.',
    nodes: [
      { kind: 'choice', title: 'Hortensia',
        flavor: 'A lawyer informs you Hortensia (a spider) needs character witnesses. She is medium-sized and weaving aggressively.',
        choices: [
          { label: 'I\'ll testify.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Court', canAbandon: true,
        flavor: 'You\'re sworn in. Hortensia is on your shoulder. The humans glare.',
        choices: [
          { label: 'Testify for Hortensia. (the humans blacklist you; lose a card)', effects: { loseRandomCard: true } },
          { label: 'Testify against. (Hortensia attacks you)', effects: { loseHp: 4 } },
          { label: 'Recuse yourself. (-1 max HP from court contempt)', effects: { maxHp: -1 } },
        ] },
      { kind: 'choice', title: 'The Verdict',
        flavor: 'Hortensia wins regardless — the will was airtight. She bequeaths you a small token.',
        choices: [
          { label: 'Accept the token.', effects: { gainCommonCard: 1 } },
          { label: 'Decline. Accept her good opinion instead.', effects: { heal: 3 } },
        ] },
    ] },

  'sq-postmaster-daughter': { id: 'sq-postmaster-daughter', title: 'The Postmaster\'s Daughter', act: 3,
    intro: 'Aurelia Tipp weeps onto a map. The map is technically excellent. It charts her affections.',
    nodes: [
      { kind: 'choice', title: 'The Map',
        flavor: 'Aurelia is in love with three cartographers. They cooperate professionally and compete romantically.',
        choices: [
          { label: 'I\'ll mediate.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Cartographers', canAbandon: true,
        flavor: 'All three insist Aurelia loves them most. They have, between them, drawn 47 versions of her smile.',
        choices: [
          { label: 'Pick one for her. (the others war; -2 HP)', effects: { loseHp: 2 } },
          { label: 'Tell them they share a delusion. (they start mapping your face; lose a card)', effects: { loseRandomCard: true } },
          { label: 'Destroy the map. (-4 HP from her grief, +1 max HP from doing right)', effects: { loseHp: 4, maxHp: 1 } },
        ] },
      { kind: 'narrative', title: 'The Resolution',
        flavor: 'Aurelia chooses none of them. She moves to a coastal town and becomes a hermit. Six weeks later, you receive a postcard.',
        next: { effects: { heal: 2, gainCommonCard: 1 } } },
    ] },

  'sq-modest-favor': { id: 'sq-modest-favor', title: 'A Modest Favor', act: 1,
    intro: 'Apothecary Webb needs "modest" ingredients. The "modest" is a lie. He won\'t tell you what for.',
    nodes: [
      { kind: 'choice', title: 'The List',
        flavor: 'Salt from a sea that doesn\'t exist anymore. A leaf from a tree that grows backwards. The breath of a sleeping cat. Webb hands you the list with a kind smile.',
        choices: [
          { label: 'I\'ll fetch them.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Salt', canAbandon: true,
        flavor: 'A memory-merchant has the salt. He wants something in trade.',
        choices: [
          { label: 'Trade a card.', effects: { loseRandomCard: true } },
          { label: 'Trade a memory. (-3 HP from the absence)', effects: { loseHp: 3 } },
        ] },
      { kind: 'combat', enemyId: 'e1-thicket',
        flavor: 'The backwards-tree has a small protector spirit. It objects to leaf-gathering.' },
      { kind: 'choice', title: 'The Cat',
        flavor: 'The cat sleeps on Webb\'s rug. One breath is enough. Don\'t wake the cat.',
        choices: [
          { label: 'Perform an elaborate hush. (-1 max HP from concentration)', effects: { maxHp: -1 } },
          { label: 'Wake the cat anyway. (-3 HP)', effects: { loseHp: 3 } },
        ] },
      { kind: 'narrative', title: 'The Brew',
        flavor: 'Webb brews tea. He drinks it. He becomes mildly enlightened for twenty minutes. He thanks you absently.',
        next: { effects: { maxHp: 2, gainUncommonCard: 1 } } },
    ] },

  'sq-quiet-village': { id: 'sq-quiet-village', title: 'The Quiet Village', act: 2,
    intro: 'The villagers of Greyhollow welcome you. They smile. They do not blink.',
    nodes: [
      { kind: 'narrative', title: 'Welcome',
        flavor: 'A child whispers something in a language that hasn\'t existed for 400 years.',
        next: { effects: { loseHp: 2 } } },
      { kind: 'narrative', title: 'The Empty House',
        flavor: 'You find an empty house with all the doors locked from the inside.',
        next: { effects: { loseHp: 2 } } },
      { kind: 'combat', enemyId: 'e2-pattern-maker',
        flavor: 'Whatever the village has been hosting steps into the road. It is composed mostly of polite expectation.' },
      { kind: 'narrative', title: 'Departure',
        flavor: 'The village resumes blinking. You leave with the strange feeling you were the polite one all along.',
        next: { effects: { maxHp: 2, heal: 4 } } },
    ] },

  'sq-lost-familiar': { id: 'sq-lost-familiar', title: 'The Lost Familiar', act: 2,
    intro: 'A senior wizard\'s familiar has gone feral. The familiar has filed paperwork.',
    nodes: [
      { kind: 'choice', title: 'Master Penrith',
        flavor: 'Penrith explains. Lord Buttons has formally severed his contract. Paperwork is in triplicate.',
        choices: [
          { label: 'I\'ll find him.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Tavern',
        flavor: 'Lord Buttons is drinking. Drunken cats are unreasonable.',
        choices: [
          { label: 'Reason with him. (-2 HP)', effects: { loseHp: 2 } },
          { label: 'Match him drink for drink. (-1 max HP, earn his respect)', effects: { maxHp: -1 } },
          { label: 'Hire a feline translator. (lose a card)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'choice', title: 'The Hearing',
        flavor: 'Lord Buttons demands a show of good faith.',
        choices: [
          { label: 'Bring him an offering. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Give him your name as a curse-word.', effects: {} },
          { label: 'Offer him a personal vow. (lose a card)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'narrative', title: 'Reconciliation',
        flavor: 'Lord Buttons rescinds his paperwork. Penrith is grateful.',
        next: { effects: { gainUncommonCard: 1 } } },
    ] },

  'sq-schoolhouse': { id: 'sq-schoolhouse', title: 'The Schoolhouse', act: 1,
    intro: 'A schoolhouse has become sentient. It has begun grading everyone who walks past.',
    nodes: [
      { kind: 'narrative', title: 'The C-',
        flavor: 'A passing villager has been given a C-. They are inconsolable.',
        next: { effects: {} } },
      { kind: 'choice', title: 'Inside', canAbandon: true,
        flavor: 'The schoolhouse grades your entrance. It assigns you a B+. The grade is real and slightly demoralizing.',
        choices: [
          { label: 'Reason with it. (-2 HP from being marked down)', effects: { loseHp: 2 } },
          { label: 'Threaten the school board. (-1 max HP)', effects: { maxHp: -1 } },
          { label: 'Compliment its rigor. (+2 HP)', effects: { heal: 2 } },
        ] },
      { kind: 'narrative', title: 'The Agreement',
        flavor: 'The schoolhouse agrees to grade only voluntarily. Your final grade: A-.',
        next: { effects: { gainCommonCard: 1 } } },
    ] },

  'sq-skeptical-ghost': { id: 'sq-skeptical-ghost', title: 'The Ghost That Doesn\'t Believe In Itself', act: 3,
    intro: 'A ghost, skeptical of ghosts on principle. He needs evidence he exists. From you.',
    nodes: [
      { kind: 'choice', title: 'Ezekiel Marsh',
        flavor: 'Ezekiel folds transparent arms. He requires demonstration.',
        choices: [
          { label: 'I\'ll try.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Demonstrations',
        flavor: 'Each piece of evidence Ezekiel rebuts.',
        choices: [
          { label: 'Walk through him. (he claims wide stance; -1 HP)', effects: { loseHp: 1 } },
          { label: 'Describe him. (he says you\'re imagining; lose a Wit card)', effects: { loseRandomCard: true } },
          { label: 'Get a third party. (the third party also can\'t see him; -2 HP)', effects: { loseHp: 2 } },
        ] },
      { kind: 'choice', title: 'The Counter',
        flavor: 'Ezekiel demands you prove the same about yourself. Each piece of evidence he rebuts.',
        choices: [
          { label: 'Concede the symmetry.', effects: {} },
        ] },
      { kind: 'narrative', title: 'Mutual Existence',
        flavor: 'You both agree you exist only in each other\'s presence. He becomes a small invisible companion for the rest of the act.',
        next: { effects: { maxHp: 1, heal: 3 } } },
    ] },

  'sq-returned-heir': { id: 'sq-returned-heir', title: 'The Returned Heir', act: 3,
    intro: 'Ferdinand Quenchwell, sole heir, declared dead, has returned. Multiple alternate heirs object.',
    nodes: [
      { kind: 'choice', title: 'Ferdinand',
        flavor: 'He needs witnesses to vouch he is, in fact, him. Three alternate heirs have stronger paperwork.',
        choices: [
          { label: 'I\'ll vouch.', effects: {} },
        ] },
      { kind: 'combat', enemyId: 'e3-quartz-sentinel', canAbandon: true,
        flavor: 'The family lawyer was paid by all four heirs. He objects to your involvement, professionally.' },
      { kind: 'choice', title: 'The Hearing',
        flavor: 'You give your testimony. The fake heir is now visibly nervous.',
        choices: [
          { label: 'Vouch for Ferdinand.', effects: { gainCommonCard: 1 } },
          { label: 'Reveal the fake. (-3 HP from magical backlash)', effects: { loseHp: 3, gainUncommonCard: 1 } },
          { label: 'Claim the estate yourself.', effects: { gainUncommonCard: 1, maxHp: -2 } },
        ] },
    ] },

  'sq-wedding-crash': { id: 'sq-wedding-crash', title: 'The Wedding Crash', act: 4,
    intro: 'Two families both believe they\'re hosting the same wedding. The bride doesn\'t exist.',
    nodes: [
      { kind: 'narrative', title: 'The Venue',
        flavor: 'Two wedding parties. Mutual confusion. The cake is also confused.',
        next: { effects: {} } },
      { kind: 'choice', title: 'The Bride', canAbandon: true,
        flavor: 'You locate her. She is a composite of paperwork and assumptions.',
        choices: [
          { label: 'Try to find the truth.', effects: {} },
        ] },
      { kind: 'combat', enemyId: 'e4-apprentice-shade',
        flavor: 'The first family\'s enforcer challenges you when you suggest the bride isn\'t real.' },
      { kind: 'combat', enemyId: 'e4-failed-initiate',
        flavor: 'The OTHER family\'s enforcer arrives. They thought you were with the first.' },
      { kind: 'narrative', title: 'The Resolution',
        flavor: 'Both families realize together. They marry each other\'s matriarchs. The cake is consumed in relief.',
        next: { effects: { maxHp: 3, gainUncommonCard: 1 } } },
    ] },

  'sq-apprentice-of-apprentice': { id: 'sq-apprentice-of-apprentice', title: 'The Apprentice\'s Apprentice', act: 4,
    intro: 'Master Doone\'s apprentice Yves was surpassed by his apprentice Coriander. Everyone is upset.',
    nodes: [
      { kind: 'choice', title: 'The Three',
        flavor: 'They speak over each other. They each demand you settle the matter.',
        choices: [
          { label: 'Fine. Three tests.', effects: {} },
        ] },
      { kind: 'choice', title: 'Doone\'s Test',
        flavor: 'Beat his old test (an old test, by old standards).',
        choices: [
          { label: 'Pay the study fee. Pass.', effects: { loseRandomCard: true } },
        ] },
      { kind: 'choice', title: 'Yves\'s Test',
        flavor: 'Beat the test he beat Doone with. A sloppy spell rebounds.',
        choices: [
          { label: 'Take the rebound. Pass.', effects: { loseHp: 2 } },
        ] },
      { kind: 'narrative', title: 'Coriander\'s Test',
        flavor: 'The test is unsolvable. You fail. She is delighted. She gives you a card in pity.',
        next: { effects: { loseHp: 3, gainCommonCard: 1 } } },
      { kind: 'narrative', title: 'A New Academy',
        flavor: 'They resolve to start a small academy where rank is decided by rock-paper-scissors. They thank you sincerely.',
        next: { effects: { maxHp: 2 } } },
    ] },

  'sq-drunk-oracle': { id: 'sq-drunk-oracle', title: 'The Drunk Oracle', act: 4,
    intro: 'Hannelore the Half-Seen has prophesied your death. By Tuesday. By a turnip.',
    nodes: [
      { kind: 'choice', title: 'The Prophecy',
        flavor: 'She is specific. She is also several drinks in.',
        choices: [
          { label: 'I should probably verify.', effects: {} },
        ] },
      { kind: 'choice', title: 'Verification',
        flavor: 'A second oracle says Wednesday. By a turnip. Somehow worse.',
        choices: [
          { label: 'Search for the turnip. (-1 HP existential dread)', effects: { loseHp: 1 } },
          { label: 'Buy Hannelore another drink. (lose a card; she retracts temporarily)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'combat', enemyId: 'e1-shrine-rat',
        flavor: 'A turnip-themed cult has heard about the prophecy. They want to help fulfill it.' },
      { kind: 'narrative', title: 'The Distraction',
        flavor: 'You confront the turnip. It is not the murderer. It was a distraction.',
        next: { effects: {} } },
      { kind: 'combat', enemyId: 'e3-vein-devourer',
        flavor: 'A vegetable seller, wronged in Act 1 (offstage), finds you. He has been preparing.' },
      { kind: 'narrative', title: 'Averted',
        flavor: 'You survive. Tuesday passes. Hannelore later claims she meant a metaphorical turnip.',
        next: { effects: { maxHp: 3, gainUncommonCard: 1 } } },
    ] },

  'sq-unfinished-symphony': { id: 'sq-unfinished-symphony', title: 'The Unfinished Symphony', act: 4, bossShortcut: true,
    intro: 'Maestro Calvert Ainsworth\'s masterwork has been declared unfinishable. He wants the critic killed. The critic is, frankly, correct.',
    nodes: [
      { kind: 'choice', title: 'The Score',
        flavor: 'Ainsworth shows you the score. It\'s beautiful and broken. He needs help.',
        choices: [
          { label: 'I\'ll talk to her.', effects: {} },
        ] },
      { kind: 'narrative', title: 'The Thicket',
        flavor: 'A spirit guards the path to the critic\'s residence and insists on payment.',
        next: { effects: { loseRandomCard: true } } },
      { kind: 'combat', enemyId: 'sq-critical-apparition',
        flavor: 'The critic. Brutal. Accurate. Slightly bored.' },
      { kind: 'choice', title: 'The Revision',
        flavor: 'She concedes one paragraph. Bring it to Ainsworth.',
        choices: [
          { label: 'Bring the revision.', effects: { gainCommonCard: 1 } },
        ] },
      { kind: 'narrative', title: 'The Boss Approaches',
        flavor: 'Ainsworth revises. The symphony is now finishable. The act boss, observing all this, takes interest. The symphony, you realize, is what summoned them.',
        next: { effects: {} } },
      { kind: 'boss',
        flavor: 'Ainsworth has placed you in the boss\'s path. He\'s deeply apologetic.' },
    ] },

  'sq-borrowed-death': { id: 'sq-borrowed-death', title: 'The Borrowed Death', act: 4, bossShortcut: true,
    intro: 'Death, polite and slightly annoyed. Someone borrowed his scythe and hasn\'t returned it.',
    nodes: [
      { kind: 'choice', title: 'Death\'s Apology',
        flavor: 'He apologises for the inconvenience. The thief, he believes, is in this act.',
        choices: [
          { label: 'I\'ll find them.', effects: {} },
        ] },
      { kind: 'narrative', title: 'The Witness',
        flavor: 'A villager remembers a direction. Interview fatigue settles in.',
        next: { effects: { loseHp: 2 } } },
      { kind: 'combat', enemyId: 'e3-quartz-sentinel',
        flavor: 'A figure who tried the scythe and is now stuck to it. They cannot let go. They are not glad to see you.' },
      { kind: 'choice', title: 'The Child',
        flavor: 'A child saw the thief. They want payment first.',
        choices: [
          { label: 'Pay. (lose a card)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'narrative', title: 'The Cuts',
        flavor: 'A cut in a hedge. A cut in a sentence. A cut in your memory of the act.',
        next: { effects: { loseRandomCard: true } } },
      { kind: 'combat', enemyId: 'e4-forgotten-master',
        flavor: 'The thief. Using the scythe inexpertly. Cannot use it well. Cannot stop.' },
      { kind: 'boss',
        flavor: 'Death thanks you. He mentions, casually, that he was on his way to a specific appointment. The appointment was the act boss. He offers you a lift.' },
    ] },

  'sq-lovers-quarrel': { id: 'sq-lovers-quarrel', title: 'The Lover\'s Quarrel', act: 4,
    intro: 'Two gods are having a domestic. You\'ve been called in to referee. Gods are not allowed to mediate other gods.',
    nodes: [
      { kind: 'choice', title: 'The Two Gods',
        flavor: 'Auron of Hearths. Mehir of Doorways. Both very tall. Both very upset. Both very specific.',
        choices: [
          { label: 'Hear them out.', effects: {} },
        ] },
      { kind: 'narrative', title: 'Auron',
        flavor: 'He serves you divine tea. You aren\'t supposed to drink that.',
        next: { effects: { maxHp: -1 } } },
      { kind: 'narrative', title: 'Mehir', canAbandon: true,
        flavor: 'He has slides. The deck is twelve hundred years old and somewhat luminous.',
        next: { effects: { loseHp: 2 } } },
      { kind: 'narrative', title: 'The Investigation',
        flavor: 'A missing key. A misplaced welcome mat. A third party who left town.',
        next: { effects: {} } },
      { kind: 'choice', title: 'The God of Vestibules',
        flavor: 'He\'s hiding in a closet.',
        choices: [
          { label: 'Bribe him out. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Break the closet door. (-3 HP)', effects: { loseHp: 3 } },
          { label: 'Perform an elaborate hush. (-1 max HP)', effects: { maxHp: -1 } },
        ] },
      { kind: 'choice', title: 'The Mediation',
        flavor: 'You must make a binding judgment. Each god will dissatisfy two others.',
        choices: [
          { label: 'Side with Auron.', effects: { gainCommonCard: 1 } },
          { label: 'Side with Mehir.', effects: { gainCommonCard: 1 } },
          { label: 'Suggest the god of vestibules is the real victim.', effects: { maxHp: 3 } },
        ] },
      { kind: 'narrative', title: 'Departure',
        flavor: 'You leave before they notice. You witnessed a divine domestic and survived.',
        next: { effects: { gainCommonCard: 1 } } },
    ] },
};

// =============================================================================
// INSULT WORD POOLS — used by insult-type effect cards. On cast, the
// player picks one noun, one verb, one adjective (3 choices each, 4s
// timer per pick). Each word has pre-classified `tags`. Alignment
// against the enemy's `insultVulnerabilities` decides outcome:
//   ≥50% tag-match → LAND (heavy composure damage to enemy)
//   25-49%         → UNFAZE (player loses base composure cost only)
//   <25%           → BACKFIRE (enemy retorts — extra composure damage)
// =============================================================================
const INSULT_NOUNS = [
  // dismissive cluster (32)
  { word: 'wretch',          tags: ['dismissive'] },
  { word: 'bore',            tags: ['dismissive', 'petty'] },
  { word: 'mediocrity',      tags: ['dismissive'] },
  { word: 'nonentity',       tags: ['dismissive'] },
  { word: 'mistake',         tags: ['dismissive', 'petty'] },
  { word: 'embarrassment',   tags: ['dismissive', 'petty'] },
  { word: 'fool',            tags: ['dismissive'] },
  { word: 'simpleton',       tags: ['dismissive'] },
  { word: 'footnote',        tags: ['dismissive', 'academic'] },
  { word: 'asterisk',        tags: ['dismissive', 'academic'] },
  { word: 'typo',            tags: ['dismissive', 'absurd'] },
  { word: 'amateur',         tags: ['dismissive'] },
  { word: 'trainee',         tags: ['dismissive'] },
  { word: 'pretender',       tags: ['dismissive', 'sarcastic'] },
  { word: 'impostor',        tags: ['dismissive', 'threatening'] },
  { word: 'understudy',      tags: ['dismissive', 'petty'] },
  { word: 'afterthought',    tags: ['dismissive'] },
  { word: 'preliminary',     tags: ['dismissive', 'formal'] },
  { word: 'rough draft',     tags: ['dismissive'] },
  { word: 'rehearsal',       tags: ['dismissive'] },
  { word: 'shrug',           tags: ['dismissive'] },
  { word: 'parenthetical',   tags: ['dismissive', 'academic'] },
  { word: 'placeholder',     tags: ['dismissive'] },
  { word: 'first attempt',   tags: ['dismissive'] },
  { word: 'second-rater',    tags: ['dismissive', 'petty'] },
  { word: 'also-ran',        tags: ['dismissive'] },
  { word: 'runner-up',       tags: ['dismissive', 'sarcastic'] },
  { word: 'pamphlet',        tags: ['dismissive', 'petty'] },
  { word: 'leaflet',         tags: ['dismissive', 'petty'] },
  { word: 'memo',            tags: ['dismissive', 'formal'] },
  { word: 'footrest',        tags: ['dismissive', 'absurd'] },
  { word: 'doormat',         tags: ['dismissive', 'petty'] },
  // petty cluster (28)
  { word: 'crumb',           tags: ['petty'] },
  { word: 'flake',           tags: ['petty', 'absurd'] },
  { word: 'wisp',            tags: ['petty'] },
  { word: 'smudge',          tags: ['petty', 'absurd'] },
  { word: 'speck',           tags: ['petty'] },
  { word: 'mite',            tags: ['petty'] },
  { word: 'snippet',         tags: ['petty'] },
  { word: 'scrap',           tags: ['petty'] },
  { word: 'trifle',          tags: ['petty'] },
  { word: 'nibble',          tags: ['petty', 'absurd'] },
  { word: 'morsel',          tags: ['petty'] },
  { word: 'side dish',       tags: ['petty', 'absurd'] },
  { word: 'hanger-on',       tags: ['petty', 'dismissive'] },
  { word: 'accessory',       tags: ['petty'] },
  { word: 'tagalong',        tags: ['petty', 'dismissive'] },
  { word: 'junior',          tags: ['petty', 'dismissive'] },
  { word: 'second',          tags: ['petty'] },
  { word: 'third place',     tags: ['petty', 'sarcastic'] },
  { word: 'seat-warmer',     tags: ['petty', 'dismissive'] },
  { word: 'understudy',      tags: ['petty', 'dismissive'] },
  { word: 'sidekick',        tags: ['petty'] },
  { word: 'tagalong',        tags: ['petty'] },
  { word: 'penny ante',      tags: ['petty', 'dismissive'] },
  { word: 'cheap seat',      tags: ['petty'] },
  { word: 'bargain bin',     tags: ['petty', 'sarcastic'] },
  { word: 'discount cousin', tags: ['petty', 'absurd'] },
  { word: 'lukewarm tea',    tags: ['petty', 'absurd'] },
  { word: 'minor key',       tags: ['petty', 'sarcastic'] },
  // threatening cluster (18)
  { word: 'parasite',        tags: ['threatening', 'dismissive'] },
  { word: 'tumour',          tags: ['threatening'] },
  { word: 'infestation',     tags: ['threatening'] },
  { word: 'blight',          tags: ['threatening'] },
  { word: 'plague',          tags: ['threatening'] },
  { word: 'canker',          tags: ['threatening'] },
  { word: 'wound',           tags: ['threatening'] },
  { word: 'carrion',         tags: ['threatening'] },
  { word: 'liability',       tags: ['threatening', 'dismissive'] },
  { word: 'drain',           tags: ['threatening', 'dismissive'] },
  { word: 'burden',          tags: ['threatening', 'dismissive'] },
  { word: 'yoke',            tags: ['threatening', 'petty'] },
  { word: 'shackle',         tags: ['threatening'] },
  { word: 'menace',          tags: ['threatening', 'sarcastic'] },
  { word: 'predator',        tags: ['threatening'] },
  { word: 'leech',           tags: ['threatening', 'petty'] },
  { word: 'mosquito',        tags: ['threatening', 'petty'] },
  { word: 'tax-collector',   tags: ['threatening', 'formal'] },
  // booming cluster (12)
  { word: 'thunderhead',     tags: ['booming'] },
  { word: 'thundering twit', tags: ['booming', 'dismissive'] },
  { word: 'avalanche',       tags: ['booming'] },
  { word: 'tempest',         tags: ['booming'] },
  { word: 'cataclysm',       tags: ['booming', 'absurd'] },
  { word: 'bellow',          tags: ['booming'] },
  { word: 'roar',            tags: ['booming'] },
  { word: 'fanfare',         tags: ['booming', 'sarcastic'] },
  { word: 'thunderclap',     tags: ['booming'] },
  { word: 'gale',            tags: ['booming'] },
  { word: 'cannonade',       tags: ['booming', 'threatening'] },
  { word: 'klaxon',          tags: ['booming', 'absurd'] },
  // absurd cluster (50+)
  { word: 'cheese-cousin',   tags: ['absurd'] },
  { word: 'turnip',          tags: ['absurd', 'petty'] },
  { word: 'hat',             tags: ['absurd', 'dismissive'] },
  { word: 'compostable',     tags: ['absurd', 'dismissive'] },
  { word: 'small-clothes thief', tags: ['absurd', 'petty'] },
  { word: 'undercooked goose', tags: ['absurd', 'petty'] },
  { word: 'discount oracle', tags: ['absurd', 'sarcastic', 'mystical'] },
  { word: 'failed thesis',   tags: ['absurd', 'dismissive', 'academic'] },
  { word: 'badger-related incident', tags: ['absurd'] },
  { word: 'weekend lecture', tags: ['absurd', 'academic'] },
  { word: 'potato emergency', tags: ['absurd'] },
  { word: 'footnote with feelings', tags: ['absurd', 'academic'] },
  { word: 'spreadsheet of mistakes', tags: ['absurd', 'dismissive'] },
  { word: 'boiled biography',tags: ['absurd', 'academic'] },
  { word: 'parable about pickles', tags: ['absurd', 'mystical'] },
  { word: 'fermenting allegory', tags: ['absurd', 'academic'] },
  { word: 'carbohydrate enthusiast', tags: ['absurd'] },
  { word: 'minor cabbage',   tags: ['absurd', 'petty'] },
  { word: 'damp ledger',     tags: ['absurd', 'formal'] },
  { word: 'opinion-haver',   tags: ['absurd', 'dismissive'] },
  { word: 'small-shaped concept', tags: ['absurd', 'petty'] },
  { word: 'mid-sized regret',tags: ['absurd'] },
  { word: 'failed weather event', tags: ['absurd'] },
  { word: 'plural sneeze',   tags: ['absurd'] },
  { word: 'crustless metaphor', tags: ['absurd'] },
  { word: 'unfinished thank-you note', tags: ['absurd', 'formal'] },
  { word: 'enthusiastic mistake', tags: ['absurd', 'dismissive'] },
  { word: 'local nuisance',  tags: ['absurd', 'petty'] },
  { word: 'footnote-shaped person', tags: ['absurd', 'dismissive'] },
  { word: 'damp omen',       tags: ['absurd', 'mystical'] },
  { word: 'soup that learned to walk', tags: ['absurd'] },
  { word: 'half-spoken whisper', tags: ['absurd'] },
  { word: 'forgotten umbrella', tags: ['absurd', 'dismissive'] },
  { word: 'tax form with a soul', tags: ['absurd', 'formal'] },
  { word: 'enchanted pamphlet', tags: ['absurd', 'mystical', 'petty'] },
  { word: 'self-aware mop',  tags: ['absurd'] },
  { word: 'mildly haunted shelf', tags: ['absurd', 'mystical'] },
  { word: 'bureaucratic accident', tags: ['absurd', 'formal'] },
  { word: 'compound interest', tags: ['absurd', 'academic'] },
  { word: 'expired charm',   tags: ['absurd', 'mystical'] },
  { word: 'mediocre vortex', tags: ['absurd', 'dismissive'] },
  { word: 'bottle of opinions', tags: ['absurd'] },
  { word: 'minor heresy',    tags: ['absurd', 'mystical', 'petty'] },
  { word: 'weekend cult',    tags: ['absurd', 'mystical'] },
  { word: 'budget revelation', tags: ['absurd', 'mystical'] },
  { word: 'half-realized hex', tags: ['absurd', 'mystical'] },
  { word: 'small printed thing', tags: ['absurd', 'petty'] },
  { word: 'memory of soup',  tags: ['absurd'] },
  { word: 'weather-shaped person', tags: ['absurd'] },
  { word: 'emotional spreadsheet', tags: ['absurd', 'academic'] },
  { word: 'cardboard prophecy', tags: ['absurd', 'mystical'] },
  { word: 'third-tier disappointment', tags: ['absurd', 'dismissive'] },
  { word: 'failed bird impression', tags: ['absurd'] },
  { word: 'badly-folded napkin', tags: ['absurd', 'petty'] },
  { word: 'small library scandal', tags: ['absurd', 'academic'] },
  { word: 'allergy to consequences', tags: ['absurd', 'dismissive'] },
  { word: 'plural inconvenience', tags: ['absurd', 'petty'] },
  { word: 'half-known constant', tags: ['absurd', 'academic'] },
  { word: 'damp scroll',     tags: ['absurd', 'mystical', 'formal'] },
  { word: 'lesser invitation', tags: ['absurd', 'formal', 'petty'] },
  { word: 'footnote on a stove', tags: ['absurd', 'academic'] },
  { word: 'recipe-shaped insult', tags: ['absurd'] },
  { word: 'tax-free hex',    tags: ['absurd', 'mystical', 'formal'] },
  { word: 'small alphabetized misery', tags: ['absurd', 'petty'] },
  { word: 'half-priced moral panic', tags: ['absurd'] },
  { word: 'glass-eyed prefect', tags: ['absurd', 'formal'] },
  { word: 'sandwich-related grievance', tags: ['absurd'] },
  { word: 'unsolved sneeze', tags: ['absurd'] },
  // sarcastic cluster (16)
  { word: 'genius',          tags: ['sarcastic'] },
  { word: 'paragon',         tags: ['sarcastic', 'formal'] },
  { word: 'luminary',        tags: ['sarcastic', 'formal'] },
  { word: 'visionary',       tags: ['sarcastic'] },
  { word: 'prodigy',         tags: ['sarcastic'] },
  { word: 'wonder',          tags: ['sarcastic'] },
  { word: 'marvel',          tags: ['sarcastic'] },
  { word: 'specimen',        tags: ['sarcastic', 'academic'] },
  { word: 'piece of work',   tags: ['sarcastic'] },
  { word: 'example',         tags: ['sarcastic'] },
  { word: 'case study',      tags: ['sarcastic', 'academic'] },
  { word: 'textbook case',   tags: ['sarcastic', 'academic'] },
  { word: 'cautionary tale', tags: ['sarcastic'] },
  { word: 'urban legend',    tags: ['sarcastic'] },
  { word: 'one for the books', tags: ['sarcastic'] },
  { word: 'philosopher',     tags: ['sarcastic', 'academic'] },
  // academic / formal cluster (12)
  { word: 'erratum',         tags: ['academic'] },
  { word: 'retraction',      tags: ['academic', 'formal'] },
  { word: 'corrigendum',     tags: ['academic', 'formal'] },
  { word: 'annotation',      tags: ['academic'] },
  { word: 'marginalia',      tags: ['academic', 'petty'] },
  { word: 'abstract',        tags: ['academic'] },
  { word: 'citation',        tags: ['academic'] },
  { word: 'supplicant',      tags: ['formal', 'petty'] },
  { word: 'correspondent',   tags: ['formal'] },
  { word: 'functionary',     tags: ['formal', 'dismissive'] },
  { word: 'operative',       tags: ['formal', 'threatening'] },
  { word: 'apprentice',      tags: ['formal', 'dismissive'] },
  // rhetorical cluster (8)
  { word: 'straw-man',       tags: ['rhetorical', 'dismissive'] },
  { word: 'counter-example', tags: ['rhetorical', 'academic'] },
  { word: 'premise',         tags: ['rhetorical'] },
  { word: 'fallacy',         tags: ['rhetorical'] },
  { word: 'tautology',       tags: ['rhetorical'] },
  { word: 'corollary',       tags: ['rhetorical', 'academic'] },
  { word: 'red herring',     tags: ['rhetorical', 'absurd'] },
  { word: 'hand-wave',       tags: ['rhetorical', 'dismissive'] },
  // mystical cluster (10)
  { word: 'apparition',      tags: ['mystical'] },
  { word: 'revenant',        tags: ['mystical', 'threatening'] },
  { word: 'shade',           tags: ['mystical', 'petty'] },
  { word: 'phantom',         tags: ['mystical'] },
  { word: 'specter',         tags: ['mystical'] },
  { word: 'wraith',          tags: ['mystical'] },
  { word: 'ghoul',           tags: ['mystical', 'threatening'] },
  { word: 'familiar',        tags: ['mystical', 'dismissive'] },
  { word: 'cipher',          tags: ['mystical', 'dismissive'] },
  { word: 'omen',            tags: ['mystical', 'sarcastic'] },
  // chaotic cluster (14)
  { word: 'mess',            tags: ['chaotic', 'dismissive'] },
  { word: 'shambles',        tags: ['chaotic'] },
  { word: 'fiasco',          tags: ['chaotic', 'absurd'] },
  { word: 'débâcle',         tags: ['chaotic'] },
  { word: 'catastrophe-in-progress', tags: ['chaotic'] },
  { word: 'fire hazard',     tags: ['chaotic', 'threatening'] },
  { word: 'rolling disaster',tags: ['chaotic'] },
  { word: 'moving violation',tags: ['chaotic', 'formal'] },
  { word: 'ongoing situation', tags: ['chaotic', 'dismissive'] },
  { word: 'unravelling',     tags: ['chaotic'] },
  { word: 'wildfire',        tags: ['chaotic', 'threatening'] },
  { word: 'one-person riot', tags: ['chaotic'] },
  { word: 'public disturbance', tags: ['chaotic', 'formal'] },
  { word: 'walking concern', tags: ['chaotic'] },
];

const INSULT_VERBS = [
  // petty cluster (30)
  { word: 'mince',         tags: ['petty'] },
  { word: 'whine',         tags: ['petty'] },
  { word: 'fuss',          tags: ['petty'] },
  { word: 'fret',          tags: ['petty'] },
  { word: 'sulk',          tags: ['petty'] },
  { word: 'pout',          tags: ['petty'] },
  { word: 'simper',        tags: ['petty', 'sarcastic'] },
  { word: 'preen',         tags: ['petty', 'sarcastic'] },
  { word: 'wobble',        tags: ['petty', 'absurd'] },
  { word: 'flounder',      tags: ['petty', 'absurd'] },
  { word: 'fidget',        tags: ['petty'] },
  { word: 'titter',        tags: ['petty'] },
  { word: 'cringe',        tags: ['petty'] },
  { word: 'shrug',         tags: ['petty', 'dismissive'] },
  { word: 'mumble',        tags: ['petty'] },
  { word: 'natter',        tags: ['petty', 'absurd'] },
  { word: 'fritter',       tags: ['petty'] },
  { word: 'dawdle',        tags: ['petty'] },
  { word: 'fawn',          tags: ['petty', 'sarcastic'] },
  { word: 'grovel',        tags: ['petty', 'sarcastic'] },
  { word: 'snivel',        tags: ['petty'] },
  { word: 'snipe',         tags: ['petty'] },
  { word: 'twitter',       tags: ['petty', 'absurd'] },
  { word: 'fluster',       tags: ['petty'] },
  { word: 'flap',          tags: ['petty', 'absurd'] },
  { word: 'piddle',        tags: ['petty', 'absurd'] },
  { word: 'shilly-shally', tags: ['petty', 'absurd'] },
  { word: 'rabbit on',     tags: ['petty', 'absurd'] },
  { word: 'witter',        tags: ['petty', 'absurd'] },
  { word: 'huff',          tags: ['petty', 'sarcastic'] },
  // dismissive cluster (24)
  { word: 'shrug',         tags: ['dismissive'] },
  { word: 'wave away',     tags: ['dismissive'] },
  { word: 'sigh',          tags: ['dismissive'] },
  { word: 'roll your eyes',tags: ['dismissive', 'sarcastic'] },
  { word: 'change subject',tags: ['dismissive'] },
  { word: 'wander',        tags: ['dismissive'] },
  { word: 'wander off',    tags: ['dismissive'] },
  { word: 'doze',          tags: ['dismissive'] },
  { word: 'yawn',          tags: ['dismissive'] },
  { word: 'tune out',      tags: ['dismissive'] },
  { word: 'mutter',        tags: ['dismissive'] },
  { word: 'shuffle',       tags: ['dismissive', 'petty'] },
  { word: 'lose interest', tags: ['dismissive'] },
  { word: 'check the time',tags: ['dismissive'] },
  { word: 'walk past',     tags: ['dismissive'] },
  { word: 'look elsewhere',tags: ['dismissive'] },
  { word: 'change the topic', tags: ['dismissive'] },
  { word: 'forget the name', tags: ['dismissive'] },
  { word: 'lose your train of thought', tags: ['dismissive', 'absurd'] },
  { word: 'tap a foot',    tags: ['dismissive'] },
  { word: 'study a wall',  tags: ['dismissive', 'absurd'] },
  { word: 'pencil that in', tags: ['dismissive', 'sarcastic'] },
  { word: 'consider it later', tags: ['dismissive', 'sarcastic'] },
  { word: 'be otherwise engaged', tags: ['dismissive', 'formal'] },
  // booming cluster (18)
  { word: 'bellow',        tags: ['booming'] },
  { word: 'thunder',       tags: ['booming'] },
  { word: 'roar',          tags: ['booming'] },
  { word: 'rattle',        tags: ['booming', 'absurd'] },
  { word: 'demand',        tags: ['booming', 'rhetorical'] },
  { word: 'declare',       tags: ['booming', 'formal'] },
  { word: 'proclaim',      tags: ['booming', 'formal'] },
  { word: 'pronounce',     tags: ['booming', 'formal'] },
  { word: 'announce',      tags: ['booming'] },
  { word: 'broadcast',     tags: ['booming'] },
  { word: 'trumpet',       tags: ['booming', 'sarcastic'] },
  { word: 'rumble',        tags: ['booming', 'threatening'] },
  { word: 'shake the rafters', tags: ['booming', 'absurd'] },
  { word: 'split the air', tags: ['booming'] },
  { word: 'fill the room', tags: ['booming'] },
  { word: 'rattle the windows', tags: ['booming'] },
  { word: 'boom',          tags: ['booming'] },
  { word: 'shake fists',   tags: ['booming', 'threatening'] },
  // threatening cluster (16)
  { word: 'crumble',       tags: ['threatening', 'petty'] },
  { word: 'cower',         tags: ['threatening', 'petty'] },
  { word: 'flinch',        tags: ['threatening', 'petty'] },
  { word: 'tremble',       tags: ['threatening'] },
  { word: 'buckle',        tags: ['threatening'] },
  { word: 'fold',          tags: ['threatening', 'petty'] },
  { word: 'collapse',      tags: ['threatening'] },
  { word: 'wilt',          tags: ['threatening', 'petty'] },
  { word: 'crumple',       tags: ['threatening', 'petty'] },
  { word: 'shrink',        tags: ['threatening', 'petty'] },
  { word: 'shy away',      tags: ['threatening', 'petty'] },
  { word: 'shudder',       tags: ['threatening'] },
  { word: 'gulp',          tags: ['threatening', 'absurd'] },
  { word: 'pale',          tags: ['threatening'] },
  { word: 'tighten',       tags: ['threatening'] },
  { word: 'sweat',         tags: ['threatening', 'absurd'] },
  // academic / formal cluster (16)
  { word: 'lecture',       tags: ['academic', 'formal'] },
  { word: 'pontificate',   tags: ['academic', 'formal'] },
  { word: 'theorize',      tags: ['academic'] },
  { word: 'postulate',     tags: ['academic'] },
  { word: 'hypothesize',   tags: ['academic'] },
  { word: 'cite',          tags: ['academic'] },
  { word: 'footnote',      tags: ['academic', 'absurd'] },
  { word: 'argue',         tags: ['academic', 'rhetorical'] },
  { word: 'expound',       tags: ['academic', 'formal'] },
  { word: 'orate',         tags: ['formal', 'booming'] },
  { word: 'declaim',       tags: ['formal', 'booming'] },
  { word: 'recite',        tags: ['formal'] },
  { word: 'intone',        tags: ['formal'] },
  { word: 'enumerate',     tags: ['academic', 'rhetorical'] },
  { word: 'belabour',      tags: ['academic', 'dismissive'] },
  { word: 'opine',         tags: ['rhetorical', 'sarcastic'] },
  // rhetorical cluster (10)
  { word: 'object',        tags: ['rhetorical'] },
  { word: 'refute',        tags: ['rhetorical'] },
  { word: 'rebut',         tags: ['rhetorical'] },
  { word: 'dispute',       tags: ['rhetorical'] },
  { word: 'contradict',    tags: ['rhetorical'] },
  { word: 'qualify',       tags: ['rhetorical', 'dismissive'] },
  { word: 'caveat',        tags: ['rhetorical', 'dismissive'] },
  { word: 'parse',         tags: ['rhetorical', 'academic'] },
  { word: 'nitpick',       tags: ['rhetorical', 'petty'] },
  { word: 'quibble',       tags: ['rhetorical', 'petty'] },
  // chaotic cluster (14)
  { word: 'gibber',        tags: ['chaotic', 'absurd'] },
  { word: 'unravel',       tags: ['chaotic'] },
  { word: 'unspool',       tags: ['chaotic'] },
  { word: 'fall apart',    tags: ['chaotic'] },
  { word: 'come undone',   tags: ['chaotic'] },
  { word: 'detonate',      tags: ['chaotic', 'threatening'] },
  { word: 'fly apart',     tags: ['chaotic'] },
  { word: 'come unstuck',  tags: ['chaotic', 'absurd'] },
  { word: 'short-circuit', tags: ['chaotic', 'absurd'] },
  { word: 'cascade',       tags: ['chaotic'] },
  { word: 'spiral',        tags: ['chaotic'] },
  { word: 'go to pieces',  tags: ['chaotic'] },
  { word: 'lose the plot', tags: ['chaotic', 'absurd'] },
  { word: 'flail',         tags: ['chaotic', 'petty'] },
  // absurd cluster (40)
  { word: 'splutter',      tags: ['absurd', 'petty'] },
  { word: 'gobble',        tags: ['absurd'] },
  { word: 'wibble',        tags: ['absurd'] },
  { word: 'wibble-wobble', tags: ['absurd'] },
  { word: 'kerfuffle',     tags: ['absurd', 'chaotic'] },
  { word: 'palaver',       tags: ['absurd'] },
  { word: 'mither',        tags: ['absurd', 'petty'] },
  { word: 'faff',          tags: ['absurd', 'petty'] },
  { word: 'flap about',    tags: ['absurd', 'petty'] },
  { word: 'gallumph',      tags: ['absurd'] },
  { word: 'plod',          tags: ['absurd', 'dismissive'] },
  { word: 'trundle',       tags: ['absurd'] },
  { word: 'shamble',       tags: ['absurd'] },
  { word: 'pootle',        tags: ['absurd', 'petty'] },
  { word: 'flounce',       tags: ['absurd', 'petty', 'sarcastic'] },
  { word: 'galumph',       tags: ['absurd'] },
  { word: 'gallivant',     tags: ['absurd'] },
  { word: 'mooch',         tags: ['absurd', 'petty'] },
  { word: 'lurk',          tags: ['absurd', 'threatening'] },
  { word: 'loiter',        tags: ['absurd', 'petty'] },
  { word: 'meander',       tags: ['absurd', 'dismissive'] },
  { word: 'wallow',        tags: ['absurd', 'petty'] },
  { word: 'reek',          tags: ['absurd', 'dismissive'] },
  { word: 'curdle',        tags: ['absurd', 'threatening'] },
  { word: 'misfire',       tags: ['absurd', 'dismissive'] },
  { word: 'malfunction',   tags: ['absurd', 'dismissive'] },
  { word: 'sneeze theatrically', tags: ['absurd', 'sarcastic'] },
  { word: 'haunt a doorway', tags: ['absurd', 'mystical'] },
  { word: 'overstay your welcome', tags: ['absurd', 'sarcastic'] },
  { word: 'underwhelm a room', tags: ['absurd', 'dismissive'] },
  { word: 'inhabit a hallway', tags: ['absurd'] },
  { word: 'misplace a vowel', tags: ['absurd', 'petty'] },
  { word: 'mistake a noun', tags: ['absurd', 'dismissive'] },
  { word: 'over-explain a joke', tags: ['absurd', 'academic'] },
  { word: 'rehearse aloud', tags: ['absurd', 'sarcastic'] },
  { word: 'translate badly',tags: ['absurd', 'dismissive'] },
  { word: 'be small about it', tags: ['absurd', 'petty'] },
  { word: 'shed feathers', tags: ['absurd'] },
  { word: 'molt',          tags: ['absurd', 'petty'] },
  { word: 'rust',          tags: ['absurd', 'dismissive'] },
  // sarcastic cluster (12)
  { word: 'enthuse',       tags: ['sarcastic'] },
  { word: 'gush',          tags: ['sarcastic'] },
  { word: 'rave',          tags: ['sarcastic', 'booming'] },
  { word: 'wax lyrical',   tags: ['sarcastic', 'formal'] },
  { word: 'wax poetic',    tags: ['sarcastic'] },
  { word: 'bless',         tags: ['sarcastic'] },
  { word: 'congratulate yourself', tags: ['sarcastic'] },
  { word: 'try',           tags: ['sarcastic', 'dismissive'] },
  { word: 'really try',    tags: ['sarcastic'] },
  { word: 'bravely attempt', tags: ['sarcastic'] },
  { word: 'represent yourself', tags: ['sarcastic', 'formal'] },
  { word: 'do your best',  tags: ['sarcastic', 'dismissive'] },
  // mystical cluster (10)
  { word: 'haunt',         tags: ['mystical', 'threatening'] },
  { word: 'manifest',      tags: ['mystical'] },
  { word: 'discorporate',  tags: ['mystical', 'absurd'] },
  { word: 'fade',          tags: ['mystical', 'petty'] },
  { word: 'evaporate',     tags: ['mystical', 'absurd'] },
  { word: 'lurk in attics',tags: ['mystical', 'absurd'] },
  { word: 'occupy doorways', tags: ['mystical', 'absurd'] },
  { word: 'spook lightly', tags: ['mystical', 'absurd'] },
  { word: 'shimmer',       tags: ['mystical', 'sarcastic'] },
  { word: 'rattle chains', tags: ['mystical', 'absurd'] },
  // top-up additions to reach ≥200
  { word: 'misquote yourself', tags: ['dismissive', 'absurd'] },
  { word: 'circle the drain', tags: ['chaotic', 'absurd'] },
  { word: 'argue with a hat', tags: ['absurd', 'rhetorical'] },
  { word: 'apologise mid-threat', tags: ['threatening', 'absurd'] },
  { word: 'lecture a puddle', tags: ['academic', 'absurd'] },
  { word: 'announce yourself twice', tags: ['booming', 'absurd'] },
  { word: 'cite the wrong year', tags: ['academic', 'dismissive'] },
  { word: 'over-rehearse', tags: ['sarcastic', 'petty'] },
  { word: 'under-rehearse', tags: ['dismissive', 'absurd'] },
  { word: 'cluck',         tags: ['petty', 'absurd'] },
  { word: 'crow',          tags: ['booming', 'sarcastic'] },
  { word: 'preside over nothing', tags: ['formal', 'absurd'] },
];

const INSULT_ADJECTIVES = [
  // dismissive cluster (36)
  { word: 'mediocre',      tags: ['dismissive'] },
  { word: 'tedious',       tags: ['dismissive'] },
  { word: 'unconvincing',  tags: ['dismissive'] },
  { word: 'forgettable',   tags: ['dismissive'] },
  { word: 'derivative',    tags: ['dismissive', 'academic'] },
  { word: 'minor',         tags: ['dismissive', 'petty'] },
  { word: 'second-rate',   tags: ['dismissive', 'petty'] },
  { word: 'lukewarm',      tags: ['dismissive', 'absurd'] },
  { word: 'middling',      tags: ['dismissive'] },
  { word: 'passable',      tags: ['dismissive', 'sarcastic'] },
  { word: 'fine',          tags: ['dismissive', 'sarcastic'] },
  { word: 'adequate',      tags: ['dismissive', 'sarcastic'] },
  { word: 'serviceable',   tags: ['dismissive'] },
  { word: 'workmanlike',   tags: ['dismissive'] },
  { word: 'unremarkable',  tags: ['dismissive'] },
  { word: 'undistinguished', tags: ['dismissive', 'formal'] },
  { word: 'flat',          tags: ['dismissive'] },
  { word: 'dull',          tags: ['dismissive'] },
  { word: 'inert',         tags: ['dismissive', 'academic'] },
  { word: 'amateurish',    tags: ['dismissive'] },
  { word: 'half-baked',    tags: ['dismissive', 'absurd'] },
  { word: 'half-finished', tags: ['dismissive'] },
  { word: 'half-hearted',  tags: ['dismissive', 'petty'] },
  { word: 'unfinished',    tags: ['dismissive'] },
  { word: 'unproven',      tags: ['dismissive', 'academic'] },
  { word: 'untested',      tags: ['dismissive'] },
  { word: 'untalented',    tags: ['dismissive'] },
  { word: 'unstudied',     tags: ['dismissive', 'academic'] },
  { word: 'transparent',   tags: ['dismissive'] },
  { word: 'predictable',   tags: ['dismissive', 'sarcastic'] },
  { word: 'obvious',       tags: ['dismissive', 'sarcastic'] },
  { word: 'overcooked',    tags: ['dismissive', 'absurd'] },
  { word: 'overdone',      tags: ['dismissive'] },
  { word: 'overheated',    tags: ['dismissive', 'petty'] },
  { word: 'underwhelming', tags: ['dismissive'] },
  { word: 'long-winded',   tags: ['dismissive', 'academic'] },
  // petty cluster (24)
  { word: 'pathetic',      tags: ['petty', 'dismissive'] },
  { word: 'small',         tags: ['petty'] },
  { word: 'tiny',          tags: ['petty'] },
  { word: 'shrunken',      tags: ['petty'] },
  { word: 'embarrassing',  tags: ['petty', 'dismissive'] },
  { word: 'frankly humiliating', tags: ['petty', 'dismissive'] },
  { word: 'frankly embarrassing', tags: ['petty', 'dismissive'] },
  { word: 'mealy-mouthed', tags: ['petty', 'absurd'] },
  { word: 'wee',           tags: ['petty', 'absurd'] },
  { word: 'titchy',        tags: ['petty', 'absurd'] },
  { word: 'piddling',      tags: ['petty', 'absurd'] },
  { word: 'mingy',         tags: ['petty'] },
  { word: 'meagre',        tags: ['petty'] },
  { word: 'scant',         tags: ['petty'] },
  { word: 'paltry',        tags: ['petty'] },
  { word: 'measly',        tags: ['petty'] },
  { word: 'penny-pinching',tags: ['petty', 'sarcastic'] },
  { word: 'small-minded',  tags: ['petty', 'dismissive'] },
  { word: 'pinched',       tags: ['petty'] },
  { word: 'narrow',        tags: ['petty'] },
  { word: 'cramped',       tags: ['petty'] },
  { word: 'parochial',     tags: ['petty', 'formal'] },
  { word: 'provincial',    tags: ['petty', 'dismissive'] },
  { word: 'small-shaped',  tags: ['petty', 'absurd'] },
  // booming cluster (14)
  { word: 'thunderous',    tags: ['booming'] },
  { word: 'shrill',        tags: ['booming', 'petty'] },
  { word: 'shouting',      tags: ['booming'] },
  { word: 'loud',          tags: ['booming'] },
  { word: 'roaring',       tags: ['booming'] },
  { word: 'deafening',     tags: ['booming'] },
  { word: 'bellowing',     tags: ['booming'] },
  { word: 'thunderstruck', tags: ['booming', 'absurd'] },
  { word: 'thundering',    tags: ['booming'] },
  { word: 'over-loud',     tags: ['booming', 'petty'] },
  { word: 'overheard',     tags: ['booming', 'dismissive'] },
  { word: 'audible-from-three-rooms', tags: ['booming', 'absurd'] },
  { word: 'shouted',       tags: ['booming'] },
  { word: 'amplified',     tags: ['booming', 'sarcastic'] },
  // threatening cluster (14)
  { word: 'lethal',        tags: ['threatening'] },
  { word: 'feral',         tags: ['threatening', 'chaotic'] },
  { word: 'rabid',         tags: ['threatening', 'chaotic'] },
  { word: 'cornered',      tags: ['threatening', 'petty'] },
  { word: 'wounded',       tags: ['threatening', 'petty'] },
  { word: 'desperate',     tags: ['threatening', 'petty'] },
  { word: 'flailing',      tags: ['threatening', 'petty'] },
  { word: 'unhinged',      tags: ['threatening', 'chaotic'] },
  { word: 'snarling',      tags: ['threatening'] },
  { word: 'on-the-back-foot', tags: ['threatening', 'petty'] },
  { word: 'one-paragraph-from-tears', tags: ['threatening', 'absurd'] },
  { word: 'biting',        tags: ['threatening'] },
  { word: 'stabbing',      tags: ['threatening'] },
  { word: 'gnashing',      tags: ['threatening'] },
  // absurd cluster (45)
  { word: 'absurd',        tags: ['absurd'] },
  { word: 'damp',          tags: ['absurd', 'dismissive'] },
  { word: 'pungent',       tags: ['absurd', 'dismissive'] },
  { word: 'crinkly',       tags: ['absurd'] },
  { word: 'rumpled',       tags: ['absurd', 'petty'] },
  { word: 'unfolded',      tags: ['absurd'] },
  { word: 'half-laundered', tags: ['absurd', 'dismissive'] },
  { word: 'compost-shaped',tags: ['absurd', 'dismissive'] },
  { word: 'turnip-coloured', tags: ['absurd', 'petty'] },
  { word: 'badly translated', tags: ['absurd', 'dismissive'] },
  { word: 'autotranslated',tags: ['absurd', 'absurd'] },
  { word: 'haunted',       tags: ['absurd', 'mystical'] },
  { word: 'lightly cursed',tags: ['absurd', 'mystical'] },
  { word: 'badly cursed',  tags: ['absurd', 'mystical'] },
  { word: 'mildly enchanted', tags: ['absurd', 'mystical', 'petty'] },
  { word: 'unevenly fermented', tags: ['absurd'] },
  { word: 'second-week leftovers', tags: ['absurd', 'dismissive'] },
  { word: 'discount-bin',  tags: ['absurd', 'petty'] },
  { word: 'used-to-be-on-fire', tags: ['absurd'] },
  { word: 'almost-haunted',tags: ['absurd', 'mystical'] },
  { word: 'partially shouted', tags: ['absurd', 'booming'] },
  { word: 'spiritually clammy', tags: ['absurd', 'mystical'] },
  { word: 'narratively unstable', tags: ['absurd', 'chaotic'] },
  { word: 'rhetorically lukewarm', tags: ['absurd', 'rhetorical'] },
  { word: 'metaphorically damp', tags: ['absurd', 'dismissive'] },
  { word: 'literally inconvenient', tags: ['absurd', 'sarcastic'] },
  { word: 'borderline cabbage', tags: ['absurd'] },
  { word: 'almost-a-priest',tags: ['absurd', 'formal'] },
  { word: 'small-batch',   tags: ['absurd', 'petty'] },
  { word: 'briefly enchanted', tags: ['absurd', 'mystical'] },
  { word: 'self-published',tags: ['absurd', 'dismissive'] },
  { word: 'home-fermented',tags: ['absurd', 'dismissive'] },
  { word: 'occasionally lucid', tags: ['absurd', 'sarcastic'] },
  { word: 'allegorical',   tags: ['absurd', 'academic'] },
  { word: 'parabolic',     tags: ['absurd', 'academic'] },
  { word: 'overdetermined',tags: ['absurd', 'academic'] },
  { word: 'second-best at metaphors', tags: ['absurd', 'sarcastic'] },
  { word: 'goose-flavoured', tags: ['absurd', 'petty'] },
  { word: 'wet-paper',     tags: ['absurd', 'petty'] },
  { word: 'tepid',         tags: ['absurd', 'dismissive'] },
  { word: 'unsubscribed',  tags: ['absurd', 'sarcastic'] },
  { word: 'unfrosted',     tags: ['absurd', 'petty'] },
  { word: 'unwaxed',       tags: ['absurd'] },
  { word: 'unscrolled',    tags: ['absurd', 'mystical'] },
  { word: 'unscandalised', tags: ['absurd', 'sarcastic'] },
  // sarcastic cluster (16)
  { word: 'impressive',    tags: ['sarcastic'] },
  { word: 'fascinating',   tags: ['sarcastic'] },
  { word: 'remarkable',    tags: ['sarcastic'] },
  { word: 'astonishing',   tags: ['sarcastic'] },
  { word: 'breathtaking',  tags: ['sarcastic'] },
  { word: 'genuinely original', tags: ['sarcastic'] },
  { word: 'truly seminal', tags: ['sarcastic', 'academic'] },
  { word: 'absolutely cutting-edge', tags: ['sarcastic'] },
  { word: 'definitely a choice', tags: ['sarcastic', 'dismissive'] },
  { word: 'spirited',      tags: ['sarcastic'] },
  { word: 'enthusiastic',  tags: ['sarcastic', 'dismissive'] },
  { word: 'committed',     tags: ['sarcastic'] },
  { word: 'plucky',        tags: ['sarcastic', 'petty'] },
  { word: 'game',          tags: ['sarcastic', 'petty'] },
  { word: 'a-for-effort',  tags: ['sarcastic'] },
  { word: 'creative',      tags: ['sarcastic', 'dismissive'] },
  // mystical cluster (10)
  { word: 'eldritch',      tags: ['mystical'] },
  { word: 'spectral',      tags: ['mystical'] },
  { word: 'ethereal',      tags: ['mystical', 'sarcastic'] },
  { word: 'phantom-shaped',tags: ['mystical', 'absurd'] },
  { word: 'mildly cosmic', tags: ['mystical', 'absurd'] },
  { word: 'half-haunted',  tags: ['mystical', 'absurd'] },
  { word: 'discount-eldritch', tags: ['mystical', 'absurd', 'petty'] },
  { word: 'astrally inconvenient', tags: ['mystical', 'absurd'] },
  { word: 'celestially mediocre', tags: ['mystical', 'dismissive'] },
  { word: 'cosmically forgettable', tags: ['mystical', 'dismissive'] },
  // chaotic cluster (12)
  { word: 'incoherent',    tags: ['chaotic', 'dismissive'] },
  { word: 'unhinged',      tags: ['chaotic'] },
  { word: 'discombobulated', tags: ['chaotic', 'absurd'] },
  { word: 'unmoored',      tags: ['chaotic'] },
  { word: 'all-over-the-place', tags: ['chaotic'] },
  { word: 'one-step-ahead-of-collapse', tags: ['chaotic', 'absurd'] },
  { word: 'frothing',      tags: ['chaotic', 'threatening'] },
  { word: 'spluttering',   tags: ['chaotic', 'petty'] },
  { word: 'flying-by-the-seat-of-it', tags: ['chaotic', 'sarcastic'] },
  { word: 'unsupervised',  tags: ['chaotic', 'petty'] },
  { word: 'untreated',     tags: ['chaotic'] },
  { word: 'live-wire',     tags: ['chaotic', 'threatening'] },
  // academic / formal / rhetorical cluster (12)
  { word: 'long-winded',   tags: ['academic', 'dismissive'] },
  { word: 'overcited',     tags: ['academic'] },
  { word: 'pedantic',      tags: ['academic', 'petty'] },
  { word: 'circular',      tags: ['rhetorical'] },
  { word: 'tautological',  tags: ['rhetorical'] },
  { word: 'recursive',     tags: ['rhetorical', 'absurd'] },
  { word: 'overargued',    tags: ['rhetorical', 'dismissive'] },
  { word: 'underexplained',tags: ['rhetorical', 'dismissive'] },
  { word: 'over-formal',   tags: ['formal', 'dismissive'] },
  { word: 'starchy',       tags: ['formal', 'sarcastic'] },
  { word: 'stiff-collared',tags: ['formal', 'petty'] },
  { word: 'beige',         tags: ['formal', 'dismissive'] },
  // top-up additions to reach ≥200
  { word: 'twice-warmed',  tags: ['absurd', 'dismissive'] },
  { word: 'previously interesting', tags: ['sarcastic', 'dismissive'] },
  { word: 'aggressively normal', tags: ['sarcastic', 'dismissive'] },
  { word: 'professionally bewildered', tags: ['absurd', 'academic'] },
  { word: 'visibly improvising', tags: ['chaotic', 'sarcastic'] },
  { word: 'audibly out of ideas', tags: ['booming', 'dismissive'] },
  { word: 'rhetorically lopsided', tags: ['rhetorical', 'absurd'] },
  { word: 'spiritually crinkly', tags: ['mystical', 'absurd'] },
  { word: 'briefly correct', tags: ['sarcastic', 'academic'] },
  { word: 'occasionally upright', tags: ['sarcastic', 'absurd'] },
  { word: 'a-little-too-loud', tags: ['booming', 'petty'] },
  { word: 'a-little-too-quiet', tags: ['petty', 'dismissive'] },
  { word: 'mostly-bones',  tags: ['threatening', 'absurd'] },
  { word: 'mostly-rumour', tags: ['absurd', 'mystical'] },
  { word: 'half-a-thought',tags: ['absurd', 'petty'] },
  { word: 'twice-haunted', tags: ['mystical', 'absurd'] },
  { word: 'fully optional',tags: ['sarcastic', 'dismissive'] },
  { word: 'distinctly damp', tags: ['absurd', 'dismissive'] },
];

// Generic comeback templates by which tag the enemy WANTS to be insulted in.
// Used when the player's insult unfazes/backfires — gives the player a hint
// at which tag-flavor of word would have actually landed.
const INSULT_HINT_BY_TAG = {
  dismissive:  'Calling me boring would have stung harder than that.',
  petty:       'You\'d wound me more by going small.',
  threatening: 'Threats might actually move me.',
  booming:     'Speak louder. Make me hear you.',
  absurd:      'Try something genuinely absurd. That rattles me.',
  sarcastic:   'Sarcasm cuts deeper than sincere abuse.',
  mystical:    'Invoke something old and wrong.',
  formal:      'Adopt the proper register, would you?',
  academic:    'Cite a source. THAT would hurt.',
  rhetorical:  'Make an argument I can\'t refute.',
  chaotic:     'I prefer my insults a little unhinged.',
};

const INSULT_BACKFIRE_RETORTS = [
  'Is that all?',
  'I expect more from a real wizard.',
  'Your words slide off, and yours with them.',
  'You sound less like an insulter and more like an apologiser.',
  'My grandmother insulted me harder than this. Posthumously.',
];

// Map act number to the pool of sidequests available in that act.
// Postcard phrase pools for the Jazz Cafe quest. Generates short
// memorable five-word sentences the player must reproduce exactly.
const POSTCARD_NOUNS = ['umbrella','kettle','mountain','fish','door','window','song','shoe','star','moth','pen','cat','sparrow','lantern','cup','thread','bell','biscuit','sword','apple','cloud','stone','feather','kite','river','candle','letter','spoon','clock','chair'];
const POSTCARD_VERBS = ['forgives','remembers','forgets','follows','leaves','enters','opens','closes','sings','sleeps','wakes','waits','returns','rises','falls','mends','breaks','holds'];
const POSTCARD_ADJECTIVES = ['small','large','quiet','loud','cold','warm','patient','forgotten','old','new','tired','kind','distant','careful','clever','gentle'];
const POSTCARD_TEMPLATES = [
  ['the',     'adj',  'noun', 'verb', 'noun'],
  ['no',      'noun', 'verb', 'the',  'noun'],
  ['remember','the',  'noun', 'not',  'noun'],
  ['noun',    'verb', 'every','adj',  'noun'],
  ['adj',     'noun', 'verb', 'every','noun'],
  ['the',     'noun', 'verb', 'and',  'noun'],
];
function generatePostcardPhrase() {
  const tpl = POSTCARD_TEMPLATES[Math.floor(Math.random() * POSTCARD_TEMPLATES.length)];
  return tpl.map(slot => {
    if (slot === 'noun') return POSTCARD_NOUNS[Math.floor(Math.random() * POSTCARD_NOUNS.length)];
    if (slot === 'verb') return POSTCARD_VERBS[Math.floor(Math.random() * POSTCARD_VERBS.length)];
    if (slot === 'adj')  return POSTCARD_ADJECTIVES[Math.floor(Math.random() * POSTCARD_ADJECTIVES.length)];
    return slot;
  }).join(' ');
}

const SIDEQUESTS_BY_ACT = (() => {
  const map = {};
  for (const sq of Object.values(SIDEQUEST_TEMPLATES)) {
    (map[sq.act] = map[sq.act] || []).push(sq.id);
  }
  return map;
})();

// Materials — gathered at Material nodes during an act. Each slot has
// its own family. When the player visits a material node, three random
// variants from that slot's pool are rolled into a chooser (same shape
// as the old Arcane Workshop grove system). Stats here are placeholder
// signals that the crafting minigame (Commit 3) will roll into the
// final equipment card's per-slot mechanic.
// Each material has a UNIQUE mechanical identity within its slot —
// not a linear "more of the same stat" variant. Picking one is an
// archetype commitment, not a number comparison.
//
// Stat semantics by slot (buildCraftedEquipment consumes these):
//   STAFF (one-shot Effect card):
//     chutzpah → base + multiplier (always primary)
//     loseHp   → loseHpOnPlay on the cast (Chutzpah lever)
//     defense  → rider Block AND equipment bonus.damageReduction
//     dot      → rider Weak on cast + 'threatening' resonance
//     chance   → 50% bonus Vuln vs 50% self-Weak (Jnsq gamble)
//     jnsq     → 'absurd' resonance tag
//   ROBES (passive equipment):
//     defense  → permanent damageReduction (engine caps total at 2)
//     regen    → healOnCombatStart
//     draw     → extraStartHand on turn 1
//     vuln     → applies N enemy Vulnerable at combat start
//   RING (passive per-combat triggers):
//     defense  → permanent damageReduction
//     energy   → permanentEnergyBonus (+N per turn)
//     draw     → extraStartHand on turn 1
//     weak     → applies N enemy Weak at combat start
//   HAT (Power card → start-of-turn triggers):
//     block    → +N Block every turn
//     energy   → +N Energy every turn
//     draw     → +N Draw every turn
//     vuln     → applies N enemy Vulnerable every turn
const MATERIAL_TEMPLATES = {
  staff: [
    // The Workhorse — pure damage, no rider. Predictable, reliable.
    { id: 'mat-maple',    name: 'Maple Wood',  slot: 'staff', flavor: 'Clean grain, predictable yield.',
      stats: { chutzpah: 3 } },
    // The Glass Cannon — biggest damage in the game, but it COSTS.
    { id: 'mat-rosewood', name: 'Rosewood',    slot: 'staff', flavor: 'Heavy in the hand; quietly self-important. Every swing takes something from you.',
      stats: { chutzpah: 4, loseHp: 3 } },
    // The Shield — mid damage + cast Block rider + permanent Defense.
    { id: 'mat-cedar',    name: 'Cedar',       slot: 'staff', flavor: "Smells of someone's grandmother. Smells of protection.",
      stats: { chutzpah: 2, defense: 2 } },
    // The Chaos — moderate damage + chance rider (50% bonus Vuln, 50% self-Weak).
    { id: 'mat-madrone',  name: 'Madrone',     slot: 'staff', flavor: 'Burnished red. Reads the weather. Sometimes hits the wrong target.',
      stats: { chutzpah: 3, chance: 1, jnsq: 1 } },
    // The Slow Burn — low damage, punishing Weak rider.
    { id: 'mat-hemlock',  name: 'Hemlock',     slot: 'staff', flavor: "Slightly off in a way you can't place. The enemy noticed first.",
      stats: { chutzpah: 2, dot: 3 } },
  ],
  robes: [
    // Pure defensive baseline — damageReduction only.
    { id: 'mat-linen',       name: 'Linen Thread', slot: 'robes', flavor: 'Honest, plain, dependable. A robe that knows what a robe is for.',
      stats: { defense: 4 } },
    // Endurance tank — heals every combat, no DR.
    // Cycle 3 batch 5: relaunched at regen + extraStartHand. Different
    // identity from cycle 2's regen+draw (which dominated). Now Wild Silk
    // = "go-fast" robe (turn-1 hand size) for combo decks; competes with
    // burrgrass/wraithcloth but doesn't shadow them.
    { id: 'mat-wild-silk',   name: 'Wild Silk',    slot: 'robes', flavor: 'Cool to the touch, slightly haunted. It remembers the moth.',
      stats: { regen: 2, draw: 1 } },
    // Balanced hybrid — modest of everything.
    { id: 'mat-lichen',      name: 'Lichen Weave', slot: 'robes', flavor: 'Damp. Encouraging. Mildly photosynthetic.',
      stats: { defense: 1, regen: 1, draw: 1 } },
    // Card engine — heavy turn-1 draw, no defense.
    { id: 'mat-wraithcloth', name: 'Wraithcloth',  slot: 'robes', flavor: 'Drinks the light. Drinks several other things.',
      stats: { draw: 3 } },
    // Aggressive defender — DR + applies enemy Vuln at combat start.
    { id: 'mat-burrgrass',   name: 'Burrgrass',    slot: 'robes', flavor: 'Itches by design. The enemy will itch worse, eventually.',
      stats: { defense: 2, vuln: 1 } },
  ],
  ring: [
    // Passive DR ring — fits a defender build.
    { id: 'mat-iron',      name: 'Iron Ore',         slot: 'ring',  flavor: 'Plain. Reliable. Slightly rusted in places.',
      stats: { defense: 2 } },
    // Energy ring — +1 mana per turn (long-game compounder).
    { id: 'mat-copper',    name: 'Copper Ore',       slot: 'ring',  flavor: 'Conducts everything. Including embarrassment.',
      stats: { energy: 1 } },
    // Draw ring — +2 turn-1 hand size (combo enabler).
    { id: 'mat-silver',    name: 'Silver Ore',       slot: 'ring',  flavor: 'Bright, expensive, makes you feel watched.',
      stats: { draw: 2 } },
    // Debuff ring — applies enemy Weak at combat start + small DR.
    { id: 'mat-cold-iron', name: 'Cold Iron',        slot: 'ring',  flavor: 'Black, heavy, uncharmed. The fey would rather not.',
      stats: { weak: 1, defense: 1 } },
    // Combo ring — small bit of everything.
    { id: 'mat-mithril',   name: 'Mithril Filament', slot: 'ring',  flavor: 'Light as the idea of it. Suspiciously so.',
      stats: { energy: 1, draw: 1 } },
  ],
  hat: [
    // Per-turn block hat — defensive turn-by-turn.
    { id: 'mat-felt',          name: 'Felt',          slot: 'hat', flavor: 'Warm, forgiving, modestly opinionated.',
      stats: { block: 3 } },
    // Per-turn energy hat — the long-game power. Bigger spells every turn.
    { id: 'mat-suede',         name: 'Suede',         slot: 'hat', flavor: 'Stains if you look at it wrong. Apparently, magic.',
      stats: { energy: 1 } },
    // Hybrid hat — small block + small draw.
    { id: 'mat-tarred-canvas', name: 'Tarred Canvas', slot: 'hat', flavor: 'Waterproof, opinionated, smells of expedition.',
      stats: { block: 2, draw: 1 } },
    // Heavy draw hat — Wit-archetype enabler.
    { id: 'mat-brocade',       name: 'Brocade',       slot: 'hat', flavor: 'Heavy, ornate, deliberately ridiculous.',
      stats: { draw: 2 } },
    // Aggressive hat — applies enemy Vulnerable every turn.
    { id: 'mat-dragonwool',    name: 'Dragonwool',    slot: 'hat', flavor: 'Itches and shimmers and remembers the dragon. The enemy will, too.',
      stats: { vuln: 1 } },
  ],
};

// Skill events — found at Skill nodes on the map. Each event's `skill`
// field declares which craft it bumps; the map gen filters to skills
// whose act is still AHEAD of the player (you don't learn whittling
// the act after you've already built your staff). Resolver supports
// `fx.skill: { whittling: N }` etc. — see resolveEventChoice.
// Skill events use a "safe / risky / skip-with-bait" pattern. Every
// choice has a real trade so no option is dominated:
//   Safe pick   — +2 skill, no cost
//   Risky pick  — +4 skill but -1 MAX HP (permanent, not rest-healed)
//   Skip pick   — no skill but a real upside (HP heal, card, etc.)
const SKILL_EVENTS = [
  {
    id: 'skill-whittling-1',
    skill: 'whittling',
    title: 'A Mossy Whittling Block',
    flavor: 'A sturdy stump, a half-finished blank, and a knife with sentimental fingerprints. Someone left, presumably, before they were finished.',
    choices: [
      { label: 'Practice the long curve. (+2 Whittling, -8 HP)',             effects: { skill: { whittling: 2 }, loseHp: 8 } },
      { label: 'Carve until your hands cramp. (Trace the cut — up to +4 Whittling, -8 max HP)',    effects: { skill: { whittling: 4 }, maxHp: -8, minigame: 'trace-whittling' } },
      { label: 'Pocket the knife. Walk on. (+6 HP)',                          effects: { heal: 6 } },
    ],
  },
  {
    id: 'skill-whittling-2',
    skill: 'whittling',
    title: "Old Greb the Whittler",
    flavor: 'An old man sits beside the path, working a length of yew into a shape that does not declare itself. "Sit a while," he says. "I\'ll show you the trick. The trick is not what you think it is."',
    choices: [
      { label: 'Watch the trick. (+2 Whittling, -8 HP)',                     effects: { skill: { whittling: 2 }, loseHp: 8 } },
      { label: 'Sit for a long lesson. (Trace the cut — up to +4 Whittling, -8 max HP)',           effects: { skill: { whittling: 4 }, maxHp: -8, minigame: 'trace-whittling' } },
      { label: 'Decline. Old Greb gives you something instead. (+1 Common card)', effects: { gainCommonCard: 1 } },
    ],
  },
  {
    id: 'skill-weaving-1',
    skill: 'weaving',
    title: 'A Roadside Loom',
    flavor: 'It hums. Looms are not supposed to hum. This one is, apparently, an exception.',
    choices: [
      { label: 'Sit and practice. (+2 Weaving, -8 HP)',                      effects: { skill: { weaving: 2 }, loseHp: 8 } },
      { label: 'Try the difficult cross-warp. (+4 Weaving, -8 max HP)',      effects: { skill: { weaving: 4 }, maxHp: -8 } },
      { label: 'Step around it carefully. (+5 HP, it was warmer than it looked)', effects: { heal: 5 } },
    ],
  },
  {
    id: 'skill-weaving-2',
    skill: 'weaving',
    title: 'The Sewing Circle',
    flavor: 'Three women sit on a fence in a row. None of them speak. All of them sew. It is an enormous sock and they appear to be on the third foot.',
    choices: [
      { label: 'Join in. (+2 Weaving, -8 HP)',                               effects: { skill: { weaving: 2 }, loseHp: 8 } },
      { label: 'Stay until the fourth foot. (+4 Weaving, -8 max HP)',        effects: { skill: { weaving: 4 }, maxHp: -8 } },
      { label: 'Ask whose foot it is. (+1 Uncommon card)',                   effects: { gainUncommonCard: 1 } },
    ],
  },
  {
    id: 'skill-smithing-1',
    skill: 'smithing',
    title: 'A Travelling Forge',
    flavor: 'Coal smoke and a stranger pounding a hot bar into a shape you cannot, in the moment, identify. "Hold this," they say, before you have agreed to anything.',
    choices: [
      { label: 'Hold it. Carefully. (+2 Smithing, -8 HP)',                   effects: { skill: { smithing: 2 }, loseHp: 8 } },
      { label: 'Try the hammer yourself. (+4 Smithing, -8 max HP)',          effects: { skill: { smithing: 4 }, maxHp: -8 } },
      { label: 'Politely decline. (+1 Common card from the cart)',           effects: { gainCommonCard: 1 } },
    ],
  },
  {
    id: 'skill-smithing-2',
    skill: 'smithing',
    title: 'A Cooling Anvil',
    flavor: 'An anvil sits alone in a clearing, faintly warm. Around it: tongs, hammers, a kettle, and a brief note: BACK SHORTLY. PLEASE NO BANGING.',
    choices: [
      { label: 'Bang on it once, quietly. (+2 Smithing, -8 HP)',             effects: { skill: { smithing: 2 }, loseHp: 8 } },
      { label: 'Bang loudly. Take the consequences. (+4 Smithing, -8 max HP)', effects: { skill: { smithing: 4 }, maxHp: -8 } },
      { label: 'Read the note. Use the kettle. (+8 HP)',                     effects: { heal: 8 } },
    ],
  },
  {
    id: 'skill-felting-1',
    skill: 'felting',
    title: "A Milliner's Block",
    flavor: 'A wooden hat-block sits on a stump, slightly damp, alarmingly head-shaped. There are pins around it in the manner of a small ritual.',
    choices: [
      { label: 'Try a quick brimming exercise. (+2 Felting, -8 HP)',        effects: { skill: { felting: 2 }, loseHp: 8 } },
      { label: 'Block a felt with serious intent. (+4 Felting, -8 max HP)', effects: { skill: { felting: 4 }, maxHp: -8 } },
      { label: 'Tip your invisible hat at it. (+1 Common card)',             effects: { gainCommonCard: 1 } },
    ],
  },
  {
    id: 'skill-felting-2',
    skill: 'felting',
    title: 'The Old Hatter',
    flavor: '"It\'s about the brim," he tells you, before you have asked. "Everyone gets the crown right. The brim is where the wizard is."',
    choices: [
      { label: 'Study his brim work. (+2 Felting, -8 HP)',                  effects: { skill: { felting: 2 }, loseHp: 8 } },
      { label: 'Become an apprentice for the afternoon. (+4 Felting, -8 max HP)', effects: { skill: { felting: 4 }, maxHp: -8 } },
      { label: 'Argue about crowns. He throws you a hat. (+1 Uncommon card)', effects: { gainUncommonCard: 1 } },
    ],
  },
  // Cross-skill choice — pick which craft you'd rather invest in.
  // The "skip" path gives a real positive so it competes with the
  // skill picks (which are all currently +2, no cost — making this
  // the easy-mode skill node).
  {
    id: 'skill-crossroads',
    skill: 'any',
    title: 'A Crossroads Workshop',
    flavor: 'A tarp, a folding chair, and a sign: HALF AN HOUR\'S TUITION — PICK A CRAFT. The proprietor is asleep.',
    choices: [
      { label: '(Practice your weaving, if still relevant) (+2 Weaving, -8 HP)',   effects: { skill: { weaving: 2 }, loseHp: 8 } },
      { label: '(Practice your smithing, if still relevant) (+2 Smithing, -8 HP)', effects: { skill: { smithing: 2 }, loseHp: 8 } },
      { label: '(Practice your felting, if still relevant) (+2 Felting, -8 HP)',   effects: { skill: { felting: 2 }, loseHp: 8 } },
      { label: 'Leave the proprietor to it. (+6 HP, +1 Common card)',      effects: { heal: 6, gainCommonCard: 1 } },
    ],
  },
];

// Acts — four paths, one per equipment slot, with escalating
// difficulty. All four are ~15 rows long because Material and Skill
// nodes need room to compete with combat for the player's path
// budget. Slot order: robes → ring → hat → STAFF (the staff is the
// run's capstone item, crafted in the final act).
const ACTS = [
  { id: 1, slot: 'robes', name: 'The Thread Path',
    flavor: 'Threads, looms, and the things that walk between them. The right robes find the right wearer.',
    rows: 15, width: 4,
    bossId: 'e2-boss-tapestry',
    craft: 'weaving',
  },
  { id: 2, slot: 'ring',  name: 'The Forge Path',
    flavor: 'Coal, anvil, and a metal with opinions of its own. A ring earned at the forge fits no other hand.',
    rows: 15, width: 4,
    bossId: 'e3-boss-anvil',
    craft: 'smithing',
  },
  { id: 3, slot: 'hat',   name: "The Milliner's Path",
    flavor: "The hat does not, in itself, want to be worn. It does, however, have very specific opinions about by whom.",
    rows: 15, width: 4,
    bossId: 'e4-boss-headmasters-hat',
    craft: 'felting',
  },
  { id: 4, slot: 'staff', name: 'The Staff Path',
    flavor: 'The capstone. You walk into the deepest wood to claim a staff fit to graduate with. The school will know if you return without it.',
    rows: 15, width: 4,
    bossId: 'e1-boss-thornlord',
    craft: 'whittling',
  },
];

const SLOT_LABEL = { staff: 'Staff', robes: 'Robes', ring: 'Ring', hat: 'Hat', gem: 'Gem' };
const CRAFT_LABEL = { whittling: 'Whittling', weaving: 'Weaving', smithing: 'Smithing', felting: 'Felting' };

// Three wizard archetypes, one per lane. Selected at run start. Each
// commits the player to a specific voice + a specific (future) card pool.
// For now the only mechanical effect is that supply-shop offers are
// weighted toward the chosen lane's existing cards. When v2 pools ship
// (see design/{WIT,CHUTZPAH,JNSQ}_V2_DESIGN.md), this field will switch
// the player's draw pool entirely.
const CHARACTERS = [
  {
    id: 'wit-scholar',
    name: 'The Scholar',
    lane: 'wit',
    voice: 'Hawkeye / Fleabag',
    title: 'graduates by being unkindly correct',
    desc: 'Spells land because they say what nobody else dares to phrase. Cuts through arguments like a librarian through a hangover.',
    poolDoc: 'design/WIT_V2_DESIGN.md',
    tagPalette: ['academic', 'dismissive', 'observational', 'ironic', 'cutting'],
  },
  {
    id: 'chutzpah-bruiser',
    name: 'The Bruiser',
    lane: 'chutzpah',
    voice: 'Jack Burton / Walter Sobchak',
    title: 'graduates by refusing to leave the room',
    desc: 'Spells land because they will not be talked over. Volume is a kind of intelligence. So is staying.',
    poolDoc: 'design/CHUTZPAH_V2_DESIGN.md',
    tagPalette: ['demanding', 'threatening', 'dismissive', 'swaggering', 'direct'],
  },
  {
    id: 'jnsq-fool',
    name: 'The Fool',
    lane: 'jnsq',
    voice: 'Kramer / Charlie Kelly',
    title: 'graduates by going sideways through every door',
    desc: 'Spells land because nobody can find a foothold to disagree. The kitchen is rotating. Pay attention.',
    poolDoc: 'design/JNSQ_V2_DESIGN.md',
    tagPalette: ['mystical', 'absurd', 'chaotic', 'theatrical', 'conspiratorial'],
  },
];
const CHARACTERS_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

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

// Roll a weighted-random intent from the enemy's behavior list. `excludeKinds`
// is an optional list of intent kinds to skip — used by the anti-repetition
// system so an enemy can't fire the same intent (e.g. 'block') 3+ turns in
// a row. Falls back to the full behavior list if every option is excluded
// (e.g. an enemy whose only behaviors share one kind).
function rollIntent(enemy, excludeKinds = []) {
  const filtered = enemy.behaviors.filter(b => !excludeKinds.includes(b.kind));
  const pool = filtered.length > 0 ? filtered : enemy.behaviors;
  const total = pool.reduce((s, b) => s + (b.weight || 1), 0);
  let roll = Math.random() * total;
  for (const b of pool) {
    roll -= (b.weight || 1);
    if (roll <= 0) return { ...b };
  }
  return { ...pool[0] };
}

function buildStartingDeck(lane = 'wit') {
  const ids = buildStarterDeckForLane(lane);
  return shuffle(ids.map(id => ({ ...CARDS_BY_ID[id], uid: uid() })));
}

// Return a new card object representing the upgraded version of `card`.
// The upgrade field can override `effects`, `power`, `cost`, `stats`,
// `effect`, or `phrase`. Sets `upgraded: true` and "+"-suffixes the name.
function upgradeCard(card) {
  if (!card.upgrade) return card; // already-upgraded or no path
  const up = card.upgrade;
  const next = {
    ...card,
    uid: uid(),
    name: card.upgraded ? card.name : `${card.name}+`,
    upgraded: true,
    upgrade: null, // can only upgrade once
  };
  if (up.effects) next.effects = { ...card.effects, ...up.effects };
  if (up.power)   next.power   = { ...card.power, ...up.power };
  if (up.stats)   next.stats   = { ...card.stats, ...up.stats };
  if (up.effect)  next.effect  = { ...card.effect, ...up.effect };
  if (up.phrase !== undefined) next.phrase = up.phrase;
  if (up.cost !== undefined)   next.cost   = up.cost;
  return next;
}

// Crafting output factory. Takes the chosen material + quality grade
// + skill level and produces either a CARD (for staff/hat — goes into
// the deck) or a stat-stick EQUIPMENT (for robes/ring — goes into the
// equipment[] slot). The two output shapes correspond to the per-slot
// mechanic decided in the design memo:
//   staff = one-shot drawable Effect
//   hat   = drawable Power
//   robes = permanent install via equipment bonus
//   ring  = per-turn tick via equipment bonus
//
// Quality multipliers: rough 0.5, fine 1.0, master 1.5.
const QUALITY_MULT = { rough: 0.5, fine: 1.0, master: 1.5 };
const QUALITY_LABEL = { rough: 'Rough', fine: 'Fine', master: 'Master' };

function buildCraftedEquipment({ slot, material, quality, skill }) {
  const q = QUALITY_MULT[quality] ?? 1.0;
  const qLabel = QUALITY_LABEL[quality] || 'Fine';
  const matStats = material.stats || {};
  const mult = (v) => Math.max(1, Math.round((v || 0) * q));
  const namePrefix = `${qLabel} ${material.name}`;
  const craftedMeta = { slot, materialId: material.id, quality, skill };

  if (slot === 'staff') {
    // Drawable Effect card. Material's stat profile shapes both the
    // numbers AND the card's "feel" — Rosewood is glass-cannon,
    // Cedar is defensive, Madrone is chaos, Hemlock is control.
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
      scaleBy: 'chutzpah',
      base: baseAtk,
      multiplier: multAtk,
      damageType: 'composure',
      resonatesWith: Array.from(new Set(resonatesWith)),
      resonanceBonus: { perTag: Math.max(2, Math.round(3 * q)) },
      exhaust: false,
    };
    const rider = {};
    if ((matStats.defense || 0) > 0) rider.block = mult(matStats.defense * 2);
    if ((matStats.dot || 0)     > 0) rider.weak  = matStats.dot;
    if (Object.keys(rider).length) effect.rider = rider;
    if ((matStats.loseHp || 0) > 0)  effect.loseHpOnPlay = matStats.loseHp;
    if ((matStats.chance || 0) > 0)  effect.chance = { prob: 0.5, success: { enemyVulnerable: 2 }, failure: { selfWeak: 1 } };
    const riderText = [];
    if (rider.block)         riderText.push(`Gain ${rider.block} Block`);
    if (rider.weak)          riderText.push(`apply ${rider.weak} Weak`);
    if (effect.loseHpOnPlay) riderText.push(`lose ${effect.loseHpOnPlay} HP`);
    if (effect.chance)       riderText.push(`50%: +2 Vuln / 50%: gain 1 Weak`);
    const card = {
      id: `eq-staff-${material.id}-${quality}`,
      name: `${namePrefix} Staff`,
      cost: 2,
      type: 'effect',
      rarity: 'rare',
      effect,
      phrase: '…and that is what the Staff says, and the Staff does not say it twice.',
      desc: `Cast: ${baseAtk} + Chutzpah×${multAtk} Composure${riderText.length ? '. ' + riderText.join('. ') + '.' : '.'}`,
      flavor: material.flavor,
      crafted: craftedMeta,
    };
    // Cedar also confers passive Defense (the staff has a guard).
    if ((matStats.defense || 0) > 0) card.bonus = { damageReduction: Math.max(0, Math.round(matStats.defense * q / 2)) };
    return { kind: 'card', card };
  }
  if (slot === 'hat') {
    // Drawable Power. Material stats map directly to startOfTurn keys.
    // No more "defense → DR" on hats — hats are turn-based effects.
    const turnBlock  = mult(matStats.block || 0);
    const turnEnergy = matStats.energy || 0; // integer, no quality scaling
    const turnDraw   = matStats.draw || 0;
    const turnVuln   = matStats.vuln || 0;
    const power = { startOfTurn: {} };
    if (turnBlock > 0)  power.startOfTurn.block      = turnBlock;
    if (turnEnergy > 0) power.startOfTurn.energy     = turnEnergy + (quality === 'master' ? 1 : 0);
    if (turnDraw > 0)   power.startOfTurn.draw       = turnDraw + (quality === 'master' ? 1 : 0);
    if (turnVuln > 0)   power.startOfTurn.vulnerable = turnVuln + (quality === 'master' ? 1 : 0);
    const descParts = [];
    if (power.startOfTurn.block)      descParts.push(`+${power.startOfTurn.block} Block`);
    if (power.startOfTurn.energy)     descParts.push(`+${power.startOfTurn.energy} Energy`);
    if (power.startOfTurn.draw)       descParts.push(`+${power.startOfTurn.draw} draw`);
    if (power.startOfTurn.vulnerable) descParts.push(`apply ${power.startOfTurn.vulnerable} Vulnerable`);
    const card = {
      id: `eq-hat-${material.id}-${quality}`,
      name: `${namePrefix} Hat`,
      cost: 1,
      type: 'power',
      rarity: 'rare',
      power,
      desc: `At the start of each turn: ${descParts.join(', ') || 'nothing (a Rough hat is mostly hat).'}`,
      flavor: material.flavor,
      crafted: craftedMeta,
    };
    return { kind: 'card', card };
  }
  if (slot === 'robes') {
    // Permanent install. defense→DR, regen→combat-start heal,
    // draw→turn-1 hand, vuln→applies enemy Vulnerable at combat start.
    const def   = Math.max(0, Math.round((matStats.defense || 0) * q / 2));
    const regen = matStats.regen || 0;
    const drawN = matStats.draw || 0;
    const vuln  = matStats.vuln || 0;
    const bonus = {};
    if (def > 0)   bonus.damageReduction  = def;
    if (regen > 0) bonus.healOnCombatStart = mult(regen * 2);
    if (drawN > 0) bonus.extraStartHand    = drawN + (quality === 'master' ? 1 : 0);
    if (vuln > 0)  bonus.startCombatVulnerable = vuln + (quality === 'master' ? 1 : 0);
    const descParts = [];
    if (bonus.damageReduction)        descParts.push(`+${bonus.damageReduction} Defense`);
    if (bonus.healOnCombatStart)      descParts.push(`Heal ${bonus.healOnCombatStart} HP at combat start`);
    if (bonus.extraStartHand)         descParts.push(`draw +${bonus.extraStartHand} on turn 1`);
    if (bonus.startCombatVulnerable)  descParts.push(`apply ${bonus.startCombatVulnerable} Vulnerable to enemy at combat start`);
    return {
      kind: 'equipment',
      equipment: {
        id: `eq-robes-${material.id}-${quality}`,
        name: `${namePrefix} Robes`,
        bonus,
        desc: descParts.join('. ') + '.',
        flavor: material.flavor,
        crafted: craftedMeta,
      },
    };
  }
  if (slot === 'ring') {
    // Per-combat triggers. defense→DR, energy→permanent energy,
    // draw→turn-1 hand, weak→applies enemy Weak at combat start.
    const bonus = {};
    if ((matStats.energy || 0)  > 0) bonus.permanentEnergyBonus = matStats.energy;
    if ((matStats.draw || 0)    > 0) bonus.extraStartHand       = matStats.draw + (quality === 'master' ? 1 : 0);
    if ((matStats.defense || 0) > 0) bonus.damageReduction      = Math.max(0, Math.round((matStats.defense || 0) * q / 2));
    if ((matStats.weak || 0)    > 0) bonus.startCombatWeak      = matStats.weak + (quality === 'master' ? 1 : 0);
    if (Object.keys(bonus).length === 0) bonus.damageReduction = 1;
    const descParts = [];
    if (bonus.permanentEnergyBonus) descParts.push(`+${bonus.permanentEnergyBonus} Energy per turn`);
    if (bonus.extraStartHand)       descParts.push(`draw +${bonus.extraStartHand} on turn 1`);
    if (bonus.damageReduction)      descParts.push(`+${bonus.damageReduction} Defense`);
    if (bonus.startCombatWeak)      descParts.push(`apply ${bonus.startCombatWeak} Weak to enemy at combat start`);
    return {
      kind: 'equipment',
      equipment: {
        id: `eq-ring-${material.id}-${quality}`,
        name: `${namePrefix} Ring`,
        bonus,
        desc: descParts.join('. ') + '.',
        flavor: material.flavor,
        crafted: craftedMeta,
      },
    };
  }
  return null;
}

// Pathetic salvage material used when the player gathered nothing for
// this act's slot. Boss-drop fallback; forces Rough quality.
function salvageMaterial(slot) {
  return {
    id: `salvage-${slot}`,
    name: 'Salvaged Scrap',
    slot,
    flavor: 'You found it on the boss. Frankly, you wish you had not.',
    stats: { defense: 1 },
  };
}

function pickCardByRarity(rarityWeights = { common: 4, uncommon: 1 }, exclude = [], lane = null) {
  // Lane filter: when set, only cards matching that lane OR lane-agnostic
  // utility cards (skill/power without a `lane` field) qualify. Used by the
  // reward flow so v2 characters draw from their own card pool.
  const matchesLane = (c) => {
    if (!lane) return true;
    if (!c.lane) return true; // utility / familiar / power — open to all lanes
    return c.lane === lane;
  };
  const pool = CARDS.filter(c => rarityWeights[c.rarity] && !exclude.includes(c.id) && matchesLane(c));
  if (pool.length === 0) return null;
  const total = pool.reduce((s, c) => s + rarityWeights[c.rarity], 0);
  let r = Math.random() * total;
  for (const c of pool) {
    r -= rarityWeights[c.rarity];
    if (r <= 0) return c;
  }
  return pool[0];
}

function pickRelicByRarity(rarityWeights = { common: 3, uncommon: 2, rare: 1 }, excludeIds = []) {
  const pool = RELICS.filter(r => rarityWeights[r.rarity] && !excludeIds.includes(r.id));
  if (pool.length === 0) return null;
  const total = pool.reduce((s, r) => s + rarityWeights[r.rarity], 0);
  let r = Math.random() * total;
  for (const relic of pool) {
    r -= rarityWeights[relic.rarity];
    if (r <= 0) return relic;
  }
  return pool[0];
}

// STS-style branching DAG generator. Material + skill nodes are
// injected at fixed rows (3/7/11 = material, 5/9 = skill) so the
// player's route choice is deterministic at the strategic level —
// you can see "row 3 has the wood gather, route accordingly".
function generateActMap(rows, width) {
  const nodes = [];
  const rng = Math.random;
  // Row 0 is one Town hub — three paths radiate outward into the act.
  // Was 2-3 separate trailheads; collapsed per the Town + sidequests plan
  // ([[wg-town-and-sidequests]]). Future slices add NPC offers + sidequest
  // forks; for now the Town is purely the single shared starting node.
  nodes.push({ id: `n-0-0`, row: 0, col: 0, type: 'town',
    x: spacedX(0, 1, width), y: rowY(0, rows) });
  const materialRows = new Set([3, 7, 11]);
  const skillRows    = new Set([5, 9]);
  const preBossRow   = rows - 2; // Always rest before the boss, every path.
  for (let r = 1; r < rows - 1; r++) {
    // Row 1 is the Town's immediate fanout — pinned at 3 so the player
    // always sees three distinct first-step paths. Other rows vary 2-3.
    const w = r === 1 ? 3 : (2 + Math.floor(rng() * 2));
    // Material/skill rows used to force EVERY column to be that type —
    // 6-9 material nodes visible on the map but the player could only
    // pick one per row. Now one column per material/skill row is the
    // special tile and the rest are normal mix. Player's path may or
    // may not cross the material; typical outcome is 2 materials per
    // act with max 3 if the path is lucky.
    const materialCol = materialRows.has(r) ? Math.floor(rng() * w) : -1;
    const skillCol    = skillRows.has(r)    ? Math.floor(rng() * w) : -1;
    for (let c = 0; c < w; c++) {
      // Pre-boss row is ALL rest — every path lands at an inn before the
      // boss so the player gets one HP/Composure top-off no matter how
      // they routed through the act.
      const t = r === preBossRow      ? 'rest'
              : c === materialCol     ? 'material'
              : c === skillCol        ? 'skill'
              :                         pickNodeType(r, rows);
      nodes.push({ id: `n-${r}-${c}`, row: r, col: c,
        type: t,
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
      // Town (row 0) fans out to ALL row-1 nodes so the player genuinely
      // sees the three branching directions instead of a random 1-2 slice.
      // Every other row keeps the random-fanout that gives the map its
      // STS-style "pick a lane and ride it" feel.
      if (a.type === 'town') {
        edges[a.id] = next.map(n => n.id);
      } else {
        const sorted = [...next].sort((x, y) => Math.abs(x.col - a.col) - Math.abs(y.col - a.col));
        const links = sorted.slice(0, 1 + Math.floor(rng() * 2));
        edges[a.id] = links.map(n => n.id);
      }
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
    // Forge nodes were removed — equipment now drops only from the act
    // boss (Master tier). Map distribution skews toward combat with
    // events and rest as breathers, plus the occasional elite.
    const roll = rng();
    if (roll < 0.58) return 'combat';
    if (roll < 0.78) return 'event';
    if (roll < 0.92) return 'rest';
    return 'elite';
  }
}

// Module-level positioning helpers — hoisted out of generateActMap so
// seedSidequestSpurs / spawnRemainingSpur can use the same math without
// re-inlining it. Previously inlined twice and bit us once with a
// rowY-scope ReferenceError.
function spacedX(c, w, totalCols) {
  if (w === 1) return totalCols / 2;
  const pad = 0.5;
  return pad + (c * (totalCols - 1)) / (w - 1);
}
function rowY(r, totalRows) { return totalRows - 1 - r; }

// Add 0-1 sidequest hooks to a placed map. A "hook" is just the FIRST
// node of a sidequest — placed at a normal row, looking like any other
// event/combat (no special visual). Reachable from at least one row-prior
// main node. The REST of the sidequest chain spawns lazily on first
// engagement via spawnRemainingSpur, so the player doesn't see the
// chain until they commit. Each spur node consumes one row of progress,
// keeping the sidequest path at the same boss-distance as the main path.
function seedSidequestSpurs(map, actId, rows, cols) {
  if (!map) return map;
  if (Math.random() > 0.6) return map;
  const pool = SIDEQUESTS_BY_ACT[actId] || [];
  if (pool.length === 0) return map;
  const sqId = pool[Math.floor(Math.random() * pool.length)];
  const tpl = SIDEQUEST_TEMPLATES[sqId];
  if (!tpl) return map;
  const spurLen = tpl.nodes.length;

  // Pick start row R. Boss shortcuts start earlier so the bypass meaningfully
  // skips later-act content. Loop-back quests need (spurLen) rows ahead of R
  // before hitting the pre-boss rest row.
  const minR = 1;
  const maxR = tpl.bossShortcut
    ? Math.min(3, rows - 3)
    : Math.max(minR, rows - 2 - spurLen);
  if (maxR < minR) return map;
  const startR = minR + Math.floor(Math.random() * (maxR - minR + 1));

  // First sidequest node: place at row R, right of the existing row R nodes.
  const existingInRow = map.nodes.filter(n => n.row === startR);
  const maxX = existingInRow.length > 0 ? Math.max(...existingInRow.map(n => n.x)) : (cols / 2);
  const firstBeat = tpl.nodes[0];
  const firstType = firstBeat.kind === 'combat' ? 'combat' : 'event';
  const firstNode = {
    id: `sq-${sqId}-0`,
    row: startR,
    col: -1,
    type: firstType,
    x: Math.min(cols - 0.3, maxX + 0.9),
    y: rowY(startR, rows),
    sidequestRef: { templateId: sqId, nodeIdx: 0 },
    // No isSidequest flag — looks identical to a normal node.
  };

  // Connect from at least one row-(startR-1) main node, picking the
  // rightmost so the visual flow makes geometric sense.
  const prevRow = map.nodes.filter(n => n.row === startR - 1);
  const newEdges = { ...map.edges };
  if (prevRow.length > 0) {
    const entry = prevRow.reduce((a, b) => (a.x > b.x ? a : b));
    newEdges[entry.id] = [...(newEdges[entry.id] || []), firstNode.id];
  }
  return { ...map, nodes: [...map.nodes, firstNode], edges: newEdges };
}

// =============================================================================
// 3. App
// =============================================================================

const STARTING_MAX_HP = 70;
// Composure — the player's "verbal HP." Some enemies (Tapestry's loom song,
// the Headmaster's withering remarks) target this instead of HP. Drops to 0
// = you lose your nerve = defeat. Block and Defense protect both pools.
const STARTING_MAX_COMPOSURE = 30;
// Each craft skill caps at this level. C3's crafting minigame reads
// the current level and widens the gauge / softens the chooser.
const SKILL_MAX = 5;
const ENERGY_PER_TURN = 3;
const HAND_SIZE = 5;
// Heal a fraction of max HP between acts (STS-style act transition heal).
// Cycle 3 batch 3: 0.40 → 0.55. Players reaching Act 3+ are too damaged
// to survive late-act bosses. Bigger between-act recovery gives a real
// shot at deep runs.
const INTER_ACT_HEAL_RATIO = 0.55;

// v2 tray initial state. The intro/subject/target/modifiers fields are the
// primary truth. Legacy fields (chutzpah/wit/jnsq totals, tags, words array,
// effectCard) are computed mirrors kept populated for back-compat reads
// scattered through the older codebase (previewSway, certain log paths).
function initialV2Tray(overrides = {}) {
  return {
    intro: null, subject: null, target: null, modifiers: [],
    chutzpah: 0, wit: 0, jnsq: 0,
    phrases: [], tags: [], words: [],
    effectCard: null,
    effectFiredThisTurn: false,
    ...overrides,
  };
}

// Rebuild the legacy mirror fields from the v2 slot truth. Called any time
// we mutate intro / subject / target / modifiers.
function syncTrayLegacy(t) {
  const cards = [t.intro, t.subject, ...(t.modifiers || [])].filter(Boolean);
  const out = { chutzpah: 0, wit: 0, jnsq: 0, phrases: [], tags: [], words: [...cards] };
  for (const c of cards) {
    out.chutzpah += c.stats?.chutzpah || 0;
    out.wit      += c.stats?.wit      || 0;
    out.jnsq     += c.stats?.jnsq     || 0;
    if (c.phrase) out.phrases.push(c.phrase);
    if (c.tags) out.tags.push(...c.tags);
  }
  return { ...t, ...out, effectCard: t.target };
}

export default function App() {
  // Stage flow:
  //   menu → map → (combat / event / rest / reward) → map →
  //   act-cleared → map (next act) → ... → graduation / defeat
  //   Equipment is granted only on boss kill (Master tier). Forge
  //   nodes were removed in the simplification pass.
  const [stage, setStage] = useState('menu');

  // Run-wide player state
  const [maxHp, setMaxHp] = useState(STARTING_MAX_HP);
  const [hp, setHp] = useState(STARTING_MAX_HP);
  const [composureMax, setComposureMax] = useState(STARTING_MAX_COMPOSURE);
  const [composure, setComposure] = useState(STARTING_MAX_COMPOSURE);
  const [block, setBlock] = useState(0);
  const [energy, setEnergy] = useState(ENERGY_PER_TURN);
  const [deck, setDeck] = useState([]);
  const [hand, setHand] = useState([]);
  const [discard, setDiscard] = useState([]);
  const [exiled, setExiled] = useState([]);
  const [equipment, setEquipment] = useState([]);
  // Powers — `type: 'power'` cards live here for the duration of one combat
  // and fire their triggers (startOfTurn / endOfTurn / onEffectCardPlayed).
  // Cleared at combat start.
  const [powers, setPowers] = useState([]);
  // Relics — persistent across the whole run. Earned from elites / boss
  // kills / treasure nodes / events. Effects fire via the same hooks
  // dispatcher used by equipment + powers.
  const [relics, setRelics] = useState([]);
  // Familiar + chosen name. Both selected during the town intro (supply
  // shop → familiar shop → name screen) before the first map appears.
  // familiar.bonus is treated as a permanent effect source like a relic.
  const [familiar, setFamiliar] = useState(null);
  const [familiarName, setFamiliarName] = useState('');
  // Wizard archetype selected at run start. Determines lane bias for offers
  // and (when v2 card pools ship) the entire draw pool.
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  // Which two cards the player chose from STARTING_PICKS_POOL. Tracked as
  // an array so toggle-to-deselect works; commit happens when length === 2.
  const [startingPicksSelected, setStartingPicksSelected] = useState([]);
  // Pending minigame prompt. Set when a skill-event choice carries a
  // `minigame` field — the resolver defers the effect, fires the
  // minigame, and applies a graded outcome based on the player's
  // performance instead of the deterministic effect.
  // Shape: { kind: 'trace-whittling', baseEffects: {...}, eventTitle: string }
  const [skillMinigame, setSkillMinigame] = useState(null);
  // Sidequest state. Spurs are now part of the placed map (see
  // seedSidequestSpurs). When the player walks onto a spur node,
  // resolveNodeEnter sets sidequestActive = { templateId, nodeIdx } and
  // routes to the appropriate stage. sidequestCombatActive is the flag
  // onEnemyDefeated reads to skip the normal reward flow.
  const [sidequestActive, setSidequestActive] = useState(null);
  const [sidequestCombatActive, setSidequestCombatActive] = useState(false);
  // Postcard mechanic (sq-jazz-cafe ongoing quest). State machine:
  //   idle      → no quest accepted yet
  //   active    → quest accepted, tracking node-counter
  //   completed → 3 correct sends made; next mailbox click is the reward
  //   failed    → wrong submission; fog active; next mailbox click rebukes
  //   done      → quest fully resolved (reward or rebuke applied)
  // postcardsCorrect counts only while state === 'active'.
  // nodesSincePostcard increments on every node entry; resets on submit.
  const [postcardState, setPostcardState] = useState('idle');
  const [postcardPhrase, setPostcardPhrase] = useState(null);
  const [postcardsCorrect, setPostcardsCorrect] = useState(0);
  const [nodesSincePostcard, setNodesSincePostcard] = useState(0);
  const [postcardModalOpen, setPostcardModalOpen] = useState(false);

  // Insult prompt — when player casts an insult card, this holds the
  // card + a slate of 3 random nouns/verbs/adjectives to pick from.
  // Shape: { card, phase, samples: { noun, verb, adjective }, picks: [] }
  const [insultPrompt, setInsultPrompt] = useState(null);
  // In-game menu / pause overlay.
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  // True if localStorage holds a saved run we can resume.
  const [hasSavedRun, setHasSavedRun] = useState(false);
  // Supply shop draft state. Cleared after exit.
  const [supplyChoices, setSupplyChoices] = useState([]); // 5 candidate cards
  const [supplyPicks, setSupplyPicks] = useState([]);     // indices already picked (max 2)
  // Player debuffs (mirror of enemy ones). Tick down at end of turn.
  // Damage multipliers replace the old Weak/Vulnerable; see combat
  // state declarations below. Helpers clamp to [0.5, 1.5].
  function adjustEnemyDmg(delta)  { setEnemyDmgMult(m  => Math.max(0.5, Math.min(1.5, m + delta))); }
  function adjustPlayerDmg(delta) { setPlayerDmgMult(m => Math.max(0.5, Math.min(1.5, m + delta))); }
  // Attack counter for everyNthAttack relic hooks (resets each combat).
  // Count of effect cards cast this run (drives everyNthEffect relic).
  const [effectCount, setEffectCount] = useState(0);

  // Act + map state
  const [currentActIdx, setCurrentActIdx] = useState(0);
  const [map, setMap] = useState(null);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [clearedNodes, setClearedNodes] = useState([]);

  // Combat state
  const [enemy, setEnemy] = useState(null);
  const [enemyComposure, setEnemyComposure] = useState(0);
  const [enemyHp, setEnemyHp] = useState(0);
  const [enemyBlock, setEnemyBlock] = useState(0);
  const [enemyIntent, setEnemyIntent] = useState(null);
  // Track the last 2 intent kinds the enemy actually fired (in order).
  // Used to anti-repetition the next roll: if both are the same kind,
  // the next rollIntent excludes that kind. Reset per combat.
  const [lastIntentKinds, setLastIntentKinds] = useState([]);
  // Increments every time a new intent rolls. Used as a render key so
  // the intent box flashes empty-then-back even when the new intent is
  // the same KIND as the previous (e.g. Block after Block) — was hard
  // to tell anything had changed otherwise.
  const [intentTick, setIntentTick] = useState(0);
  // Damage multipliers — replace the old discrete Weak/Vulnerable
  // status. Each modifier card / enemy intent shifts the multiplier
  // by ±0.25, clamped to [0.5, 1.5]. Drifts 0.25 toward 1.0 each
  // end-of-turn so stacks don't lock the fight.
  //   enemyDmgMult  — applied to enemy outgoing damage (was: playerVuln +50%, enemyWeak -25%)
  //   playerDmgMult — applied to player outgoing spell damage (was: enemyVuln +50%, playerWeak -25%)
  const [enemyDmgMult, setEnemyDmgMult] = useState(1.0);
  const [playerDmgMult, setPlayerDmgMult] = useState(1.0);
  // Read the Room — next Effect this turn ignores enemy effectiveness
  // multiplier. Set true on play, consumed by castStagedSpell.
  const [pierceNextCast, setPierceNextCast] = useState(false);
  // Iron Stomach — next chutzpah cast this turn deals +N%. Number, not bool
  // (e.g., 0.5 = +50%). Consumed only when a chutzpah-scaling cast fires.
  const [boostNextChutzpahCast, setBoostNextChutzpahCast] = useState(0);
  // Visceral feedback — short-lived state flipped when the enemy takes
  // damage. The CombatScreen reads these and applies the hit-shake
  // class + renders damage-number floaters.
  const [enemyHitFlash, setEnemyHitFlash] = useState(0);
  // Mirror of enemyHitFlash for the player HUD — flips when an enemy
  // intent actually lands damage on either pool. Re-keys the player card
  // so the same shake animation runs.
  const [playerHitFlash, setPlayerHitFlash] = useState(0);
  const [dmgFloaters, setDmgFloaters] = useState([]);

  // Push a damage floater + trigger the enemy hit-shake. Auto-removes
  // the floater after the animation duration.
  function showDamageFloater(amount, dmgType) {
    if (amount <= 0) return;
    const id = uid();
    setDmgFloaters(prev => [...prev, { id, amount, dmgType }]);
    setEnemyHitFlash(Date.now());
    setTimeout(() => {
      setDmgFloaters(prev => prev.filter(f => f.id !== id));
    }, 900);
  }

  // Spell tray — accumulates as the player plays word cards this turn.
  // `phrases` is the running list of fragment text; `effectFiredThisTurn`
  // tracks whether ANY effect card has resolved the tray (used to detect
  // fizzles at end-of-turn).
  const [tray, setTray] = useState(initialV2Tray());
  // Amplify escalates: 1st play costs base (1), every play after costs +1.
  // Resets per combat. The cap on playerDmgMult (1.5) already limits how
  // many times it does anything; the escalating cost stops you from cheaply
  // spamming it to reach the cap.
  const [amplifyPlaysThisCombat, setAmplifyPlaysThisCombat] = useState(0);

  // Tutorial — when active, a scripted Bursar fight teaches the verbal
  // combat system step-by-step. Step advances on specific player actions
  // (see advanceTutorialStep). `tutorialActive` short-circuits onEnemyDefeated
  // and applyDamageToPlayer's KO path so the player can learn safely.
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Reward / event / rest state
  const [rewardChoices, setRewardChoices] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [restNode, setRestNode] = useState(null);
  // When set, shows the "you received this card" modal. Used after
  // events / shops that hand the player cards silently. Shape:
  // { cards: [...card objects...], title?, body? } — null means no modal.
  const [cardGrantPrompt, setCardGrantPrompt] = useState(null);

  // ---- Crafting state (Commit 2: gather; Commit 3: craft) ----
  // Inventory of raw materials gathered per slot during this act and
  // carried forward. Each entry is a full material template (id, name,
  // slot, flavor, stats). At end-of-act crafting time (Commit 3) the
  // current act's slot is read out and used in the minigame.
  const [inventory, setInventory] = useState({ staff: [], robes: [], ring: [], hat: [] });
  // Skill levels — earned at Skill nodes. Persistent across acts but
  // only EARNED while the relevant act is still ahead (see
  // isSkillRelevant). Caps at SKILL_MAX.
  const [skills, setSkills] = useState({ whittling: 0, weaving: 0, smithing: 0, felting: 0 });
  // The chooser shown at a Material node: 3 randomly-rolled variants
  // of the current act's slot. null = no chooser open.
  const [materialChoices, setMaterialChoices] = useState(null);
  // The skill event currently being resolved. null = not on a skill node.
  const [activeSkillEvent, setActiveSkillEvent] = useState(null);
  // Crafting screen prompt — set when the act's boss is defeated and the
  // crafting flow opens. Shape:
  //   { slot, materials: [], skill: N, phase: 'choose' | 'gauge' | 'result',
  //     chosenMaterial: matObj | null, quality: 'rough'|'fine'|'master' | null,
  //     gaugeWidth: 0-1, result: cardObj | null }
  const [craftingPrompt, setCraftingPrompt] = useState(null);
  // Card-upgrade picker at rest sites. When set, shows the deck and lets
  // the player pick one non-upgraded card to upgrade.
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Log
  const [log, setLog] = useState([]);
  const pushLog = (s) => {
    setLog(prev => [...prev.slice(-20), s]);
    // Relic firings always include 📿 in the log line — piggyback off
    // that convention to emit a telemetry event without instrumenting
    // every onCombatEnd / onEnemyDefeated / onTurnStart / onCardPlay
    // call site individually.
    if (typeof s === 'string' && s.includes('📿')) {
      logEvent('relic.fire', { message: s, hp, composure });
    }
  };

  const currentAct = ACTS[currentActIdx];

  // All passive-effect sources (relics + familiar bonus) flattened into a
  // single list of `{ effect, sourceName }` for the loops that read hooks.
  // Use this everywhere a relic loop reads `r.effect.*`.
  function effectSources() {
    const arr = relics.map(r => ({ effect: r.effect, sourceName: r.name }));
    if (familiar?.bonus) arr.push({ effect: familiar.bonus, sourceName: familiarName || familiar.species });
    return arr;
  }

  // Energy refill per turn — base + permanentEnergyBonus from equipment +
  // relics + familiar bonus.
  const energyPerTurnRefill = () => {
    return ENERGY_PER_TURN
      + equipment.reduce((s, eq) => s + (eq.bonus?.permanentEnergyBonus || 0), 0)
      + effectSources().reduce((s, x) => s + (x.effect?.permanentEnergyBonus || 0), 0);
  };

  // ---------- TUTORIAL ----------
  // Scripted practice match. Reset player state, build a small fixed
  // deck, force the opening hand so the player always has a Word + a
  // matching Effect on turn 1, and enter combat against the Bursar.
  // Save / Load -------------------------------------------------------------
  // We persist only when the player chooses Save & Quit from the in-game
  // menu. Combat / sidequest-beat states aren't safe to save mid-flight
  // (closure-stale refs, animation timing), so save is only enabled while
  // stage === 'map'. Run state shape is versioned so we can invalidate
  // saves cleanly if the data model changes.
  const SAVE_KEY = 'wg-saved-run-v1';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) setHasSavedRun(true);
    } catch (_) { /* localStorage unavailable; just don't show Continue */ }
  }, []);

  function saveRunSnapshot() {
    if (stage !== 'map') return false;
    const snapshot = {
      v: 1,
      maxHp, hp, composureMax, composure, energy,
      deck, hand, discard, exiled,
      inventory, skills,
      equipment, powers, relics,
      familiar, familiarName,
      selectedCharacterId: selectedCharacter?.id || null,
      effectCount,
      currentActIdx, map, currentNodeId, clearedNodes,
      sidequestActive,
      log: log.slice(-50),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
      setHasSavedRun(true);
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadRunSnapshot() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return false;
      setMaxHp(s.maxHp); setHp(s.hp);
      setComposureMax(s.composureMax); setComposure(s.composure);
      setBlock(0); setEnergy(s.energy);
      setDeck(s.deck || []); setHand(s.hand || []);
      setDiscard(s.discard || []); setExiled(s.exiled || []);
      setInventory(s.inventory || { staff: [], robes: [], ring: [], hat: [] });
      setSkills(s.skills || { whittling: 0, weaving: 0, smithing: 0, felting: 0 });
      setEquipment(s.equipment || []);
      setPowers(s.powers || []);
      setRelics(s.relics || []);
      setFamiliar(s.familiar || null);
      setFamiliarName(s.familiarName || '');
      setSelectedCharacter(s.selectedCharacterId ? (CHARACTERS_BY_ID[s.selectedCharacterId] || null) : null);
      setEffectCount(s.effectCount || 0);
      setCurrentActIdx(s.currentActIdx || 0);
      setMap(s.map || null);
      setCurrentNodeId(s.currentNodeId || null);
      setClearedNodes(s.clearedNodes || []);
      setSidequestActive(s.sidequestActive || null);
      setLog(s.log || []);
      setStage('map');
      pushLog(`📜 Run resumed.`);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSavedRun() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
    setHasSavedRun(false);
  }

  // Resume from the saved run (called from MenuScreen).
  function continueRun() {
    if (loadRunSnapshot()) return;
    // Failed to load — clear so the Continue button disappears.
    clearSavedRun();
  }

  // Save & Quit: serialize current run, then return to main menu.
  function saveAndQuit() {
    const ok = saveRunSnapshot();
    if (!ok) {
      // Saving failed (e.g., in combat). Tell the user and bail.
      pushLog(`⚠ Cannot save mid-combat. Resolve the current step first.`);
      setGameMenuOpen(false);
      return;
    }
    setGameMenuOpen(false);
    setStage('menu');
  }

  // Give Up: wipe state + saved run, return to main menu.
  function giveUpRun() {
    clearSavedRun();
    setGameMenuOpen(false);
    setStage('menu');
  }

  function startTutorial() {
    setMaxHp(STARTING_MAX_HP);
    setHp(STARTING_MAX_HP);
    setComposureMax(STARTING_MAX_COMPOSURE);
    setComposure(STARTING_MAX_COMPOSURE);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    setStartingPicksSelected([]);
    setSidequestActive(null);
    setSidequestCombatActive(false);
    setPostcardState('idle');
    setPostcardPhrase(null);
    setPostcardsCorrect(0);
    setNodesSincePostcard(0);
    setPostcardModalOpen(false);
    setExiled([]);
    setEquipment([]);
    setPowers([]);
    setRelics([]);
    setFamiliar(null);
    setFamiliarName('');
    setEffectCount(0);
    setTray(initialV2Tray());
    setInventory({ staff: [], robes: [], ring: [], hat: [] });
    setSkills({ whittling: 0, weaving: 0, smithing: 0, felting: 0 });
    setMaterialChoices(null);
    setActiveSkillEvent(null);
    setClearedNodes([]);
    setLog([]);
    setCurrentActIdx(0);
    setMap(null);
    setCurrentNodeId(null);
    setTutorialActive(true);
    setTutorialStep(0);
    pushLog('🎓 Tutorial: a verbal sparring match with the Bursar.');
    // Forced opening hand — guarantees a teachable turn 1.
    const forcedHand = ['w-respect', 'e-persuade', 'c-defend', 'w-frankly', 'e-spark'];
    const forcedDeck = ['w-erm', 'e-bluster', 'e-bewilder', 'c-defend'];
    enterFight('tutorial-bursar', { forcedHand, forcedDeck });
  }

  // Advance the tutorial step IF the current step is waiting on a
  // matching action. No-op when not in the tutorial.
  function advanceTutorialStep(trigger) {
    if (!tutorialActive) return;
    if (tutorialStep === 1 && trigger === 'played-word') setTutorialStep(2);
    if (tutorialStep === 2 && trigger === 'cast-spell')  setTutorialStep(3);
  }

  function exitTutorial() {
    setTutorialActive(false);
    setTutorialStep(0);
    setStage('menu');
  }

  // ---------- RUN LIFECYCLE ----------
  function startRun() {
    clearSavedRun();
    // Deck is built per-character after character-select. Initialise empty.
    setMaxHp(STARTING_MAX_HP);
    setHp(STARTING_MAX_HP);
    setComposureMax(STARTING_MAX_COMPOSURE);
    setComposure(STARTING_MAX_COMPOSURE);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    setDeck([]);
    setHand([]);
    setDiscard([]);
    setExiled([]);
    setEquipment([]);
    setPowers([]);
    setRelics([]);
    setFamiliar(null);
    setFamiliarName('');
    setSelectedCharacter(null);
    setEffectCount(0);
    setTray(initialV2Tray());
    setInventory({ staff: [], robes: [], ring: [], hat: [] });
    setSkills({ whittling: 0, weaving: 0, smithing: 0, felting: 0 });
    setMaterialChoices(null);
    setActiveSkillEvent(null);
    setClearedNodes([]);
    setLog([]);
    setCurrentActIdx(0);
    setMap(null);
    setCurrentNodeId(null);
    setSupplyChoices([]);
    setSupplyPicks([]);
    // Character select first — the chosen lane drives the supply pool.
    setStage('character-select');
  }

  function pickCharacter(characterId) {
    const c = CHARACTERS_BY_ID[characterId];
    if (!c) return;
    setSelectedCharacter(c);
    logEvent('character.select', { characterId: c.id, lane: c.lane, name: c.name });
    pushLog(`🧙 You are ${c.name}, ${c.title}.`);
    // Build the character's v2 starter deck (basics from this lane + utility skills).
    const starterDeck = buildStartingDeck(c.lane);
    setDeck(starterDeck);
    // Build a lane-pure supply pool from the character's v2 cards. Supply
    // shop offers are commons of intro/subject/target slots so the player
    // begins shaping the deck immediately.
    const lanePool = LANE_POOL[c.lane] || [];
    const commons = lanePool.filter(card => card.rarity === 'common');
    const supply = [];
    const used = new Set();
    let attempts = 0;
    while (supply.length < 5 && attempts < 80) {
      attempts++;
      const cand = commons[Math.floor(Math.random() * commons.length)];
      if (!cand || used.has(cand.id)) continue;
      supply.push(cand);
      used.add(cand.id);
    }
    setSupplyChoices(supply);
    setStage('supply-shop');
    pushLog(`🏘 You set out from the school. Town first.`);
  }

  function pickSupplyCard(idx) {
    if (supplyPicks.includes(idx)) return;     // already picked
    if (supplyPicks.length >= 2) return;       // capped
    const card = supplyChoices[idx];
    if (!card) return;
    setDeck(d => [...d, { ...card, uid: uid() }]);
    pushLog(`🛒 Bought: ${card.name}.`);
    logEvent(TE.STARTING_PICK, { cardId: card.id, cardName: card.name, type: card.type, rarity: card.rarity, offered: supplyChoices.map(c => c?.id), pickIndex: supplyPicks.length });
    // Pure updater + side-effects outside it ([[feedback_react_pure_updaters]]).
    const next = [...supplyPicks, idx];
    setSupplyPicks(next);
    if (next.length >= 2) {
      setTimeout(() => {
        setSupplyChoices([]);
        setSupplyPicks([]);
        setStage('familiar-shop');
      }, 300);
    }
  }

  function pickFamiliar(familiarId) {
    const fam = FAMILIARS_BY_ID[familiarId];
    if (!fam) return;
    setFamiliar(fam);
    // Familiar's signature card joins the deck.
    setDeck(d => [...d, { ...fam.card, uid: uid() }]);
    // Apply maxHp bonus immediately if present.
    if (fam.bonus?.maxHp) {
      setMaxHp(m => m + fam.bonus.maxHp);
      setHp(h => h + fam.bonus.maxHp);
    }
    pushLog(`🐾 You choose the ${fam.species}. ${fam.card.name} added to deck.`);
    logEvent(TE.RUN_START, { familiarId: fam.id, familiarSpecies: fam.species, startingDeckPicks: deck.map(c => c.id) });
    setStage('familiar-name');
  }

  function confirmFamiliarName(name) {
    const trimmed = (name || '').trim();
    const final = trimmed || familiar?.species || 'Familiar';
    setFamiliarName(final);
    pushLog(`🐾 You name your ${familiar?.species || 'familiar'} ${final}.`);
    // Character-select + supply-shop already gave the lane-pure picks the
    // legacy starting-picks screen used to provide. Skip it and head
    // directly to the map.
    {
      const m0 = generateActMap(ACTS[0].rows, ACTS[0].width);
      setMap(seedSidequestSpurs(m0, ACTS[0].id, ACTS[0].rows, ACTS[0].width));
    }
    setStage('map');
    pushLog(`🌅 ${ACTS[0].name} begins.`);
  }

  function toggleStartingPick(cardId) {
    setStartingPicksSelected(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      if (prev.length >= 2) return prev; // already at cap — must deselect first
      return [...prev, cardId];
    });
  }

  function confirmStartingPicks() {
    if (startingPicksSelected.length !== 2) return;
    const additions = startingPicksSelected
      .map(id => CARDS_BY_ID[id])
      .filter(Boolean)
      .map(c => ({ ...c, uid: uid() }));
    setDeck(d => shuffle([...d, ...additions]));
    for (const c of additions) pushLog(`+ ${c.name} added to your starting deck.`);
    {
      const m0 = generateActMap(ACTS[0].rows, ACTS[0].width);
      setMap(seedSidequestSpurs(m0, ACTS[0].id, ACTS[0].rows, ACTS[0].width));
    }
    setStage('map');
    pushLog(`🌅 ${ACTS[0].name} begins.`);
  }

  function advanceToNextAct() {
    const nextIdx = currentActIdx + 1;
    if (nextIdx >= ACTS.length) {
      setStage('graduation');
      return;
    }
    // Heal a fraction of max HP between acts. Composure gets the same ratio
    // (or restored fully if the ratio rounds higher than current loss).
    const healAmount = Math.floor(maxHp * INTER_ACT_HEAL_RATIO);
    const compHeal   = Math.floor(composureMax * INTER_ACT_HEAL_RATIO);
    setHp(h => clamp(h + healAmount, 0, maxHp));
    setComposure(c => clamp(c + compHeal, 0, composureMax));
    pushLog(`🌄 Between acts: +${healAmount} HP, +${compHeal} Composure.`);
    setCurrentActIdx(nextIdx);
    const nextAct = ACTS[nextIdx];
    {
      const m = generateActMap(nextAct.rows, nextAct.width);
      setMap(seedSidequestSpurs(m, nextAct.id, nextAct.rows, nextAct.width));
    }
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
    logEvent(TE.MAP_NODE, { nodeId, nodeType: node.type, row: node.r, col: node.c, sidequestRef: node.sidequestRef || null, offeredNodeIds: reachableFromCurrent(), actIdx: currentActIdx, hp, composure });
    setCurrentNodeId(nodeId);
    // Postcard mechanic: count every node visit toward the 5-node cadence
    // (only while the quest is active and not yet resolved).
    if (postcardState === 'active') {
      setNodesSincePostcard(n => n + 1);
    }
    resolveNodeEnter(node);
  }

  function resolveNodeEnter(node) {
    if (node.type === 'town' || node.type === 'start') {
      pushLog(`You set out from ${nodeLabel(node)}.`);
      return;
    }
    // Sidequest spur nodes: route to the relevant beat instead of the
    // generic event/combat resolver. The map placed them; this fires them.
    if (node.sidequestRef) {
      const { templateId, nodeIdx } = node.sidequestRef;
      const tpl = SIDEQUEST_TEMPLATES[templateId];
      if (!tpl) return;
      const beat = tpl.nodes[nodeIdx];
      logEvent(TE.SIDEQUEST_CHOICE, { action: 'enter', templateId, beatIdx: nodeIdx, beatKind: beat.kind, title: tpl.title, hp, composure });
      setSidequestActive({ templateId, nodeIdx });
      if (beat.kind === 'combat') {
        setSidequestCombatActive(true);
        enterFight(beat.enemyId);
      } else if (beat.kind === 'boss') {
        pushLog(`🌿 The path delivers you to the act boss.`);
        setSidequestActive(null);
        enterFight(currentAct.bossId);
      } else {
        setStage('sidequest-node');
      }
      return;
    }
    if (node.type === 'combat')        return enterFight(pickActEnemyId('normal'));
    if (node.type === 'elite')         return enterFight(pickActEnemyId('elite'));
    if (node.type === 'rest')          { setRestNode(node); setStage('rest'); return; }
    if (node.type === 'event')         {
      const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      setActiveEvent(ev); setStage('event'); return;
    }
    if (node.type === 'material')      return enterMaterialNode();
    if (node.type === 'skill')         return enterSkillNode();
    if (node.type === 'boss')          return enterFight(currentAct.bossId);
  }

  // Material node — roll 3 random variants from the current act's
  // slot pool and open the chooser screen. The player picks one;
  // the chosen material lands in inventory[slot].
  function enterMaterialNode() {
    const slot = currentAct.slot;
    const pool = MATERIAL_TEMPLATES[slot] || [];
    if (pool.length === 0) { pushLog('Nothing of use here.'); return; }
    // Pick up to 3 distinct candidates.
    const shuffled = shuffle(pool);
    const choices = shuffled.slice(0, Math.min(3, shuffled.length));
    setMaterialChoices({ slot, choices });
    setStage('material-choose');
  }

  function claimMaterial(materialId) {
    if (!materialChoices) return;
    const m = materialChoices.choices.find(c => c.id === materialId);
    if (!m) return;
    logEvent(TE.MATERIAL_HARVEST, { materialId: m.id, name: m.name, slot: m.slot, offered: materialChoices.choices.map(c => c.id) });
    setInventory(prev => ({ ...prev, [m.slot]: [...prev[m.slot], m] }));
    pushLog(`🪵 You gather ${m.name}.`);
    setMaterialChoices(null);
    returnToMap();
  }

  function skipMaterial() {
    pushLog('You leave the material where it is.');
    setMaterialChoices(null);
    returnToMap();
  }

  // Skill node — pick a skill event from the pool, filtered to skills
  // whose act is still ahead OR is the current act. Skills you've moved
  // past don't show events (you've already crafted that piece).
  function enterSkillNode() {
    const eligibleSkills = new Set();
    for (let i = currentActIdx; i < ACTS.length; i++) {
      const c = ACTS[i]?.craft;
      if (c) eligibleSkills.add(c);
    }
    // Filter events: skill === 'any' is OK (it's a chooser), otherwise
    // the event's primary skill must be in the eligible set.
    const pool = SKILL_EVENTS.filter(e => e.skill === 'any' || eligibleSkills.has(e.skill));
    if (pool.length === 0) {
      pushLog('No craft worth practicing on the road here.');
      returnToMap();
      return;
    }
    // For the 'any' cross-skill event, filter its choices to relevant
    // skills only so the player doesn't pick a dead one.
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const filtered = picked.skill === 'any'
      ? { ...picked, choices: picked.choices.filter(c => {
          const sk = c.effects?.skill;
          if (!sk) return true;
          return Object.keys(sk).some(k => eligibleSkills.has(k));
        }) }
      : picked;
    setActiveSkillEvent(filtered);
    setStage('skill-event');
  }

  // Resolves a skill-event choice the same way resolveEventChoice does
  // regular events, but the modal lives on its own stage so we don't
  // mash the two flows together.
  // Apply the graded outcome of a skill-event minigame. The player's
  // grade scales the advertised skill bump (Master = full bump, Fine =
  // half rounded up, Rough = 1 with extra HP penalty) while always
  // applying the labeled max-HP cost (you committed by choosing it).
  function finalizeSkillMinigame(grade) {
    const m = skillMinigame;
    if (!m) return;
    const fx = m.baseEffects || {};
    const logBits = [`🛠 ${m.eventTitle}: ${m.choiceLabel} → ${grade.toUpperCase()}`];
    // Skill scaling by grade — Master full, Fine half, Rough quarter.
    const skillScale = grade === 'master' ? 1.0 : grade === 'fine' ? 0.5 : 0.25;
    applyEffectsCore(fx, { logBits, skillScale });
    // Rough adds an extra -2 HP penalty for fumbling (botch tax).
    if (grade === 'rough') {
      setHp(h => Math.max(1, h - 2));
      logBits.push(`-2 HP (botched)`);
    }
    pushLog(logBits.join(' · '));
    setSkillMinigame(null);
    returnToMap();
  }

  // Unified choice-effects dispatcher. The four call sites (sidequest
  // beats, skill events, skill-minigame finalize, story events) used to
  // each re-implement this vocabulary with subtle log/modal divergences.
  // Per ARCHITECTURE_REVIEW.md #6 — single core, thin wrappers per
  // call site decide whether to open the card-grant modal.
  //
  // Returns { granted } — caller pushes its own preamble to logBits
  // BEFORE calling, then commits the log itself.
  //
  // Options:
  //   logBits  — array the core appends per-effect log fragments to
  //   skillScale — multiplier on `fx.skill` bumps (1.0 default;
  //                minigames pass 0.5/0.25 for Fine/Rough grades)
  function applyEffectsCore(fx, { logBits, skillScale = 1.0 } = {}) {
    const granted = [];
    if (fx.healFull) { setHp(maxHp); logBits.push(`+full HP`); }
    if (fx.heal)    { setHp(h => clamp(h + fx.heal, 0, maxHp)); logBits.push(`+${fx.heal} HP`); }
    if (fx.loseHp)  { setHp(h => Math.max(1, h - fx.loseHp)); logBits.push(`-${fx.loseHp} HP`); }
    if (fx.maxHp) {
      setMaxHp(m => Math.max(1, m + fx.maxHp));
      // On loss: clamp current HP DOWN to the new ceiling.
      // On gain: do NOT auto-heal — labeled cost would otherwise lie.
      if (fx.maxHp < 0) setHp(h => Math.max(1, Math.min(h, maxHp + fx.maxHp)));
      logBits.push(`${fx.maxHp > 0 ? '+' : ''}${fx.maxHp} max HP`);
    }
    if (fx.loseRandomCard) {
      setDeck(d => {
        if (d.length === 0) return d;
        const indexed = d.map((c, i) => ({ c, i }));
        const nonStarters = indexed.filter(({ c }) => !STARTER_DECK.includes(c.id));
        const pool = nonStarters.length > 0 ? nonStarters : indexed;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        logBits.push(`− ${pick.c.name}`);
        return d.filter((_, i) => i !== pick.i);
      });
    }
    const grantCardOf = (rarity) => {
      const c = pickCardByRarity({ [rarity]: 1 });
      if (c) {
        setDeck(d => [...d, { ...c, uid: uid() }]);
        logBits.push(`+ ${c.name}`);
        granted.push(c);
      }
    };
    if (fx.gainCommonCard)   grantCardOf('common');
    if (fx.gainUncommonCard) grantCardOf('uncommon');
    if (fx.gainRareCard)     grantCardOf('rare');
    if (fx.skill) {
      const eligibleSkills = new Set();
      for (let i = currentActIdx; i < ACTS.length; i++) {
        const c = ACTS[i]?.craft;
        if (c) eligibleSkills.add(c);
      }
      const scale = (bump) => skillScale === 1.0 ? bump : Math.max(1, Math.ceil(bump * skillScale));
      setSkills(prev => {
        const next = { ...prev };
        for (const [skill, bump] of Object.entries(fx.skill)) {
          if (!eligibleSkills.has(skill)) continue;
          next[skill] = Math.min(SKILL_MAX, (next[skill] || 0) + scale(bump));
        }
        return next;
      });
      for (const [skill, bump] of Object.entries(fx.skill)) {
        if (!eligibleSkills.has(skill)) continue;
        logBits.push(`+${scale(bump)} ${CRAFT_LABEL[skill] || skill}`);
      }
    }
    if (fx.grantPostcardPhrase) {
      const phrase = generatePostcardPhrase();
      setPostcardPhrase(phrase);
      setPostcardState('active');
      setPostcardsCorrect(0);
      setNodesSincePostcard(0);
      logBits.push(`📮 phrase: "${phrase}"`);
      logEvent('postcard.granted', { phrase });
    }
    return { granted };
  }

  // Sidequest beat / narrative resolver. No card-grant modal — sidequest
  // rewards land silently in the deck (kept from the pre-refactor
  // behavior; sidequest pacing doesn't benefit from a modal interrupt).
  function applyChoiceEffects(fx, sourceLabel) {
    const logBits = [`📜 ${sourceLabel}`];
    applyEffectsCore(fx, { logBits });
    pushLog(logBits.join(' · '));
  }

  // Postcard mechanic handlers ----------------------------------------------
  function submitPostcard(text) {
    if (postcardState === 'completed') {
      // The man's forgiveness postcard arrives. Heal + max-HP reward.
      setHp(h => clamp(h + 10, 0, maxHp + 5));
      setMaxHp(m => m + 5);
      pushLog(`📮 Postcard from the man: "My cat forgives you." +10 HP, +5 max HP.`);
      logEvent('postcard.reward', { result: 'completed' });
      setPostcardState('done');
      setPostcardModalOpen(false);
      return;
    }
    if (postcardState === 'failed') {
      // Rebuke postcard arrives and lifts the fog.
      pushLog(`📮 Postcard from the man: "You have disgraced my cat. We will not speak again."`);
      logEvent('postcard.reward', { result: 'failed' });
      setPostcardState('done');
      setPostcardModalOpen(false);
      return;
    }
    // Active state — validate input against the phrase exactly.
    const clean = (text || '').trim();
    const correct = clean === (postcardPhrase || '').trim();
    logEvent('postcard.submit', { correct, attemptLength: clean.length, expectedPhrase: postcardPhrase, submitted: clean, currentProgress: postcardsCorrect });
    if (correct) {
      const newCount = postcardsCorrect + 1;
      setPostcardsCorrect(newCount);
      setNodesSincePostcard(0);
      pushLog(`📮 You send the postcard. (${newCount}/3)`);
      if (newCount >= 3) {
        // Quest moves to 'completed'; the NEXT mailbox click is the reward.
        setPostcardState('completed');
        pushLog(`📮 The third postcard sent. Something will arrive.`);
      }
    } else {
      // Wrong text — penalty.
      setHp(h => Math.max(1, h - 5));
      setPostcardState('failed');
      setNodesSincePostcard(0);
      pushLog(`📮 You misremembered. The phrase was: "${postcardPhrase}". -5 HP. The road ahead grows obscured.`);
    }
    setPostcardModalOpen(false);
  }

  // Visibility helper for the mailbox button.
  function postcardMailboxVisible() {
    if (postcardState === 'completed' || postcardState === 'failed') return true;
    if (postcardState === 'active' && nodesSincePostcard >= 5) return true;
    return false;
  }

  // Cut a sidequest spur short — the player picks an early-exit option
  // (e.g. "Look away" in the Jazz Cafe quest). Remove the remaining spur
  // nodes from the map and reroute the current spur node's edge directly
  // to the original rejoin point.
  function endSpurEarly(currentSpurNodeId) {
    setMap(prev => {
      if (!prev) return prev;
      const currentNode = prev.nodes.find(n => n.id === currentSpurNodeId);
      if (!currentNode || !currentNode.sidequestRef) return prev;
      const { templateId } = currentNode.sidequestRef;
      const tpl = SIDEQUEST_TEMPLATES[templateId];
      if (!tpl) return prev;
      const currentIdx = currentNode.sidequestRef.nodeIdx;
      // Inherit the rejoin point from the last spur node's outgoing edge.
      const lastSpurId = `sq-${templateId}-${tpl.nodes.length - 1}`;
      const rejoinIds = prev.edges[lastSpurId] || [];
      const newEdges = { ...prev.edges };
      newEdges[currentSpurNodeId] = rejoinIds;
      for (let i = currentIdx + 1; i < tpl.nodes.length; i++) {
        delete newEdges[`sq-${templateId}-${i}`];
      }
      const newNodes = prev.nodes.filter(n =>
        !n.sidequestRef ||
        n.sidequestRef.templateId !== templateId ||
        n.sidequestRef.nodeIdx <= currentIdx
      );
      return { ...prev, nodes: newNodes, edges: newEdges };
    });
  }

  // SIDEQUEST flow ----------------------------------------------------------
  // Sidequests are now visible map spurs. Each beat is a real map node
  // tagged with sidequestRef. Walking onto a spur node fires the beat;
  // resolving the beat returns control to the map and the player walks
  // forward to the next spur node. The last spur node connects back to
  // the main map (or directly to the boss for shortcut quests).

  function getActiveSidequestBeat() {
    if (!sidequestActive) return null;
    const tpl = SIDEQUEST_TEMPLATES[sidequestActive.templateId];
    if (!tpl) return null;
    return { tpl, node: tpl.nodes[sidequestActive.nodeIdx], idx: sidequestActive.nodeIdx };
  }

  // Resolve a beat. Apply any effects, mark the spur node as cleared,
  // then return to the map. The player clicks the next spur node manually.
  function resolveSidequestBeat(effects) {
    const active = getActiveSidequestBeat();
    if (!active) { returnToMap(); return; }
    if (effects && Object.keys(effects).length > 0) {
      applyChoiceEffects(effects, active.tpl.title);
    }
    // First beat of a sidequest: lazy-spawn the rest of the chain so
    // the player sees the new path appear after engagement.
    if (active.idx === 0 && !(effects && effects.endSpurEarly)) {
      spawnRemainingSpur(active.tpl);
    }
    // Early-exit option (e.g. Jazz Cafe "look away") — collapse the
    // remaining spur and reroute to the rejoin point.
    if (effects && effects.endSpurEarly && currentNodeId) {
      endSpurEarly(currentNodeId);
    }
    setSidequestActive(null);
    setSidequestCombatActive(false);
    returnToMap();
  }

  // After first beat resolves, append the rest of the sidequest chain
  // to the map. Each subsequent beat becomes a node one row forward.
  // Last node connects to a rejoin main-row node (loop-back) or to
  // the boss (boss-shortcut). Idempotent — only runs once per quest.
  function spawnRemainingSpur(tpl) {
    if (!tpl || tpl.nodes.length <= 1) return;
    if (!map) return;
    if (map.nodes.some(n => n.id === `sq-${tpl.id}-1`)) return; // idempotent
    const firstNode = map.nodes.find(n => n.id === `sq-${tpl.id}-0`);
    if (!firstNode) return;
    const totalRows = currentAct?.rows || 15;
    // Build everything OUTSIDE the setMap updater — no Math.random or
    // outer-scope reads inside the updater body per [[feedback_react_pure_updaters]].
    const newNodes = [];
    for (let i = 1; i < tpl.nodes.length; i++) {
      const r = firstNode.row + i;
      if (r >= totalRows - 1) break; // ran out of rows before the boss row
      const beat = tpl.nodes[i];
      const type = beat.kind === 'combat' ? 'combat'
                 : beat.kind === 'boss'   ? 'boss'
                 :                          'event';
      newNodes.push({
        id: `sq-${tpl.id}-${i}`,
        row: r,
        col: -1,
        type,
        x: firstNode.x,
        y: rowY(r, totalRows),
        sidequestRef: { templateId: tpl.id, nodeIdx: i },
      });
    }
    const newEdges = {};
    newEdges[firstNode.id] = [...(map.edges[firstNode.id] || []), `sq-${tpl.id}-1`];
    for (let i = 0; i < newNodes.length - 1; i++) {
      newEdges[newNodes[i].id] = [newNodes[i + 1].id];
    }
    const lastSpur = newNodes[newNodes.length - 1];
    if (lastSpur) {
      if (tpl.bossShortcut) {
        const bossNode = map.nodes.find(n => n.type === 'boss');
        if (bossNode) newEdges[lastSpur.id] = [bossNode.id];
      } else {
        const rejoinRow = Math.min(totalRows - 2, lastSpur.row + 1);
        const candidates = map.nodes.filter(n =>
          n.row === rejoinRow && !n.sidequestRef && n.type !== 'boss');
        if (candidates.length > 0) {
          const rejoin = candidates[Math.floor(Math.random() * candidates.length)];
          newEdges[lastSpur.id] = [rejoin.id];
        }
      }
    }
    // Pure updater: only merges precomputed nodes/edges.
    setMap(prev => prev ? {
      ...prev,
      nodes: [...prev.nodes, ...newNodes],
      edges: { ...prev.edges, ...newEdges },
    } : prev);
  }

  function resolveSidequestChoice(choice) {
    const active = getActiveSidequestBeat();
    logEvent(TE.SIDEQUEST_CHOICE, { action: 'choice', templateId: active?.tpl?.id, beatIdx: active?.idx, title: active?.tpl?.title, choiceLabel: choice.label, effects: Object.keys(choice.effects || {}), hp, composure });
    resolveSidequestBeat(choice.effects || {});
  }

  function resolveSidequestNarrative() {
    const active = getActiveSidequestBeat();
    if (!active) return;
    resolveSidequestBeat(active.node?.next?.effects || {});
  }

  // Abandon: teleport the player off the spur to a rejoin main-map node.
  // We look up the spur's last node in the placed map and use its outgoing
  // edge as the rejoin target. If we can't find one, fall back to the
  // current node (player just stays put with the sidequest cleared).
  function abandonSidequest() {
    const active = getActiveSidequestBeat();
    if (!active) { returnToMap(); return; }
    const tpl = active.tpl;
    logEvent(TE.SIDEQUEST_CHOICE, { action: 'abandon', templateId: tpl.id, beatIdx: active.idx, title: tpl.title, hp, composure });
    pushLog(`🌿 You leave ${tpl.title} unfinished.`);
    // Find the last spur node for this template and follow its rejoin edge.
    const lastIdx = tpl.nodes.length - 1;
    const lastSpurId = `sq-${tpl.id}-${lastIdx}`;
    const rejoinIds = map?.edges?.[lastSpurId] || [];
    const rejoinId = rejoinIds[0];
    setSidequestActive(null);
    setSidequestCombatActive(false);
    if (rejoinId) {
      setCurrentNodeId(rejoinId);
      const rejoinNode = map.nodes.find(n => n.id === rejoinId);
      if (rejoinNode && !clearedNodes.includes(rejoinId)) {
        setClearedNodes(prev => [...prev, rejoinId]);
      }
    }
    returnToMap();
  }

  function resolveSkillChoice(choice) {
    const fx = choice.effects || {};
    logEvent(TE.SKILL_LEVEL, { eventTitle: activeSkillEvent?.title, choiceLabel: choice.label, effects: Object.keys(fx) });
    // Minigame intercept: defer the effect until the player has played
    // the minigame. The grade they achieve replaces the deterministic
    // skill bump with a Master/Fine/Rough variant.
    if (fx.minigame) {
      const title = activeSkillEvent?.title || '';
      setActiveSkillEvent(null);
      setSkillMinigame({
        kind: fx.minigame,
        baseEffects: fx,
        eventTitle: title,
        choiceLabel: choice.label,
      });
      setStage('skill-minigame');
      return;
    }
    const logBits = [`🛠 ${activeSkillEvent.title}: ${choice.label}`];
    const { granted } = applyEffectsCore(fx, { logBits });
    pushLog(logBits.join(' · '));
    const title = activeSkillEvent.title;
    setActiveSkillEvent(null);
    if (granted.length > 0) {
      setCardGrantPrompt({ cards: granted, title: `${title} — added to your deck` });
      setStage('card-grant');
      return;
    }
    returnToMap();
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
  // `opts.forcedHand` / `opts.forcedDeck` — arrays of card IDs. When
  // passed, the opening hand and deck are seeded deterministically
  // (skipping the shuffle). Used by the tutorial; everyone else relies
  // on the normal pile-shuffle draw.
  function enterFight(enemyId, opts = {}) {
    const tmpl = ENEMIES_BY_ID[enemyId];
    if (!tmpl) return;
    const e = { ...tmpl };
    logEvent(TE.COMBAT_START, { enemyId: e.id, enemyName: e.name, tier: e.tier, act: e.act, hp, composure, deckSize: deck.length + hand.length + discard.length, equipment: equipment.map(eq => eq.id) });
    setEnemy(e);
    setEnemyComposure(e.composureMax);
    setEnemyHp(e.hpMax);
    setEnemyBlock(0);
    setEnemyHitFlash(0);
    setDmgFloaters([]);
    setEnemyDmgMult(1.0);
    setPlayerDmgMult(1.0);
    setPierceNextCast(false);
    setBoostNextChutzpahCast(0);
    setLastIntentKinds([]);
    setEnemyIntent(rollIntent(e));
    setIntentTick(t => t + 1);
    // Powers don't persist between combats.
    setPowers([]);
    // Reset per-combat counters and player debuffs.
    setTray(initialV2Tray());
    setAmplifyPlaysThisCombat(0);

    // Apply start-of-combat effects from equipment AND relics.
    let startBlockTotal = 0;
    let startEnergyBonus = 0;
    let startHandBonus = 0;
    let healOnStart = 0;
    let startDrawBonus = 0;
    let startCombatVulnTotal = 0;
    let startCombatWeakTotal = 0;
    for (const eq of equipment) {
      if (eq.bonus?.startBlock)              startBlockTotal       += eq.bonus.startBlock;
      if (eq.bonus?.energyOnCombatStart)     startEnergyBonus      += eq.bonus.energyOnCombatStart;
      if (eq.bonus?.extraStartHand)          startHandBonus        += eq.bonus.extraStartHand;
      if (eq.bonus?.healOnCombatStart)       healOnStart           += eq.bonus.healOnCombatStart;
      // Material-driven combat-start enemy debuffs (Burrgrass robes,
      // Cold Iron ring, etc.).
      if (eq.bonus?.startCombatVulnerable)   startCombatVulnTotal  += eq.bonus.startCombatVulnerable;
      if (eq.bonus?.startCombatWeak)         startCombatWeakTotal  += eq.bonus.startCombatWeak;
    }
    for (const { effect } of effectSources()) {
      const oc = effect?.onCombatStart;
      if (oc) {
        if (oc.block)  startBlockTotal += oc.block;
        if (oc.draw)   startDrawBonus  += oc.draw;
        if (oc.energy) startEnergyBonus += oc.energy;
        if (oc.hp)     healOnStart     += oc.hp;
      }
      if (effect?.startCombatVulnerable) startCombatVulnTotal += effect.startCombatVulnerable;
      if (effect?.startCombatWeak)       startCombatWeakTotal += effect.startCombatWeak;
    }
    // Apply familiar startOfTurnBlock for turn 1 as well — every-turn means
    // also turn 1. (Per-turn application happens in endTurn's working block.)
    const startTurnBlockTotal = effectSources().reduce(
      (s, x) => s + (x.effect?.startOfTurnBlock || 0), 0);
    startBlockTotal += startTurnBlockTotal;

    if (healOnStart > 0) {
      setHp(h => clamp(h + healOnStart, 0, maxHp));
      pushLog(`💚 +${healOnStart} HP (start of combat).`);
    }
    if (startCombatVulnTotal > 0) {
      adjustPlayerDmg(+0.25 * startCombatVulnTotal);
      pushLog(`💫 +${25*startCombatVulnTotal}% potency vs ${e.name} (start of combat).`);
    }
    if (startCombatWeakTotal > 0) {
      adjustEnemyDmg(-0.25 * startCombatWeakTotal);
      pushLog(`💢 ${e.name}: −${25*startCombatWeakTotal}% atk (start of combat).`);
    }
    setBlock(startBlockTotal);
    setEnergy(energyPerTurnRefill() + startEnergyBonus);

    if (opts.forcedHand && opts.forcedDeck) {
      // Tutorial path: deterministic deck + hand. Skip shuffle entirely.
      setHand(opts.forcedHand.map(id => ({ ...CARDS_BY_ID[id], uid: uid() })));
      setDeck(opts.forcedDeck.map(id => ({ ...CARDS_BY_ID[id], uid: uid() })));
      setDiscard([]);
    } else {
      const fullDeck = [...deck, ...hand, ...discard];
      const drawn = drawFromPiles(shuffle(fullDeck), [], HAND_SIZE + startHandBonus + startDrawBonus);
      setDeck(drawn.deck);
      setHand(drawn.hand);
      setDiscard([]);
    }
    setStage('combat');
    const tierTag = e.tier === 'elite' ? ' — elite' : e.tier === 'boss' ? ' — BOSS' : '';
    const composureNote = e.composureMax < 999 ? `Composure ${e.composureMax}` : '';
    const hpNote = e.hpMax < 999 ? `HP ${e.hpMax}` : '';
    const tags = [composureNote, hpNote].filter(Boolean).join(' · ');
    pushLog(`⚔ ${e.name} (${tags})${tierTag}`);
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
    return equipment.reduce((s, eq) => s + (eq.bonus?.strikeBonus || 0), 0)
         + effectSources().reduce((s, x) => s + (x.effect?.passiveStrikeBonus || 0), 0);
  }

  // Returns the extra flat damage to add this Effect cast from everyNth-effect
  // triggers across all effect sources. Advances the global effectCount.
  function consumeEveryNthEffectBonus() {
    const nextCount = effectCount + 1;
    setEffectCount(nextCount);
    let bonus = 0;
    for (const { effect, sourceName } of effectSources()) {
      const every = effect?.everyNthEffect;
      if (!every) continue;
      if (nextCount % every.n === 0) {
        bonus += every.extraDamage || 0;
        pushLog(`📿 ${sourceName}: +${every.extraDamage} damage.`);
      }
    }
    return bonus;
  }

  // Effective energy cost for a card right now. Most cards return card.cost
  // unchanged; Amplify escalates by +1 for every prior play this combat.
  function effectiveCardCost(card) {
    if (card?.id === 'c-amplify') return (card.cost || 0) + amplifyPlaysThisCombat;
    return card?.cost || 0;
  }

  function playCard(handIdx) {
    if (stage !== 'combat') return;
    const card = hand[handIdx];
    if (!card) return;
    const cost = effectiveCardCost(card);
    if (cost > energy) { pushLog(`Not enough energy for ${card.name}.`); return; }
    setEnergy(e => e - cost);
    if (card.id === 'c-amplify') setAmplifyPlaysThisCombat(n => n + 1);
    logEvent(TE.CARD_PLAY, { cardId: card.id, cardName: card.name, type: card.type, cost, energyBefore: energy, handSize: hand.length, enemyId: enemy?.id });
    const logBits = [card.name];

    // Powers don't apply effects directly — they install themselves on the
    // player's `powers` array and trigger via the turn-hooks instead.
    if (card.type === 'power') {
      setPowers(ps => [...ps, card]);
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(`📿 ${card.name} — power active.`);
      return;
    }

    // v2 sentence engine routing by slot.
    if (card.slot === 'intro' || card.slot === 'subject') {
      const prev = tray[card.slot];
      if (prev) {
        setHand(h => [...h, prev]);
        setEnergy(e => e + (prev.cost || 0));
        pushLog(`↩ Replaced ${card.slot} ${prev.name}.`);
      }
      setTray(p => syncTrayLegacy({ ...p, [card.slot]: card }));
      applySideEffects(card.effects || {}, logBits);
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(logBits.join(' · ') + `  →  📜 ${card.slot} staged`);
      advanceTutorialStep('played-word');
      return;
    }

    if (card.slot === 'modifier') {
      if ((tray.modifiers || []).length >= 2) {
        setEnergy(e => e + (card.cost || 0));
        pushLog(`Two modifiers already staged — can't add a third.`);
        return;
      }
      setTray(p => syncTrayLegacy({ ...p, modifiers: [...(p.modifiers || []), card] }));
      applySideEffects(card.effects || {}, logBits);
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(logBits.join(' · ') + `  →  ✨ modifier staged`);
      return;
    }

    if (card.slot === 'target') {
      if (!tray.intro || !tray.subject) {
        setEnergy(e => e + (card.cost || 0));
        pushLog(`Need an intro AND a subject before playing a target.`);
        return;
      }
      // Replace any existing target the way intro/subject replacement works.
      if (tray.target) {
        setHand(h => [...h, tray.target]);
        setEnergy(e => e + (tray.target.cost || 0));
        pushLog(`↩ Replaced target ${tray.target.name || tray.target.phrase}.`);
      }
      setTray(p => syncTrayLegacy({ ...p, target: card }));
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(`🎯 Target staged: ${card.phrase} — hit CAST when ready.`);
      return;
    }

    // ---- BACK-COMPAT (pre-v2 word/effect cards from event-grants etc.) ----
    if (card.type === 'word') {
      const stats = card.stats || {};
      const cardTags = card.tags || [];
      setTray(prev => ({
        ...prev,
        chutzpah: prev.chutzpah + (stats.chutzpah || 0),
        wit:      prev.wit      + (stats.wit      || 0),
        jnsq:     prev.jnsq     + (stats.jnsq     || 0),
        phrases:  [...prev.phrases, card.phrase || card.name],
        tags:     [...prev.tags, ...cardTags],
        words:    [...prev.words, card],
      }));
      applySideEffects(card.effects || {}, logBits);
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(logBits.join(' · ') + `  →  📜 staged`);
      advanceTutorialStep('played-word');
      return;
    }
    if (card.type === 'effect') {
      const prevEffect = tray.effectCard;
      setTray(prev => ({ ...prev, effectCard: card, target: card }));
      if (prevEffect) {
        setHand(h => [...h, prevEffect]);
        setEnergy(e => e + (prevEffect.cost || 0));
        pushLog(`↩ Replaced ${prevEffect.name} — returned to hand.`);
      }
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(`🎯 ${card.name} sealed — ready to CAST.`);
      return;
    }

    // SKILL CARD — pure utility, no stat / spell. Fires immediately.
    const fx = card.effects || {};
    applySideEffects(fx, logBits);
    setHand(h => h.filter((_, i) => i !== handIdx));
    if (fx.exhaust) setExiled(ex => [...ex, card]);
    else            setDiscard(d => [...d, card]);
    pushLog(logBits.join(' · '));
  }

  // Take a staged card back to hand + refund its energy. Word cards
  // restore their stat contributions; effects clear the sealer slot.
  function unstageCard(cardUid) {
    if (stage !== 'combat') return;
    logEvent('combat.unstage', { cardUid, enemyId: enemy?.id });

    // v2 slot-aware unstage: check intro, subject, target, then modifiers.
    if (tray.intro?.uid === cardUid) {
      const c = tray.intro;
      setTray(p => syncTrayLegacy({ ...p, intro: null }));
      setHand(h => [...h, c]);
      setEnergy(e => e + (c.cost || 0));
      pushLog(`↩ Unstaged intro ${c.name}.`);
      return;
    }
    if (tray.subject?.uid === cardUid) {
      const c = tray.subject;
      setTray(p => syncTrayLegacy({ ...p, subject: null }));
      setHand(h => [...h, c]);
      setEnergy(e => e + (c.cost || 0));
      pushLog(`↩ Unstaged subject ${c.name}.`);
      return;
    }
    if (tray.target?.uid === cardUid) {
      const c = tray.target;
      setTray(p => syncTrayLegacy({ ...p, target: null }));
      setHand(h => [...h, c]);
      setEnergy(e => e + (c.cost || 0));
      pushLog(`↩ Unstaged target ${c.name}.`);
      return;
    }
    const modIdx = (tray.modifiers || []).findIndex(m => m.uid === cardUid);
    if (modIdx >= 0) {
      const c = tray.modifiers[modIdx];
      setTray(p => syncTrayLegacy({ ...p, modifiers: p.modifiers.filter((_, i) => i !== modIdx) }));
      setHand(h => [...h, c]);
      setEnergy(e => e + (c.cost || 0));
      pushLog(`↩ Unstaged modifier ${c.name}.`);
      return;
    }

    // ---- BACK-COMPAT: legacy word/effectCard unstage ----
    const wordIdx = tray.words.findIndex(w => w.uid === cardUid);
    if (wordIdx >= 0) {
      const w = tray.words[wordIdx];
      setTray(prev => {
        const newWords = prev.words.filter((_, i) => i !== wordIdx);
        const c = { chutzpah: 0, wit: 0, jnsq: 0 };
        const phrases = []; const allTags = [];
        for (const x of newWords) {
          if (x.stats?.chutzpah) c.chutzpah += x.stats.chutzpah;
          if (x.stats?.wit)      c.wit      += x.stats.wit;
          if (x.stats?.jnsq)     c.jnsq     += x.stats.jnsq;
          phrases.push(x.phrase || x.name);
          if (x.tags) allTags.push(...x.tags);
        }
        return { ...prev, words: newWords, phrases, tags: allTags, ...c };
      });
      setHand(h => [...h, w]);
      setEnergy(e => e + (w.cost || 0));
      pushLog(`↩ Unstaged ${w.name}.`);
      return;
    }
    if (tray.effectCard && tray.effectCard.uid === cardUid) {
      const e = tray.effectCard;
      setTray(prev => ({ ...prev, effectCard: null, target: null }));
      setHand(h => [...h, e]);
      setEnergy(en => en + (e.cost || 0));
      pushLog(`↩ Unstaged ${e.name}.`);
    }
  }

  // CAST — resolve the staged spell. Requires at least one word AND a
  // staged effect. Computes the full damage (including resonance, Strike
  // bonus, every-nth-effect, weak/vuln, effectiveness), applies damage
  // and any riders, and clears the tray.
  // Compute Sway success probability + matched-bonus breakdown for a card
  // against the current tray + enemy. Pure read; used by both castStagedSpell
  // and the cast-preview UI.
  function previewSway(card) {
    if (!card?.effect?.sway || !enemy) return null;
    const eff = card.effect;
    const tacticTags = eff.tacticTags || [];
    const matchedTacticTagsCount = (tray.tags || []).filter(t => tacticTags.includes(t)).length;
    const resonanceTags = eff.resonatesWith || [];
    const matchedResonance = (tray.tags || []).filter(t => resonanceTags.includes(t)).length;
    const softSpotMatch = enemy.softSpot === eff.tactic;
    const upgradeBonus = eff.successBonus || 0;
    const raw = 0.35
              + (matchedTacticTagsCount * 0.15)
              + (softSpotMatch ? 0.20 : 0)
              + (matchedResonance * 0.10)
              + upgradeBonus;
    const prob = Math.max(0.10, Math.min(0.90, raw));
    return { prob, matchedTacticTagsCount, matchedResonance, softSpotMatch,
             target: eff.swayTarget, tactic: eff.tactic, currentEff: enemy.effectiveness?.[eff.swayTarget] ?? 1 };
  }

  // Route the staged tray to discard/exile after a cast. Honors each
  // word's own exhaust flag AND the effect card's exhaust flag — so a
  // non-exhaust word in a tray cast through an exhaust Effect lands in
  // discard, not the void. (Previously they vanished — caught by the
  // architect review 2026-05-20.)
  function dischargeStagedCards(words, effectCard, effExhausts) {
    const exhaustWords = words.filter(w =>  w.effects?.exhaust);
    const discardWords = words.filter(w => !w.effects?.exhaust);
    if (exhaustWords.length) setExiled(ex => [...ex, ...exhaustWords]);
    if (discardWords.length) setDiscard(d => [...d, ...discardWords]);
    if (effExhausts) setExiled(ex => [...ex, effectCard]);
    else             setDiscard(d => [...d, effectCard]);
  }

  // v2 sentence-engine cast. Resolves a fully-staged intro+subject+target
  // (plus 0-2 modifiers) into composed sentence text + tier-multiplied
  // damage + rider application + card discharge.
  function castV2SentenceSpell(t) {
    const { intro, subject, target } = t;
    const modifiers = t.modifiers || [];

    logEvent(TE.SPELL_CAST, {
      lane: target.lane,
      introId: intro.id, subjectId: subject.id, targetId: target.id,
      modifierIds: modifiers.map(m => m.id),
      enemyId: enemy?.id, enemyHp, enemyComposure,
    });

    // Damage formula handled in shared/cards/shared.js.
    const { damage: rawDamage, tier, riders, sideEffects } =
      computeSpellDamage(intro, subject, target, modifiers);

    // Read-the-Room pierce + enemy effectiveness still applies.
    const eff = target.effect || {};
    const stat = eff.scaleBy || target.lane || 'wit';
    const piercing = pierceNextCast;
    if (piercing) setPierceNextCast(false);
    const dmgType = eff.damageType || 'composure';
    const enemyMult = piercing ? 1.0 : (enemy?.effectiveness?.[stat] ?? 1.0);
    const physMult = piercing ? 1.0 : (enemy?.effectiveness?.physical ?? 1.0);
    let dmg = rawDamage;
    if (dmgType === 'physical') dmg = Math.round(dmg * physMult);
    else                        dmg = Math.round(dmg * enemyMult);
    dmg = Math.round(dmg * playerDmgMult);

    // Compose + log the full sentence.
    const sentence = composeSpellText(intro, subject, target, modifiers);
    pushLog(`✨ "${sentence}"`);

    // Strip enemy block before damage if modifier requested it.
    if (sideEffects.stripBlock) {
      setEnemyBlock(b => Math.max(0, b - sideEffects.stripBlock));
      pushLog(`🛇 Stripped ${sideEffects.stripBlock} enemy block.`);
    }
    // Apply damage.
    let after = 0;
    if (dmgType === 'physical') after = applyDamageToEnemyHp(dmg);
    else                        after = applyDamageToEnemyComposure(dmg);

    const tierLabel = tier === 3 ? 'DEVASTATING' : tier === 2 ? 'RESONANT' : 'COHERENT';
    const dmgTagSuffix = dmgType === 'physical'
      ? `${dmg} phys → ${after} HP${physMult === 0 ? ' (IMMUNE)' : ''}`
      : `${dmg} comp → ${after}${enemyMult === 0 ? ' (IMMUNE)' : enemyMult >= 1.5 ? ' (susceptible)' : enemyMult <= 0.5 ? ' (resistant)' : ''}`;
    pushLog(`🎯 ${tierLabel} (×${TIER_MULTIPLIER[tier] || 1.0}) → ${dmgTagSuffix}`);

    // Riders.
    if (riders.weak)       { adjustEnemyDmg(-0.25 * riders.weak);  pushLog(`💢 enemy −${25*riders.weak}% atk`); }
    if (riders.vulnerable) { adjustPlayerDmg(+0.25 * riders.vulnerable); pushLog(`💫 +${25*riders.vulnerable}% potency`); }
    if (riders.block)      { setBlock(b => b + riders.block); pushLog(`🛡 +${riders.block}`); }

    // Side effects (draw, self-composure cost).
    if (sideEffects.drawCount) {
      drawCards(sideEffects.drawCount);
      pushLog(`📥 +${sideEffects.drawCount} draw`);
    }
    if (sideEffects.selfComposureCost) {
      setComposure(c => Math.max(0, c - sideEffects.selfComposureCost));
      pushLog(`💔 -${sideEffects.selfComposureCost} composure (self)`);
    }

    // Discharge cards. Intro / subject / modifiers → discard. Target →
    // exile if requiresTier3 failed AND exhaustOnFail is set; else discard.
    setDiscard(d => [...d, intro, subject, ...modifiers]);
    if (sideEffects.exhaustTarget) setExiled(ex => [...ex, target]);
    else                           setDiscard(d => [...d, target]);

    setTray(initialV2Tray({ effectFiredThisTurn: true }));
    applyPowerTriggers('onEffectCardPlayed');
    advanceTutorialStep('cast-spell');
  }

  function castStagedSpell(stagedOverride = null) {
    if (stage !== 'combat') return;
    const t = stagedOverride || tray;

    // v2 path: intro + subject + target all filled → sentence-engine cast.
    if (t.intro && t.subject && t.target) {
      return castV2SentenceSpell(t);
    }

    if (!t.effectCard) { pushLog('No Effect staged — nothing to cast.'); return; }
    if ((t.words || []).length === 0) { pushLog('No Word staged — Effect cards need at least one word.'); return; }

    const card = t.effectCard;
    const eff = card.effect || {};
    logEvent(TE.SPELL_CAST, { effectId: card.id, effectName: card.name, stagedWords: (t.words || []).map(w => w.id), trayStats: { chutzpah: t.chutzpah, wit: t.wit, jnsq: t.jnsq }, tags: t.tags, enemyId: enemy?.id, enemyHp, enemyComposure });

    // INSULT branch: open the 3-pick word prompt. The cast resolves
    // asynchronously from the prompt screen via finalizeInsult.
    if (eff.insult) {
      // Send staged cards to discard immediately (the cost is paid).
      dischargeStagedCards(tray.words, card, false);
      // Sample 3 random words for each part of speech.
      const sample = (pool) => {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3);
      };
      setInsultPrompt({
        card,
        phase: 0, // 0 = noun, 1 = verb, 2 = adjective
        samples: {
          noun:      sample(INSULT_NOUNS),
          verb:      sample(INSULT_VERBS),
          adjective: sample(INSULT_ADJECTIVES),
        },
        picks: [],
      });
      setTray(initialV2Tray({ effectFiredThisTurn: true }));
      setStage('insult-prompt');
      return;
    }

    // SWAY branch: no damage, instead try to shift one enemy resistance up
    // by +0.5 (cap 1.0). Success rolled from tray-tags + enemy.softSpot.
    if (eff.sway) {
      const pv = previewSway(card);
      const phrase = [...tray.phrases, card.phrase || ''].filter(Boolean).join(' ');
      if (phrase) pushLog(`✨ "${phrase}"`);
      const roll = Math.random();
      const succeeded = roll < pv.prob;
      const dim = eff.swayTarget;
      const before = enemy?.effectiveness?.[dim] ?? 1;
      if (succeeded) {
        const after = Math.min(1.0, before + 0.5);
        if (after > before) {
          setEnemy(e => e ? { ...e, effectiveness: { ...e.effectiveness, [dim]: after } } : e);
          pushLog(`🤝 ${enemy.name} listens. ${dim} ×${before} → ×${after}.`);
        } else {
          pushLog(`🤝 ${enemy.name} listens — but their ${dim} is already at the cap.`);
        }
        if (eff.successFlavor) pushLog(`"${eff.successFlavor}"`);
      } else {
        pushLog(`🛇 ${enemy.name} is unmoved. (${Math.round(pv.prob * 100)}% chance — rolled ${Math.round(roll * 100)}.)`);
        if (eff.failFlavor) pushLog(`"${eff.failFlavor}"`);
      }
      // Send staged cards to discard / exile (same rule as a normal cast).
      dischargeStagedCards(tray.words, card, !!eff.exhaust);
      setTray(initialV2Tray({ effectFiredThisTurn: true }));
      applyPowerTriggers('onEffectCardPlayed');
      return;
    }
    let base = eff.base || 0;
    if (card.name === 'Strike' || card.name === 'Strike+') base += strikeBonusTotal();
    base += consumeEveryNthEffectBonus();
    const stat = eff.scaleBy || 'wit';
    // Polymath-style: sum all three verbal stats instead of using one.
    const trayVal = eff.sumAllStats
      ? (tray.chutzpah || 0) + (tray.wit || 0) + (tray.jnsq || 0)
      : (tray[stat] || 0);
    const rawSpell = base + trayVal * (eff.multiplier || 0);
    const dmgType = eff.damageType || 'composure';
    // Read-the-Room consumption: pierce effectiveness on the next cast.
    const piercing = pierceNextCast;
    if (piercing) setPierceNextCast(false);
    const eff_mult = piercing ? 1.0 : (enemy?.effectiveness?.[stat] ?? 1.0);
    const phys_mult = piercing ? 1.0 : (enemy?.effectiveness?.physical ?? 1.0);
    let dmg = rawSpell;
    if (dmgType === 'physical') dmg = Math.round(dmg * phys_mult);
    else                        dmg = Math.round(dmg * eff_mult);
    // Don't-Hold-Back: damage doubles when below the HP threshold.
    if (eff.hpThresholdDouble && hp < eff.hpThresholdDouble) {
      dmg *= 2;
      pushLog(`💥 below ${eff.hpThresholdDouble} HP — damage doubled.`);
    }
    // Iron Stomach: next chutzpah-scaling cast gets the boost.
    if (boostNextChutzpahCast > 0 && stat === 'chutzpah') {
      dmg = Math.round(dmg * (1 + boostNextChutzpahCast));
      pushLog(`💪 chutzpah cast boosted +${Math.round(boostNextChutzpahCast * 100)}%.`);
      setBoostNextChutzpahCast(0);
    }
    if (piercing) pushLog(`🎯 cast pierces ${enemy?.name}'s resistance.`);
    const rWith = eff.resonatesWith || [];
    const perTag = eff.resonanceBonus?.perTag || 0;
    const matchedTags = (tray.tags || []).filter(t => rWith.includes(t));
    const resonanceBonus = matchedTags.length * perTag;
    if (resonanceBonus > 0) dmg += resonanceBonus;
    dmg = Math.round(dmg * playerDmgMult);

    const phrase = [...tray.phrases, card.phrase || ''].filter(Boolean).join(' ');
    if (phrase) pushLog(`✨ "${phrase}"`);
    if (matchedTags.length > 0) {
      const uniq = Array.from(new Set(matchedTags));
      pushLog(`✦ Resonance ×${matchedTags.length} (${uniq.join(', ')}) → +${resonanceBonus} damage`);
    }

    let after = 0;
    if (dmgType === 'physical') after = applyDamageToEnemyHp(dmg);
    else                        after = applyDamageToEnemyComposure(dmg);
    const stickyTag = eff_mult === 0 ? ' (IMMUNE)' : (eff_mult >= 1.5 ? ' (susceptible)' : eff_mult <= 0.5 ? ' (resistant)' : '');
    const dmgTag = dmgType === 'physical' ? `${dmg} phys → ${after} HP${phys_mult === 0 ? ' (IMMUNE)' : ''}` : `${dmg} comp → ${after}${stickyTag}`;
    pushLog(`🎯 ${(card.name || '').toUpperCase()} — ${dmgTag}`);

    const rider = eff.rider || {};
    if (rider.weak)       { adjustEnemyDmg(-0.25 * rider.weak);  pushLog(`💢 enemy −${25*rider.weak}% atk`); }
    if (rider.vulnerable) { adjustPlayerDmg(+0.25 * rider.vulnerable); pushLog(`💫 +${25*rider.vulnerable}% potency`); }
    if (rider.block)      { setBlock(b => b + rider.block);          pushLog(`🛡 +${rider.block}`); }
    if (rider.draw)       { drawCards(rider.draw);                   pushLog(`+${rider.draw} draw`); }
    // Chutzpah-archetype effects: pay HP to cast.
    if (eff.loseHpOnPlay)  { setHp(h => clamp(h - eff.loseHpOnPlay, 0, maxHp)); pushLog(`💔 -${eff.loseHpOnPlay} HP (self)`); }
    // Jnsq-archetype effects: weighted gamble.
    if (eff.chance) {
      const chanceBits = [];
      applyChance(eff.chance, chanceBits);
      if (chanceBits.length) pushLog(chanceBits.join(' · '));
    }

    // Send all staged cards to discard / exile based on flags.
    dischargeStagedCards(tray.words, card, !!eff.exhaust);

    setTray(initialV2Tray({ effectFiredThisTurn: true }));
    applyPowerTriggers('onEffectCardPlayed');
    advanceTutorialStep('cast-spell');

    // Cycle 4 batch 5: drawAfterCast (chutzpah engine card hook).
    if (eff.drawAfterCast) {
      drawCards(eff.drawAfterCast);
      pushLog(`📥 Drew ${eff.drawAfterCast} after cast.`);
    }
  }

  // Insult prompt — player picks a word from the current phase's samples.
  // Auto-pick triggers when the 4s timer elapses (InsultPromptScreen calls
  // this with the first sample as a fallback).
  function pickInsultWord(wordObj) {
    if (!insultPrompt) return;
    const nextPicks = [...insultPrompt.picks, wordObj];
    const nextPhase = insultPrompt.phase + 1;
    if (nextPhase >= 3) {
      // All 3 picks made — resolve.
      finalizeInsult(nextPicks);
      return;
    }
    setInsultPrompt({ ...insultPrompt, picks: nextPicks, phase: nextPhase });
  }

  function finalizeInsult(picks) {
    const card = insultPrompt?.card;
    if (!card || !enemy) { setInsultPrompt(null); setStage('combat'); return; }
    const eff = card.effect || {};
    const vulns = enemy.insultVulnerabilities || ['dismissive', 'sarcastic'];
    // Score: each word counts as a vote if any of its tags align with
    // the enemy's vulnerability set. 3/3 = 100%, 2/3 = 67%, etc.
    let matches = 0;
    for (const pick of picks) {
      const tags = pick?.tags || [];
      if (tags.some(t => vulns.includes(t))) matches++;
    }
    const pct = picks.length > 0 ? matches / picks.length : 0;
    const outcome = pct >= 0.5 ? 'land' : pct >= 0.25 ? 'unfaze' : 'backfire';

    // Build the actual insult sentence for log narration.
    const adj = picks.find(p => INSULT_ADJECTIVES.some(a => a.word === p.word));
    const noun = picks.find(p => INSULT_NOUNS.some(n => n.word === p.word));
    const verb = picks.find(p => INSULT_VERBS.some(v => v.word === p.word));
    const sentence = `You ${adj?.word || ''} ${noun?.word || ''}. ${(verb?.word || '').replace(/.$/, m => m)}, all of you.`;
    pushLog(`💢 "${sentence}"`);

    // Pay the player composure cost (always).
    const cost = eff.playerComposureCost || 3;
    setComposure(c => Math.max(0, c - cost));
    pushLog(`🎭 −${cost} Composure (you lose some of yourself doing this).`);

    if (outcome === 'land') {
      const dmg = Math.round((eff.landDamage || 10) * playerDmgMult);
      const witMult = enemy?.effectiveness?.wit ?? 1.0; // verbal channel
      const finalDmg = Math.round(dmg * witMult);
      const after = applyDamageToEnemyComposure(finalDmg);
      pushLog(`✓ LAND — ${finalDmg} composure → ${after}`);
      if (eff.successFlavor) pushLog(`"${eff.successFlavor}"`);
    } else if (outcome === 'unfaze') {
      pushLog(`◌ UNFAZE — ${enemy.name} does not register the insult.`);
      const hint = INSULT_HINT_BY_TAG[vulns[0]] || 'You\'d need to try a different angle.';
      pushLog(`${enemy.name}: "${hint}"`);
    } else {
      // Backfire — enemy retorts, player takes extra composure damage.
      const retort = INSULT_BACKFIRE_RETORTS[Math.floor(Math.random() * INSULT_BACKFIRE_RETORTS.length)];
      pushLog(`✗ BACKFIRE — ${enemy.name}: "${retort}"`);
      const back = eff.backfireDamage || 5;
      setComposure(c => Math.max(0, c - back));
      pushLog(`🎭 −${back} Composure (their retort lands).`);
      const hint = vulns.length > 0
        ? (INSULT_HINT_BY_TAG[vulns[0]] || 'A more cutting angle would have stuck.')
        : 'It does not appear to hear you. Or care.';
      pushLog(`Hint: ${hint}`);
      // KO check projected against the closure value — no side-effect
      // inside a setState updater ([[feedback_react_pure_updaters]]).
      const projected = Math.max(0, composure - cost - back);
      if (projected <= 0) {
        setTimeout(() => setStage('defeat'), 200);
        setInsultPrompt(null);
        return;
      }
    }

    setInsultPrompt(null);
    setStage('combat');
  }

  // Compute the predicted damage if you CAST right now. Used by the
  // tray UI's preview. Pure read of current state — no mutations.
  function previewCastDamage() {
    if (!tray.effectCard) return null;
    const card = tray.effectCard;
    const eff = card.effect || {};
    // Sway cards don't deal damage — return a sway-shaped preview instead.
    if (eff.sway) {
      const pv = previewSway(card);
      return pv ? { kind: 'sway', ...pv } : null;
    }
    let base = eff.base || 0;
    if (card.name === 'Strike' || card.name === 'Strike+') base += strikeBonusTotal();
    // Peek the everyNth bonus (don't consume).
    for (const { effect } of effectSources()) {
      const every = effect?.everyNthEffect;
      if (!every) continue;
      if ((effectCount + 1) % every.n === 0) base += every.extraDamage || 0;
    }
    const stat = eff.scaleBy || 'wit';
    const trayVal = eff.sumAllStats
      ? (tray.chutzpah || 0) + (tray.wit || 0) + (tray.jnsq || 0)
      : (tray[stat] || 0);
    const rawSpell = base + trayVal * (eff.multiplier || 0);
    const dmgType = eff.damageType || 'composure';
    const eff_mult = pierceNextCast ? 1.0 : (enemy?.effectiveness?.[stat] ?? 1.0);
    const phys_mult = pierceNextCast ? 1.0 : (enemy?.effectiveness?.physical ?? 1.0);
    let dmg = rawSpell;
    if (dmgType === 'physical') dmg = Math.round(dmg * phys_mult);
    else                        dmg = Math.round(dmg * eff_mult);
    if (eff.hpThresholdDouble && hp < eff.hpThresholdDouble) dmg *= 2;
    if (boostNextChutzpahCast > 0 && stat === 'chutzpah') dmg = Math.round(dmg * (1 + boostNextChutzpahCast));
    const rWith = eff.resonatesWith || [];
    const perTag = eff.resonanceBonus?.perTag || 0;
    const matchedTags = (tray.tags || []).filter(t => rWith.includes(t));
    const resonanceBonus = matchedTags.length * perTag;
    if (resonanceBonus > 0) dmg += resonanceBonus;
    dmg = Math.round(dmg * playerDmgMult);
    return { dmg, dmgType, resonanceBonus, matchedTags, eff_mult, phys_mult, base, trayVal, multiplier: eff.multiplier || 0, stat };
  }

  // Side-effects shared between skill cards and word cards' on-play block.
  // Mutates the logBits array in place.
  function applySideEffects(fx, logBits) {
    if (fx.block) {
      setBlock(b => b + fx.block);
      logBits.push(`🛡 +${fx.block}`);
    }
    if (fx.pierceNextCast) {
      setPierceNextCast(true);
      logBits.push(`🎯 next cast pierces resistance`);
    }
    if (fx.boostNextChutzpahCast) {
      setBoostNextChutzpahCast(fx.boostNextChutzpahCast);
      logBits.push(`💪 next Chutzpah cast +${Math.round(fx.boostNextChutzpahCast * 100)}%`);
    }
    if (fx.vulnerable) {
      adjustPlayerDmg(+0.25 * fx.vulnerable);
      logBits.push(`💫 +${25*fx.vulnerable}% potency`);
    }
    // Direct multiplier ops (Sap / Amplify / Dispel and any new modifier card).
    if (fx.enemyDmgMod) {
      adjustEnemyDmg(fx.enemyDmgMod);
      const pct = Math.round(fx.enemyDmgMod * 100);
      logBits.push(`💢 enemy ${pct > 0 ? '+' : ''}${pct}% atk`);
    }
    if (fx.playerDmgMod) {
      adjustPlayerDmg(fx.playerDmgMod);
      const pct = Math.round(fx.playerDmgMod * 100);
      logBits.push(`💫 ${pct > 0 ? '+' : ''}${pct}% potency`);
    }
    if (fx.weak) {
      adjustEnemyDmg(-0.25 * fx.weak);
      logBits.push(`💢 enemy −${25*fx.weak}% atk`);
    }
    if (fx.energy) {
      setEnergy(e => e + fx.energy);
      logBits.push(`+${fx.energy} Energy`);
    }
    if (fx.draw) {
      drawCards(fx.draw);
      logBits.push(`+${fx.draw} draw`);
    }
    if (fx.hp) {
      setHp(h => clamp(h + fx.hp, 0, maxHp));
      logBits.push(`+${fx.hp} HP`);
    }
    // Self-damage cost on the card (Chutzpah identity — risk for damage).
    if (fx.loseHp) {
      setHp(h => clamp(h - fx.loseHp, 0, maxHp));
      logBits.push(`-${fx.loseHp} HP (self)`);
    }
    // Player-side debuff (e.g., Cantrip Roulette failure).
    if (fx.selfWeak) {
      adjustPlayerDmg(-0.25 * fx.selfWeak);
      logBits.push(`💢 self −${25*fx.selfWeak}% potency`);
    }
    // Apply Vulnerable to the enemy from a side-effect path (used by
    // chance.success in some Jnsq effects).
    if (fx.enemyVulnerable) {
      adjustPlayerDmg(+0.25 * fx.enemyVulnerable);
      logBits.push(`💫 +${25*fx.enemyVulnerable}% potency`);
    }
  }

  // Resolve a `chance: { prob, success, failure }` block — used by Jnsq
  // archetype cards. Rolls once and applies one of the two effect
  // payloads through the same applySideEffects dispatcher.
  function applyChance(chanceBlock, logBits) {
    if (!chanceBlock) return;
    const roll = Math.random();
    const fired = roll < (chanceBlock.prob ?? 0.5) ? chanceBlock.success : chanceBlock.failure;
    if (fired) {
      logBits.push(roll < chanceBlock.prob ? `🎲 lucky` : `🎲 unlucky`);
      applySideEffects(fired, logBits);
    }
  }

  // Apply the effects payload from a power trigger. Mirrors playCard's
  // dispatcher but reads from a plain effects object (no card metadata).
  // `composure` here is the new analogue of the old `attack` key — Ostensible
  // Inferno etc. deal composure damage through the enemy's wit effectiveness
  // (treat it as wit-channelled for resistance purposes — flame-shaped magic
  // bypasses the social system but enemies who are unflappable still no-sell).
  function applyPowerTriggerEffects(effects, sourceName) {
    if (!effects) return;
    const bits = [`📿 ${sourceName}`];
    if (effects.composure) {
      const eff_mult = enemy?.effectiveness?.wit ?? 1.0;
      let dmg = Math.round(effects.composure * eff_mult);
      dmg = Math.round(dmg * playerDmgMult);
      const after = applyDamageToEnemyComposure(dmg);
      bits.push(`✨ ${dmg} comp → ${after}`);
    }
    if (effects.block) {
      setBlock(b => b + effects.block);
      bits.push(`🛡 +${effects.block}`);
    }
    if (effects.vulnerable) {
      adjustPlayerDmg(+0.25 * effects.vulnerable);
      bits.push(`💫 +${25*effects.vulnerable}% potency`);
    }
    if (effects.weak) {
      adjustEnemyDmg(-0.25 * effects.weak);
      bits.push(`💢 enemy −${25*effects.weak}% atk`);
    }
    if (effects.energy) {
      setEnergy(e => e + effects.energy);
      bits.push(`+${effects.energy} Energy`);
    }
    if (effects.draw) {
      drawCards(effects.draw);
      bits.push(`+${effects.draw} draw`);
    }
    pushLog(bits.join(' · '));
  }

  // Walk all installed powers and fire any that have a trigger matching
  // `hook` (one of: startOfTurn / onEffectCardPlayed). For endOfTurn use
  // `applyEndOfTurnPowerTriggers` instead — it tracks enemy composure / hp
  // synchronously so the caller knows whether the enemy was defeated.
  function applyPowerTriggers(hook) {
    for (const p of powers) {
      const trig = p.power?.[hook];
      if (trig) applyPowerTriggerEffects(trig, p.name);
    }
  }

  // Specialised end-of-turn trigger pass that batches all damage / debuff
  // / block changes into local working variables, then commits to state
  // once. Returns true if the enemy was defeated as a result. This is so
  // the caller can short-circuit the enemy's intent resolution.
  function applyEndOfTurnPowerTriggers() {
    let wComposure = enemyComposure;
    let wHp = enemyHp;
    let wEnemyBlock = enemyBlock;
    let wEnemyDmg  = enemyDmgMult;
    let wPlayerDmg = playerDmgMult;
    let wPlayerBlock = block;
    const clamp01 = (m) => Math.max(0.5, Math.min(1.5, m));
    for (const p of powers) {
      const trig = p.power?.endOfTurn;
      if (!trig) continue;
      const bits = [`📿 ${p.name}`];
      if (trig.composure) {
        const eff_mult = enemy?.effectiveness?.wit ?? 1.0;
        // Power-trigger composure damage uses the live player potency.
        let dmg = Math.round(trig.composure * eff_mult * wPlayerDmg);
        const absorbed = Math.min(wEnemyBlock, dmg);
        wEnemyBlock -= absorbed; dmg -= absorbed;
        wComposure = Math.max(0, wComposure - dmg);
        bits.push(`✨ → ${wComposure} comp`);
      }
      if (trig.block) { wPlayerBlock += trig.block; bits.push(`🛡 +${trig.block}`); }
      // Old vuln/weak power triggers shift the multipliers (player-side
      // potency for vuln, enemy-side attack for weak).
      if (trig.vulnerable) { wPlayerDmg = clamp01(wPlayerDmg + 0.25 * trig.vulnerable); bits.push(`💫 +${25*trig.vulnerable}% potency`); }
      if (trig.weak)       { wEnemyDmg  = clamp01(wEnemyDmg  - 0.25 * trig.weak);       bits.push(`💢 enemy −${25*trig.weak}% atk`); }
      pushLog(bits.join(' · '));
      if (wComposure <= 0 || wHp <= 0) break;
    }
    setBlock(wPlayerBlock);
    setEnemyBlock(wEnemyBlock);
    setEnemyComposure(wComposure);
    setEnemyHp(wHp);
    setEnemyDmgMult(wEnemyDmg);
    setPlayerDmgMult(wPlayerDmg);
    if (wComposure <= 0 || wHp <= 0) {
      setTimeout(() => onEnemyDefeated(), 200);
      return true;
    }
    return false;
  }

  // Synchronous draw. Reads deck/discard/hand from closure (the state at
  // the start of the current event handler) and computes the result in
  // working locals before committing each pile once. The nested-setState
  // pattern this replaced was broken — inner updaters don't fire
  // synchronously inside the outer one, so `result` was undefined and
  // `setHand(undefined.hand)` crashed the render → blank screen on endTurn.
  function drawCards(n) {
    let wDeck = [...deck];
    let wDiscard = [...discard];
    const wHand = [...hand];
    for (let i = 0; i < n; i++) {
      if (wDeck.length === 0) {
        if (wDiscard.length === 0) break;
        wDeck = shuffle(wDiscard);
        wDiscard = [];
      }
      const c = wDeck.shift();
      wHand.push({ ...c, uid: uid() });
    }
    setDeck(wDeck);
    setDiscard(wDiscard);
    setHand(wHand);
  }

  // Composure damage: block absorbs first, then composure drops.
  function applyDamageToEnemyComposure(damage) {
    let remaining = damage;
    let newBlock = enemyBlock;
    let newComposure = enemyComposure;
    if (newBlock > 0) {
      const absorbed = Math.min(newBlock, remaining);
      newBlock -= absorbed; remaining -= absorbed;
    }
    newComposure = Math.max(0, newComposure - remaining);
    setEnemyBlock(newBlock);
    setEnemyComposure(newComposure);
    showDamageFloater(damage, 'composure');
    if (newComposure <= 0) setTimeout(() => onEnemyDefeated(), 200);
    return newComposure;
  }

  // Physical damage: same block-then-pool flow, but pool is enemy HP.
  function applyDamageToEnemyHp(damage) {
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
    showDamageFloater(damage, 'physical');
    if (newHp <= 0) setTimeout(() => onEnemyDefeated(), 200);
    return newHp;
  }

  // End the player's turn. Sequence:
  //   1. End-of-turn power triggers (sync local — may kill enemy).
  //   2. Enemy resolves intent (may KO player).
  //   3. Tick down debuff stacks (1 step each).
  //   4. Discard hand, reset block.
  //   5. Refill energy + draw new hand + run start-of-turn power triggers,
  //      all computed in sync working locals before commit. This replaces
  //      a nested-setState + setTimeout pattern that was unsafe — inner
  //      updaters don't fire synchronously inside the outer one and the
  //      hand-set ended up reading undefined, blanking the screen.
  function endTurn() {
    if (stage !== 'combat') return;
    logEvent(TE.TURN_END, { enemyId: enemy?.id, hp, composure, energyLeft: energy, handSize: hand.length, trayStaged: (tray.intro ? 1 : 0) + (tray.subject ? 1 : 0) + (tray.target ? 1 : 0) + (tray.modifiers?.length || 0) });

    // v2.1: persistent tray. Cards staged into intro/subject/target/modifier
    // slots carry across turns until the spell casts. This replaces the old
    // fizzle-on-turn-end behavior — players can now compose a sentence
    // across multiple turns, casting partial spells for tempo or holding
    // for a higher-tier cast next turn.
    // (Tray clears only when a cast fires or combat ends.)

    // 1. End-of-turn power triggers.
    const killedByPowers = applyEndOfTurnPowerTriggers();
    if (killedByPowers) return;

    // 2. Enemy turn begins. Enemy block expires here, before the intent
    // fires — so an enemy that blocks on consecutive turns gets a fresh
    // pool each time, and player attacks during the previous turn can't
    // free-rider through stale block.
    if (enemyBlock > 0) pushLog(`👹 ${enemy?.name || 'Enemy'}: 🛡 fades.`);
    setEnemyBlock(0);

    // 3. Enemy intent.
    if (enemyIntent) applyEnemyIntent(enemyIntent);
    if (hp <= 0 || composure <= 0) return;

    // 2.5. Block fades — explicit log so the player sees expiry happen even
    //      when a Hedgehog/Felt re-grant immediately tops it back up below.
    //      `block` here is the closure value at the top of the event handler;
    //      good enough for "you had block; it's gone now."
    if (block > 0) pushLog(`🛡 Block fades.`);

    // 3. Debuff decay.
    // Multiplier drift: shift toward 1.0 by 0.25 per turn.
    setEnemyDmgMult(m  => m > 1 ? Math.max(1, m - 0.5) : m < 1 ? Math.min(1, m + 0.5) : m);
    setPlayerDmgMult(m => m > 1 ? Math.max(1, m - 0.5) : m < 1 ? Math.min(1, m + 0.5) : m);

    // 4-5. Compose the new turn's piles + start-of-turn triggers
    //      synchronously, then commit all related state in one pass.
    const stagedDiscard = [...discard, ...hand];
    const drawn = drawFromPiles(deck, stagedDiscard, HAND_SIZE);
    let wDeck     = drawn.deck;
    let wDiscard  = drawn.discard;
    const wHand   = [...drawn.hand];
    let wEnergy   = energyPerTurnRefill();
    let wBlock    = 0;
    // Familiar-style startOfTurnBlock (e.g. Hedgehog): fires every turn,
    // including turn 1 (handled separately in enterFight's startBlockTotal).
    // This is the SAME source the player sees as "Block: 2 every turn"
    // — it's not lingering, it's being re-granted.
    for (const { effect, sourceName } of effectSources()) {
      if (effect?.startOfTurnBlock) {
        wBlock += effect.startOfTurnBlock;
        pushLog(`🛡 +${effect.startOfTurnBlock} (${sourceName || 'aura'}).`);
      }
    }
    // Apply start-of-turn power triggers in working locals. Multiplier
    // shifts dispatch live via adjustEnemyDmg/adjustPlayerDmg.
    for (const p of powers) {
      const trig = p.power?.startOfTurn;
      if (!trig) continue;
      const bits = [`📿 ${p.name}`];
      if (trig.block)      { wBlock += trig.block;   bits.push(`🛡 +${trig.block}`); }
      if (trig.energy)     { wEnergy += trig.energy; bits.push(`+${trig.energy} Energy`); }
      if (trig.vulnerable) { adjustPlayerDmg(+0.25 * trig.vulnerable); bits.push(`💫 +${25*trig.vulnerable}% potency`); }
      if (trig.weak)       { adjustEnemyDmg(-0.25 * trig.weak);        bits.push(`💢 enemy −${25*trig.weak}% atk`); }
      if (trig.draw) {
        for (let i = 0; i < trig.draw; i++) {
          if (wDeck.length === 0) {
            if (wDiscard.length === 0) break;
            wDeck = shuffle(wDiscard);
            wDiscard = [];
          }
          const c = wDeck.shift();
          wHand.push({ ...c, uid: uid() });
        }
        bits.push(`+${trig.draw} draw`);
      }
      pushLog(bits.join(' · '));
    }

    // Commit.
    setDeck(wDeck);
    setDiscard(wDiscard);
    setHand(wHand);
    setBlock(wBlock);
    setEnergy(wEnergy);

    // 6. New intent. Track what just fired and force a switch if the
    // enemy has already done the same kind twice in a row — saves the
    // "spammed Block 15 turns in a row" mind-numbing fights.
    const justFiredKind = enemyIntent?.kind;
    const newHistory = justFiredKind
      ? [...lastIntentKinds, justFiredKind].slice(-2)
      : lastIntentKinds;
    setLastIntentKinds(newHistory);
    const exclude = (newHistory.length === 2 && newHistory[0] === newHistory[1])
      ? [newHistory[0]] : [];
    if (enemy) {
      setEnemyIntent(rollIntent(enemy, exclude));
      setIntentTick(t => t + 1);
    }
  }

  function applyEnemyIntent(intent) {
    const e = enemy;
    if (!e) return;
    let playerDied = false;
    if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
      const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
      // Pool routing: intent.pool === 'composure' targets the verbal pool;
      // default is HP. Block + Defense protect both — they're "bracing,"
      // not just "armor."
      const targetsComposure = intent.pool === 'composure';
      // Enemy outgoing damage multiplier (old weak/vuln replacement).
      let raw = Math.round(intent.value * enemyDmgMult);
      const rawReduction = effectSources().reduce((s, x) => s + (x.effect?.damageReduction || 0), 0)
                         + equipment.reduce((s, eq) => s + (eq.bonus?.damageReduction || 0), 0);
      const reduction = Math.min(2, rawReduction);
      let wBlock = block;
      let wHp = hp;
      let wComp = composure;
      for (let i = 0; i < hits; i++) {
        let remaining = raw;
        if (reduction > 0 && remaining > 0) remaining = Math.max(1, remaining - reduction);
        if (wBlock > 0) {
          const absorbed = Math.min(wBlock, remaining);
          wBlock -= absorbed; remaining -= absorbed;
        }
        if (targetsComposure) wComp = Math.max(0, wComp - remaining);
        else                  wHp   = Math.max(0, wHp   - remaining);
        if (wHp <= 0 || wComp <= 0) break;
      }
      setBlock(wBlock);
      setHp(wHp);
      setComposure(wComp);
      // Hit-shake the player HUD if either pool actually moved. Block-only
      // absorption (both pools unchanged) shouldn't shake — that beat is
      // "the bracing worked," visually distinct from "you got hit."
      if (wHp < hp || wComp < composure) setPlayerHitFlash(Date.now());
      pushLog(`👹 ${e.name}: ${intent.telegraph}`);
      if (wHp <= 0 || wComp <= 0) playerDied = true;
    } else if (intent.kind === 'block') {
      setEnemyBlock(b => b + intent.value);
      pushLog(`👹 ${e.name}: 🛡 +${intent.value}`);
    } else if (intent.kind === 'vulnerable') {
      // Enemy applies vulnerable to player → enemy hits harder.
      adjustEnemyDmg(+0.25 * intent.value);
      pushLog(`👹 ${e.name}: 💢 +${25*intent.value}% to incoming dmg.`);
    } else if (intent.kind === 'weak') {
      // Enemy applies weak to player → player spells weaker.
      adjustPlayerDmg(-0.25 * intent.value);
      pushLog(`👹 ${e.name}: 💢 −${25*intent.value}% to your spell potency.`);
    }
    // Riders: a combo intent can attach extra side-effects that fire AFTER
    // the main effect. Keys: weak (player potency down), vulnerable (player
    // damage taken up), block (enemy gains block). Riders apply even on
    // lethal attacks — that's flavor, not bug. Keep telegraphs honest: the
    // intent.telegraph string above should already advertise the rider.
    if (intent.riders) {
      const r = intent.riders;
      if (r.weak) adjustPlayerDmg(-0.25 * r.weak);
      if (r.vulnerable) adjustEnemyDmg(+0.25 * r.vulnerable);
      if (r.block) setEnemyBlock(b => b + r.block);
    }
    if (playerDied) {
      if (tutorialActive) { setHp(maxHp); setComposure(composureMax); return; }
      logEvent(TE.COMBAT_END, { enemyId: enemy?.id, outcome: 'lost', tier: enemy?.tier, hpAfter: 0, composureAfter: composure });
      logEvent(TE.RUN_END, { outcome: 'lost', killedBy: enemy?.id, actIdx: currentActIdx, finalDeckSize: deck.length + hand.length + discard.length + exiled.length });
      setTimeout(() => setStage('defeat'), 200);
    }
  }


  function onEnemyDefeated() {
    if (!enemy) return;
    logEvent(TE.COMBAT_END, { enemyId: enemy.id, outcome: 'won', tier: enemy.tier, hpAfter: hp, composureAfter: composure });
    // Tutorial short-circuit: skip rewards, route to the wrap-up screen.
    if (tutorialActive) {
      pushLog(`✓ The Bursar concedes the match. "Well argued."`);
      setTutorialActive(false);
      setStage('tutorial-complete');
      return;
    }
    // Sidequest combat short-circuit: skip the reward draw and return
    // the player to the map. The current node is the spur combat node;
    // the next click walks forward to the next spur node.
    if (sidequestCombatActive && sidequestActive) {
      pushLog(`✓ ${enemy.name} resolved.`);
      setSidequestCombatActive(false);
      setSidequestActive(null);
      // Combat resolution returns to map via existing post-fight path.
      // Mark the combat node as cleared so the spur node turns 'spent'.
      if (currentNodeId && !clearedNodes.includes(currentNodeId)) {
        setClearedNodes(prev => [...prev, currentNodeId]);
      }
      returnToMap();
      return;
    }
    pushLog(`✓ ${enemy.name} defeated.`);
    // v2.2: post-combat heal — 15% HP + composure restore after every won
    // combat, so the player can survive multi-combat acts without
    // accumulating fatal attrition.
    const healHp = Math.floor(maxHp * 0.15);
    const healComp = Math.floor(composureMax * 0.15);
    if (healHp > 0) {
      setHp(h => clamp(h + healHp, 0, maxHp));
      setComposure(c => clamp(c + healComp, 0, composureMax));
      pushLog(`💚 Recovered +${healHp} HP, +${healComp} Composure.`);
    }
    const isBoss = enemy.tier === 'boss';
    // Fire relic onEnemyDefeated triggers (heal etc.). Not for bosses —
    // bosses already give a richer reward path.
    if (!isBoss) {
      for (const { effect, sourceName } of effectSources()) {
        const ed = effect?.onEnemyDefeated;
        if (!ed) continue;
        if (ed.heal) {
          setHp(h => clamp(h + ed.heal, 0, maxHp));
          pushLog(`📿 ${sourceName}: +${ed.heal} HP.`);
        }
      }
    }
    // Fire onCombatEnd triggers (heal etc.) for all kills incl. boss.
    for (const { effect, sourceName } of effectSources()) {
      const ce = effect?.onCombatEnd;
      if (!ce) continue;
      if (ce.heal) {
        setHp(h => clamp(h + ce.heal, 0, maxHp));
        pushLog(`📿 ${sourceName}: +${ce.heal} HP.`);
      }
    }
    if (isBoss) {
      // Boss kill — route to the crafting screen. The act's gathered
      // inventory + skill is bundled into the prompt; if the inventory
      // is empty, a salvaged scrap is dropped by the boss so the act
      // never feels broken. Crafting confirms → act-cleared.
      const slot = currentAct.slot;
      const skillName = currentAct.craft;
      const gathered = inventory[slot] || [];
      const materials = gathered.length > 0 ? gathered : [salvageMaterial(slot)];
      // Plus a random Rare relic from the boss chest. Skip duplicates.
      const rareRelic = pickRelicByRarity({ rare: 1 }, relics.map(r => r.id));
      if (rareRelic) {
        setRelics(prev => [...prev, rareRelic]);
        pushLog(`📿 Boss relic claimed: ${rareRelic.name}.`);
      }
      setDeck(d => [...d, ...hand, ...discard, ...exiled]);
      setHand([]); setDiscard([]); setExiled([]);
      pushLog(`👑 ${enemy.name} falls. Time to craft your ${SLOT_LABEL[slot]}.`);
      setCraftingPrompt({
        slot,
        skillName,
        materials,
        skill: skills[skillName] || 0,
        phase: 'choose',
        chosenMaterial: null,
        quality: null,
        result: null,
        salvaged: gathered.length === 0,
      });
      setStage('crafting');
      return;
    }
    // Elite kill → grant a random common/uncommon relic (no choice for MVP).
    if (enemy.tier === 'elite') {
      const r = pickRelicByRarity({ common: 2, uncommon: 3 }, relics.map(x => x.id));
      if (r) {
        setRelics(prev => [...prev, r]);
        pushLog(`📿 Elite spoils: ${r.name}.`);
      }
    }
    const weights = enemy.tier === 'elite'
      ? { common: 2, uncommon: 3, rare: 1 }
      : { common: 4, uncommon: 1 };
    const choices = [];
    const used = [];
    const lane = selectedCharacter?.lane || null;
    while (choices.length < 3) {
      const pick = pickCardByRarity(weights, used, lane);
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
      logEvent(TE.CARD_PICK, { cardId: cardOrSkip.id, cardName: cardOrSkip.name, type: cardOrSkip.type, rarity: cardOrSkip.rarity, offered: rewardChoices.map(c => c?.id), source: 'combat-reward' });
      setDeck(d => [...d, ...hand, ...discard, ...exiled, { ...cardOrSkip, uid: uid() }]);
      pushLog(`+ ${cardOrSkip.name} added to deck.`);
    } else {
      logEvent(TE.REWARD_SKIP, { offered: rewardChoices.map(c => c?.id), source: 'combat-reward' });
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
    logEvent(TE.EVENT_CHOICE, { eventId: activeEvent?.id, eventTitle: activeEvent?.title, choiceLabel: choice.label, effects: Object.keys(fx), hp, composure });
    const logBits = [`📜 ${activeEvent.title}: ${choice.label}`];
    const { granted } = applyEffectsCore(fx, { logBits });
    pushLog(logBits.join(' · '));
    const eventTitle = activeEvent?.title;
    setActiveEvent(null);
    // If the event granted cards, queue them up in the modal and defer
    // returning to the map until the player acknowledges them.
    if (granted.length > 0) {
      setCardGrantPrompt({
        cards: granted,
        title: `${eventTitle} — added to your deck`,
      });
      setStage('card-grant');
      return;
    }
    returnToMap();
  }

  // Dismiss the card-grant modal. Routes back to the map.
  function dismissCardGrant() {
    setCardGrantPrompt(null);
    returnToMap();
  }

  // Crafting screen handlers. Three phases — choose / gauge / result —
  // tracked on craftingPrompt.phase. Confirm at the end commits the
  // crafted output (card or equipment) and routes to act-cleared.
  function craftingPickMaterial(materialId) {
    if (!craftingPrompt) return;
    const m = craftingPrompt.materials.find(x => x.id === materialId);
    if (!m) return;
    setCraftingPrompt(prev => ({ ...prev, chosenMaterial: m, phase: 'gauge' }));
  }

  // Called when the gauge minigame locks in. Position 0..1; target is
  // centered around 0.5 with width that grows with skill.
  function craftingResolveGauge(position) {
    if (!craftingPrompt) return;
    const skill = craftingPrompt.skill || 0;
    // Master zone: ±(0.06 + skill * 0.025) → 0.06 (skill 0) to 0.185 (skill 5)
    // Fine zone:   ±(0.18 + skill * 0.04)  → 0.18 (skill 0) to 0.38 (skill 5)
    const masterRadius = 0.06 + skill * 0.025;
    const fineRadius   = 0.18 + skill * 0.04;
    const offset = Math.abs(position - 0.5);
    const quality = craftingPrompt.salvaged ? 'rough'
                  : offset <= masterRadius   ? 'master'
                  : offset <= fineRadius     ? 'fine'
                  :                            'rough';
    const built = buildCraftedEquipment({
      slot: craftingPrompt.slot,
      material: craftingPrompt.chosenMaterial,
      quality,
      skill,
    });
    setCraftingPrompt(prev => ({ ...prev, phase: 'result', quality, result: built }));
  }

  // Commit the crafted output — card to deck, equipment to equipment slot.
  // Clear the act's inventory for that slot (materials are spent) and
  // route to act-cleared.
  function craftingConfirm() {
    if (!craftingPrompt || !craftingPrompt.result) return;
    const r = craftingPrompt.result;
    if (r.kind === 'card') {
      setDeck(d => [...d, { ...r.card, uid: uid() }]);
      pushLog(`🛠 Crafted: ${r.card.name} — added to your deck.`);
    } else if (r.kind === 'equipment') {
      setEquipment(prev => [...prev, r.equipment]);
      applyEquipmentMaxHp(r.equipment);
      pushLog(`🛠 Crafted: ${r.equipment.name}.`);
    }
    // Spend materials for this slot (rest are kept for narrative? no —
    // simpler to clear: they were used in the workshop or set aside).
    const slot = craftingPrompt.slot;
    setInventory(prev => ({ ...prev, [slot]: [] }));
    setCraftingPrompt(null);
    setStage('act-cleared');
  }

  function resolveRestChoice(kind) {
    logEvent(TE.REST_CHOICE, { kind, hp, composure, deckSize: deck.length + hand.length + discard.length + exiled.length });
    if (kind === 'heal') {
      // Rest restores both pools at 30% of max. Composure recovers same
      // ratio as HP so the inn-before-boss guarantee actually tops you
      // off across both vital pools, not just physical health.
      const hpAmount   = Math.floor(maxHp * 0.3);
      const compAmount = Math.floor(composureMax * 0.3);
      setHp(h => clamp(h + hpAmount, 0, maxHp));
      setComposure(c => clamp(c + compAmount, 0, composureMax));
      pushLog(`🛏 Rest: +${hpAmount} HP, +${compAmount} Composure.`);
      setRestNode(null);
      returnToMap();
      return;
    }
    if (kind === 'upgrade') {
      // Open the upgrade picker. Rest node stays selected; the picker
      // returns to map on confirm or cancel.
      setUpgradeOpen(true);
      setStage('upgrade');
      return;
    }
  }

  function pickCardToUpgrade(cardUid) {
    if (cardUid === null) {
      // Cancelled — go back to rest.
      logEvent('upgrade.cancel', { deckSize: deck.length });
      setUpgradeOpen(false);
      setStage('rest');
      return;
    }
    const target = deck.find(c => c.uid === cardUid);
    logEvent('upgrade.pick', { cardId: target?.id, cardName: target?.name, type: target?.type, deckSize: deck.length });
    setDeck(prev => prev.map(c => {
      if (c.uid !== cardUid) return c;
      const upgraded = upgradeCard(c);
      pushLog(`🛏 Upgraded ${c.name} → ${upgraded.name}.`);
      return upgraded;
    }));
    setUpgradeOpen(false);
    setRestNode(null);
    returnToMap();
  }

  // ---------- RENDER ----------
  if (stage === 'menu')               return <MenuScreen
    onStart={startRun} onTutorial={startTutorial}
    onContinue={hasSavedRun ? continueRun : null}
    onDiscardSave={hasSavedRun ? () => { clearSavedRun(); } : null} />;
  if (stage === 'tutorial-complete')  return <TutorialCompleteScreen onStart={startRun} onMenu={() => setStage('menu')} />;
  if (stage === 'defeat')             return <EndScreen win={false} onRetry={startRun} />;
  if (stage === 'graduation')         return <GraduationScreen equipment={equipment} familiar={familiar} familiarName={familiarName} onRetry={startRun} />;
  // Card-grant modal sits on top of whatever stage triggered it — render
  // the modal as an overlay below.

  if (stage === 'character-select') return <CharacterSelectScreen characters={CHARACTERS} onSelect={pickCharacter} />;
  if (stage === 'supply-shop')   return <SupplyShopScreen choices={supplyChoices} picks={supplyPicks} onPick={pickSupplyCard} character={selectedCharacter} />;
  if (stage === 'familiar-shop') return <FamiliarShopScreen onPick={pickFamiliar} />;
  if (stage === 'familiar-name') return <FamiliarNameScreen familiar={familiar} onConfirm={confirmFamiliarName} />;
  if (stage === 'starting-picks') return <StartingPicksScreen
    pool={STARTING_PICKS_POOL}
    selected={startingPicksSelected}
    onToggle={toggleStartingPick}
    onConfirm={confirmStartingPicks} />;

  if (stage === 'act-cleared') {
    return <ActClearedScreen act={currentAct} equipment={equipment}
      isFinalAct={currentActIdx === ACTS.length - 1}
      onContinue={() => {
        logEvent(TE.ACT_CLEARED, { actIdx: currentActIdx, hp, composure, deckSize: deck.length + hand.length + discard.length + exiled.length, equipment: equipment.map(eq => eq.id) });
        if (currentActIdx === ACTS.length - 1) {
          logEvent(TE.RUN_END, { outcome: 'won', actIdx: currentActIdx, finalDeckSize: deck.length + hand.length + discard.length + exiled.length, finalHp: hp });
          setStage('graduation');
        } else advanceToNextAct();
      }} />;
  }
  if (stage === 'reward') return <RewardScreen choices={rewardChoices} onPick={pickReward} />;
  if (stage === 'card-grant') return <CardGrantScreen prompt={cardGrantPrompt} onDismiss={dismissCardGrant} />;
  if (stage === 'material-choose') return <MaterialChooseScreen prompt={materialChoices} onPick={claimMaterial} onSkip={skipMaterial} />;
  if (stage === 'skill-event') return <SkillEventScreen event={activeSkillEvent} skills={skills} onChoose={resolveSkillChoice} />;
  if (stage === 'sidequest-node') {
    const active = sidequestActive ? { tpl: SIDEQUEST_TEMPLATES[sidequestActive.templateId], node: SIDEQUEST_TEMPLATES[sidequestActive.templateId]?.nodes[sidequestActive.nodeIdx], idx: sidequestActive.nodeIdx } : null;
    if (!active?.tpl || !active?.node) { returnToMap(); return null; }
    return <SidequestNodeScreen template={active.tpl} node={active.node} nodeIdx={active.idx}
      onChoose={resolveSidequestChoice} onNarrativeContinue={resolveSidequestNarrative}
      onAbandon={abandonSidequest} />;
  }
  if (stage === 'insult-prompt' && insultPrompt) return <InsultPromptScreen
    insultPrompt={insultPrompt} enemy={enemy}
    onPick={pickInsultWord} />;
  if (stage === 'skill-minigame' && skillMinigame?.kind === 'trace-whittling') return <TraceWhittlingMinigame
    eventTitle={skillMinigame.eventTitle}
    choiceLabel={skillMinigame.choiceLabel}
    onComplete={finalizeSkillMinigame} />;
  if (stage === 'crafting') return <CraftingScreen
    prompt={craftingPrompt}
    onPickMaterial={craftingPickMaterial}
    onResolveGauge={craftingResolveGauge}
    onConfirm={craftingConfirm}
  />;
  if (stage === 'event')  return <EventScreen event={activeEvent} onChoose={resolveEventChoice} />;
  if (stage === 'rest')   return <RestScreen onChoose={resolveRestChoice} />;
  if (stage === 'upgrade') return <UpgradeCardScreen deck={deck} onPick={pickCardToUpgrade} />;
  // Floating menu button (☰) + overlay. Only renders on play stages.
  // Save & Quit only allowed when stage === 'map' (combat / mid-event
  // state isn't safe to serialize). Give Up always available.
  // The mailbox postcard button piggybacks on this overlay block so
  // it persists across map/combat — it's intentionally not super
  // noticeable per the design ("a small mailbox, not super noticeable").
  const menuOverlay = <>
    {postcardMailboxVisible() && (
      <button onClick={() => setPostcardModalOpen(true)}
        title="A small mailbox catches your eye."
        className="fixed top-3 right-24 z-40 px-2 py-1 rounded bg-ink-800 border border-ink-600 text-parchment-400 text-xs hover:bg-ink-700 opacity-60 hover:opacity-100 transition-opacity">
        📮
      </button>
    )}
    {postcardModalOpen && (
      <PostcardModal
        state={postcardState}
        phrase={postcardPhrase}
        progress={postcardsCorrect}
        onSubmit={submitPostcard}
        onClose={() => setPostcardModalOpen(false)} />
    )}
    <button onClick={() => setGameMenuOpen(true)}
      title="Menu (resume / save / give up)"
      className="fixed top-3 right-3 z-40 px-3 py-1.5 rounded-md bg-ink-700 border border-ink-500 text-parchment-200 text-sm hover:bg-ink-600 shadow-lg">
      ☰ Menu
    </button>
    {gameMenuOpen && (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
        <div className="parchment-card-strong p-6 max-w-sm w-full flex flex-col gap-3">
          <h2 className="font-display text-2xl text-gold-300 text-center">Pause</h2>
          <button onClick={() => setGameMenuOpen(false)} className="btn btn-moss">Resume</button>
          <button onClick={saveAndQuit} disabled={stage !== 'map'}
            className={`btn ${stage === 'map' ? 'btn-iris' : 'bg-ink-600 text-parchment-400 cursor-not-allowed'}`}
            title={stage === 'map' ? 'Save the run and return to the main menu.' : 'Saving is only available on the map. Finish the current step first.'}>
            Save &amp; Quit {stage !== 'map' && <span className="text-xs">(not on this screen)</span>}
          </button>
          <button onClick={giveUpRun} className="btn btn-ember">Give Up (lose run)</button>
        </div>
      </div>
    )}
  </>;

  if (stage === 'map') {
    return <>
      <MapScreen
        map={map} act={currentAct} actIdx={currentActIdx} totalActs={ACTS.length}
        currentNodeId={currentNodeId} clearedNodes={clearedNodes}
        reachable={reachableFromCurrent()}
        mapFog={postcardState === 'failed'}
        player={{ hp, maxHp, composure, composureMax, equipment, relics, deckSize: deck.length, familiar, familiarName, inventory, skills }}
        onPick={pickNode} log={log} />
      {menuOverlay}
    </>;
  }

  // Combat
  return <>
    {menuOverlay}
    <CombatScreen
      enemy={enemy} enemyComposure={enemyComposure} enemyHp={enemyHp}
      enemyBlock={enemyBlock} enemyIntent={enemyIntent} intentTick={intentTick}
      enemyDmgMult={enemyDmgMult} playerDmgMult={playerDmgMult}
      enemyHitFlash={enemyHitFlash} playerHitFlash={playerHitFlash} dmgFloaters={dmgFloaters}
      hp={hp} maxHp={maxHp}
      playerComposure={composure} playerComposureMax={composureMax}
      block={block} energy={energy} hand={hand}
      amplifyPlaysThisCombat={amplifyPlaysThisCombat}
      deck={deck} discard={discard} tray={tray}
      energyMax={energyPerTurnRefill()}
      equipment={equipment} powers={powers} relics={relics}
      familiar={familiar} familiarName={familiarName}
      onPlayCard={playCard} onEndTurn={endTurn}
      onUnstage={unstageCard} onCast={castStagedSpell}
      castPreview={previewCastDamage()}
      log={log}
    />
    {tutorialActive && <TutorialOverlay
      step={tutorialStep}
      onAdvance={() => setTutorialStep(s => s + 1)}
      onExit={exitTutorial}
    />}
  </>;
}

// =============================================================================
// 4. SUB-SCREENS
// =============================================================================

function MenuScreen({ onStart, onTutorial, onContinue, onDiscardSave }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="font-display text-6xl text-gold-300 tracking-widest text-center">Wizard Graduation</h1>
      <p className="font-quill text-parchment-200 italic max-w-xl text-center">
        The school has taught you what it can. To graduate, you must walk the
        Path of Mastery — gather your staff, robes, gem, and ring, each from
        a trial worthier than the last.
      </p>
      <div className="flex flex-col gap-2 items-center">
        {onContinue && (
          <button onClick={onContinue} className="btn btn-iris text-lg px-8 py-3 animate-pulse">Continue Saved Run</button>
        )}
        <button onClick={onStart}    className="btn btn-gold text-lg px-8 py-3">{onContinue ? 'Begin a New Path (discards save)' : 'Begin the Path'}</button>
        <button onClick={onTutorial} className="btn btn-ink  text-sm px-6 py-2">First time? Practice with the Bursar →</button>
        {onDiscardSave && (
          <button onClick={onDiscardSave} className="text-xs text-parchment-500 italic hover:text-ember-300 mt-2">Discard saved run</button>
        )}
      </div>
      <p className="text-xs text-parchment-400">MVP 5 — verbal combat: words build spells, effects cast them.</p>
    </div>
  );
}

// Tutorial overlay — fixed-position floating panel that walks the player
// through the verbal combat system. Step-gated content; step 1 and 2 wait
// on a specific player action (advanced by advanceTutorialStep); other
// steps advance via the Continue button.
function TutorialOverlay({ step, onAdvance, onExit }) {
  const STEPS = [
    {
      title: 'Welcome.',
      body: (<>
        <p>The Bursar has offered to spar with you. <i>Verbally</i>, of course — wizards prefer it that way. (He hasn't actually agreed to your terms, but he is here, which counts.)</p>
        <p className="mt-2">Three things you'll need to know: <b>Words build spells</b>. <b>Effects cast them</b>. <b>Skills</b> (like Defend) do their thing immediately.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 1 — Play a Word card.',
      body: (<>
        <p>Look at your hand. The iris-bordered cards (like <b>"With all due respect,"</b>) are <b>Word cards</b>. They don't do anything to the enemy on their own — they add stat points to your <b>Spell Tray</b> (the panel right under the Bursar).</p>
        <p className="mt-2">Play a Word card. Any will do. Watch the Tray fill up.</p>
      </>),
      cta: '(play any Word card)',
      waitsForAction: true,
    },
    {
      title: 'Step 2 — Stage an Effect card and CAST.',
      body: (<>
        <p>Excellent. Your tray now has a stat point. Words on their own do nothing — they're potential energy.</p>
        <p className="mt-2">The ember-bordered cards are <b>Effect cards</b>. Click one — it goes to the tray as the <i>sealer</i>. The tray will show a <b>Predicted damage</b> number, then click the big <b>✨ CAST</b> button to actually fire the spell. (You can stage more words first if you want a bigger spell. You can also click a staged card to take it back.)</p>
      </>),
      cta: '(stage an Effect, then click CAST)',
      waitsForAction: true,
    },
    {
      title: 'Step 3 — Resistances, themes, and fizzling.',
      body: (<>
        <p>You drained some of the Bursar's <b>Composure</b> (the ✨ bar). Drain it to 0 and he concedes.</p>
        <p className="mt-2"><b>Effectiveness badges</b> (next to his Intent) — <b>Chutz / Wit / Jnsq / Phys</b>. Each shows how he reacts: <b>×1</b> baseline · <span className="text-moss-300">×1.5–2 susceptible</span> · <span className="text-ember-300">×0.5 resistant</span> · <span className="text-parchment-400">×0 immune</span>. The Bursar is fair on everything; other enemies aren't.</p>
        <p className="mt-2"><b>Themes ✦</b> — every Word card carries 1–2 themes (like <i>formal</i>, <i>academic</i>, <i>booming</i>). When you cast an Effect that <i>resonates</i> with themes in your tray, you get <b>flat bonus damage per match</b>. Look at any card — themes are listed under the stats with a ✦. The Spell Tray shows themes accumulating as you build.</p>
        <p className="mt-2">Last lesson: if you play Word cards but never play an Effect, the spell <b>fizzles</b> at end of turn. The Wit you built up vanishes. Don't let it happen.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 4 — Physical, Block, and the rest.',
      body: (<>
        <p>A handful of enemies (Constructs, Crabs, Beetles) are <i>completely</i> verbal-immune. For them you'll want a <b>physical Effect</b> like <b>Spark</b> — it hits their HP instead of Composure, and scales the same way.</p>
        <p className="mt-2"><b>Defend</b> still works the same as ever: gain Block, which absorbs incoming damage. Block resets to 0 at end of turn — spend it.</p>
        <p className="mt-2">That's the whole system. Finish the Bursar at your leisure. (You can't lose this match — he's pulling his punches.)</p>
      </>),
      cta: 'Got it — let me finish',
      waitsForAction: false,
    },
  ];
  const data = STEPS[Math.min(step, STEPS.length - 1)];
  if (step >= STEPS.length) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto parchment-card-strong border-2 border-iris-500 bg-ink-700 p-4 shadow-2xl">
        <div className="flex justify-between items-start mb-2">
          <div className="font-display text-lg text-iris-300">🎓 {data.title}</div>
          <button onClick={onExit} className="text-xs text-parchment-400 hover:text-parchment-200" title="Exit tutorial">✕ Exit</button>
        </div>
        <div className="text-sm font-quill text-parchment-100 space-y-1">{data.body}</div>
        <div className="mt-3 flex justify-end">
          {data.waitsForAction
            ? <span className="text-xs italic text-iris-300">{data.cta}</span>
            : <button onClick={onAdvance} className="btn btn-iris text-sm">{data.cta}</button>
          }
        </div>
      </div>
    </div>
  );
}

// Played after the player drains the Bursar's Composure to 0.
function TutorialCompleteScreen({ onStart, onMenu }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-2xl mx-auto">
      <h2 className="font-display text-5xl text-gold-300 tracking-widest text-center">Practice Match Won</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">
        The Bursar inclines his head. "Reasonable," he says. "Mostly. We'll
        see if it holds up in the field." He goes back to his ledger.
      </p>
      <div className="parchment-card-strong p-4 w-full">
        <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">What you just learned</div>
        <ul className="text-sm font-quill text-parchment-100 space-y-1 list-disc list-inside">
          <li><b>Word cards</b> add stat points + themes to the Spell Tray.</li>
          <li><b>Effect cards</b> cast a spell scaling off one stat — damage = (base + stat × multiplier) × effectiveness.</li>
          <li><b>Themes ✦</b> — match an Effect's resonance with words in your tray for a flat bonus per match. Build a "lawyer deck", a "drunkard deck", a "bully deck" — the LLM is in your corner.</li>
          <li>Enemies have per-stat resistance / susceptibility / immunity. Check the badges.</li>
          <li>Play words without an Effect → spell <b>fizzles</b> at end of turn.</li>
          <li>Most enemies are physical-immune by default; a few aren't (Spark / Magic Missile / Sword Logic).</li>
          <li>Block still works. Defend still defends.</li>
        </ul>
      </div>
      <div className="flex gap-2">
        <button onClick={onStart} className="btn btn-gold text-lg px-8 py-3">Begin the Path</button>
        <button onClick={onMenu}  className="btn btn-ink  px-6 py-3">Back to Menu</button>
      </div>
    </div>
  );
}

// ---- CHARACTER SELECT ----

function CharacterSelectScreen({ characters, onSelect }) {
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-6 max-w-6xl mx-auto">
      <h2 className="font-display text-5xl text-gold-300 tracking-widest text-center">Choose Your Wizard</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-2xl">
        The school taught you words. The graduation requires that you commit
        to one voice and walk the path with it. The path is the same path.
        The voice changes everything.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4 w-full">
        {characters.map(c => (
          <button key={c.id} onClick={() => onSelect(c.id)}
            className="flex flex-col gap-3 p-6 bg-ink-700 border-2 border-ink-500 hover:border-gold-400 rounded-lg text-left shadow-lg transition hover:scale-[1.02] cursor-pointer">
            <div className="text-xs uppercase tracking-widest text-gold-500">{c.lane}</div>
            <h3 className="font-display text-3xl text-gold-300">{c.name}</h3>
            <div className="text-sm italic text-parchment-200">{c.title}</div>
            <p className="font-quill text-parchment-100 leading-relaxed text-sm">{c.desc}</p>
            <div className="mt-auto pt-3 border-t border-ink-500">
              <div className="text-xs text-stone-400 mb-1">Voice</div>
              <div className="text-sm text-parchment-200">{c.voice}</div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {c.tagPalette.map(t => (
                <span key={t} className="text-[10px] uppercase tracking-wide bg-ink-600 text-parchment-300 px-2 py-0.5 rounded">{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <p className="font-quill italic text-stone-400 text-xs text-center max-w-2xl mt-4">
        Note: full per-character card pools (see design/*_V2_DESIGN.md) are in
        progress. For now, supply-shop offers are weighted toward your lane —
        the deck experience will deepen as each pool is implemented.
      </p>
    </div>
  );
}

// ---- TOWN INTRO ----

function SupplyShopScreen({ choices, picks, onPick, character }) {
  const remaining = 2 - picks.length;
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-5 max-w-5xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300">The Supply Shop</h2>
      {character && (
        <div className="text-sm text-gold-500 italic">
          For: <span className="text-gold-300">{character.name}</span> — offers leaning {character.lane}.
        </div>
      )}
      <p className="font-quill italic text-parchment-200 text-center max-w-2xl">
        A long table covered in cards. The proprietor sucks his teeth in the
        manner of a man who has done so professionally. "Pick two," he says.
        "You're an apprentice. <i>Two.</i>"
      </p>
      <div className="text-sm text-gold-300">
        Picked: {picks.length} / 2 {remaining > 0 ? `(choose ${remaining} more)` : '— off to the familiar shop'}
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        {choices.map((card, i) => {
          const picked = picks.includes(i);
          const disabled = picked || picks.length >= 2;
          return (
            <button key={i} onClick={() => onPick(i)} disabled={disabled}
              className={`w-48 min-h-[260px] rounded-lg border-2 p-3 text-left flex flex-col gap-2 shadow-lg transition ${
                picked
                  ? 'bg-moss-700 text-parchment-50 border-moss-400 cursor-default'
                  : disabled
                    ? 'bg-ink-600 text-parchment-400 border-ink-500 opacity-50'
                    : 'bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl cursor-pointer'
              }`}>
              <div className="flex justify-between items-center">
                <div className="font-display text-base leading-tight">{card.name || card.phrase || ''}</div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">
                  {card.cost}
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">
                {(card.slot || card.type)} · {card.rarity}{card.tier ? ` · T${card.tier}` : ''}
              </div>
              {/* Stat contribution (intros/subjects/modifiers) */}
              {card.stats && (card.stats.chutzpah || card.stats.wit || card.stats.jnsq) && (
                <div className="flex gap-1 flex-wrap text-xs font-mono">
                  {card.stats.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
                  {card.stats.wit      ? <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">✨ {card.stats.wit}</span> : null}
                  {card.stats.jnsq     ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
                </div>
              )}
              {/* Target damage formula */}
              {(card.slot === 'target' || card.type === 'effect') && card.effect && (
                <div className="text-xs font-mono text-ink-700">
                  {card.effect.base} + {(card.effect.scaleBy || card.lane || 'wit').toUpperCase()}×{card.effect.multiplier}
                  {card.effect.rider && (
                    <span className="ml-1 text-ember-700">
                      ({Object.entries(card.effect.rider).map(([k, v]) => `+${v} ${k}`).join(' · ')})
                    </span>
                  )}
                </div>
              )}
              {/* Tags */}
              {card.tags && card.tags.length > 0 && (
                <div className="text-[11px] italic text-ink-500">✦ {card.tags.join(' · ')}</div>
              )}
              <div className="text-xs font-quill">{card.desc || ''}</div>
              {card.flavor && (
                <div className="text-[11px] italic opacity-70 mt-auto pt-1 border-t border-ink-300">"{card.flavor}"</div>
              )}
              {picked && <div className="text-xs italic text-moss-300 mt-1">— bought —</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FamiliarShopScreen({ onPick }) {
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-5 max-w-6xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300">The Familiar Shop</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-2xl">
        A narrow shop with a low door, smelling of straw and disagreement. Ten
        creatures occupy ten various surfaces. The proprietor is asleep, or
        pretending to be. Either way, the cat is in charge.
      </p>
      <p className="text-sm text-gold-300">Pick one familiar. (You can name it next.)</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
        {FAMILIARS.map(fam => (
          <button key={fam.id} onClick={() => onPick(fam.id)}
            className="rounded-lg border-2 border-ink-500 bg-ink-700 hover:border-gold-500 hover:bg-ink-600 transition p-3 text-left flex flex-col gap-2 cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-3xl leading-none">{fam.emoji}</span>
              <div className="font-display text-lg text-gold-300">{fam.species}</div>
            </div>
            <div className="text-xs text-parchment-200">{fam.desc}</div>
            <div className="text-[11px] italic text-parchment-400">"{fam.flavor}"</div>
            <div className="mt-1 pt-2 border-t border-ink-500">
              <div className="text-[10px] uppercase tracking-widest text-gold-400">Signature card</div>
              <div className="text-xs"><b className="text-parchment-50">{fam.card.name}</b> <span className="text-parchment-300">({fam.card.cost}⚡) — {fam.card.desc}</span></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FamiliarNameScreen({ familiar, onConfirm }) {
  const [name, setName] = useState('');
  if (!familiar) return null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-md mx-auto">
      <h2 className="font-display text-4xl text-gold-300">A Naming</h2>
      <div className="text-7xl">{familiar.emoji}</div>
      <p className="font-quill italic text-parchment-200 text-center">
        Your {familiar.species.toLowerCase()} looks at you with an expression that
        is either expectant or hungry, or possibly both at once. A name would
        help with the paperwork.
      </p>
      <input
        type="text" value={name} onChange={e => setName(e.target.value)}
        placeholder={`(default: ${familiar.species})`}
        maxLength={24}
        className="w-full px-3 py-2 rounded-md bg-parchment-50 text-ink-800 border-2 border-gold-500 font-quill text-lg"
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') onConfirm(name); }}
      />
      <div className="flex gap-2 w-full">
        <button onClick={() => onConfirm(name)} className="btn btn-gold flex-1">Confirm</button>
        <button onClick={() => onConfirm('')} className="btn btn-ink flex-1">Use "{familiar.species}"</button>
      </div>
    </div>
  );
}

function MapScreen({ map, act, actIdx, totalActs, currentNodeId, clearedNodes, reachable, player, onPick, log, mapFog }) {
  // Scroll the player's current node into the middle of the viewport
  // whenever this screen mounts or the position changes. Otherwise the
  // page lands at the top of the act and the player has to manually
  // scroll down to find themselves after every combat/event.
  // On row 0 (act start, before any pick) there's no current node — we
  // fall back to scrolling to the top.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!currentNodeId) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    // requestAnimationFrame so the SVG has actually painted by the time
    // we query it. Without this the lookup runs before the SVG mounts.
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-node-id="${currentNodeId}"]`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [currentNodeId]);

  if (!map || !act) return null;
  // Map viewBox: ~90 viewBox-units between rows so nodes (r=18) have a
  // generous gap that survives CSS scaling. W bumped to 900 so the
  // aspect ratio stays workable (taller maps stretched too vertically
  // at W=600).
  const W = 900, padding = 40;
  const rows = act.rows;
  const cols = act.width;
  const ROW_SPACING = 90;
  const H = padding * 2 + Math.max(1, rows - 1) * ROW_SPACING;
  const xScale = (x) => padding + (x * (W - 2 * padding)) / cols;
  const yScale = (y) => padding + (y * (H - 2 * padding)) / (rows - 1);

  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-6xl mx-auto">
      {/* Sticky top HUD — scroll-to-current jumps you below the fold;
          this keeps HP/Composure visible regardless of scroll position. */}
      <div className="sticky top-0 z-10 flex justify-between items-center parchment-card px-4 py-2 shadow-lg">
        <div>
          <h1 className="font-display text-xl text-gold-300">{act.name}</h1>
          <div className="text-[10px] uppercase text-parchment-400 tracking-widest">Act {actIdx + 1} of {totalActs} · prize: master {SLOT_LABEL[act.slot]}</div>
        </div>
        <div className="text-sm flex gap-3 items-center">
          {player.familiar && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-ink-600 border border-ink-400 text-xs"
                  title={player.familiar.desc}>
              <span className="text-base leading-none">{player.familiar.emoji}</span>
              <span className="text-gold-300">{player.familiarName || player.familiar.species}</span>
            </span>
          )}
          <span className="font-mono text-moss-300" title="HP — your physical health. Drops to 0 and you fail.">
            ❤ {player.hp}<span className="text-parchment-400 text-xs"> / {player.maxHp}</span>
          </span>
          {player.composureMax != null && (
            <span className="font-mono text-iris-200" title="Composure — your nerve. Drops to 0 and you fail by losing your nerve.">
              🎭 {player.composure}<span className="text-parchment-400 text-xs"> / {player.composureMax}</span>
            </span>
          )}
          <span className="text-xs text-parchment-300">📜 {player.deckSize}</span>
          <span className="text-xs text-parchment-300">⚜ {player.equipment.length}</span>
        </div>
      </div>

      <div className="parchment-card p-4 flex flex-col items-center">
        {(() => {
          // Fog-of-war visibility per node:
          //   cleared : in clearedNodes — path you've already walked
          //   current : your current spot
          //   next    : directly reachable from current — clickable
          //   visible : everything else, shown fully (STS-style — no fog)
          // The player sees the entire act up front and can plan a route
          // around the material/skill nodes they want.
          const reachableSet = new Set(reachable);
          const clearedSet = new Set(clearedNodes);
          const visibilityOf = (nodeId) => {
            if (clearedSet.has(nodeId))   return 'cleared';
            if (nodeId === currentNodeId) return 'current';
            if (reachableSet.has(nodeId)) return 'next';
            return 'visible';
          };
          return (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl" preserveAspectRatio="xMidYMid meet">
              {Object.entries(map.edges).map(([fromId, tos]) => {
                const from = map.nodes.find(n => n.id === fromId);
                return tos.map(toId => {
                  const to = map.nodes.find(n => n.id === toId);
                  if (!from || !to) return null;
                  const fromVis = visibilityOf(fromId);
                  const toVis   = visibilityOf(toId);
                  const cleared = fromVis === 'cleared' && toVis === 'cleared';
                  const onCurrentPath = currentNodeId === fromId;
                  let stroke, strokeWidth, opacity, dash;
                  if (cleared)               { stroke = '#5d7e3f'; strokeWidth = 1.5; opacity = 0.55; dash = '6,3'; }
                  else if (onCurrentPath)    { stroke = '#c79d44'; strokeWidth = 3;   opacity = 1;    dash = '0';   }
                  else                       { stroke = '#3d3325'; strokeWidth = 1.5; opacity = 0.7;  dash = '0';   }
                  return (
                    <line key={`${fromId}->${toId}`}
                      x1={xScale(from.x)} y1={yScale(from.y)}
                      x2={xScale(to.x)} y2={yScale(to.y)}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      strokeDasharray={dash} />
                  );
                });
              })}
              {map.nodes.map(n => {
                const vis = visibilityOf(n.id);
                // All nodes show their type up front (STS-style, no fog).
                // Reachable nodes get a gold halo + clickability; cleared
                // nodes desaturate; everything else renders fully but
                // inert until the path reaches it.
                const isCurrent   = vis === 'current';
                const isCleared   = vis === 'cleared';
                const isReachable = vis === 'next';
                const isFuture    = vis === 'visible';
                const fill   = nodeColor(n.type, isCleared, isCurrent);
                const stroke = isReachable ? '#dbb45f'
                             : isCurrent   ? '#c79d44'
                             :               '#5a4d3a';
                const strokeWidth = isReachable ? 3 : isCurrent ? 2.5 : 1.5;
                const opacity = isCleared ? 0.55
                              : isFuture ? 0.85
                              :            1;
                return (
                  <g key={n.id}
                    data-node-id={n.id}
                    style={{ cursor: isReachable ? 'pointer' : 'default' }}
                    onClick={() => isReachable && onPick(n.id)}>
                    <title>{nodeTooltip(n.type)}</title>
                    <circle cx={xScale(n.x)} cy={yScale(n.y)} r={n.type === 'boss' ? 26 : 18}
                      fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                      opacity={opacity} />
                    <text x={xScale(n.x)} y={yScale(n.y) + 5} textAnchor="middle"
                      className="select-none" fill="#f7eed3"
                      fontSize={n.type === 'boss' ? 18 : 14}
                      opacity={isFuture ? 0.9 : 1}>
                      {/* Postcard penalty: fog hides node types until lifted. */}
                      {mapFog && !isCurrent && !isCleared ? '?' : nodeGlyph(n.type)}
                    </text>
                  </g>
                );
              })}
            </svg>
          );
        })()}
        <div className="mt-3 text-xs text-parchment-300 flex gap-3 flex-wrap justify-center">
          <Legend glyph="⚔" label="Combat" />
          <Legend glyph="☠" label="Elite" />
          <Legend glyph="🛏" label="Rest" />
          <Legend glyph="📜" label="Event" />
          <Legend glyph="🪵" label="Material" />
          <Legend glyph="🛠" label="Skill" />
          <Legend glyph="🏘" label="Town" />
          <Legend glyph="👑" label="Boss" />
        </div>
        {!currentNodeId && (
          <div className="mt-2 text-sm text-gold-300 italic">Pick a starting trail. The path beyond is hearsay.</div>
        )}
      </div>

      {(player.equipment.length > 0 || (player.relics?.length || 0) > 0) && (
        <div className="parchment-card p-3 text-xs flex gap-3 flex-wrap">
          {player.equipment.length > 0 && (
            <>
              <span className="uppercase text-parchment-300">Equipment:</span>
              {player.equipment.map(eq => (
                <span key={eq.id} className="text-gold-300" title={eq.desc}>⚜ {eq.name}</span>
              ))}
            </>
          )}
          {(player.relics?.length || 0) > 0 && (
            <>
              <span className="uppercase text-parchment-300 ml-2">Relics:</span>
              {player.relics.map(r => (
                <span key={r.id} className="text-gold-300" title={`${r.desc}${r.flavor ? '\n\n' + r.flavor : ''}`}>📿 {r.name}</span>
              ))}
            </>
          )}
        </div>
      )}

      {/* Inventory + skill summary — visible so the player can plan
          route choices around what they still need for the act's
          crafting screen at the boss. */}
      {(player.inventory || player.skills) && (
        <div className="parchment-card p-3 flex flex-col gap-1.5">
          {player.inventory && Object.values(player.inventory).some(arr => arr.length > 0) && (
            <div className="text-xs flex gap-2 flex-wrap items-center">
              <span className="uppercase text-parchment-300">Gathered:</span>
              {Object.entries(player.inventory).map(([slot, mats]) =>
                mats.length > 0 ? (
                  <span key={slot} className="text-gold-300" title={mats.map(m => m.name).join(', ')}>
                    {slot === 'staff' ? '🪵' : slot === 'robes' ? '🧵' : slot === 'ring' ? '⚒' : '🎩'}{' '}
                    {mats.map(m => m.name).join(', ')}
                  </span>
                ) : null
              )}
            </div>
          )}
          {player.skills && Object.values(player.skills).some(v => v > 0) && (
            <div className="text-xs flex gap-2 flex-wrap items-center">
              <span className="uppercase text-parchment-300">Skills:</span>
              {Object.entries(player.skills).map(([sk, lvl]) =>
                lvl > 0 ? (
                  <span key={sk} className="text-moss-300">
                    🛠 {sk[0].toUpperCase() + sk.slice(1)} {lvl}
                  </span>
                ) : null
              )}
            </div>
          )}
        </div>
      )}

      <div className="parchment-card p-3 max-h-40 overflow-y-auto text-sm font-quill text-parchment-200 space-y-0.5">
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
  if (type === 'material') return '#7c5e2e';
  if (type === 'skill') return '#5a6e2a';
  if (type === 'start' || type === 'town') return '#5d4a2a';
  return '#2b2418';
}
function nodeGlyph(type) {
  return {
    combat: '⚔', elite: '☠', rest: '🛏', event: '📜',
    material: '🪵', skill: '🛠',
    boss: '👑', town: '🏘', start: '·',
  }[type] || '?';
}
function nodeLabel(n) {
  return ({
    combat: 'a combat tile', elite: 'an elite tile', rest: 'a rest tile',
    event: 'an event', start: 'the trailhead', town: 'the town', boss: 'the boss',
    material: 'a gather', skill: 'a craft lesson',
  }[n.type]) || 'a tile';
}
// Plain-language tooltip body for a map node — appears on hover. Tells
// the player exactly what will happen when they step on the tile.
function nodeTooltip(type) {
  return ({
    combat:   '⚔ Combat — face a normal enemy. Drop their composure or HP to win and pick a card reward.',
    elite:    '☠ Elite — tougher enemy with more behaviors. Higher-quality reward on victory.',
    rest:     '🛏 Rest — restore 30% of both HP and Composure, OR upgrade a card from your deck.',
    event:    '📜 Event — a story moment with 2-3 choices, usually a trade (heal/card/max-HP up for HP/max-HP/card down).',
    material: '🪵 Gather — pick a raw material for this act\'s slot. Drives the end-of-act craft.',
    skill:    '🛠 Craft lesson — bump a craft skill. Safe pick: +2 skill, -8 HP. Risky pick: +4 skill, -8 max HP.',
    boss:     '👑 Boss — the act\'s final fight. Required to advance.',
    town:     '🏘 Town — the act\'s hub. Three paths radiate outward; pick a route. (Sidequests and NPC offers planned here in a later slice.)',
    start:    'Trailhead — the starting point of the act.',
  }[type]) || 'A tile.';
}
function Legend({ glyph, label }) {
  return <span><span className="mr-1">{glyph}</span>{label}</span>;
}

function CombatScreen({ enemy, enemyComposure, enemyHp, enemyBlock, enemyIntent, intentTick,
                       enemyDmgMult, playerDmgMult,
                       enemyHitFlash, playerHitFlash, dmgFloaters,
                       hp, maxHp, playerComposure, playerComposureMax,
                       block, energy, energyMax, hand, deck, discard, tray,
                       amplifyPlaysThisCombat,
                       equipment, powers, relics, familiar, familiarName,
                       onPlayCard, onEndTurn, onUnstage, onCast, castPreview, log }) {
  const composureMax = enemy?.composureMax ?? 999;
  const hpMax = enemy?.hpMax ?? 999;
  const showComposure = composureMax < 999;
  const showHp = hpMax < 999;
  const eff = enemy?.effectiveness || { chutzpah: 1, wit: 1, jnsq: 1, physical: 1 };
  const eff_label = (v) => v === 0 ? 'immune' : v >= 1.5 ? `×${v} susceptible` : v <= 0.5 ? `×${v} resistant` : `×${v}`;
  const eff_color = (v) => v === 0 ? 'bg-ink-500 text-parchment-300' : v >= 1.5 ? 'bg-moss-700 text-parchment-50' : v <= 0.5 ? 'bg-ember-800 text-parchment-100' : 'bg-ink-600 text-parchment-200';
  // Hit-shake: re-key on every enemyHitFlash change so the animation
  // restarts even on rapid consecutive hits.
  const shakeClass = enemyHitFlash ? 'enemy-hit-shake' : '';

  // Build a plain-language tooltip for the enemy's intent box. The
  // telegraph string ('🎭 5 (pattern-wrong)') is opaque on first read —
  // this is what teaches the icon vocabulary on hover.
  const intentTooltip = (intent) => {
    if (!intent) return '';
    const lines = [];
    if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
      const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
      const total = intent.value * hits;
      const pool = intent.pool === 'composure' ? 'Composure' : 'HP';
      const poolIcon = intent.pool === 'composure' ? '🎭' : '⚔';
      if (hits > 1) {
        lines.push(`${poolIcon} Attacks ${hits}× for ${intent.value} each (${total} total) — targets your ${pool}.`);
      } else {
        lines.push(`${poolIcon} Attacks for ${intent.value} damage — targets your ${pool}.`);
      }
      if (intent.pool === 'composure') {
        lines.push('Composure attacks bypass HP. Lose all Composure and you fail by losing your nerve.');
      }
    } else if (intent.kind === 'block') {
      lines.push(`🛡 Gains ${intent.value} Block — absorbs your damage to it until its next turn.`);
    } else if (intent.kind === 'vulnerable') {
      lines.push(`🩸 Applies Vulnerable ${intent.value} — its attacks deal +${25*intent.value}% damage to you next turns.`);
    } else if (intent.kind === 'weak') {
      lines.push(`⛧ Applies Weak ${intent.value} — your spell potency drops by ${25*intent.value}% next turns.`);
    }
    if (intent.riders) {
      const r = intent.riders;
      if (r.weak)       lines.push(`+ rider ⛧ Weak ${r.weak} — your spell potency also drops ${25*r.weak}%.`);
      if (r.vulnerable) lines.push(`+ rider 🩸 Vulnerable ${r.vulnerable} — enemy will deal +${25*r.vulnerable}% more damage too.`);
      if (r.block)      lines.push(`+ rider 🛡 ${r.block} — also gains Block.`);
    }
    lines.push('Block + Defense reduce attack damage to either pool. Debuffs drift back toward neutral by 0.25/turn.');
    return lines.join('\n');
  };
  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-6xl mx-auto">
      <div key={`enemy-${enemyHitFlash || 0}`} className={`parchment-card-strong p-4 relative ${shakeClass}`}>
        {/* Damage floaters — composure (iris) and physical (ember). */}
        {dmgFloaters && dmgFloaters.length > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-20">
            {dmgFloaters.map(f => (
              <div key={f.id}
                className={`dmg-float absolute font-display font-bold text-3xl tabular-nums whitespace-nowrap drop-shadow-lg ${
                  f.dmgType === 'physical' ? 'text-ember-300' : 'text-iris-200'
                }`}
                style={{ left: 0 }}>
                −{f.amount}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="font-display text-3xl text-ember-300">{enemy?.name}</div>
            <div className="text-sm text-parchment-300 italic">
              {enemy?.tier === 'boss' ? 'Boss' : enemy?.tier === 'elite' ? 'Elite' : 'Enemy'}
            </div>
          </div>
          <div className="text-right">
            {showComposure && (
              <div className="text-3xl font-mono text-iris-300" title="Composure — drain to 0 to make them back down.">
                ✨ {enemyComposure} <span className="text-base text-parchment-300">/ {composureMax}</span>
              </div>
            )}
            {showHp && (
              <div className="text-3xl font-mono text-ember-400" title="Physical HP — only physical effects hit this.">
                ❤ {enemyHp} <span className="text-base text-parchment-300">/ {hpMax}</span>
              </div>
            )}
            <div className="text-base">🛡 {enemyBlock}</div>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div key={`intent-${intentTick}`}
               className="intent-flash px-3 py-2 bg-ember-900 bg-opacity-60 rounded border border-ember-700 cursor-help"
               title={intentTooltip(enemyIntent) || 'No intent yet — it will telegraph what the enemy plans before their turn.'}>
            <div className="text-xs uppercase text-ember-300 tracking-widest">Intent <span className="text-ember-400">ⓘ</span></div>
            <div className="text-lg text-parchment-50">{enemyIntent?.telegraph || '...'}</div>
          </div>
          {enemyDmgMult !== 1.0 && (
            <span className={`px-2 py-1 rounded text-sm ${enemyDmgMult > 1 ? 'bg-ember-700 text-parchment-50' : 'bg-iris-700 text-parchment-50'}`}
              title={`Enemy attack damage ×${enemyDmgMult.toFixed(2)} (drifts toward 1.00 by 0.25/turn).`}>
              💢 Atk ×{enemyDmgMult.toFixed(2)}
            </span>
          )}
          {playerDmgMult !== 1.0 && (
            <span className={`px-2 py-1 rounded text-sm ${playerDmgMult > 1 ? 'bg-iris-700 text-parchment-50' : 'bg-ember-700 text-parchment-50'}`}
              title={`Your spell potency ×${playerDmgMult.toFixed(2)} (drifts toward 1.00 by 0.25/turn).`}>
              💫 Spell ×{playerDmgMult.toFixed(2)}
            </span>
          )}
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.chutzpah ?? 1)}`} title={`Chutzpah ${eff_label(eff.chutzpah ?? 1)}`}>💪 Chutz {eff_label(eff.chutzpah ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.wit ?? 1)}`} title={`Wit ${eff_label(eff.wit ?? 1)}`}>✨ Wit {eff_label(eff.wit ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.jnsq ?? 1)}`} title={`Jnsq ${eff_label(eff.jnsq ?? 1)}`}>🌀 Jnsq {eff_label(eff.jnsq ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.physical ?? 1)}`} title={`Physical ${eff_label(eff.physical ?? 1)}`}>⚔ Phys {eff_label(eff.physical ?? 1)}</span>
        </div>
      </div>

      {/* v2 SENTENCE TRAY — intro + subject + target + 0-2 modifiers.
          Playing a target auto-casts. End the turn without a target and
          the spell fizzles. */}
      <V2SpellTray tray={tray} onUnstage={onUnstage} onCast={onCast} />
      <div key={`player-hud-${playerHitFlash || 0}`}
           className={`parchment-card p-3 flex justify-between items-center ${playerHitFlash ? 'hit-shake' : ''}`}>
        <div className="flex gap-4 items-center flex-wrap">
          <div title="HP — your physical health. Drops to 0 and you fail. Heals through rest stops + inter-act recovery.">
            <div className="text-xs uppercase text-parchment-300">HP <span className="text-parchment-500">ⓘ</span></div>
            <div className="text-2xl font-mono text-moss-300">{hp} <span className="text-sm text-parchment-300">/ {maxHp}</span></div>
          </div>
          <div title="Composure — your nerve / verbal HP. Some enemies (🎭 attacks) target this instead of HP. Drop to 0 and you fail by losing your nerve, even at full HP.">
            <div className="text-xs uppercase text-parchment-300">Composure <span className="text-parchment-500">ⓘ</span></div>
            <div className="text-2xl font-mono text-iris-200">{playerComposure} <span className="text-sm text-parchment-300">/ {playerComposureMax}</span></div>
          </div>
          <div title="Block — absorbs incoming damage to either pool (HP or Composure). Resets to 0 at the start of your next turn. Powers / Felt-tier hats can re-grant it.">
            <div className="text-xs uppercase text-parchment-300">Block <span className="text-parchment-500">ⓘ</span></div>
            <div className="text-2xl font-mono text-iris-300">🛡 {block}</div>
          </div>
          {(() => {
            const rawDef = equipment.reduce((s, eq) => s + (eq.bonus?.damageReduction || 0), 0)
                          + (familiar?.bonus?.damageReduction || 0);
            const def = Math.min(2, rawDef);
            return rawDef > 0 ? (
              <div>
                <div className="text-xs uppercase text-parchment-300">Defense</div>
                <div className="text-2xl font-mono text-moss-200"
                  title={`Defense reduces every incoming hit by ${def} (min 1 damage taken). Capped at 2 — additional equipment Defense provides no further benefit.`}>
                  🛡✦ {def}{rawDef > def ? <span className="text-xs text-parchment-400 align-top">/{rawDef}</span> : null}
                </div>
              </div>
            ) : null;
          })()}
          <div title="Energy — spent to play cards. Refills to the cap every turn. Some equipment / rings add to the cap.">
            <div className="text-xs uppercase text-parchment-300">Energy <span className="text-parchment-500">ⓘ</span></div>
            <div className="text-2xl font-mono text-gold-300">⚡ {energy} / {energyMax}</div>
          </div>
          <div title={`Deck pile (${deck.length}) → Discard pile (${discard.length}). When the deck empties, the discard reshuffles back in.`}>
            <div className="text-xs uppercase text-parchment-300">Deck</div>
            <div className="text-base font-mono text-parchment-200">{deck.length} ▸ {discard.length}</div>
          </div>
          {/* PLAYER STATUS — Weak / Vulnerable / Strengthened / etc. Only
              shows pills for active (non-1.0) modifiers. Same numbers as
              the enemy-side display, but labeled from the player's POV so
              "what am I afflicted with" is unambiguous. */}
          {(playerDmgMult !== 1.0 || enemyDmgMult !== 1.0) && (
            <div className="flex flex-col gap-1">
              <div className="text-xs uppercase text-parchment-300">Status</div>
              <div className="flex gap-1 flex-wrap">
                {playerDmgMult < 1.0 && (
                  <span className="px-2 py-1 rounded text-xs bg-ember-800 text-parchment-50 border border-ember-600"
                        title={`Weak — your spell potency is at ×${playerDmgMult.toFixed(2)} (${Math.round((playerDmgMult-1)*100)}%). Drifts back toward 1.00 by 0.25/turn.`}>
                    ⛧ Weak ×{playerDmgMult.toFixed(2)}
                  </span>
                )}
                {playerDmgMult > 1.0 && (
                  <span className="px-2 py-1 rounded text-xs bg-moss-800 text-parchment-50 border border-moss-600"
                        title={`Strengthened — your spell potency is at ×${playerDmgMult.toFixed(2)} (+${Math.round((playerDmgMult-1)*100)}%). Drifts back toward 1.00 by 0.25/turn.`}>
                    💫 Strong ×{playerDmgMult.toFixed(2)}
                  </span>
                )}
                {enemyDmgMult > 1.0 && (
                  <span className="px-2 py-1 rounded text-xs bg-ember-800 text-parchment-50 border border-ember-600"
                        title={`Vulnerable — incoming damage is at ×${enemyDmgMult.toFixed(2)} (+${Math.round((enemyDmgMult-1)*100)}%). Drifts back toward 1.00 by 0.25/turn.`}>
                    🩸 Vuln ×{enemyDmgMult.toFixed(2)}
                  </span>
                )}
                {enemyDmgMult < 1.0 && (
                  <span className="px-2 py-1 rounded text-xs bg-moss-800 text-parchment-50 border border-moss-600"
                        title={`Sapped — enemy attack damage is at ×${enemyDmgMult.toFixed(2)} (${Math.round((enemyDmgMult-1)*100)}%). Drifts back toward 1.00 by 0.25/turn.`}>
                    🛡 Sapped ×{enemyDmgMult.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}
          {familiar && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-ink-600 border border-ink-400 text-sm"
                  title={familiar.desc}>
              <span className="text-lg leading-none">{familiar.emoji}</span>
              <span className="text-gold-300">{familiarName || familiar.species}</span>
            </span>
          )}
          {equipment.length > 0 && (
            <div className="text-xs flex gap-2 flex-wrap ml-2">
              {equipment.map(eq => (
                <span key={eq.id} className="text-gold-300" title={eq.desc}>⚜ {eq.name}</span>
              ))}
            </div>
          )}
        </div>
        <button onClick={onEndTurn} className="btn btn-ember text-base px-5 py-2">End Turn</button>
      </div>

      {/* Relic chip row — persistent across the run, shown all combats. */}
      {relics.length > 0 && (
        <div className="parchment-card p-2 flex gap-2 flex-wrap items-center">
          <span className="text-[10px] uppercase tracking-widest text-gold-300 mr-1">📿 Relics</span>
          {relics.map(r => (
            <span key={r.id}
              title={`${r.desc}${r.flavor ? '\n\n' + r.flavor : ''}`}
              className="px-2 py-1 bg-gold-700 text-parchment-50 rounded border border-gold-500 text-xs cursor-help">
              {r.name}
            </span>
          ))}
        </div>
      )}

      {/* Active Powers row — visible only while at least one power is on
          the field. Hover shows the trigger + flavor. */}
      {powers.length > 0 && (
        <div className="parchment-card p-2 flex gap-2 flex-wrap items-center">
          <span className="text-[10px] uppercase tracking-widest text-iris-300 mr-1">📿 Powers in effect</span>
          {powers.map((p, i) => (
            <span key={p.uid || i}
              title={`${p.desc}${p.flavor ? '\n\n' + p.flavor : ''}`}
              className="px-2 py-1 bg-iris-800 text-parchment-50 rounded border border-iris-600 text-xs cursor-help">
              {p.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-nowrap min-h-[260px] items-stretch justify-center overflow-x-auto">
        {hand.map((card, i) => {
          // Amplify gets +1 cost per prior play this combat. UI shows the
          // current (escalated) cost so the player doesn't get surprised.
          const effCost = card.id === 'c-amplify'
            ? (card.cost || 0) + (amplifyPlaysThisCombat || 0)
            : (card.cost || 0);
          const playable = effCost <= energy;
          const escalated = card.id === 'c-amplify' && amplifyPlaysThisCombat > 0;
          // Card frame tint. v2 cards: intro/subject = iris, target =
          // ember, modifier = gold. v1 fallback by card.type for utilities.
          const tint = card.slot === 'intro' || card.slot === 'subject' ? 'border-iris-500'
                     : card.slot === 'target' ? 'border-ember-500'
                     : card.slot === 'modifier' ? 'border-gold-500'
                     : card.type === 'word'   ? 'border-iris-500'
                     : card.type === 'effect' ? 'border-ember-500'
                     : card.type === 'power'  ? 'border-gold-500'
                     :                          'border-moss-500';
          // Display label: prefer slot (intro/subject/target/modifier) for v2,
          // fall back to type for v1 utilities (skill/power).
          const displayLabel = card.slot
            ? card.slot
            : card.type;
          // Display name: v2 uses `phrase` as the card text; v1 uses `name`.
          const displayName = card.name || card.phrase || '';
          // Card body text: v2 uses `flavor` as descriptive italics; v1 has `desc`.
          const displayDesc = card.desc || (card.flavor ? `"${card.flavor}"` : '');
          const dmgType = card.type === 'effect' ? card.effect?.damageType : null;
          const dmgLabel = dmgType === 'physical' ? 'Physical dmg'
                         : dmgType === 'composure' ? 'Composure dmg'
                         : null;
          const dmgChip = dmgType === 'physical' ? 'text-ember-700 bg-ember-100'
                        :                          'text-iris-700 bg-iris-100';
          // Tags: shown on every v2 card (intro/subject/target/modifier all carry tags).
          // Legacy v1 cards: words show their tags; legacy effect cards show resonance.
          const tagOrResonance =
            card.tags && card.tags.length > 0
              ? <div className="text-[11px] text-ink-500 italic" title="Tags this card contributes to the spell. Cards that share tags can unlock modifier bonuses.">
                  ✦ {card.tags.join(' · ')}
                </div>
              : card.type === 'effect' && card.effect?.resonatesWith && card.effect.resonatesWith.length > 0
              ? <div className="text-[11px] text-iris-700 italic" title={`+${card.effect.resonanceBonus?.perTag || 0} damage per matching theme in your spell tray.`}>
                  ✦ {card.effect.resonatesWith.join(', ')} <span className="text-ink-500">(+{card.effect.resonanceBonus?.perTag || 0})</span>
                </div>
              : null;
          return (
            <motion.button key={card.uid}
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={() => onPlayCard(i)} disabled={!playable}
              className={`w-[180px] h-72 shrink-0 rounded-lg border-2 p-2.5 text-left flex flex-col gap-1.5 shadow-lg transition-all ${
                playable
                  ? `bg-parchment-50 text-ink-800 ${tint} hover:scale-105 hover:shadow-2xl cursor-pointer`
                  : 'bg-ink-600 text-parchment-400 border-ink-500 opacity-50 cursor-not-allowed'
              }`}>
              <div className="flex justify-between items-start gap-1">
                <div className="font-display text-[15px] leading-tight">{displayName}</div>
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold ${playable ? (escalated ? 'bg-ember-500 text-parchment-50' : 'bg-gold-500 text-ink-800') : 'bg-ink-500 text-parchment-300'}`}
                  title={escalated ? `Amplify costs +${amplifyPlaysThisCombat} this combat (base ${card.cost}).` : undefined}>
                  {effCost}
                </div>
              </div>
              <div className={`text-[10px] uppercase tracking-wider font-bold ${card.slot === 'target' ? 'text-ember-700' : card.slot === 'modifier' ? 'text-gold-700' : card.slot ? 'text-iris-700' : 'text-ink-400'}`}>
                {displayLabel}{card.tier ? ` · T${card.tier}` : ''}
              </div>
              {/* Word / intro / subject / modifier stats */}
              {card.stats && (card.stats.chutzpah || card.stats.wit || card.stats.jnsq) && (
                <div className="flex gap-1 flex-wrap text-xs font-mono">
                  {card.stats.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
                  {card.stats.wit      ? <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">✨ {card.stats.wit}</span> : null}
                  {card.stats.jnsq     ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
                </div>
              )}
              {/* Target (effect) damage formula + damage-type chip */}
              {(card.slot === 'target' || card.type === 'effect') && card.effect && (
                <>
                  <div className="text-sm font-mono text-ink-700">
                    {card.effect.base} + {(card.effect.scaleBy || card.lane || 'wit').toUpperCase()}×{card.effect.multiplier}
                  </div>
                  {dmgLabel && (
                    <div className={`text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 self-start ${dmgChip}`}>
                      {dmgLabel}
                    </div>
                  )}
                  {card.effect.rider && (
                    <div className="text-[11px] text-ember-700 italic">
                      {Object.entries(card.effect.rider).map(([k, v]) => `+${v} ${k}`).join(' · ')}
                    </div>
                  )}
                  {card.effect.tier3Double && (
                    <div className="text-[10px] text-ember-700 font-bold italic">Doubles at Tier 3</div>
                  )}
                  {card.effect.requiresTier3 && (
                    <div className="text-[10px] text-ember-700 font-bold italic">Requires Tier 3 (else half dmg + exile)</div>
                  )}
                </>
              )}
              {/* Modifier kind + effect summary */}
              {card.slot === 'modifier' && card.modifierEffect && (
                <div className="text-[11px] text-gold-700 italic leading-tight">
                  ({card.modifierKind})
                  {card.modifierEffect.damageMult ? ` · ×${card.modifierEffect.damageMult} dmg` : ''}
                  {card.modifierEffect.conditionalMult?.tier2Plus ? ` · ×${card.modifierEffect.conditionalMult.tier2Plus} if T2+` : ''}
                  {card.modifierEffect.tier3Payoff ? ` · T3 payoff` : ''}
                  {card.modifierEffect.rider ? ' · ' + Object.entries(card.modifierEffect.rider).map(([k, v]) => `+${v} ${k}`).join(' ') : ''}
                  {card.modifierEffect.drawAfterCast ? ` · +${card.modifierEffect.drawAfterCast} draw` : ''}
                  {card.modifierEffect.stripEnemyBlock ? ` · strip ${card.modifierEffect.stripEnemyBlock} block` : ''}
                </div>
              )}
              <div className="text-sm flex-1 font-quill leading-snug italic">{displayDesc}</div>
              {(card.effects?.exhaust || card.effect?.exhaust) && <div className="text-[10px] italic text-ember-700">Exhaust</div>}
              {/* Resonance / tag row — separated visually so it reads as
                  meta-info, not as part of the card's main effect. */}
              {tagOrResonance && (
                <div className="mt-auto pt-1.5 border-t border-ink-300">
                  {tagOrResonance}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="parchment-card p-3 max-h-40 overflow-y-auto text-sm font-quill text-parchment-200 space-y-0.5">
        {log.slice(-10).map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

function V2SpellTray({ tray, onUnstage, onCast }) {
  const intro = tray.intro;
  const subject = tray.subject;
  const target = tray.target || tray.effectCard;
  const modifiers = tray.modifiers || [];
  const anyStaged = intro || subject || target || modifiers.length > 0;

  // Compose sentence + damage preview when all 3 primary slots filled.
  const ready = !!(intro && subject && target);
  const tier = ready ? computeSpellTier(intro, subject, target) : 0;
  const tierMult = TIER_MULTIPLIER[tier] || 1.0;
  const tierLabel = tier === 3 ? 'DEVASTATING' : tier === 2 ? 'RESONANT' : tier === 1 ? 'COHERENT' : '';
  let sentence = '';
  let predicted = null;
  if (ready) {
    sentence = composeSpellText(intro, subject, target, modifiers);
    const { damage, riders } = computeSpellDamage(intro, subject, target, modifiers);
    predicted = { damage, riders };
  }

  const tagCounts = {};
  for (const c of [intro, subject, target, ...modifiers]) {
    if (!c) continue;
    for (const t of c.tags || []) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }

  const slotPill = (card, slotName, color) => {
    if (!card) {
      return (
        <div className={`px-3 py-2 rounded border border-dashed ${color.empty} text-xs italic text-center opacity-60 min-w-[110px]`}>
          {slotName}
        </div>
      );
    }
    return (
      <motion.button key={card.uid}
        layout
        initial={{ scale: 0.5, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        onClick={() => onUnstage(card.uid)}
        title={`${card.phrase || card.name} — click to unstage`}
        className={`px-3 py-2 rounded ${color.filled} text-parchment-50 text-xs flex flex-col items-center gap-0.5 min-w-[110px] max-w-[200px]`}>
        <span className="font-mono text-[10px] opacity-70">{slotName}</span>
        <span className="font-bold text-center">{card.phrase || card.name}</span>
      </motion.button>
    );
  };

  return (
    <div className={`parchment-card p-3 border-l-4 ${anyStaged ? 'border-l-iris-400' : 'border-l-ink-500'}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs uppercase tracking-widest text-iris-300 font-bold">📜 Spell Tray</div>
        {tier > 0 && (
          <div className={`text-sm font-bold font-mono ${tier === 3 ? 'text-ember-300' : tier === 2 ? 'text-iris-200' : 'text-parchment-300'}`}>
            {tierLabel} ×{tierMult.toFixed(1)}
          </div>
        )}
      </div>

      {/* Sentence preview */}
      <div className="text-sm font-quill italic text-parchment-100 min-h-[1.5rem] mb-2 leading-relaxed">
        {ready
          ? <span>"{sentence}"</span>
          : !anyStaged
            ? <span className="text-parchment-400">(empty — stage intro + subject + target to cast)</span>
            : <span>
                {intro && <span>{intro.phrase} </span>}
                {subject && <span>{subject.phrase} </span>}
                {!target && <span className="text-parchment-400 not-italic">… (need a target to cast)</span>}
              </span>
        }
      </div>

      {/* Tag chip row */}
      {Object.keys(tagCounts).length > 0 && (
        <div className="mb-2 flex gap-1 flex-wrap text-xs font-mono">
          <span className="text-iris-300">✦</span>
          {Object.entries(tagCounts).map(([tag, n]) => (
            <span key={tag} className="px-2 py-0.5 rounded bg-iris-800 text-parchment-100">
              {tag}{n > 1 ? ` ×${n}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Slot row */}
      <div className="flex flex-wrap items-stretch gap-2">
        {slotPill(intro, 'intro', { empty: 'border-iris-600 text-iris-400', filled: 'bg-iris-700 hover:bg-iris-600 border border-iris-400' })}
        {slotPill(subject, 'subject', { empty: 'border-iris-600 text-iris-400', filled: 'bg-iris-700 hover:bg-iris-600 border border-iris-400' })}
        {slotPill(target, 'target', { empty: 'border-ember-600 text-ember-500', filled: 'bg-ember-700 hover:bg-ember-600 border border-ember-400' })}
        {modifiers.map(m => slotPill(m, 'modifier', { empty: '', filled: 'bg-gold-700 hover:bg-gold-600 border border-gold-400' }))}
        {modifiers.length < 2 && slotPill(null, modifiers.length === 0 ? 'modifier (optional)' : 'modifier 2 (optional)', { empty: 'border-gold-600 text-gold-500', filled: '' })}
        <div className="flex-1" />
        {ready && predicted && (
          <div className="text-right">
            <div className="text-[10px] uppercase text-parchment-300">Predicted</div>
            <div className="text-2xl font-bold font-mono text-iris-200"
                 title={`Tier ${tier} × ${tierMult.toFixed(1)} multiplier`}>
              {predicted.damage} <span className="text-sm text-parchment-300">comp</span>
            </div>
          </div>
        )}
        <button onClick={onCast}
          disabled={!ready}
          className={`btn text-base px-6 py-2 ml-2 ${ready ? 'btn-iris animate-pulse' : 'bg-ink-600 text-parchment-400 cursor-not-allowed'}`}>
          ✨ CAST
        </button>
      </div>
    </div>
  );
}


// Starting Picks — shown after familiar selection. Player taps two cards
// from a fixed pool to seed their deck with archetype commitment. This
// is a PLACEHOLDER for the planned character-selection opening sequence;
// when that lands, the pool will be derived from the chosen character.
function StartingPicksScreen({ pool, selected, onToggle, onConfirm }) {
  const cards = pool.map(id => CARDS_BY_ID[id]).filter(Boolean);
  const archetypeOf = (card) => {
    if (card.type === 'word') {
      if (card.stats?.chutzpah) return 'Chutzpah';
      if (card.stats?.wit)      return 'Wit';
      if (card.stats?.jnsq)     return 'Jnsq';
    }
    if (card.type === 'effect') {
      const s = card.effect?.scaleBy;
      if (s === 'chutzpah') return 'Chutzpah';
      if (s === 'wit')      return 'Wit';
      if (s === 'jnsq')     return 'Jnsq';
    }
    return '';
  };
  const archColor = (a) => a === 'Chutzpah' ? 'text-ember-600 border-ember-400'
                       : a === 'Wit'      ? 'text-iris-700 border-iris-400'
                       : a === 'Jnsq'     ? 'text-moss-700 border-moss-400'
                       : 'text-ink-500 border-ink-300';
  const ready = selected.length === 2;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-5xl mx-auto">
      <h2 className="font-display text-3xl text-gold-300">Find Your Voice</h2>
      <p className="text-sm text-parchment-300 italic max-w-2xl text-center">
        Your starter deck covers the basics in <span className="text-ember-300">Chutzpah</span> and <span className="text-iris-200">Wit</span>.
        Pick <b>2</b> more cards to seed your style — double down on a stat you know, or open <span className="text-moss-200">Jnsq</span> as a third lane.
      </p>
      <p className="text-xs text-parchment-400">
        Selected: <span className={ready ? 'text-moss-300' : 'text-gold-300'}>{selected.length} / 2</span>
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        {cards.map((card) => {
          const arch = archetypeOf(card);
          const isSelected = selected.includes(card.id);
          const disabled = !isSelected && selected.length >= 2;
          return (
            <button key={card.id} onClick={() => onToggle(card.id)} disabled={disabled}
              className={`w-48 min-h-[240px] rounded-lg border-2 p-3 text-left flex flex-col gap-2 shadow-lg transition bg-parchment-50 text-ink-800 ${archColor(arch)} ${
                isSelected ? 'scale-105 ring-4 ring-gold-400 shadow-2xl' :
                disabled   ? 'opacity-40 cursor-not-allowed' :
                'hover:scale-105 hover:shadow-2xl'
              }`}>
              <div className="flex justify-between items-center">
                <div className="font-display text-base leading-tight">{card.name || card.phrase || ''}</div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">{card.cost}</div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-bold">
                {(card.slot || card.type)}{card.tier ? ` · T${card.tier}` : ''}{arch && <> · <span className={archColor(arch).split(' ')[0]}>{arch}</span></>}
              </div>
              {card.tags && card.tags.length > 0 && (
                <div className="text-[11px] italic text-ink-500">✦ {card.tags.join(' · ')}</div>
              )}
              <div className="text-xs font-quill">{card.desc || ''}</div>
              {card.flavor && (
                <div className="text-[11px] italic text-ink-500 mt-auto pt-1 border-t border-ink-300">"{card.flavor}"</div>
              )}
            </button>
          );
        })}
      </div>
      <button onClick={onConfirm} disabled={!ready}
        className={`btn text-base px-8 py-3 ${ready ? 'btn-iris animate-pulse' : 'bg-ink-600 text-parchment-400 cursor-not-allowed'}`}>
        Begin Act 1
      </button>
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
            className="w-48 min-h-[260px] rounded-lg border-2 p-3 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl transition">
            <div className="flex justify-between items-center">
              <div className="font-display text-base leading-tight">{card.name || card.phrase || ''}</div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">{card.cost}</div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400 font-bold">
              {(card.slot || card.type)} · {card.rarity}{card.tier ? ` · T${card.tier}` : ''}
            </div>
            {card.stats && (card.stats.chutzpah || card.stats.wit || card.stats.jnsq) && (
              <div className="flex gap-1 flex-wrap text-xs font-mono">
                {card.stats.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
                {card.stats.wit      ? <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">✨ {card.stats.wit}</span> : null}
                {card.stats.jnsq     ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
              </div>
            )}
            {(card.slot === 'target' || card.type === 'effect') && card.effect && (
              <div className="text-xs font-mono text-ink-700">
                {card.effect.base} + {(card.effect.scaleBy || card.lane || 'wit').toUpperCase()}×{card.effect.multiplier}
                {card.effect.rider && (
                  <span className="ml-1 text-ember-700">
                    ({Object.entries(card.effect.rider).map(([k, v]) => `+${v} ${k}`).join(' · ')})
                  </span>
                )}
              </div>
            )}
            {card.tags && card.tags.length > 0 && (
              <div className="text-[11px] italic text-ink-500">✦ {card.tags.join(' · ')}</div>
            )}
            <div className="text-xs font-quill">{card.desc || ''}</div>
            {card.flavor && (
              <div className="text-[11px] italic text-ink-500 mt-auto pt-1 border-t border-ink-300">"{card.flavor}"</div>
            )}
          </button>
        ))}
      </div>
      <button onClick={() => onPick(null)} className="btn btn-ink mt-4">Skip</button>
    </div>
  );
}

// Played when an event / shop / familiar hands the player one or more
// cards. Shows them face-up with a single "Got it" button. Prompt shape:
// { cards: [card objects], title: string }
function CardGrantScreen({ prompt, onDismiss }) {
  if (!prompt) return null;
  const { cards, title } = prompt;
  const tint = (card) =>
    card.type === 'word'   ? 'border-iris-500' :
    card.type === 'effect' ? 'border-ember-500' :
    card.type === 'power'  ? 'border-gold-500' :
                             'border-moss-500';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-4xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300 text-center">📜 You gained {cards.length === 1 ? 'a card' : `${cards.length} cards`}</h2>
      <div className="text-sm text-parchment-300 italic">{title}</div>
      <div className="flex gap-4 flex-wrap justify-center">
        {cards.map((card, i) => (
          <div key={i}
            className={`w-52 min-h-[280px] rounded-lg border-2 p-3 text-left flex flex-col gap-2 shadow-xl bg-parchment-50 text-ink-800 ${tint(card)}`}>
            <div className="flex justify-between items-start gap-1">
              <div className="font-display text-base leading-tight">{card.name}</div>
              <div className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">{card.cost}</div>
            </div>
            <div className="text-xs uppercase tracking-wider text-ink-400">{card.type} · {card.rarity}</div>
            {card.type === 'word' && card.stats && (
              <div className="flex gap-1 flex-wrap text-xs font-mono">
                {card.stats.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
                {card.stats.wit      ? <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">✨ {card.stats.wit}</span> : null}
                {card.stats.jnsq     ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
              </div>
            )}
            {card.type === 'word' && card.tags && card.tags.length > 0 && (
              <div className="text-xs text-ink-500 italic">✦ {card.tags.join(' · ')}</div>
            )}
            {card.type === 'effect' && card.effect && (
              <>
                <div className="text-xs font-mono text-ink-700">
                  {card.effect.base} + {card.effect.scaleBy?.toUpperCase()}×{card.effect.multiplier}{' '}
                  <span className={card.effect.damageType === 'physical' ? 'text-ember-700' : 'text-iris-700'}>
                    {card.effect.damageType === 'physical' ? 'phys' : 'comp'}
                  </span>
                </div>
                {card.effect.resonatesWith && card.effect.resonatesWith.length > 0 && (
                  <div className="text-xs text-iris-700 italic">✦ resonates: {card.effect.resonatesWith.join(', ')}</div>
                )}
              </>
            )}
            <div className="text-sm font-quill leading-snug">{card.desc}</div>
            {card.flavor && (
              <div className="text-xs italic text-ink-500 mt-auto pt-1 border-t border-ink-300">"{card.flavor}"</div>
            )}
          </div>
        ))}
      </div>
      <button onClick={onDismiss} className="btn btn-gold text-lg px-8 py-3">Got it</button>
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

// Friendly label + tooltip for a raw material-stat key. Material
// data uses internal keys (`defense`, `regen`, `chutzpah`, etc.);
// the UI shows what the player will actually get when crafted.
function materialStatChip(key, value) {
  const labels = {
    chutzpah: { label: 'Chutzpah', tip: `On a Staff: scales the spell's base and multiplier (more raw damage).` },
    loseHp:   { label: 'Risk',     tip: `On a Staff: cast costs ${value} HP (Chutzpah glass-cannon archetype).` },
    defense:  { label: 'Defense',  tip: `Permanent damage reduction (-${value} per incoming hit, engine caps total at 2, min 1 damage taken). On a Staff: also adds rider Block on cast.` },
    regen:    { label: 'Regen',    tip: `On Robes: heals ${value * 2} HP at the start of every combat.` },
    draw:     { label: 'Draw',     tip: `On Robes/Ring: +${value} card drawn on turn 1. On a Hat: +${value} card every turn.` },
    energy:   { label: 'Energy',   tip: `On a Ring: +${value} permanent Energy per turn. On a Hat: +${value} Energy every turn.` },
    block:    { label: 'Block',    tip: `On a Hat: +${value} Block at the start of every turn.` },
    dot:      { label: 'Weak rider', tip: `On a Staff: cast applies ${value} Weak to the enemy (control archetype).` },
    chance:   { label: 'Chance',   tip: `On a Staff: cast has a 50% chance to apply 2 Vuln; 50% chance you gain 1 Weak (Jnsq gamble).` },
    vuln:     { label: 'Vulnerable', tip: `On Robes: applies ${value} Vulnerable to the enemy at combat start. On a Hat: applies it every turn.` },
    weak:     { label: 'Weak',     tip: `On a Ring: applies ${value} Weak to the enemy at combat start.` },
    jnsq:     { label: 'Jnsq',     tip: `On a Staff: adds the 'absurd' resonance tag.` },
    wit:      { label: 'Wit',      tip: `Material flavor stat. (Currently unused in equipment outputs.)` },
  };
  return labels[key] || { label: key, tip: `${key} +${value}` };
}

// Material chooser — shown when the player visits a Material node.
// Three random variants of the current act's slot pool. The player
// picks one; the material lands in their inventory and is consumed
// at the act's crafting screen (Commit 3).
const SLOT_HEADLINE = {
  staff: 'A clearing of timber',
  robes: 'A rack of threads',
  ring:  'A cache of ore',
  hat:   'A press of felts',
};
const SLOT_EMOJI = { staff: '🪵', robes: '🧵', ring: '⚒', hat: '🎩' };

function MaterialChooseScreen({ prompt, onPick, onSkip }) {
  if (!prompt) return null;
  const { slot, choices } = prompt;
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-5 max-w-4xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300 text-center">
        {SLOT_EMOJI[slot]} {SLOT_HEADLINE[slot] || 'A gather'}
      </h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">
        Three things you might take from here. The act's crafting screen will use whatever you've gathered when the boss falls — bring back what feels right.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        {choices.map((m) => (
          <button key={m.id} onClick={() => onPick(m.id)}
            className="w-56 min-h-[14rem] rounded-lg border-2 border-gold-500 bg-parchment-50 text-ink-800 p-3 text-left hover:scale-105 hover:shadow-2xl transition flex flex-col gap-2">
            <div className="font-display text-lg">{m.name}</div>
            <div className="text-xs uppercase tracking-wider text-ink-400">{SLOT_LABEL[m.slot] || m.slot} material</div>
            <div className="flex flex-wrap gap-1 text-xs font-mono">
              {Object.entries(m.stats || {}).map(([k, v]) => {
                const c = materialStatChip(k, v);
                return (
                  <span key={k} className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800" title={c.tip}>
                    {c.label} +{v}
                  </span>
                );
              })}
            </div>
            <div className="text-sm font-quill italic text-ink-500 mt-auto pt-2 border-t border-ink-300">"{m.flavor}"</div>
          </button>
        ))}
      </div>
      <button onClick={onSkip} className="btn btn-ink mt-2">Take none. Push on.</button>
    </div>
  );
}

// Skill event — same shape as a regular event but lives on its own
// stage so the skill bumps are visually distinct from the generic
// event pool. Shows the player's current skill levels at the top for
// context.
function SkillEventScreen({ event, skills, onChoose }) {
  if (!event) return null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-2xl mx-auto">
      <h2 className="font-display text-3xl text-moss-300">🛠 {event.title}</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">"{event.flavor}"</p>
      <div className="text-xs text-parchment-300 flex gap-3 flex-wrap justify-center">
        {Object.entries(skills || {}).map(([sk, lvl]) => (
          <span key={sk} className={lvl > 0 ? 'text-moss-300' : 'text-parchment-400'}>
            {sk}: {lvl}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {event.choices.map((c, i) => (
          <button key={i} onClick={() => onChoose(c)}
            className="btn bg-ink-600 hover:bg-ink-500 text-parchment-100 text-left">{c.label}</button>
        ))}
      </div>
    </div>
  );
}

// SIDEQUEST OFFER — appears on Town arrival when a sidequest seeds.
// Shows the template intro + an Accept / Decline pair.
function SidequestOfferScreen({ template, onAccept, onDecline }) {
  if (!template) return null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-moss-300">A diversion offers itself</div>
      <h2 className="font-display text-3xl text-gold-300">🌿 {template.title}</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">{template.intro}</p>
      <p className="text-[11px] text-parchment-400 italic max-w-xl text-center">
        {template.nodes.length} node{template.nodes.length === 1 ? '' : 's'} · {template.bossShortcut ? 'leads directly to the act boss' : 'returns you to the map'}
      </p>
      <div className="flex gap-3">
        <button className="btn btn-iris" onClick={onAccept}>Get involved</button>
        <button className="btn btn-ink" onClick={onDecline}>Keep walking</button>
      </div>
    </div>
  );
}

// SIDEQUEST NODE — renders the current node in an active sidequest.
// Choice nodes show options; narrative nodes show one Continue button.
// `canAbandon: true` on the node adds an Abandon button that ends the
// quest and returns to the map.
function SidequestNodeScreen({ template, node, nodeIdx, onChoose, onNarrativeContinue, onAbandon }) {
  const progress = `Node ${nodeIdx + 1} of ${template.nodes.length}`;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-moss-300">🌿 {template.title} · {progress}</div>
      {node.title && <h2 className="font-display text-2xl text-gold-300">{node.title}</h2>}
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">{node.flavor}</p>
      {node.kind === 'choice' && (
        <div className="flex flex-col gap-2 w-full max-w-md">
          {node.choices.map((c, i) => (
            <button key={i} onClick={() => onChoose(c)}
              className="btn bg-ink-600 hover:bg-ink-500 text-parchment-100 text-left">{c.label}</button>
          ))}
        </div>
      )}
      {node.kind === 'narrative' && (
        <button className="btn btn-moss mt-2" onClick={onNarrativeContinue}>Continue</button>
      )}
      {node.canAbandon && (
        <button className="text-xs text-parchment-400 italic hover:text-ember-300 mt-3" onClick={onAbandon}>
          Abandon the diversion (return to the map)
        </button>
      )}
    </div>
  );
}

// POSTCARD MODAL — appears when the mailbox button is clicked. Three
// faces depending on postcardState:
//   active    — input box for the phrase; submit verifies exact match
//   completed — the "My cat forgives you" postcard (heal + max HP reward)
//   failed    — the "You have disgraced my cat" rebuke (clears the fog)
function PostcardModal({ state, phrase, progress, onSubmit, onClose }) {
  const [text, setText] = useState('');
  const isActive = state === 'active';
  const isCompleted = state === 'completed';
  const isFailed = state === 'failed';
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-amber-50 text-ink-800 rounded-lg shadow-2xl p-6 border-4 border-amber-200">
        {isCompleted ? (
          <>
            <div className="text-xs uppercase tracking-widest text-ink-500 text-center">A postcard arrives</div>
            <div className="font-display text-2xl text-center mt-2">My cat forgives you</div>
            <div className="font-quill italic text-center text-ink-600 mt-3">A small drawing of a cat at a window.</div>
            <button onClick={() => onSubmit('')} className="btn btn-iris w-full mt-4">Read it</button>
          </>
        ) : isFailed ? (
          <>
            <div className="text-xs uppercase tracking-widest text-ink-500 text-center">A postcard arrives</div>
            <div className="font-display text-2xl text-center mt-2">You have disgraced my cat.</div>
            <div className="font-display text-base text-center mt-1">We will not speak again.</div>
            <div className="font-quill italic text-center text-ink-600 mt-3">No drawing. Just the words.</div>
            <button onClick={() => onSubmit('')} className="btn btn-ember w-full mt-4">Set it down</button>
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-widest text-ink-500 text-center">A blank postcard</div>
            <div className="font-display text-lg text-center text-ink-700 mt-2">Write the phrase. Exactly.</div>
            <div className="text-xs italic text-center text-ink-500 mt-1">(Sent so far: {progress}/3)</div>
            <input type="text" value={text} onChange={e => setText(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') onSubmit(text); }}
              placeholder="five-word phrase..."
              className="w-full mt-4 px-3 py-2 rounded border-2 border-ink-300 bg-amber-100 text-ink-800 font-mono" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => onSubmit(text)} className="btn btn-iris flex-1">Send</button>
              <button onClick={onClose} className="btn btn-ink">Cancel</button>
            </div>
            <div className="text-[10px] italic text-ink-400 text-center mt-3">Any extra word or punctuation will be noticed.</div>
          </>
        )}
      </div>
    </div>
  );
}

// INSULT PROMPT — three sequential choice screens (noun / verb / adjective),
// each with three pre-classified word options and a 4-second timer. On
// timer expiry, auto-picks the first option (penalty for hesitation).
// The picks land or backfire based on alignment with the enemy's
// insultVulnerabilities — finalizeInsult does the math.
function InsultPromptScreen({ insultPrompt, enemy, onPick }) {
  const TIMER_SECONDS = 4;
  const phaseLabel = ['Noun', 'Verb', 'Adjective'][insultPrompt.phase] || '?';
  const phaseKey   = ['noun', 'verb', 'adjective'][insultPrompt.phase];
  const phasePrompt = [
    'What you call them:',
    'What they do:',
    'How they are:',
  ][insultPrompt.phase] || '';
  const samples = insultPrompt.samples?.[phaseKey] || [];
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);

  // Re-arm the timer on every phase change. The auto-pick side-effect
  // lives in the interval body (with a fired-ref guard) instead of inside
  // a setSecondsLeft updater — pure updaters per the saved-feedback rule
  // ([[feedback_react_pure_updaters]]).
  const firedRef = useRef(false);
  useEffect(() => {
    setSecondsLeft(TIMER_SECONDS);
    firedRef.current = false;
    const interval = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 0.1));
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insultPrompt.phase]);

  // When the timer hits zero, fire the auto-pick exactly once.
  useEffect(() => {
    if (secondsLeft <= 0 && !firedRef.current && samples.length > 0) {
      firedRef.current = true;
      onPick(samples[0]);
    }
  }, [secondsLeft, samples, onPick]);

  const tBar = (secondsLeft / TIMER_SECONDS) * 100;
  const timerColor = secondsLeft > 2 ? 'bg-moss-500' : secondsLeft > 1 ? 'bg-gold-500' : 'bg-ember-500';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-ember-300">💢 Insulting {enemy?.name || 'them'}</div>
      <h2 className="font-display text-2xl text-gold-300">Step {insultPrompt.phase + 1} of 3 — {phaseLabel}</h2>
      <p className="font-quill italic text-parchment-200 text-center">{phasePrompt}</p>
      <div className="w-full max-w-sm h-2 bg-ink-700 rounded-full overflow-hidden">
        <div className={`h-full ${timerColor} transition-all`} style={{ width: `${tBar}%` }} />
      </div>
      <div className="text-[10px] text-parchment-400">{secondsLeft.toFixed(1)}s — auto-picks first option if you stall</div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {samples.map((s, i) => (
          <button key={i} onClick={() => onPick(s)}
            className="btn bg-ink-600 hover:bg-ember-700 text-parchment-100 text-left">
            <span className="font-display text-base">{s.word}</span>
            <span className="ml-2 text-[10px] text-parchment-400 italic">{(s.tags || []).join(' · ')}</span>
          </button>
        ))}
      </div>
      {insultPrompt.picks.length > 0 && (
        <div className="text-xs text-parchment-400 mt-2">
          So far: <span className="text-iris-200">{insultPrompt.picks.map(p => p.word).join(' / ')}</span>
        </div>
      )}
    </div>
  );
}

// TRACE-WHITTLING MINIGAME — slice 1 of skill-event minigames. Player
// drags their cursor along a curved carve-line in an SVG. Tracks distance
// from the line each frame, averages it at completion, maps to Master/
// Fine/Rough. Grade fed back to finalizeSkillMinigame which scales the
// skill bump and applies the labeled max-HP cost.
function TraceWhittlingMinigame({ eventTitle, choiceLabel, onComplete }) {
  const VB_W = 720, VB_H = 220;
  // Curve as a list of {x, y} control points. The drawn path uses smooth
  // SVG curves between these. Discretized to fine samples for distance
  // checks. Two curves to vary across reloads — picks one per mount.
  const curves = useMemo(() => ([
    [
      { x: 50,  y: 110 },
      { x: 180, y: 60  },
      { x: 280, y: 150 },
      { x: 410, y: 80  },
      { x: 540, y: 140 },
      { x: 670, y: 95  },
    ],
    [
      { x: 50,  y: 140 },
      { x: 200, y: 80  },
      { x: 350, y: 130 },
      { x: 500, y: 70  },
      { x: 670, y: 130 },
    ],
  ]), []);
  const controlPoints = useMemo(() => curves[Math.floor(Math.random() * curves.length)], [curves]);

  // Discretize the control polyline into many small samples so the
  // distance test is just "nearest sample" — cheap and good enough.
  const pathSamples = useMemo(() => {
    const samples = [];
    const segs = 80;
    for (let i = 0; i < controlPoints.length - 1; i++) {
      const a = controlPoints[i];
      const b = controlPoints[i + 1];
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        samples.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          idx: samples.length,
        });
      }
    }
    samples.push({ ...controlPoints[controlPoints.length - 1], idx: samples.length });
    return samples;
  }, [controlPoints]);

  const svgRef = useRef(null);
  const stateRef = useRef({
    tracing: false,
    totalError: 0,
    samples: 0,
    progressIdx: 0,
    cursor: null,
  });
  const [tracing, setTracing] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [progress, setProgress] = useState(0); // 0..1
  const [errorBucket, setErrorBucket] = useState('fine'); // current proximity feedback

  function svgPointFrom(e) {
    if (!svgRef.current) return null;
    const r = svgRef.current.getBoundingClientRect();
    const sx = VB_W / r.width;
    const sy = VB_H / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function findNearest(x, y) {
    let best = Infinity, bestIdx = 0;
    for (let i = 0; i < pathSamples.length; i++) {
      const dx = pathSamples[i].x - x;
      const dy = pathSamples[i].y - y;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; bestIdx = i; }
    }
    return { idx: bestIdx, dist: Math.sqrt(best) };
  }

  function onPointerDown(e) {
    const p = svgPointFrom(e);
    if (!p) return;
    const start = pathSamples[0];
    const startDist = Math.sqrt((p.x - start.x) ** 2 + (p.y - start.y) ** 2);
    if (startDist > 60) return; // must start near the line's left endpoint
    stateRef.current = { tracing: true, totalError: 0, samples: 0, progressIdx: 0, cursor: p };
    setTracing(true);
    setCursor(p);
    setProgress(0);
  }

  function onPointerMove(e) {
    if (!stateRef.current.tracing) return;
    const p = svgPointFrom(e);
    if (!p) return;
    const near = findNearest(p.x, p.y);
    // Progress only advances forward (don't reward going backward).
    if (near.idx > stateRef.current.progressIdx) {
      stateRef.current.progressIdx = near.idx;
      setProgress(near.idx / (pathSamples.length - 1));
    }
    stateRef.current.totalError += near.dist;
    stateRef.current.samples += 1;
    stateRef.current.cursor = p;
    setCursor(p);
    setErrorBucket(near.dist < 12 ? 'master' : near.dist < 28 ? 'fine' : 'rough');
  }

  function finish() {
    const s = stateRef.current;
    if (!s.tracing) return;
    s.tracing = false;
    setTracing(false);
    const avg = s.samples > 0 ? s.totalError / s.samples : 999;
    const completion = s.progressIdx / (pathSamples.length - 1);
    // Grading: must finish at least 75% to qualify above Rough.
    let grade;
    if (completion < 0.5)            grade = 'rough';
    else if (completion >= 0.85 && avg < 14) grade = 'master';
    else if (completion >= 0.70 && avg < 26) grade = 'fine';
    else                              grade = 'rough';
    // Tiny delay so the last cursor frame paints before the screen jumps.
    setTimeout(() => onComplete(grade), 250);
  }

  function onPointerUp() { finish(); }
  function onPointerLeave() { if (stateRef.current.tracing) finish(); }

  const pathD = (() => {
    const [first, ...rest] = controlPoints;
    return `M ${first.x} ${first.y} ` + rest.map(p => `L ${p.x} ${p.y}`).join(' ');
  })();

  const proximityColor = errorBucket === 'master' ? '#7a9b3a'
                       : errorBucket === 'fine'   ? '#c79d44'
                       :                            '#a44a3f';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4 max-w-4xl mx-auto">
      <h2 className="font-display text-2xl text-moss-300">🛠 {eventTitle}</h2>
      <p className="text-sm text-parchment-300 italic max-w-xl text-center">{choiceLabel}</p>
      <p className="text-xs text-parchment-400 max-w-xl text-center">
        Press and hold from the left end. Drag your cursor along the dotted line all the way to the right.
        Stay close — the closer you stay, the better the cut.
      </p>
      <div className="parchment-card-strong p-3 select-none">
        <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`}
             className="w-full max-w-3xl block cursor-crosshair touch-none"
             onPointerDown={onPointerDown}
             onPointerMove={onPointerMove}
             onPointerUp={onPointerUp}
             onPointerLeave={onPointerLeave}>
          {/* Wood-grain background hint */}
          <rect x={0} y={0} width={VB_W} height={VB_H} fill="#3a2d1c" />
          {/* Safe band — the player should stay within this. */}
          <path d={pathD} fill="none" stroke="#6b563a" strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />
          {/* The actual carve line — dotted, the target. */}
          <path d={pathD} fill="none" stroke="#dbb45f" strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Start marker */}
          <circle cx={pathSamples[0].x} cy={pathSamples[0].y} r={10} fill="#5d7e3f" stroke="#dbb45f" strokeWidth={2} />
          <text x={pathSamples[0].x} y={pathSamples[0].y + 28} fontSize={11} fill="#dbb45f" textAnchor="middle">START</text>
          {/* End marker */}
          <circle cx={pathSamples[pathSamples.length-1].x} cy={pathSamples[pathSamples.length-1].y} r={8} fill="#a44a3f" stroke="#dbb45f" strokeWidth={2} />
          <text x={pathSamples[pathSamples.length-1].x} y={pathSamples[pathSamples.length-1].y - 16} fontSize={11} fill="#dbb45f" textAnchor="middle">END</text>
          {/* Cursor halo while tracing */}
          {tracing && cursor && (
            <circle cx={cursor.x} cy={cursor.y} r={10} fill={proximityColor} fillOpacity={0.8} stroke={proximityColor} strokeWidth={2} />
          )}
        </svg>
      </div>
      <div className="flex gap-4 items-center">
        <div className="text-xs text-parchment-300">Progress: <span className="font-mono text-gold-300">{Math.round(progress * 100)}%</span></div>
        <div className="text-xs text-parchment-300">Cut quality: <span className="font-mono" style={{ color: proximityColor }}>{errorBucket.toUpperCase()}</span></div>
        {!tracing && progress === 0 && (
          <div className="text-xs text-parchment-400 italic">Click the green dot to start.</div>
        )}
        {!tracing && progress > 0 && (
          <button className="btn btn-iris text-sm" onClick={finish}>Finish the cut</button>
        )}
      </div>
    </div>
  );
}

// CRAFTING SCREEN — three phases (choose material → gauge → result).
// `prompt` shape:
//   { slot, skillName, materials, skill, phase, chosenMaterial,
//     quality, result, salvaged }
function CraftingScreen({ prompt, onPickMaterial, onResolveGauge, onConfirm }) {
  if (!prompt) return null;
  const { slot, skillName, materials, skill, phase, chosenMaterial, quality, result, salvaged } = prompt;
  const slotLabel = SLOT_LABEL[slot] || slot;
  const craftLabel = CRAFT_LABEL[skillName] || skillName;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-4 max-w-5xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300 text-center">
        {SLOT_EMOJI[slot]} The {slotLabel} Workshop
      </h2>
      <div className="text-base text-parchment-300 italic text-center max-w-xl">
        {salvaged
          ? `You arrive with nothing in hand. The boss had this, ${slotLabel === 'Robes' ? 'wrapped around a regret' : 'shoved into a corner'}. It will have to do.`
          : `Your gather, on the bench. Your ${craftLabel} skill, in your hands. Make the thing.`}
      </div>
      <div className="text-sm text-moss-300">
        {craftLabel} skill: <b>{skill}</b> / {SKILL_MAX}
        {skill === 0 && <span className="text-parchment-400 italic"> — untrained. The gauge will be narrow.</span>}
      </div>

      {phase === 'choose' && (
        <CraftingChooseMaterial materials={materials} onPick={onPickMaterial} />
      )}

      {phase === 'gauge' && chosenMaterial && (
        <CraftingGauge skill={skill} material={chosenMaterial} salvaged={salvaged} onLock={onResolveGauge} />
      )}

      {phase === 'result' && result && (
        <CraftingResult quality={quality} material={chosenMaterial} result={result} onConfirm={onConfirm} />
      )}
    </div>
  );
}

function CraftingChooseMaterial({ materials, onPick }) {
  return (
    <>
      <div className="text-sm text-parchment-300 uppercase tracking-widest">Step 1 — pick the primary material</div>
      <div className="flex gap-4 flex-wrap justify-center">
        {materials.map((m) => (
          <button key={m.id + m.name} onClick={() => onPick(m.id)}
            className="w-56 min-h-[14rem] rounded-lg border-2 border-gold-500 bg-parchment-50 text-ink-800 p-3 text-left hover:scale-105 hover:shadow-2xl transition flex flex-col gap-2">
            <div className="font-display text-lg">{m.name}</div>
            <div className="text-xs uppercase tracking-wider text-ink-400">{SLOT_LABEL[m.slot] || m.slot} material</div>
            <div className="flex flex-wrap gap-1 text-xs font-mono">
              {Object.entries(m.stats || {}).map(([k, v]) => {
                const c = materialStatChip(k, v);
                return (
                  <span key={k} className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800" title={c.tip}>
                    {c.label} +{v}
                  </span>
                );
              })}
            </div>
            <div className="text-sm font-quill italic text-ink-500 mt-auto pt-2 border-t border-ink-300">"{m.flavor}"</div>
          </button>
        ))}
      </div>
    </>
  );
}

function CraftingGauge({ skill, material, salvaged, onLock }) {
  // Cursor oscillates 0..1 with a sine wave. Speed slows slightly as
  // skill rises so high-skill players get more thinking time. Click
  // STOP to lock — the result feeds quality via the parent's resolve.
  const [pos, setPos] = useState(0);
  const [locked, setLocked] = useState(false);
  const rafRef = useRef(null);
  const speed = 1.6 - skill * 0.12; // cycles per second-ish
  useEffect(() => {
    if (locked) return;
    let t0 = performance.now();
    const tick = (t) => {
      const elapsed = (t - t0) / 1000;
      // Triangle wave on [0,1]
      const phase = (elapsed * speed) % 2;
      const p = phase <= 1 ? phase : 2 - phase;
      setPos(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [locked, speed]);

  // Master + fine zone widths mirror the resolver's logic.
  const masterRadius = 0.06 + skill * 0.025;
  const fineRadius   = 0.18 + skill * 0.04;
  // Convert to percent for CSS.
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const lock = () => {
    if (locked) return;
    setLocked(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    // Briefly hold the result, then route up.
    setTimeout(() => onLock(pos), 250);
  };
  return (
    <>
      <div className="text-sm text-parchment-300 uppercase tracking-widest">Step 2 — settle the {material.name.toLowerCase()}</div>
      <div className="text-sm text-parchment-200 italic">
        {salvaged ? 'You will salvage no matter how steady the hand.' : 'Stop the cursor over the green zone. The wider band rewards a Fine result; the narrow centre rewards Master.'}
      </div>
      <div className="relative w-full max-w-2xl h-14 bg-ink-700 rounded-full border-2 border-ink-500 overflow-hidden shadow-inner">
        {/* Fine zone */}
        <div className="absolute top-0 bottom-0 bg-moss-700 opacity-60"
             style={{ left: pct(0.5 - fineRadius), width: pct(fineRadius * 2) }} />
        {/* Master zone */}
        <div className="absolute top-0 bottom-0 bg-gold-500 opacity-80"
             style={{ left: pct(0.5 - masterRadius), width: pct(masterRadius * 2) }} />
        {/* Centre line */}
        <div className="absolute top-0 bottom-0 w-px bg-parchment-100 opacity-40" style={{ left: '50%' }} />
        {/* Cursor */}
        <div className={`absolute top-0 bottom-0 w-1 ${locked ? 'bg-ember-300' : 'bg-parchment-50'} shadow-lg transition-colors`}
             style={{ left: pct(pos), transform: 'translateX(-50%)' }} />
      </div>
      <button onClick={lock} disabled={locked}
        className={`btn text-lg px-10 py-3 ${locked ? 'btn-ink' : 'btn-gold'}`}>
        {locked ? '…' : 'STOP'}
      </button>
    </>
  );
}

function CraftingResult({ quality, material, result, onConfirm }) {
  const qTone =
    quality === 'master' ? 'text-gold-300' :
    quality === 'fine'   ? 'text-moss-300' :
                           'text-ember-300';
  const isCard = result.kind === 'card';
  const item = isCard ? result.card : result.equipment;
  return (
    <>
      <div className={`font-display text-3xl ${qTone}`}>
        {QUALITY_LABEL[quality]}!
      </div>
      <div className="parchment-card-strong p-5 max-w-md w-full">
        <div className="text-xs uppercase tracking-widest text-parchment-300 mb-2">{isCard ? 'New card in your deck' : 'New equipment installed'}</div>
        <div className="font-display text-2xl text-gold-300">{item.name}</div>
        <div className="text-sm text-parchment-200 mt-2">{item.desc}</div>
        {item.flavor && <div className="text-sm font-quill italic text-parchment-400 mt-2 pt-2 border-t border-ink-500">"{item.flavor}"</div>}
        {isCard && item.effect?.resonatesWith?.length > 0 && (
          <div className="text-sm text-iris-300 italic mt-2">
            ✦ resonates: {item.effect.resonatesWith.join(', ')} (+{item.effect.resonanceBonus?.perTag || 0}/match)
          </div>
        )}
      </div>
      <button onClick={onConfirm} className="btn btn-gold text-lg px-8 py-3">Take it and move on</button>
    </>
  );
}

function RestScreen({ onChoose }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-md mx-auto">
      <h2 className="font-display text-3xl text-moss-300">A Rest Site</h2>
      <p className="font-quill italic text-parchment-200 text-center">A small campfire, a flat rock, the unmistakable feeling that someone has Recently Camped Here. The path will still be there in the morning. It's that kind of path.</p>
      <div className="flex flex-col gap-2 w-full">
        <button onClick={() => onChoose('heal')}    className="btn btn-moss">Sleep — restore 30% HP and Composure</button>
        <button onClick={() => onChoose('upgrade')} className="btn btn-gold">Study a card — upgrade one in your deck</button>
      </div>
    </div>
  );
}

function UpgradeCardScreen({ deck, onPick }) {
  // Show only NON-upgraded cards. Any card with no `upgrade` field is also
  // ineligible (already at max).
  const eligible = deck.filter(c => !c.upgraded && c.upgrade);
  const ineligible = deck.filter(c => c.upgraded || !c.upgrade);
  // pendingUid: which card is queued for upgrade-confirmation. null =
  // browsing the list. When set, the confirm-modal renders over the
  // list and the player can commit or back out.
  const [pendingUid, setPendingUid] = useState(null);
  const pendingCard = pendingUid ? eligible.find(c => c.uid === pendingUid) : null;
  const pendingUpgraded = pendingCard ? upgradeCard(pendingCard) : null;
  return (
    <div className="min-h-screen flex flex-col p-6 gap-4 max-w-5xl mx-auto">
      <div className="text-center">
        <h2 className="font-display text-4xl text-gold-300">Study a Card</h2>
        <p className="text-base text-parchment-300 italic mt-1">Pick one to commit to memory. Click a card to preview the upgrade — then confirm.</p>
      </div>
      <div className="parchment-card p-3">
        <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">Eligible ({eligible.length})</div>
        <div className="flex flex-wrap gap-3">
          {eligible.length === 0 && (
            <div className="text-sm italic text-parchment-400">Nothing left to study — every card has been upgraded already. Sleep instead?</div>
          )}
          {eligible.map(card => {
            const upgraded = upgradeCard(card);
            return (
              <button key={card.uid} onClick={() => setPendingUid(card.uid)}
                className="w-52 rounded-md border-2 p-3 text-left bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl transition flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <div className="font-display text-base">{card.name}</div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">{card.cost}</div>
                </div>
                <div className="text-xs uppercase tracking-wider text-ink-400">{card.type}</div>
                <div className="text-sm">{card.desc}</div>
                <div className="text-xs mt-1 pt-2 border-t border-ink-300 text-moss-700">
                  → <b>{upgraded.name}</b>: {summarizeEffects(upgraded.effects, upgraded.power, upgraded.cost, upgraded.stats, upgraded.effect)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {ineligible.length > 0 && (
        <div className="parchment-card p-3">
          <div className="text-xs uppercase text-parchment-400 mb-1 tracking-widest">Already studied or no upgrade path ({ineligible.length})</div>
          <div className="text-sm text-parchment-400 italic flex flex-wrap gap-2">
            {ineligible.map(c => <span key={c.uid}>{c.name}</span>)}
          </div>
        </div>
      )}
      <button onClick={() => onPick(null)} className="btn btn-ink self-center">Back to rest</button>

      {/* Confirm modal — fires when the player has clicked an eligible
          card. Shows the current card and the upgraded card side-by-side
          with a Confirm / Pick a different card pair of buttons. */}
      {pendingCard && pendingUpgraded && (
        <UpgradeConfirmModal
          before={pendingCard}
          after={pendingUpgraded}
          onConfirm={() => { const uid = pendingUid; setPendingUid(null); onPick(uid); }}
          onCancel={() => setPendingUid(null)}
        />
      )}
    </div>
  );
}

// Side-by-side "before / after" card preview that locks the upgrade-at-
// rest decision behind an explicit confirm step. Renders a full-screen
// dim overlay so the choice is unambiguous.
function UpgradeConfirmModal({ before, after, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-6">
      <div className="parchment-card-strong p-6 max-w-3xl w-full flex flex-col gap-4 border-2 border-gold-500">
        <h3 className="font-display text-3xl text-gold-300 text-center">Confirm upgrade?</h3>
        <p className="text-base text-parchment-200 italic text-center">You can study only one card at this rest. Make sure this is the one.</p>
        <div className="flex gap-4 justify-center items-stretch flex-wrap">
          <UpgradePreviewCard card={before} label="Current" tone="ink" />
          <div className="self-center font-display text-4xl text-gold-400 px-2">→</div>
          <UpgradePreviewCard card={after} label="Upgraded" tone="moss" />
        </div>
        <div className="flex gap-3 justify-center mt-2">
          <button onClick={onConfirm} className="btn btn-gold text-lg px-8 py-3">Confirm upgrade</button>
          <button onClick={onCancel}  className="btn btn-ink  text-base px-6 py-3">Pick a different card</button>
        </div>
      </div>
    </div>
  );
}

// Detail card-face used inside the upgrade confirm modal. Same shape as
// the hand-card display but slightly larger and always-bright (the
// modal sits over a dimmed backdrop).
function UpgradePreviewCard({ card, label, tone }) {
  const border = tone === 'moss' ? 'border-moss-500' : 'border-ink-500';
  const labelColor = tone === 'moss' ? 'text-moss-300' : 'text-parchment-300';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-xs uppercase tracking-widest ${labelColor}`}>{label}</div>
      <div className={`w-56 min-h-[18rem] rounded-lg border-2 p-3 bg-parchment-50 text-ink-800 ${border} flex flex-col gap-2`}>
        <div className="flex justify-between items-start gap-1">
          <div className="font-display text-lg leading-tight">{card.name}</div>
          <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-lg bg-gold-500 text-ink-800">
            {card.cost}
          </div>
        </div>
        <div className="text-xs uppercase tracking-wider text-ink-400">{card.type}</div>
        {card.type === 'word' && card.stats && (
          <div className="flex gap-1 flex-wrap text-sm font-mono">
            {card.stats.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
            {card.stats.wit      ? <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">✨ {card.stats.wit}</span> : null}
            {card.stats.jnsq     ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
          </div>
        )}
        {card.type === 'effect' && card.effect && (
          <div className="text-sm font-mono text-ink-700">
            {card.effect.base} + {card.effect.scaleBy?.toUpperCase()}×{card.effect.multiplier}
            <span className={card.effect.damageType === 'physical' ? 'text-ember-700' : 'text-iris-700'}>
              {' '}{card.effect.damageType === 'physical' ? 'phys' : 'comp'}
            </span>
          </div>
        )}
        <div className="text-base font-quill leading-snug flex-1">{card.desc}</div>
        {card.flavor && <div className="text-sm italic text-ink-500">"{card.flavor}"</div>}
        {(card.type === 'word' && card.tags?.length > 0) && (
          <div className="mt-1 pt-2 border-t border-ink-300 text-sm text-ink-500 italic">
            ✦ {card.tags.join(' · ')}
          </div>
        )}
        {(card.type === 'effect' && card.effect?.resonatesWith?.length > 0) && (
          <div className="mt-1 pt-2 border-t border-ink-300 text-sm text-iris-700 italic">
            ✦ resonates: {card.effect.resonatesWith.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

// Format a card's upgraded effects/power/cost as a human-readable summary
// for the upgrade picker. Doesn't aim to be exhaustive — just enough to
// see what the upgrade changes.
function summarizeEffects(effects, power, cost, stats, effect) {
  const bits = [];
  if (cost !== undefined) bits.push(`cost ${cost}`);
  if (stats) {
    if (stats.chutzpah) bits.push(`+${stats.chutzpah} Chutzpah`);
    if (stats.wit)      bits.push(`+${stats.wit} Wit`);
    if (stats.jnsq)     bits.push(`+${stats.jnsq} Jnsq`);
  }
  if (effect) {
    const dmgType = effect.damageType === 'physical' ? 'phys' : 'comp';
    bits.push(`${effect.base} + ${effect.scaleBy}×${effect.multiplier} ${dmgType}`);
    if (effect.rider) {
      if (effect.rider.weak)       bits.push(`+${effect.rider.weak} Weak`);
      if (effect.rider.vulnerable) bits.push(`+${effect.rider.vulnerable} Vuln`);
      if (effect.rider.block)      bits.push(`${effect.rider.block} Block`);
      if (effect.rider.draw)       bits.push(`draw ${effect.rider.draw}`);
    }
    if (effect.exhaust) bits.push('Exhaust');
  }
  if (effects) {
    if (effects.block)      bits.push(`${effects.block} Block`);
    if (effects.draw)       bits.push(`draw ${effects.draw}`);
    if (effects.energy)     bits.push(`+${effects.energy} Energy`);
    if (effects.vulnerable) bits.push(`${effects.vulnerable} Vuln`);
    if (effects.weak)       bits.push(`${effects.weak} Weak`);
    if (effects.hp)         bits.push(`+${effects.hp} HP`);
    if (effects.exhaust)    bits.push('Exhaust');
  }
  if (power) {
    const k = power.startOfTurn ? 'turn start'
            : power.endOfTurn ? 'turn end'
            : power.onEffectCardPlayed ? 'per effect'
            : '';
    const fx = power.startOfTurn || power.endOfTurn || power.onEffectCardPlayed || {};
    const fxBits = [];
    if (fx.composure)  fxBits.push(`${fx.composure} comp`);
    if (fx.block)      fxBits.push(`${fx.block} Block`);
    if (fx.draw)       fxBits.push(`draw ${fx.draw}`);
    if (fx.energy)     fxBits.push(`+${fx.energy} Energy`);
    if (fx.vulnerable) fxBits.push(`${fx.vulnerable} Vuln`);
    if (fx.weak)       fxBits.push(`${fx.weak} Weak`);
    if (fxBits.length) bits.push(`${k}: ${fxBits.join(', ')}`);
  }
  return bits.join(' · ');
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

function GraduationScreen({ equipment, familiar, familiarName, onRetry }) {
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
      {familiar && (
        <div className="parchment-card-strong p-4 w-full">
          <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">Loyal Familiar</div>
          <div className="flex items-center gap-3">
            <div className="text-4xl">{familiar.emoji}</div>
            <div className="text-sm font-quill">
              <div><span className="text-gold-300">{familiarName || familiar.species}</span> <span className="text-parchment-300">the {familiar.species}</span></div>
              <div className="text-parchment-300 text-xs">{familiar.desc}</div>
            </div>
          </div>
        </div>
      )}
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
