// Witch Mountain Bridge — STS-inspired single-player roguelike deckbuilder.
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
    desc: 'Gain 5 Block (vs physical attacks).' },
  // v2.9: starter Poise card. Defends against composure (🎭) attacks
  // which Block can't touch. Every starter deck gets one of these
  // alongside Defend so the player has both shields from turn 1.
  { id: 'c-compose', name: 'Compose Yourself', cost: 1, type: 'skill', rarity: 'basic',
    effects: { poise: 5 }, upgrade: { effects: { poise: 8 } },
    desc: 'Gain 5 Poise (vs composure attacks).' },

  // ---- COMMON ----
  { id: 'c-mend', name: 'Mend', cost: 1, type: 'skill', rarity: 'common',
    effects: { block: 7 }, upgrade: { effects: { block: 10 } },
    desc: 'Gain 7 Block.' },
  // v2.9: Poise common — composure-shield mid-tier.
  { id: 'c-steady', name: 'Steady Breath', cost: 1, type: 'skill', rarity: 'common',
    effects: { poise: 7 }, upgrade: { effects: { poise: 10 } },
    desc: 'Gain 7 Poise.' },
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
  { id: 'c-iron-stomach', name: 'Iron Stomach', cost: 1, type: 'skill', rarity: 'uncommon', lane: 'chutzpah',
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
  // v2.65: per-play shift dropped 0.25 → 0.15. Combined with the
  // slower 0.10/turn drift, you now need 3-4 plays to reach the cap
  // — the "stacks" text on the card is meaningful again, but the
  // payoff curve is smoother. A single play is +15% (was +25%), so
  // a 2-Amplify burst is +30% (was +50%, too strong per playtest).
  { id: 'c-sap', name: 'Sap', cost: 1, type: 'skill', rarity: 'common',
    effects: { enemyDmgMod: -0.15 },
    upgrade: { effects: { enemyDmgMod: -0.15, draw: 1 } },
    desc: 'Reduce enemy attack damage by 15% (stacks; caps at −50%).',
    flavor: 'You did not finish your sentence. They did not finish theirs, either.' },
  { id: 'c-amplify', name: 'Amplify', cost: 1, type: 'skill', rarity: 'common',
    effects: { playerDmgMod: +0.15 },
    upgrade: { effects: { playerDmgMod: +0.15, draw: 1 } },
    desc: 'Increase your spell potency by 15% (stacks; caps at +50%). Each play this combat costs +1 energy more than the last.',
    flavor: 'You feel taller. It is, demonstrably, a feeling.' },
  { id: 'c-dispel', name: 'Dispel', cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { enemyDmgMod: -0.15, playerDmgMod: +0.15, exhaust: true },
    upgrade: { effects: { enemyDmgMod: -0.30, playerDmgMod: +0.30, exhaust: true } },
    desc: 'Enemy attack −15%, your potency +15%. Exhaust.',
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

// v2.8: Opening-shop boons. Player picks ONE of three (Card / Relic / Boon)
// at game start instead of two-of-five cards. Boons are pure stat boosts;
// the relic and card slots cover effects and deckbuilding. `apply` is a
// string key consumed by the supply-shop's commit handler.
const SHOP_BOONS = [
  { id: 'boon-vigor',  icon: '❤',  name: 'Wellspring',    desc: '+10 max HP. Restore to full.',         apply: 'maxHpPlus10' },
  { id: 'boon-focus',  icon: '✨', name: 'Composed Mind', desc: '+10 max Composure. Restore to full.',  apply: 'maxCompPlus10' },
  { id: 'boon-sturdy', icon: '🪨', name: 'Sturdy Frame',  desc: '+5 max HP and +5 max Composure.',      apply: 'sturdy' },
];

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
    desc: 'At the start of every combat, gain 4 Block and draw 1.',
    flavor: 'The cat knows where it is. The cat refuses to discuss it.',
    // v2.16: was block 5 (bipolar: 33% jnsq, 6% wit). Dropped to 4
    // + added 1 draw, which is lane-agnostic (helps wit tray-completion
    // as much as jnsq survival).
    bonus: { onCombatStart: { block: 4, draw: 1 } },
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
    desc: '+8 max HP. Heal 2 HP at the end of every combat you win.',
    flavor: 'It judges your reading speed. Privately. At length.',
    // v2.16: was flat +8 maxHp only (bottom-3 in two of three lanes).
    // Added end-of-combat heal so it actually scales across a run.
    bonus: { maxHp: 8, onCombatEnd: { heal: 2 } },
    card: { id: 'f-hoo', name: 'Hoo', cost: 1, type: 'skill', rarity: 'basic',
      effects: { draw: 2 },
      upgrade: { effects: { draw: 3 } },
      desc: 'Draw 2.',
      flavor: 'It is a question. It is always a question.' },
  },
  {
    id: 'fam-beetle', species: 'Beetle', emoji: '🪲',
    desc: '+6 max HP. The first incoming hit each combat does -3 damage.',
    flavor: 'It is on its third career. The first two were also waiting.',
    // v2.9: was damageReduction:1 (every hit, every combat) — that
    // arithmetic worked out to ~60 HP saved per full run, oppressively
    // strong vs other familiars. Re-tiered as a flat HP boost + a single
    // strong opening-hit absorb so the flavor stays ("survival pet") but
    // the math sits with other familiars.
    bonus: { maxHp: 6, firstHitReduction: 3 },
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
    desc: 'At the start of every turn, gain 1 Block.',
    flavor: 'It does not move when you call it. You have called it.',
    // v2.14: 2/turn → 1/turn. Compounded too hard over long combats
    // (~58 HP equivalent over a full run); reduced to ~30 HP.
    bonus: { startOfTurnBlock: 1 },
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
    desc: '+5 max HP. At the start of every combat, apply 2 Vulnerable to the enemy.',
    flavor: 'It is patient. You are not. This is the arrangement.',
    // v2.14: was bottom-of-meta at 11.6% avg (vuln drifted back too
    // fast to matter past turn 1-2). Added +5 maxHp baseline so the
    // familiar earns its slot even on short fights.
    bonus: { maxHp: 5, startCombatVulnerable: 2 },
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
    desc: 'Start every combat with +2 Poise.',
    flavor: 'Direction was secondary. Speed was the trick.',
    // v2.14: poise 3 → 2 (was top-of-meta across all lanes at ~30% avg
    // win rate; trimmed to bring closer to ~22% mid-pack).
    bonus: { startCombatPoise: 2 },
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
// v2.72: CARDS_BY_ID must include the v2 lane pools so forcedHand /
// forcedDeck lookups (used by the practice tutorial) resolve wv2-/cv2-/jv2-
// IDs. Previously only the shared CARDS table was indexed — the tutorial
// hand silently became a list of undefined objects.
const CARDS_BY_ID = Object.fromEntries(
  [...CARDS, ...ALL_V2_CARDS].map(c => [c.id, c])
);

// v2.38: MISSTEP TOKEN — the delayed-consequence card delivered to hand
// 2 turns after casting "Saying Something Wrong." Not in the draft pool;
// only spawned by the delayedMisstep mechanic. Manual play: pay 1 Energy,
// exhausts (the player paid for the silence). Auto-play at end of turn
// while still in hand: 3 HP self-damage, exhausts (the realisation lands
// on you, hard). Either way it leaves play — it never enters discard.
const MISSTEP_TOKEN = {
  id: 'wv2-tok-misstep',
  name: 'Misstep',
  type: 'skill',
  lane: 'wit',
  rarity: 'token',
  cost: 1,
  tags: ['token', 'consequence'],
  effects: { exhaust: true, missTepDiscard: true },
  desc: 'Token. Discard for 1 Energy (exhausts). If still in hand at end of turn: -3 HP and exhausts.',
  flavor: 'A sentence you said two turns ago. It has, in the meantime, ripened.',
};

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
  // v2.6: starter deck = 3 intros + 3 subjects + 3 targets + 1 Defend = 10 cards.
  // Reverted from 2 Defends after live playtest: combat felt trivially safe,
  // never forced a defense-vs-attack choice. One Defend means block is a
  // real decision — when do you spend the energy?
  const ids = [
    ...basics(pool.intro).slice(0, 3).map(c => c.id),
    ...basics(pool.subject).slice(0, 3).map(c => c.id),
    ...firstNCommons(pool.target, 3).map(c => c.id),
    'c-defend',
    'c-compose', // v2.9: poise shield for composure-pool attacks
  ];
  // v2.10: wit characters get a starter annotation. Other lanes don't
  // (annotations are wit-flavored — characterizing the enemy in writing).
  if (lane === 'wit') {
    ids.push('wv2-ann-footnote-credibility');
  }
  return ids;
}

// STARTER_DECK is now a function of character. Kept as a const for any v1
// references that still grep for it — they'll get the wit-scholar default.
const STARTER_DECK = buildStarterDeckForLane('wit');

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
  // ===== ACT 3 — The Staff Path (the deep forest, final act) =====
  { id: 'e1-acolyte', act: 3, name: 'Lost Acolyte', composureMax: 20, hpMax: 18, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    softSpot: 'logic', // Wants someone to explain what they're doing here.
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
      { kind: 'attack', value: 3, weight: 2, telegraph: '⚔ 3 (faltering)' },
    ] },
  { id: 'e1-imp', act: 3, name: 'Pact Imp', composureMax: 18, hpMax: 999, tier: 'normal',
    // v2.4: chutzpah 0.7 → 1.0 (less hostile to chutzpah in act 1).
    effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    softSpot: 'threat', // Bullies fold the moment you don't.
    behaviors: [
      { kind: 'attack', value: 4, weight: 3, telegraph: '⚔ 4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '⛧ Weak 1' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🩸 Vuln 1' },
    ] },
  { id: 'e1-shrine-rat', act: 3, name: 'Shrine Rat Pack', composureMax: 16, hpMax: 12, tier: 'normal',
    // Cycle 4 batch 4: physical 2.0 → 1.5. Pure-physical was at 64%
    // partly because Shrine Rat and Thicket were freebies for it.
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.0, physical: 1.5 },
    softSpot: 'threat', // Bigger predator energy = scatter.
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3, telegraph: '⚔ 2×3' },
      { kind: 'block',  value: 4, weight: 1, telegraph: '🛡 4' },
      { kind: 'attack', value: 5, weight: 2, telegraph: '⚔ 5 (lunging)' },
    ] },
  // v2.17: rogue wizard — was about to claim his staff. Got too close
  // to the work. The staff turned him to wood. He is, the records will
  // show, both. The bureaucracy is unclear on the matter.
  { id: 'e-rogue-ashweather', act: 3, name: 'Doctor Phin Ashweather (recently inanimate)',
    composureMax: 36, hpMax: 32, tier: 'normal',
    // failure mode: mystical mishap (transformation). Chutzpah 0.6 —
    // you cannot bully a piece of wood. Wit 1.4 — the absurdity is the
    // wound. Physical 1.0 — he is also wood, axe him.
    effectiveness: { chutzpah: 0.6, wit: 1.4, jnsq: 1.0, physical: 1.0 },
    softSpot: 'logic', // Point out that he is a staff. He is, technically, aware.
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 (the staff turns)' },
      { kind: 'block',  value: 9, weight: 1, telegraph: '🛡 9 (knots tighten)' },
      { kind: 'attack-multi', value: 4, count: 2, weight: 2, telegraph: '⚔ 4×2 (the staff insists)' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (you remember when he was a person)' },
    ] },
  { id: 'e1-tutor', act: 3, name: 'Stern Tutor', composureMax: 32, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 2.0, physical: 0.5 },
    softSpot: 'logic', // Will argue the methodology over the outcome.
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (cutting remark)' },
    ] },
  { id: 'e1-thicket', act: 3, name: 'Living Thicket', composureMax: 55, hpMax: 38, tier: 'elite',
    // Cycle 4 batch 4: physical 1.5 → 1.0. The "physical-only" theme stays
    // (verbal at 0.5) but no longer hands pure-physical a 1.5× freebie.
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 0.7, physical: 1.0 },
    softSpot: 'confusion', // It is mostly bramble. It has thoughts about that.
    behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'block',  value: 9, weight: 2, telegraph: '🛡 9' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🌀 Vuln' },
    ] },
  { id: 'e1-boss-thornlord', act: 3, name: 'The Thornlord', composureMax: 95, hpMax: 115, tier: 'boss',
    // v2.16: was killing 182/500 chutzpah runs. First pass 0.7→0.85
    // overcorrected (chutzpah jumped to 41%). Settled at 0.75: still
    // a chutzpah-hostile boss, just not a trap.
    effectiveness: { chutzpah: 0.75, wit: 1.0, jnsq: 1.3, physical: 1.0 },
    softSpot: 'flattery', // Apex predator; flatter the apex.
    insultVulnerabilities: ['petty', 'dismissive', 'sarcastic'], // Apex; cuts most when made small.
    behaviors: [
      { kind: 'attack', value: 15, weight: 2, telegraph: '⚔ 15' },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, telegraph: '⚔ 5×4 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'block',  value: 16, weight: 1, telegraph: '🛡 16' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 (bramble-whisper)' },
    ] },

  // ===== ACT 1 — The Thread Path (the countryside) =====
  { id: 'e2-hollow-weaver', act: 1, name: 'Hollow Weaver', composureMax: 44, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.2, jnsq: 0.7, physical: 1.0 },
    softSpot: 'logic', // Half-finished thoughts; finish them and it folds.
    behaviors: [
      // v2.9.2: telemetry showed Hollow Weaver took 0 HP per fight. Bumped
      // attack values + added a multi-hit punisher so the player has to
      // think about block, not just walk through.
      { kind: 'attack', value: 7, weight: 2, telegraph: '⚔ 7 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'attack-multi', value: 4, count: 2, weight: 1, telegraph: '⚔ 4×2' },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1, telegraph: '🎭 5 (half-thought)' },
    ] },
  { id: 'e2-silk-wraith', act: 1, name: 'Silk Wraith', composureMax: 38, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.5, physical: 0.5 },
    softSpot: 'confusion', // Already half-there. Push it further.
    behaviors: [
      // v2.9.2: silk-thread cuts now hit harder + composure-pool option.
      { kind: 'attack-multi', value: 4, count: 3, weight: 3, telegraph: '⚔ 4×3' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 2, telegraph: '🎭 6 (silken whisper)' },
      { kind: 'block',  value: 6, weight: 1, telegraph: '🛡 6' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🩸 Vuln 1' },
    ] },
  { id: 'e2-loom-familiar', act: 1, name: 'Loom Familiar', composureMax: 46, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    softSpot: 'flattery', // Misses its weaver. Speak as if it still mattered.
    behaviors: [
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'block',  value: 8, weight: 1, telegraph: '🛡 8' },
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6 + ⛧ Weak 1 (thread-tangle)', riders: { weak: 1 } },
      { kind: 'attack', value: 6, pool: 'composure', weight: 2, telegraph: '🎭 6 (lonely-thread)' },
    ] },
  // v2.17: ROGUE WIZARDS — first wave. Failed-graduate wizards still
  // working at their craft, refusing to come back. Names follow the
  // Pratchett-tone with parenthetical bureaucratic annotations.
  { id: 'e-rogue-linenfast', act: 1, name: 'Bartholomew Linenfast (still adjusting the hem)',
    composureMax: 42, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 0.8, jnsq: 1.3, physical: 1.0 },
    // failure mode: refusal. 50 years on the same hem. Wit can't
    // out-argue him (heard every version); jnsq breaks his focus.
    softSpot: 'confusion',
    behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6 + ⛧ Weak 1 (stitch, weakly)', riders: { weak: 1 } },
      { kind: 'attack', value: 7, pool: 'composure', weight: 2, telegraph: '🎭 7 (murmuring about the hem)' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7 (measures, again)' },
      { kind: 'attack-multi', value: 3, count: 2, weight: 1, telegraph: '⚔ 3×2 (stitch, unstitch)' },
    ] },
  { id: 'e2-pattern-maker', act: 1, name: 'The Pattern-Maker', composureMax: 70, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.0, wit: 1.2, jnsq: 0.7, physical: 1.0 },
    softSpot: 'confusion', // Patterns hate exceptions.
    behaviors: [
      // v2.9.2: telemetry showed player losing only 3-7 HP per Pattern-Maker
      // fight. Bumped physical attacks AND added an HP-pool burst so the
      // fight feels like Silent Spinner does (which the user called "good").
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 4, count: 3, weight: 1, telegraph: '⚔ 4×3' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 2, telegraph: '🎭 7 (pattern-wrong)' },
      { kind: 'attack', value: 13, pool: 'composure', weight: 1, telegraph: '🎭 13 (PATTERN COMPLETE)' },
      // HP-side burst — the pattern lashes out physically.
      { kind: 'attack', value: 15, weight: 1, telegraph: '⚔ 15 (BROKEN-PATTERN STRIKE)' },
    ] },
  { id: 'e2-silent-spinner', act: 1, name: 'The Silent Spinner', composureMax: 72, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.5, wit: 0.5, jnsq: 1.0, physical: 1.0 },
    softSpot: 'threat', // The vow of silence has limits.
    behaviors: [
      { kind: 'block',  value: 10, weight: 2, telegraph: '🛡 10 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 8,  weight: 2, telegraph: '⚔ 8 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 6, pool: 'composure', weight: 2, telegraph: '🎭 6 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      // v2.9 burst — telegraphed big swing to HP. "Loud silence" is a
      // breaking-of-the-vow moment.
      { kind: 'attack', value: 14, weight: 1, telegraph: '⚔ 14 (LOUD SILENCE)' },
    ] },
  { id: 'e2-boss-tapestry', act: 1, name: 'The Tapestry Walker', composureMax: 85, hpMax: 999, tier: 'boss',
    effectiveness: { chutzpah: 1.0, wit: 1.2, jnsq: 1.0, physical: 0.5 },
    softSpot: 'flattery', // Vain creator. Praise the work to crack the maker.
    insultVulnerabilities: ['dismissive', 'petty', 'sarcastic'], // Vain — hates being trivialized.
    behaviors: [
      { kind: 'attack', value: 10, weight: 2, telegraph: '⚔ 10 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, telegraph: '⚔ 4×4' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 (loom-song)' },
      { kind: 'block',  value: 10, weight: 1, telegraph: '🛡 10' },
    ] },

  // ===== ACT 2 — The Forge Path (the mines and caves) =====
  { id: 'e3-geode-crab', act: 2, name: 'Geode Crab', composureMax: 44, hpMax: 22, tier: 'normal',
    // v2.4: sharpened from flat-low to chutzpah-favored. Geodes hate
    // being loomed over; jnsq just makes them weirder.
    effectiveness: { chutzpah: 1.5, wit: 0.7, jnsq: 0.7, physical: 1.0 },
    softSpot: 'threat', // Hard shell, soft instinct. Loom over it.
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 8,  weight: 1, telegraph: '🛡 8' },
      { kind: 'attack', value: 7, weight: 1, telegraph: '⚔ 7 (claw-snap)' },
    ] },
  { id: 'e3-glow-mite', act: 2, name: 'Glow Mite Swarm', composureMax: 34, hpMax: 26, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.5, physical: 1.0 },
    softSpot: 'confusion', // A swarm of small minds is easily scattered.
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 4, weight: 2, telegraph: '⚔ 2×4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack-multi', value: 2, count: 4, weight: 1, telegraph: '⚔ 2×4' },
      { kind: 'weak',   value: 1, weight: 1, telegraph: '⛧ Weak 1' },
    ] },
  { id: 'e3-crystal-beetle', act: 2, name: 'Crystal Beetle', composureMax: 44, hpMax: 22, tier: 'normal',
    // v2.4: sharpened to wit-favored (its prismatic surfaces refract logic).
    effectiveness: { chutzpah: 0.5, wit: 1.2, jnsq: 0.7, physical: 1.0 },
    softSpot: 'threat', // Slow, certain, intimidatable.
    behaviors: [
      { kind: 'attack', value: 6, weight: 3, telegraph: '⚔ 6' },
      { kind: 'attack', value: 8, weight: 1, telegraph: '⚔ 8' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5 (carapace)' },
    ] },
  // v2.17: rogue wizard — chutzpah-punisher. Tried to forge a ring of
  // three metals; the ring forged him. The metal absorbs direct threat.
  { id: 'e-rogue-smelterson', act: 2, name: 'Smelterson, J.C. (alloyed)',
    composureMax: 48, hpMax: 26, tier: 'normal',
    // failure mode: transformation. Chutzpah resist 0.6 — you can't
    // bully someone whose identity is partly an iron ring. Jnsq 1.3
    // because absurdity disrupts the alloy. Physical 1.0 — he is, after
    // all, also metal.
    effectiveness: { chutzpah: 0.6, wit: 1.1, jnsq: 1.3, physical: 1.0 },
    softSpot: 'confusion',
    behaviors: [
      { kind: 'attack', value: 7, weight: 2, telegraph: '⚔ 7 (alloyed strike)' },
      { kind: 'block',  value: 7, weight: 2, telegraph: '🛡 7 + ⛧ Weak 1 (the ring sets)', riders: { weak: 1 } },
      { kind: 'attack', value: 9, weight: 1, telegraph: '⚔ 9 (the ring tells him to)' },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1, telegraph: '🎭 5 (the alloy hums)' },
    ] },
  { id: 'e3-quartz-sentinel', act: 2, name: 'Quartz Sentinel', composureMax: 50, hpMax: 40, tier: 'elite',
    // v2.4: sharpened to wit-favored. Constructs answer to logic.
    effectiveness: { chutzpah: 0.7, wit: 1.2, jnsq: 0.7, physical: 1.0 },
    softSpot: 'logic', // Constructs respond to the logic they were built with.
    behaviors: [
      { kind: 'attack', value: 10, weight: 2, telegraph: '⚔ 10 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'block',  value: 12, weight: 2, telegraph: '🛡 12 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'attack', value: 8, pool: 'composure', weight: 2, telegraph: '🎭 8 (axiom-strike)' },
      // v2.9 burst — single-pool HP hammer.
      { kind: 'attack', value: 16, weight: 1, telegraph: '⚔ 16 (RULING)' },
    ] },
  { id: 'e3-vein-devourer', act: 2, name: 'Vein Devourer', composureMax: 80, hpMax: 50, tier: 'elite',
    // v2.4: chutzpah-favored. The Devourer responds to direct threat
    // (Walter punches it, it backs off); evades wit and jnsq.
    effectiveness: { chutzpah: 1.5, wit: 0.7, jnsq: 0.7, physical: 1.0 },
    softSpot: 'confusion', // Doesn't think. Only confusion can confuse it.
    insultVulnerabilities: [], // Mindless. Cannot be insulted. ALL insults backfire on it.
    behaviors: [
      { kind: 'attack', value: 13, weight: 2, telegraph: '⚔ 13 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 5, count: 3, weight: 1, telegraph: '⚔ 5×3' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 + ⛧ Weak 1', riders: { weak: 1 } },
      // v2.9 burst — the Devourer's "DEVOUR" is a 1-shot KO risk.
      { kind: 'attack', value: 18, weight: 1, telegraph: '⚔ 18 (DEVOUR)' },
    ] },
  { id: 'e3-boss-anvil', act: 2, name: 'The Anvil-Forged', composureMax: 78, hpMax: 75, tier: 'boss',
    // v2.4: Anvil flipped from chutzpah-resist to chutzpah-favored. It's
    // a forging boss — it understands direct demands. Jnsq is now the
    // softer side (0.7); wit stays neutral.
    effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 0.7, physical: 1.0 },
    softSpot: 'logic', // Rule-bound smithcraft; argue the specification.
    insultVulnerabilities: ['dismissive', 'petty', 'absurd'], // Rule-bound; absurdity unmoors them.
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1, telegraph: '⚔ 4×4' },
      { kind: 'block',  value: 12, weight: 1, telegraph: '🛡 12' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (hammer-rhythm)' },
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

  'sq-last-will-sneeze': { id: 'sq-last-will-sneeze', title: 'The Last Will of a Sneeze', act: 3,
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

  'sq-wedding-crash': { id: 'sq-wedding-crash', title: 'The Wedding Crash', act: 3,
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
      { kind: 'combat', enemyId: 'e1-acolyte',
        flavor: 'The first family\'s enforcer challenges you when you suggest the bride isn\'t real.' },
      { kind: 'combat', enemyId: 'e1-imp',
        flavor: 'The OTHER family\'s enforcer arrives. They thought you were with the first.' },
      { kind: 'narrative', title: 'The Resolution',
        flavor: 'Both families realize together. They marry each other\'s matriarchs. The cake is consumed in relief.',
        next: { effects: { maxHp: 3, gainUncommonCard: 1 } } },
    ] },

  'sq-apprentice-of-apprentice': { id: 'sq-apprentice-of-apprentice', title: 'The Apprentice\'s Apprentice', act: 3,
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

  'sq-drunk-oracle': { id: 'sq-drunk-oracle', title: 'The Drunk Oracle', act: 3,
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

  'sq-unfinished-symphony': { id: 'sq-unfinished-symphony', title: 'The Unfinished Symphony', act: 3, bossShortcut: true,
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

  'sq-borrowed-death': { id: 'sq-borrowed-death', title: 'The Borrowed Death', act: 3, bossShortcut: true,
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
      { kind: 'combat', enemyId: 'e1-tutor',
        flavor: 'The thief. Using the scythe inexpertly. Cannot use it well. Cannot stop.' },
      { kind: 'boss',
        flavor: 'Death thanks you. He mentions, casually, that he was on his way to a specific appointment. The appointment was the act boss. He offers you a lift.' },
    ] },

  'sq-lovers-quarrel': { id: 'sq-lovers-quarrel', title: 'The Lover\'s Quarrel', act: 3,
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
    flavor: 'The countryside outside the town. Cottages with looms, threads worth walking miles for, and the things that walk between them. The right robes find the right wearer.',
    rows: 15, width: 4,
    bossId: 'e2-boss-tapestry',
    craft: 'weaving',
  },
  { id: 2, slot: 'ring',  name: 'The Forge Path',
    flavor: 'Down into the mines and cave systems beneath the hills. Coal, anvil, and a metal with opinions of its own. A ring earned in the dark fits no other hand.',
    rows: 15, width: 4,
    bossId: 'e3-boss-anvil',
    craft: 'smithing',
  },
  { id: 3, slot: 'staff', name: 'The Staff Path',
    flavor: 'The capstone. You walk into the deep forest to claim a staff fit to graduate with. The school will know if you return without it. The hat, mercifully, is provided.',
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
  if (card.upgraded) return card;
  // Explicit upgrade path (legacy v1 cards).
  if (card.upgrade) {
    const up = card.upgrade;
    const next = {
      ...card,
      uid: uid(),
      name: `${card.name}+`,
      upgraded: true,
      upgrade: null,
    };
    if (up.effects) next.effects = { ...card.effects, ...up.effects };
    if (up.power)   next.power   = { ...card.power, ...up.power };
    if (up.stats)   next.stats   = { ...card.stats, ...up.stats };
    if (up.effect)  next.effect  = { ...card.effect, ...up.effect };
    if (up.phrase !== undefined) next.phrase = up.phrase;
    if (up.cost !== undefined)   next.cost   = up.cost;
    return next;
  }
  // v2 sentence-engine auto-upgrade: any slot-typed card gets a tier-
  // appropriate buff. Intros/subjects gain +1 stat. Targets gain +2 base
  // damage. Modifiers gain +0.25 damage multiplier (or block bump if
  // they're defensive). All keep the same phrase but the card is marked
  // with a "+" suffix.
  const isV2 = card.slot && card.lane;
  if (isV2) {
    const baseName = card.name || card.phrase;
    const next = { ...card, uid: uid(), upgraded: true, name: `${baseName}+` };
    if (card.slot === 'intro' || card.slot === 'subject') {
      const lane = card.lane;
      next.stats = { ...card.stats, [lane]: (card.stats?.[lane] || 0) + 1 };
    } else if (card.slot === 'target' && card.effect) {
      next.effect = { ...card.effect, base: (card.effect.base || 0) + 2 };
    } else if (card.slot === 'modifier' && card.modifierEffect) {
      const me = card.modifierEffect;
      if (me.rider?.block) {
        next.modifierEffect = { ...me, rider: { ...me.rider, block: me.rider.block + 1 } };
      } else if (me.damageMult) {
        next.modifierEffect = { ...me, damageMult: me.damageMult + 0.25 };
      } else {
        // No clean upgrade hook → bump the lane stat instead.
        next.stats = { ...card.stats, [card.lane]: (card.stats?.[card.lane] || 0) + 1 };
      }
    } else if (card.slot === 'gesture' && card.gestureEffect) {
      // v2.18: gesture upgrade — bump damage +3 (the main payload) AND
      // any present rider value by +1. Falls back to damage-only.
      const ge = card.gestureEffect;
      const nextGE = { ...ge };
      nextGE.damage = (ge.damage || 0) + 3;
      if (ge.stripEnemyBlock) nextGE.stripEnemyBlock = ge.stripEnemyBlock + 2;
      if (ge.draw) nextGE.draw = ge.draw + 1;
      if (ge.rider) {
        const nextRider = { ...ge.rider };
        for (const k of Object.keys(nextRider)) {
          if (typeof nextRider[k] === 'number') nextRider[k] = nextRider[k] + 1;
        }
        nextGE.rider = nextRider;
      }
      next.gestureEffect = nextGE;
    } else if (card.slot === 'annotation' && card.annotationEffect) {
      // v2.18: annotation upgrade — +1 duration AND bump every numeric
      // effect value by 1. So Subtext-in-italics (bonusSpellDamage 4)
      // upgrades to 4 turns of +5 dmg/cast.
      next.duration = (card.duration || 3) + 1;
      const ae = card.annotationEffect;
      const nextAE = { ...ae };
      for (const k of Object.keys(nextAE)) {
        if (typeof nextAE[k] === 'number') nextAE[k] = nextAE[k] + 1;
      }
      next.annotationEffect = nextAE;
    } else {
      // v2.18: defensive catch-all — any v2 card slot we don't have an
      // explicit handler for still gets the lane-stat bump so the
      // upgrade flow never silently no-ops.
      next.stats = { ...card.stats, [card.lane]: (card.stats?.[card.lane] || 0) + 1 };
    }
    return next;
  }
  return card;
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

// v2.4: slot weights to keep target draws healthy as deck grows. Without
// these, the 25/25/15/10 (intro/subject/target/modifier) lane pools
// over-deliver intros/subjects exactly when the player needs targets.
const REWARD_SLOT_WEIGHTS = { target: 35, intro: 25, subject: 25, modifier: 15 };
// v2.60 / v2.64: a reward-pool card is "interesting" only if it brings a
// real mechanic. Targets/skills/powers/annotations/gestures qualify
// directly. WORD-slot cards (intro / subject) qualify only if they are
// UNCOMMON+ rarity OR have a high scaling stat (3+). Common intros and
// subjects — even with a `{ draw: 1 }` or `{ weak: 1 }` rider — read as
// "same generic stat-pump as the starter" per playtest, so they're
// filtered out regardless of trivial side-effects. Modifiers can be
// common (they carry distinct modifierEffect math). Same for targets.
function isInterestingReward(card) {
  if (card.effect) return true;
  if (card.type === 'power' || card.type === 'annotation' || card.type === 'skill' || card.type === 'gesture') return true;
  // Word slots get a tighter test — rarity and/or scaling.
  if (card.slot === 'intro' || card.slot === 'subject') {
    if (card.rarity === 'uncommon' || card.rarity === 'rare') return true;
    if (card.stats) {
      const maxStat = Math.max(0, ...Object.values(card.stats));
      if (maxStat >= 3) return true;
    }
    return false;
  }
  // Modifiers and anything else with an effects block keep the
  // permissive rule (they're not starter-shaped).
  if (card.effects && Object.keys(card.effects).length > 0) return true;
  if (card.stats) {
    const maxStat = Math.max(0, ...Object.values(card.stats));
    if (maxStat >= 3) return true;
  }
  return false;
}

function pickCardByRarity(rarityWeights = { common: 4, uncommon: 1 }, exclude = [], lane = null) {
  // Lane filter: when set, only cards matching that lane OR lane-agnostic
  // utility cards (skill/power without a `lane` field) qualify.
  const matchesLane = (c) => {
    if (!lane) return true;
    if (!c.lane) return true;
    return c.lane === lane;
  };
  const pool = CARDS.filter(c => rarityWeights[c.rarity] && !exclude.includes(c.id) && matchesLane(c) && isInterestingReward(c));
  if (pool.length === 0) return null;
  // Weight by rarity AND slot together.
  const weightOf = (c) => (rarityWeights[c.rarity] || 0) * (REWARD_SLOT_WEIGHTS[c.slot] || 10);
  const total = pool.reduce((s, c) => s + weightOf(c), 0);
  if (total <= 0) return pool[0];
  let r = Math.random() * total;
  for (const c of pool) {
    r -= weightOf(c);
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
      let t = r === preBossRow      ? 'rest'
            : c === materialCol     ? 'material'
            : c === skillCol        ? 'skill'
            :                         pickNodeType(r, rows);
      // v2.62: no rest within 2 rows of another rest along likely paths.
      // Map edges link each node to its column-nearest neighbor in the
      // previous row, so check R-1 and R-2 for a nearby rest. Also block
      // rest within 2 rows BEFORE the pre-boss row (which is all-rest by
      // design), so the inn-before-boss isn't preceded by another inn.
      if (t === 'rest' && r !== preBossRow) {
        const isCloseRest = (prevRow) => {
          if (prevRow < 0) return false;
          for (const n of nodes) {
            if (n.row !== prevRow) continue;
            if (n.type !== 'rest') continue;
            if (Math.abs(n.col - c) <= 1) return true;
          }
          return false;
        };
        if (isCloseRest(r - 1) || isCloseRest(r - 2)) t = 'combat';
        // Pre-boss row will be all-rest, so the two rows before it must not
        // also be rest.
        if (r === preBossRow - 1 || r === preBossRow - 2) t = 'combat';
      }
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
const INTER_ACT_HEAL_RATIO = 0.35; // v2.22: was 0.55 — too generous; 0.25 was too harsh. 0.35 lands middle.

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
  // v2.9: dual-shield system. `block` (🛡) absorbs PHYSICAL damage; `poise`
  // (🪞) absorbs COMPOSURE damage. Both fade at the start of the enemy's
  // turn. Cards/relics that grant block default to the physical kind;
  // cards that grant poise are explicitly tagged with `poise:` in effects.
  const [poise, setPoise] = useState(0);
  // v2.9: Beetle's first-hit absorb — non-zero only while a combat is
  // ongoing AND the Beetle wielder hasn't yet taken a hit this fight.
  // Consumed once on the first attack the enemy lands; reset on combat
  // enter.
  const [beetleAbsorb, setBeetleAbsorb] = useState(0);
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
  // v2.8: STS-style 1-of-3 supply shop. One card / one relic / one boon.
  // Shape: { card: <v2-card>, relic: <relic-obj>, boon: <boon-obj> }
  const [supplyOffers, setSupplyOffers] = useState(null);
  // Player debuffs (mirror of enemy ones). Tick down at end of turn.
  // Damage multipliers replace the old Weak/Vulnerable; see combat
  // state declarations below. Helpers clamp to [0.5, 1.5].
  function adjustEnemyDmg(delta)  { setEnemyDmgMult(m  => Math.max(0.5, Math.min(1.5, m + delta))); }
  // v2.10: pull annotation effect value (0 if no annotation or key missing).
  function annoFx(key) { return enemy?.annotation?.effect?.[key] || 0; }
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
  // v2.7: peeked next intent (from Jnsq's "the next thing you'll do"
  // subject). Cleared when the enemy actually fires that intent.
  const [peekedNextIntent, setPeekedNextIntent] = useState(null);
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
  // v2.9: hard cap on spell casts per turn. Was previously unbounded —
  // a 3-energy turn could comfortably stage+cast twice. Caps player
  // tempo so elites and bosses can actually pressure across multiple
  // rounds instead of getting one-shot.
  const [castsThisTurn, setCastsThisTurn] = useState(0);
  // v2.49: BABBLING lifts the per-turn cap from 1 to 2. Derived inline so
  // the read always reflects the current powers array.
  const MAX_CASTS_PER_TURN_BASE = 1;
  const MAX_CASTS_PER_TURN = MAX_CASTS_PER_TURN_BASE
    + (powers.some(p => p.installPower?.id === 'babbling' || p.id === 'jv2-p-wait-and-another-thing') ? 1 : 0);
  // v2.13: per-combat cast counter (resets at combat enter).
  // Used by Thesis-expanded annotation's bonusSpellDamagePerCast scaling.
  const [castsThisCombat, setCastsThisCombat] = useState(0);
  // v2.11: chutzpah ALL IN — per-cast HP wager. Player commits 0-N HP
  // before casting; bonus damage = N × 1.5 (plus per-card multipliers).
  // Cap at floor(hp/3) so the stake alone can't be lethal. Reset on
  // cast, turn end, and combat enter.
  const [stakeAmount, setStakeAmount] = useState(0);
  // v2.12: jnsq CHAOS DICE — per-cast optional 1d6 roll that modifies
  // damage and adds side effects per a fixed outcome table. rollOptIn is
  // the toggle for the next cast; lastRoll is the most recent result
  // (for UI feedback); combatRolls is the history this combat (for
  // synergy cards like Cosmic Recoil).
  const [rollOptIn, setRollOptIn] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);
  // v2.24: chutzpah TUNNEL VISION meter. Fills +1 per chutzpah-lane card
  // played (intro/subject/modifier/target — anywhere staging completes).
  // At >= 5 at start of your turn, you enter RAGE for that turn:
  // playerDmgMult +0.5 (channeled through adjustPlayerDmg so it interacts
  // with the existing Weak/Strengthened plumbing) and RAGE-only cards
  // (Bare Knuckles) become castable. At end of RAGE turn, reset meter to
  // 0 and restore the +0.5 bonus.
  const [tunnelVision, setTunnelVision] = useState(0);
  const [rageActive, setRageActive] = useState(false);
  // v2.34: wit LONG THREAD — consecutive-turn scaling counter. Ticks +1
  // at end of every player turn where the player cast a wit Effect (target)
  // AND took zero unblocked HP damage. Block-absorbed hits DON'T break
  // the thread — that's the wit-defender's whole point. Taking actual
  // unblocked HP damage resets the meter to 0. Wit targets with
  // `threadScaling: N` add N × longThread flat damage on cast. Persists
  // across turns; resets between combats.
  const [longThread, setLongThread] = useState(0);
  // Track whether the player took unblocked HP damage this turn — read at
  // end-of-turn by the long-thread bookkeeping. Reset at the start of every
  // player turn.
  const [unblockedThisTurn, setUnblockedThisTurn] = useState(false);
  // Track whether the player cast at least one wit Effect (target) this
  // turn. Read at end-of-turn by the long-thread bookkeeping. Reset at
  // the start of every player turn.
  const [castWitEffectThisTurn, setCastWitEffectThisTurn] = useState(false);
  // v2.35: FOOTNOTE prompt — set true when the player plays the
  // "As Hewn-Greaves notes in his footnotes," skill. While true, the
  // hand AND discard piles render their Word cards (intro/subject/
  // modifier) as clickable. Clicking one bumps that card instance's
  // `footnotes` count by 1 and clears the prompt. Esc / cancel dismisses
  // without applying. The skill is exhausted at play time either way —
  // the prompt is the payoff window.
  const [footnotePromptActive, setFootnotePromptActive] = useState(false);
  // v2.85: pick-one-of-two-to-forget. When an event/sidequest fires the
  // loseRandomCard effect, pre-pick two candidates and surface a modal
  // so the player chooses which one to lose (not silent + not pure RNG).
  // Shape: { cards: [card, card], source: 'event/sidequest title' } | null
  const [forgetTwoPrompt, setForgetTwoPrompt] = useState(null);
  // v2.36: ACTUALLY— state. lastCastSnapshot captures the most recent cast
  // this turn (intro/subject/target/modifiers + the ctx that was used to
  // resolve damage). Reset to null at the start of every player turn AND
  // on combat entry. When the player plays the "Actually—" skill, the
  // refireLastCast effect re-computes damage from this snapshot at ×1.5
  // and applies it to the enemy. We deliberately re-fire DAMAGE ONLY
  // (no rider re-application, no annotation auto-attach, no tray clear)
  // so the side-effects don't double-trigger.
  //
  // arguingBackThisTurn is the player-side stacking debuff. Each Actually—
  // played this turn bumps it +1; enemy attacks this turn add this value
  // to their raw damage. Reset to 0 at end of every player turn.
  const [lastCastSnapshot, setLastCastSnapshot] = useState(null);
  const [arguingBackThisTurn, setArguingBackThisTurn] = useState(0);
  // v2.37: HOLD ON — wit's reactive interrupt. When the player plays the
  // "Hold on, hold on —" skill, holdOnArmed flips true and holdOnValue is
  // SNAPSHOTTED from the player's current longThread at play time (so a
  // later thread-tick or thread-break doesn't change the interrupt's
  // strength). On the very next enemy attack/attack-multi, the first
  // swing's `raw` value is reduced by holdOnValue (clamped at 0) and the
  // flag clears regardless of whether the reduction was meaningful (no
  // free re-cast — you spent the energy). Auto-clears at the START of the
  // player's NEXT turn if no enemy attack consumed it ("you only get to
  // interrupt the NEXT thing they say"). Reset to false / 0 in enterFight.
  const [holdOnArmed, setHoldOnArmed] = useState(false);
  const [holdOnValue, setHoldOnValue] = useState(0);
  // v2.38: SAYING SOMETHING WRONG — pending misstep tokens. Each entry is
  // `{ turnsRemaining: N }`. Created when Saying Something Wrong casts
  // (delay 2). Decrements at end of each player turn AFTER auto-play
  // resolves; when an entry reaches 0, a Misstep token card is delivered
  // into the new turn's hand during the endTurn pile-composition pass.
  // Reset to [] in enterFight (never persists between combats).
  //
  // missTepAutoPlayedThisTurn is the per-turn flag used by the UI banner
  // to surface that an auto-play just fired (so the player sees the cost
  // land even on a busy log). Reset every endTurn.
  const [pendingMissteps, setPendingMissteps] = useState([]);
  // v2.39: wit OPENING STATEMENT — first-turn scaling. combatTurn ticks +1
  // at every endTurn (turn 1 on enterFight, turn 2 after first endTurn, etc.).
  // openingExtended is the single-use bridge: the "to revisit my opening
  // point," skill flips it true, and the next wit target cast consumes it
  // (granting the openingBonus even past turn 1). Both reset per combat.
  const [combatTurn, setCombatTurn] = useState(1);
  const [openingExtended, setOpeningExtended] = useState(false);
  // v2.25: chutzpah DOUBLING DOWN — per-turn "corner tokens" counter.
  // +1 per chutzpah target with `doubleDown: true` that resolves a CAST
  // (not fizzled). At end of player turn, if the enemy is still alive,
  // the player takes cornerTokens * 2 unblocked HP damage — the bill for
  // bravado that didn't close the deal. Resets to 0 every turn (after the
  // damage tick fires).
  const [cornerTokens, setCornerTokens] = useState(0);
  // v2.29: chutzpah SAYING IT LOUDER — per-turn counter of chutzpah word
  // cards (intro/subject/modifier) carrying the 'demanding' tag. Reset at
  // the start of every player turn. Read by `loudScaling` targets to add
  // +loudCount * 3 to spell damage. The combo path is: stack as many
  // demanding-tagged words into one turn as possible, then fire I SAID.
  const [loudCount, setLoudCount] = useState(0);
  // v2.26: chutzpah STORMING OUT — when a stormOut target casts, the enemy's
  // next intent is HIDDEN from the UI (we don't render the telegraph). The
  // flag persists through ONE upcoming player turn (the intent rolled during
  // the storm-out endTurn), then clears at the END of THAT turn's endTurn so
  // the next intent reveals normally. `stormOutFiredRef` is the cross-closure
  // signal so the immediate storm-out endTurn doesn't clear its own flag.
  const [intentHidden, setIntentHidden] = useState(false);
  const stormOutFiredRef = useRef(false);
  // v2.27: HIT ME AGAIN — chutzpah's reactive recoil power. While the
  // `cv2-p-hit-me-again` power is installed (mirrored on this flag so the
  // attack-resolution path doesn't have to walk `powers` on every swing),
  // each enemy hit landing on the player arms +1 to `hitMeAgainCharges`.
  // The NEXT swing eats `charges` recoil before resolving its damage —
  // for attack-multi, each swing both eats recoil AND arms a new charge,
  // so the bleed snowballs. Charges never reset within a combat. Both
  // reset to 0 / false in enterFight.
  const [hitMeAgainInstalled, setHitMeAgainInstalled] = useState(false);
  const [hitMeAgainCharges, setHitMeAgainCharges] = useState(0);
  // v2.40: PATIENCE — wit's skip-cast-and-defend power. While installed, every
  // end-of-turn where the player did NOT cast a spell increments
  // patienceStacks. The next cast adds patienceStacks × 2 flat damage and
  // clears the counter. Mirrored as a fast-read flag (patienceInstalled) so
  // the end-of-turn + cast hooks don't have to walk `powers` every tick.
  // Both reset to false / 0 in enterFight (patience is intra-combat only).
  const [patienceInstalled, setPatienceInstalled] = useState(false);
  const [patienceStacks, setPatienceStacks] = useState(0);
  // v2.33: Stubborn Block was removed (Power that converted unspent energy
  // to carry-over Block — wit-flavored on a lane whose defensive identity is
  // "bill them for the hit," not "accumulate Block").
  // v2.33: NOT LISTENING refactored from a Power to a one-shot SKILL.
  // notListeningCharges = number of pending "absorb the next debuff" tokens
  // (0 by default; +1 each time the player plays the "Sorry — what?" skill).
  // The on-cast Block rider from the old Power is GONE.
  const [notListeningCharges, setNotListeningCharges] = useState(0);
  const [combatRolls, setCombatRolls] = useState([]);
  // v2.44: TANGENT telemetry — counts fires (skill plays), targetsCast
  // (tray was complete + fired), wordsStaged (intro/subject/modifier from
  // discard), fizzles (target hit empty tray). Per-run counters; reported
  // via logEvent so the sim mirror keeps parity.
  const [tangentTelemetry, setTangentTelemetry] = useState({ fires: 0, targetsCast: 0, wordsStaged: 0, fizzles: 0 });
  // v2.45: APOLOGY telemetry. casts = skill plays; hpHealed = total HP gained
  // from the heal rider; trayDiscarded = cards moved tray → discard by the
  // reset (intro+subject+target+modifiers, summed across plays).
  const [apologyTelemetry, setApologyTelemetry] = useState({ casts: 0, hpHealed: 0, trayDiscarded: 0 });
  // v2.46: WON'T SHUT UP — commitment-chain flag. Armed when a target with
  // `mustPlayAnotherJnsq` resolves a cast. Cleared when ANY jnsq-lane card
  // is played AFTER the rider fired (the "kept going" path), OR at end of
  // turn (with a 3 HP penalty if still armed — the "stopped abruptly" path).
  // Telemetry: armed = total times rider fired; damage = times the 3 HP
  // landed; dodges = times the player kept going and dodged the penalty.
  const [wontShutUpArmed, setWontShutUpArmed] = useState(false);
  const [wontShutUpTelemetry, setWontShutUpTelemetry] = useState({ armed: 0, damage: 0, dodges: 0 });

  // v2.47: DRUNKEN CONFIDENCE — jnsq damage-trade Power. While installed:
  // every player Effect/Spell cast scales +50%, AND every enemy attack adds
  // +2 raw damage BEFORE block absorption (so block can still soak some of
  // the chunk). Removed explicitly via the "sober second thought," skill
  // (uninstallPower side effect). Installed state lives on the `powers`
  // array — checked via powers.some(p => p.installPower?.id === 'drunken-
  // confidence'). Telemetry: installs = power plays, castBonus = total
  // bonus damage from the +50%, incomingPenalty = total +2 chunks taken.
  const [drunkenTelemetry, setDrunkenTelemetry] = useState({ installs: 0, castBonus: 0, incomingPenalty: 0 });

  // v2.48: AWKWARD PAUSE — jnsq tray-hold mechanic. Two flags:
  //   - pauseHeld: set on play (this turn). At end-of-turn it graduates to
  //     pauseHeldActive (the doubling-pending bank) and itself clears.
  //   - pauseHeldActive: doubles every staged-card stat contribution on the
  //     NEXT cast. Cleared when the cast fires (single-use). If no cast
  //     fires, the flag stays armed and the doubling persists into the turn
  //     after (multi-turn buildup if the player is patient).
  // Telemetry: pauses = skill plays; doubledCasts = casts that benefited;
  // doubledExtraDamage = total damage delta (post-double minus would-have-
  // been-single, computed at cast time).
  const [pauseHeld, setPauseHeld] = useState(false);
  const [pauseHeldActive, setPauseHeldActive] = useState(false);
  const [awkwardPauseTelemetry, setAwkwardPauseTelemetry] = useState({ pauses: 0, doubledCasts: 0, doubledExtraDamage: 0 });

  // v2.49: BABBLING — jnsq Power that lifts the per-turn cast cap from 1 to
  // 2. Read path: powers.some(p => p.installPower?.id === 'babbling'). The
  // 2nd cast empties the tray as usual, so re-staging is required. Final
  // damage on the 2nd cast multiplies by 0.6 (applied post-effectiveness +
  // mults — same shape as drunken's +50%). Telemetry: installs = power
  // plays, secondCasts = casts that fired with castsThisTurn === 1, second-
  // CastDamage = total damage delivered by those 2nd casts.
  const [babblingTelemetry, setBabblingTelemetry] = useState({ installs: 0, secondCasts: 0, secondCastDamage: 0 });

  // v2.51: UNIVERSE-SIDEWAYS — synergy capstone metrics.
  //   casts            = total resolved casts of jv2-t-universe-sideways
  //   totalDamage      = sum of resolved damage (for avg-per-cast in reports)
  //   tangentOnCastFires = times the on-cast Tangent dispatcher fired (= casts)
  const [universeSidewaysTelemetry, setUniverseSidewaysTelemetry] = useState({
    casts: 0, totalDamage: 0, tangentOnCastFires: 0,
  });

  // v2.52: DRUNKEN STAGGER — jnsq's chaotic defense. `staggerActive` is set by
  // the "sorry, I lost my balance for a second," skill and persists until the
  // start of the next player turn (cleared at the very end of endTurn, AFTER
  // applyEnemyIntent has had its chance to roll dodges). Per-swing 50% roll
  // happens inside applyEnemyIntent's attack/attack-multi branch. Telemetry:
  // plays = skill plays, missesAvoided = swings that fully missed thanks to
  // stagger, damageAvoided = total raw damage prevented (post-multipliers,
  // pre-block — the swing simply zeroes out).
  const [staggerActive, setStaggerActive] = useState(false);
  const [staggerTelemetry, setStaggerTelemetry] = useState({ plays: 0, missesAvoided: 0, damageAvoided: 0 });

  // Tutorial — when active, a scripted Bursar fight teaches the verbal
  // combat system step-by-step. Step advances on specific player actions
  // (see advanceTutorialStep). `tutorialActive` short-circuits onEnemyDefeated
  // and applyDamageToPlayer's KO path so the player can learn safely.
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  // v2.71: which lane the player is practicing — drives lane-specific
  // step content in TutorialOverlay (signature mechanic explainer).
  const [tutorialLane, setTutorialLane] = useState('wit');

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

  // v2.71: per-wizard practice match. Tutorial is now lane-aware —
  // forced hand pulls 2 intros + 1 subject + 1 target + Defend from
  // the player's chosen lane so the practice combat actually teaches
  // THEIR lane's spell shape. Called from the character-select "Practice
  // match" button with the selected character's lane.
  const TUTORIAL_HANDS = {
    wit: {
      hand: ['wv2-i-frankly', 'wv2-i-actually', 'wv2-s-your-conclusion', 'wv2-t-shows', 'c-defend'],
      deck: ['wv2-i-honestly', 'wv2-s-this-argument', 'wv2-t-what-i-expected', 'c-compose'],
    },
    chutzpah: {
      hand: ['cv2-i-look', 'cv2-i-listen-pal', 'cv2-s-this-nonsense', 'cv2-t-stops-now', 'c-defend'],
      deck: ['cv2-i-hey-now', 'cv2-s-your-attitude', 'cv2-t-is-over', 'c-compose'],
    },
    jnsq: {
      hand: ['jv2-i-speaking-of', 'jv2-i-astrally', 'jv2-s-your-aura', 'jv2-t-wrong-color', 'c-defend'],
      deck: ['jv2-i-on-a-tuesday', 'jv2-s-the-moon', 'jv2-t-owes-nothing', 'c-compose'],
    },
  };
  function startTutorial(lane = 'wit') {
    const setup = TUTORIAL_HANDS[lane] || TUTORIAL_HANDS.wit;
    setSelectedCharacter(CHARACTERS.find(c => c.lane === lane) || null);
    setMaxHp(STARTING_MAX_HP);
    setHp(STARTING_MAX_HP);
    setComposureMax(STARTING_MAX_COMPOSURE);
    setComposure(STARTING_MAX_COMPOSURE);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
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
    setTutorialLane(lane);
    pushLog(`🎓 Practice match — ${lane} wizard vs the Bursar.`);
    enterFight('tutorial-bursar', { forcedHand: setup.hand, forcedDeck: setup.deck });
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
    setSelectedCharacter(null);
    // v2.71: return to character-select (was menu). After practice match
    // the player needs to actually pick a wizard for the real run.
    setStage('character-select');
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
    setSupplyOffers(null);
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
    // v2.8: STS-style 1-of-3. Build three offers from three different
    // categories so each option feels meaningfully distinct.
    const lanePool = LANE_POOL[c.lane] || [];
    // Card: a strong lane uncommon — picking it commits to lane identity.
    // v2.61: apply isInterestingReward filter — never offer a vanilla
    // 2-stat uncommon as the starting card. The offer should bring a
    // real mechanic or scaling upgrade.
    const starterIds = buildStarterDeckForLane(c.lane);
    const uncommons = lanePool.filter(card =>
      card.rarity === 'uncommon' &&
      !starterIds.includes(card.id) &&
      isInterestingReward(card)
    );
    const cardOffer = uncommons.length > 0
      ? uncommons[Math.floor(Math.random() * uncommons.length)]
      : null;
    // Relic: any common relic. Reuses the existing RELICS table.
    const commonRelics = RELICS.filter(r => r.rarity === 'common');
    const relicOffer = commonRelics.length > 0
      ? commonRelics[Math.floor(Math.random() * commonRelics.length)]
      : null;
    // Boon: a permanent stat tweak.
    const boonOffer = SHOP_BOONS[Math.floor(Math.random() * SHOP_BOONS.length)];
    setSupplyOffers({ card: cardOffer, relic: relicOffer, boon: boonOffer });
    setStage('supply-shop');
    pushLog(`🏘 You set out from the school. Town first.`);
  }

  function pickSupplyOffer(kind) {
    if (!supplyOffers) return;
    const offer = supplyOffers[kind];
    if (!offer) return;
    if (kind === 'card') {
      setDeck(d => [...d, { ...offer, uid: uid() }]);
      pushLog(`🛒 Pocketed: ${offer.name || offer.phrase}.`);
      logEvent(TE.STARTING_PICK, { kind: 'card', cardId: offer.id, cardName: offer.name, type: offer.type, rarity: offer.rarity });
    } else if (kind === 'relic') {
      setRelics(r => [...r, offer]);
      pushLog(`🛒 Strapped on: ${offer.name}.`);
      logEvent(TE.STARTING_PICK, { kind: 'relic', relicId: offer.id, relicName: offer.name, rarity: offer.rarity });
    } else if (kind === 'boon') {
      if (offer.apply === 'maxHpPlus10') {
        setMaxHp(m => m + 10);
        setHp(_ => STARTING_MAX_HP + 10);
      } else if (offer.apply === 'maxCompPlus10') {
        setComposureMax(m => m + 10);
        setComposure(_ => STARTING_MAX_COMPOSURE + 10);
      } else if (offer.apply === 'sturdy') {
        setMaxHp(m => m + 5);
        setHp(h => h + 5);
        setComposureMax(m => m + 5);
        setComposure(c => c + 5);
      }
      pushLog(`🛒 Took the boon: ${offer.name}.`);
      logEvent(TE.STARTING_PICK, { kind: 'boon', boonId: offer.id, boonName: offer.name });
    }
    setSupplyOffers(null);
    setStage('familiar-shop');
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
    // School-granted Master Hat on entry to the final act. The hat slot
    // is no longer a player-crafted equipment — the school provides it
    // as part of graduation outfitting before the deep-forest journey.
    if (nextIdx === ACTS.length - 1) {
      const hat = { ...EQUIPMENT.hat.master, uid: uid() };
      setEquipment(prev => [...prev, hat]);
      applyEquipmentMaxHp(hat);
      pushLog(`🎓 The school sends a runner: "${hat.name} — provided by the bursar's office. Don't lose it."`);
    }
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
      // v2.85: was silently picking 1 random card. Now picks 2 candidates
      // (prefer non-starters) and surfaces a modal so the player chooses
      // which to forget. The chosen card is removed in
      // resolveForgetTwoChoice; the unchosen card stays. Auto-handles
      // edge cases: 0 cards → no-op; 1 card → auto-discard with log.
      const indexed = deck.map((c, i) => ({ c, i }));
      const nonStarters = indexed.filter(({ c }) => !STARTER_DECK.includes(c.id));
      const pool = nonStarters.length > 0 ? nonStarters : indexed;
      if (pool.length === 0) {
        logBits.push(`(no cards to forget)`);
      } else if (pool.length === 1) {
        const only = pool[0];
        setDeck(d => d.filter(c => c.uid !== only.c.uid));
        logBits.push(`− ${only.c.name} (only card available)`);
      } else {
        // Pick 2 distinct candidates (Fisher-Yates is overkill — sort+slice).
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const choices = shuffled.slice(0, 2).map(x => x.c);
        setForgetTwoPrompt({ cards: choices });
        logBits.push(`✋ Choose one to forget…`);
      }
    }
    const grantCardOf = (rarity) => {
      // v2.60: event grants respect lane AND exclude starter-deck cards
      // (same as combat rewards). isInterestingReward applies inside
      // pickCardByRarity — no vanilla stat-pumps.
      const lane = selectedCharacter?.lane || null;
      const starterIds = lane ? buildStarterDeckForLane(lane) : [];
      const c = pickCardByRarity({ [rarity]: 1 }, starterIds, lane);
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
    const e = { ...tmpl, annotation: null }; // v2.10: fresh annotation slot per combat
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
    setPeekedNextIntent(null);
    // Powers don't persist between combats.
    setPowers([]);
    // Reset per-combat counters and player debuffs.
    setTray(initialV2Tray());
    setAmplifyPlaysThisCombat(0);
    setCastsThisTurn(0);
    setCastsThisCombat(0);
    setStakeAmount(0);
    setRollOptIn(false);
    setLastRoll(null);
    setCombatRolls([]);
    // v2.24: chutzpah tunnel-vision meter and RAGE state reset per combat.
    setTunnelVision(0);
    setRageActive(false);
    // v2.34: wit LONG THREAD — meter + per-turn flags reset per combat.
    setLongThread(0);
    setUnblockedThisTurn(false);
    setCastWitEffectThisTurn(false);
    // v2.35: FOOTNOTE prompt — never persists between combats. Card
    // instances are rebuilt at combat start (uids re-issued, footnotes
    // reset to 0 implicitly since no skill has fired yet).
    setFootnotePromptActive(false);
    // v2.36: ACTUALLY— state. lastCastSnapshot starts null (no casts yet);
    // arguingBackThisTurn starts 0. Both never persist between combats.
    setLastCastSnapshot(null);
    setArguingBackThisTurn(0);
    // v2.37: HOLD ON — reactive interrupt flag + snapshot reset per combat.
    setHoldOnArmed(false);
    setHoldOnValue(0);
    // v2.38: SAYING SOMETHING WRONG — pending tokens reset per combat. The
    // delay/consequence loop is intra-combat only; a misstep doesn't carry
    // across fights (the apprentice gets a fresh slate when the next enemy
    // walks in).
    setPendingMissteps([]);
    // v2.39: OPENING STATEMENT — combat turn counter reset to 1 (first turn)
    // and any extend-opening flag from a previous combat cleared. The "to
    // revisit my opening point," skill is intra-combat only; no carry.
    setCombatTurn(1);
    setOpeningExtended(false);
    // v2.25: chutzpah corner-token counter resets per combat.
    setCornerTokens(0);
    // v2.29: chutzpah saying-it-louder counter resets per combat (and per turn).
    setLoudCount(0);
    // v2.26: chutzpah hidden-intent flag resets per combat.
    setIntentHidden(false);
    stormOutFiredRef.current = false;
    // v2.27: chutzpah Hit Me Again — power install + charges reset.
    setHitMeAgainInstalled(false);
    setHitMeAgainCharges(0);
    // v2.46: jnsq WON'T SHUT UP — commitment flag clears per combat. Per-
    // turn clear lives in endTurn (with the damage/dodge accounting).
    setWontShutUpArmed(false);
    // v2.48: jnsq AWKWARD PAUSE — both pause flags clear per combat. The
    // mechanic is intra-combat only; a doubled cast doesn't carry forward.
    setPauseHeld(false);
    setPauseHeldActive(false);
    // v2.52: jnsq DRUNKEN STAGGER — defensive flag clears per combat. The
    // dodge window is intra-turn / intra-combat only.
    setStaggerActive(false);
    // v2.40: wit PATIENCE — install flag + stacks reset per combat.
    setPatienceInstalled(false);
    setPatienceStacks(0);
    // v2.33: chutzpah Not Listening — pending absorb charges reset per combat.
    setNotListeningCharges(0);

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
    // v2.9: Rabbit's startCombatPoise — combat-start composure shield.
    const startPoiseTotal = effectSources().reduce(
      (s, x) => s + (x.effect?.startCombatPoise || 0), 0);
    setBlock(startBlockTotal);
    setPoise(startPoiseTotal);
    setEnergy(energyPerTurnRefill() + startEnergyBonus);
    // v2.9: Beetle's firstHitReduction — one-shot per combat. Tracked
    // on a state flag consumed by the enemy intent handler.
    const firstHitReduction = effectSources().reduce(
      (s, x) => s + (x.effect?.firstHitReduction || 0), 0);
    setBeetleAbsorb(firstHitReduction);
    // v2.16: wit characters open every combat with a stub annotation
    // already attached. Fixes the act-0/1 floor problem — wit's slow
    // burn was dying before BURST could ever fire. The remark is
    // *already written down*.
    if (selectedCharacter?.lane === 'wit') {
      setEnemy(prevE => prevE ? {
        ...prevE,
        annotation: {
          id: 'wv2-ann-cited',
          name: 'Cited in passing',
          phrase: '*[cited]',
          effect: { damageOnTurnEnd: 1 },
          turnsRemaining: 2,
          stub: true,
        },
      } : prevE);
      pushLog(`📝 You arrive having already taken notes.`);
    }

    if (opts.forcedHand && opts.forcedDeck) {
      // Tutorial path: deterministic deck + hand. Skip shuffle entirely.
      setHand(opts.forcedHand.map(id => ({ ...CARDS_BY_ID[id], uid: uid() })));
      setDeck(opts.forcedDeck.map(id => ({ ...CARDS_BY_ID[id], uid: uid() })));
      setDiscard([]);
    } else {
      const fullDeck = [...deck, ...hand, ...discard];
      // v2.13: jnsq +1 hand size at combat start (chaos dice need full
      // trays to roll). Real-play impact only — sim AI runs both ways.
      const jnsqBonus = selectedCharacter?.lane === 'jnsq' ? 1 : 0;
      const drawn = drawFromPiles(shuffle(fullDeck), [], HAND_SIZE + startHandBonus + startDrawBonus + jnsqBonus);
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
    // v2.46: WON'T SHUT UP — clear the commitment flag when ANY jnsq-lane
    // card is played AFTER the rider armed. The arming itself happens in
    // castV2SentenceSpell (the soup target's cast), which fires AFTER the
    // playCard splice that staged the target — so the soup card's own play
    // can't clear the flag (armed is still false at that moment). Any
    // subsequent jnsq play (word, modifier, skill) counts as "kept going".
    if (wontShutUpArmed && card.lane === 'jnsq') {
      setWontShutUpArmed(false);
      setWontShutUpTelemetry(t => ({ ...t, dodges: t.dodges + 1 }));
      pushLog(`🗣 ...kept going.`);
      logEvent('jnsq.wontShutUp.dodge', {
        cardId: card.id, enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    if (card.id === 'c-amplify') setAmplifyPlaysThisCombat(n => n + 1);
    logEvent(TE.CARD_PLAY, { cardId: card.id, cardName: card.name, type: card.type, cost, energyBefore: energy, handSize: hand.length, enemyId: enemy?.id });
    const logBits = [card.name];

    // Powers don't apply effects directly — they install themselves on the
    // player's `powers` array and trigger via the turn-hooks instead.
    if (card.type === 'power') {
      setPowers(ps => [...ps, card]);
      setHand(h => h.filter((_, i) => i !== handIdx));
      // v2.27: Hit Me Again — surface a fast-read flag so the per-swing
      // attack-resolution doesn't walk `powers` every hit.
      if (card.installPower?.id === 'hit-me-again' || card.id === 'cv2-p-hit-me-again') {
        setHitMeAgainInstalled(true);
      }
      // v2.40: PATIENCE — surface a fast-read flag for the end-of-turn +
      // cast-resolution hooks.
      if (card.installPower?.id === 'patience' || card.id === 'wv2-p-patience') {
        setPatienceInstalled(true);
      }
      // v2.47: DRUNKEN CONFIDENCE — telemetry-only install count. The read
      // path is `powers.some(p => p.installPower?.id === 'drunken-confidence')`
      // wherever the +50% cast bonus / +2 incoming penalty applies.
      if (card.installPower?.id === 'drunken-confidence' || card.id === 'jv2-p-hold-my-drink') {
        setDrunkenTelemetry(t => ({ ...t, installs: t.installs + 1 }));
        logEvent('jnsq.drunken.install', { enemyId: enemy?.id, enemyTier: enemy?.tier });
      }
      // v2.49: BABBLING — telemetry-only install count. The cap-lift + 0.6×
      // 2nd-cast scaling read `powers.some(p => p.installPower?.id ===
      // 'babbling')` in castStagedSpell and in the MAX_CASTS prop derivation.
      if (card.installPower?.id === 'babbling' || card.id === 'jv2-p-wait-and-another-thing') {
        setBabblingTelemetry(t => ({ ...t, installs: t.installs + 1 }));
        logEvent('jnsq.babbling.install', { enemyId: enemy?.id, enemyTier: enemy?.tier });
      }
      pushLog(`📿 ${card.name} — power active.`);
      return;
    }

    // v2.24: tunnel-vision +1 helper. Bumps the meter when a chutzpah-lane
    // card lands a successful stage. Does NOT fire on refunds — the staging
    // outcome (replace, success) calls this AFTER the new card is committed.
    const bumpTunnelVisionIfChutzpah = () => {
      if (card.lane === 'chutzpah') setTunnelVision(n => n + 1);
      // v2.29: saying-it-louder. Chutzpah word cards (intro/subject/modifier)
      // with the 'demanding' tag are the repetition beats. Targets don't
      // count — they consume loudCount, they don't add to it.
      if (card.lane === 'chutzpah'
          && (card.slot === 'intro' || card.slot === 'subject' || card.slot === 'modifier')
          && (card.tags || []).includes('demanding')) {
        setLoudCount(n => n + 1);
      }
    };
    // v2.24: target-side guard. "Bare knuckles." (and any future card with
    // `requiresRage: true`) is castable only while RAGE is active.
    if (card.slot === 'target' && card.effect?.requiresRage && !rageActive) {
      setEnergy(e => e + (card.cost || 0));
      pushLog(`🔥 ${card.phrase || card.name} needs RAGE — chutzpah isn't there yet.`);
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
      bumpTunnelVisionIfChutzpah();
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
      // v2.41: footnoteSelfOnStage — the staged instance gains +1 footnote on
      // itself before it lands in the tray. Self-referential rhetorical move;
      // the cast immediately reads the bumped stat through computeSpellDamage's
      // footnote-aware stat sum. Bumps the in-tray copy only — the source
      // card object in hand (already removed via setHand below) doesn't
      // need updating.
      const stagedCard = card.effects?.footnoteSelfOnStage
        ? { ...card, footnotes: (card.footnotes || 0) + 1 }
        : card;
      setTray(p => syncTrayLegacy({ ...p, modifiers: [...(p.modifiers || []), stagedCard] }));
      applySideEffects(card.effects || {}, logBits);
      if (card.effects?.footnoteSelfOnStage) {
        logBits.push(`📖 self-footnoted (+1 wit on this card)`);
      }
      setHand(h => h.filter((_, i) => i !== handIdx));
      bumpTunnelVisionIfChutzpah();
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
      bumpTunnelVisionIfChutzpah();
      pushLog(`🎯 Target staged: ${card.phrase} — hit CAST when ready.`);
      return;
    }

    // v2.5: GESTURE slot — fires immediate damage and exhausts. Bypasses
    // the tray entirely. The "I just hit them" attack archetype:
    // hand gestures, shouts, familiar interjections.
    // v2.10: ANNOTATION — wit-only. Attaches to enemy as a persistent
    // debuff (3-4 turns). One slot per enemy; new ones overwrite. The
    // card itself goes to discard (cycles like a skill card). Annotations
    // don't enter the tray and don't count against the cast cap.
    if (card.slot === 'annotation') {
      if (!enemy) return;
      const prev = enemy.annotation;
      if (prev) pushLog(`📝 The old note (${prev.name}) is overwritten.`);
      setEnemy(e => e ? {
        ...e,
        annotation: {
          id: card.id, name: card.name, phrase: card.phrase,
          effect: card.annotationEffect || {},
          turnsRemaining: card.duration || 3,
        },
      } : e);
      pushLog(`📝 Annotated ${enemy.name}: ${card.phrase}`);
      // NOTE: energy was already deducted by playCard's outer gate.
      setDiscard(d => [...d, card]);
      setHand(h => h.filter((_, i) => i !== handIdx));
      return;
    }
    if (card.slot === 'gesture') {
      const ge = card.gestureEffect || {};
      const lane = card.lane || 'wit';
      const trayStat = tray[lane] || 0;
      const trayBonus = trayStat * (ge.trayMultiplier || 0);
      let dmg = (ge.damage || 0) + trayBonus;
      const dmgType = ge.damageType || 'composure';
      const mult = (dmgType === 'physical')
        ? (enemy?.effectiveness?.physical ?? 1.0)
        : (enemy?.effectiveness?.[lane] ?? 1.0);
      dmg = Math.round(dmg * mult * playerDmgMult);
      pushLog(`${ge.icon || '✊'} ${card.phrase || card.name} → ${dmg} ${dmgType === 'physical' ? 'phys' : 'comp'}`);
      if (dmgType === 'physical') applyDamageToEnemyHp(dmg);
      else                        applyDamageToEnemyComposure(dmg);
      // Apply riders (weak/vulnerable on the enemy).
      if (ge.rider?.weak)       { adjustEnemyDmg(-0.25 * ge.rider.weak);  pushLog(`💢 enemy −${25*ge.rider.weak}% atk`); }
      if (ge.rider?.vulnerable) { adjustPlayerDmg(+0.25 * ge.rider.vulnerable); pushLog(`🩸 enemy Vulnerable +${ge.rider.vulnerable} (your spells +${25*ge.rider.vulnerable}%)`); }
      if (ge.rider?.block)      { setBlock(b => b + ge.rider.block); pushLog(`🛡 +${ge.rider.block}`); }
      if (ge.draw) drawCards(ge.draw);
      if (ge.stripEnemyBlock)   { setEnemyBlock(b => Math.max(0, b - ge.stripEnemyBlock)); pushLog(`🛇 Stripped ${ge.stripEnemyBlock} enemy block.`); }
      // Exhaust by default — gestures are one-shot per acquisition.
      if (ge.exhaust !== false) setExiled(ex => [...ex, card]);
      else                      setDiscard(d => [...d, card]);
      setHand(h => h.filter((_, i) => i !== handIdx));
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

    // v2.38: SAYING SOMETHING WRONG — Misstep token manual discard. The
    // token enters the regular skill-play path; we intercept here to log
    // the "took it back" choice cleanly and add telemetry. The token's
    // `exhaust: true` flag routes it to exiled via the standard path
    // below, so we fall through after the log + event.
    if (card.id === MISSTEP_TOKEN.id) {
      pushLog(`📜 Misstep discarded (1 Energy spent). The room moves on.`);
      logEvent('wit.missTepDiscarded', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
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

  // v2.12: CHAOS DICE outcome table. Indexed 1-6. EV ~+4% damage,
  // tuned post-sim to keep jnsq from leaping past chutzpah's risk-reward
  // identity.
  const CHAOS_OUTCOMES = {
    1: { name: 'BACKFIRE',   dmgMult: 0.5,  hpDelta: -3, draw: 0, energyNext: 0, vuln: 0, discardRandom: 0 },
    2: { name: 'SPILLED IT', dmgMult: 1.0,  hpDelta: 0,  draw: 0, energyNext: 0, vuln: 0, discardRandom: 1 },
    3: { name: 'HALF-BAKED', dmgMult: 0.75, hpDelta: 0,  draw: 0, energyNext: 1, vuln: 0, discardRandom: 0 },
    4: { name: 'STICKS',     dmgMult: 1.0,  hpDelta: 0,  draw: 1, energyNext: 0, vuln: 0, discardRandom: 0 },
    5: { name: 'SINGS',      dmgMult: 1.25, hpDelta: 0,  draw: 1, energyNext: 0, vuln: 0, discardRandom: 0 },
    6: { name: 'COSMIC',     dmgMult: 1.75, hpDelta: 0,  draw: 2, energyNext: 0, vuln: 1, discardRandom: 0 },
  };

  // v2.12: roll a chaos die. Applies intro reroll-on-1/2 and modifier
  // diceShift if present. Returns 1-6.
  function rollChaosDie(intro, modifiers) {
    let roll = 1 + Math.floor(Math.random() * 6);
    const shift = (modifiers || []).reduce((s, m) => s + (m?.modifierEffect?.diceShift || 0), 0);
    roll = Math.min(6, Math.max(1, roll + shift));
    // Reroll low rolls if intro permits ("I have a feeling about this —").
    const rerollList = intro?.diceReroll?.onResults;
    if (rerollList && rerollList.includes(roll)) {
      const reroll = 1 + Math.floor(Math.random() * 6);
      roll = Math.min(6, Math.max(1, reroll + shift));
    }
    return roll;
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

    // Damage formula handled in shared/cards/shared.js. Pass world state
    // so v2.5 scaling mechanics (perDiscardCard, perDeckCard,
    // missingHpBonus) can read current values.
    // v2.12: roll chaos die if opt-in OR if any staged card forces it.
    const forceRoll = modifiers.some(m => m?.modifierEffect?.forceRoll) ||
                      target.effect?.alwaysRolls === true;
    const willRoll = (rollOptIn || forceRoll);
    let chaosRoll = null;
    let chaosOutcome = null;
    if (willRoll) {
      chaosRoll = rollChaosDie(intro, modifiers);
      chaosOutcome = CHAOS_OUTCOMES[chaosRoll];
      setLastRoll(chaosRoll);
      setCombatRolls(rs => [...rs, chaosRoll]);
      logEvent('jnsq.roll', {
        result: chaosRoll, outcome: chaosOutcome.name,
        forced: forceRoll, enemyId: enemy?.id,
      });
      // v2.13: intro diceDraw — "I have a feeling about this —"
      // becomes a sustain card.
      const diceDraw = intro?.diceDraw || 0;
      if (diceDraw > 0) {
        drawCards(diceDraw);
        pushLog(`📥 +${diceDraw} draw (rolling)`);
      }
    }

    // v2.50: BABBLING isSecondCast — computed BEFORE the ctx so the
    // doubleOnSecondCast rider can fire inside computeSpellDamage. Mirrors the
    // check at the damage-multiplier site below (line ~5040): castsThisTurn
    // hasn't been incremented for THIS cast yet, so 1 means "this is the 2nd".
    const ctxBabblingInstalled = powers.some(p => p.installPower?.id === 'babbling' || p.id === 'jv2-p-wait-and-another-thing');
    const ctxIsSecondCast = ctxBabblingInstalled && castsThisTurn === 1;
    const ctx = {
      discardSize: discard.length,
      deckSize: deck.length + hand.length + discard.length + exiled.length,
      missingHpFrac: maxHp > 0 ? (maxHp - hp) / maxHp : 0,
      stakeAmount, // v2.11: chutzpah ALL IN
      loudCount, // v2.29: chutzpah SAYING IT LOUDER
      // v2.30: chutzpah SMELL WEAKNESS — predator rider reads enemy debuff state
      playerDmgMult, enemyDmgMult,
      // v2.34: wit LONG THREAD — threadScaling targets read this for +N × LT
      longThread,
      // v2.39: wit OPENING STATEMENT — openingBonus targets read combatTurn
      // (firstTurn = 1) AND openingExtended (the "to revisit my opening point,"
      // skill bridges a later turn back into the opening).
      combatTurn, openingExtended,
      // v2.42: wit INSULT VULNERABILITIES — pierceVulnerableInsult targets
      // read the enemy's list of vulnerable tags. Default to [] if the enemy
      // has none — rider just won't fire.
      insultVulnerabilities: enemy?.insultVulnerabilities || [],
      // v2.48: AWKWARD PAUSE — if pauseHeldActive is armed (player held +
      // queued the doubling last turn), every staged-card stat contribution
      // doubles for THIS cast. Flag is cleared post-cast (single-use).
      pauseDoubled: pauseHeldActive,
      // v2.50: BABBLING 2nd-cast flag — doubleOnSecondCast targets fire here.
      isSecondCast: ctxIsSecondCast,
    };
    const { damage: rawDamage, tier, riders, flippedDmgType, sideEffects, stakeBonus, loudBonus, predatorBonus, threadBonus, footnoteBonus, openingBonus, insultBonus, insultMatches, insultMatchedTags } =
      computeSpellDamage(intro, subject, target, modifiers, ctx);
    // v2.48: AWKWARD PAUSE — compute the doubling delta for telemetry by
    // re-running the formula WITHOUT the doubling. Only when actually paused.
    let pauseDelta = 0;
    if (pauseHeldActive) {
      const singleResult = computeSpellDamage(intro, subject, target, modifiers, { ...ctx, pauseDoubled: false });
      pauseDelta = Math.max(0, rawDamage - singleResult.damage);
      pushLog(`🤫 AWKWARD PAUSE → staged stats doubled (+${pauseDelta} dmg over single).`);
      setAwkwardPauseTelemetry(t => ({
        doubledCasts: t.doubledCasts + 1,
        doubledExtraDamage: t.doubledExtraDamage + pauseDelta,
        pauses: t.pauses,
      }));
      logEvent('jnsq.awkwardPause.cast', {
        bonusDamage: pauseDelta,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
      setPauseHeldActive(false);
    }
    // v2.29: SAYING IT LOUDER — surface the bonus in the log when it applied.
    if (loudBonus > 0) {
      pushLog(`📢 SAID IT LOUDER ×${loudCount} → +${loudBonus} dmg`);
      logEvent('chutzpah.loud', {
        loudCount, bonusDamage: loudBonus,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.30: SMELL WEAKNESS — surface the predator rider when it fired.
    if (predatorBonus > 0) {
      pushLog(`🩸 PREDATOR — enemy debuffed → +${predatorBonus} dmg`);
      logEvent('chutzpah.predator', {
        bonusDamage: predatorBonus,
        playerDmgMult, enemyDmgMult,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.34: LONG THREAD — surface the thread-scaling bonus when it fired.
    if (threadBonus > 0) {
      pushLog(`🧵 LONG THREAD ×${longThread} → +${threadBonus} dmg`);
      logEvent('wit.thread', {
        longThread, bonusDamage: threadBonus,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.35: FOOTNOTE — surface the stat-rider bonus when it fired. Each
    // footnote unit feeds through statTotal → eff.multiplier × tierMult.
    if (footnoteBonus > 0) {
      pushLog(`📖 FOOTNOTE → +${footnoteBonus} dmg`);
      logEvent('wit.footnote.cast', {
        bonusDamage: footnoteBonus,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.39: OPENING STATEMENT — surface the bonus when it fired AND consume
    // the extend flag if it was the bridge that made this cast count. The
    // flag drops on every wit target cast (whether the bonus actually applied
    // or not — a wit target without `openingBonus` still spends the bridge).
    if (openingBonus > 0) {
      const viaExtended = openingExtended && combatTurn !== 1;
      pushLog(`🎩 OPENING STATEMENT → +${openingBonus} dmg${viaExtended ? ' (revisited)' : ''}`);
      logEvent('wit.opening', {
        bonusDamage: openingBonus,
        combatTurn, viaExtended,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.42: INSULT VULNERABILITIES — surface tag-match bonus when it fired.
    // matchedTags surfaces WHICH tags landed so the player can read the
    // enemy correctly next time.
    if ((insultBonus || 0) > 0) {
      const tagList = (insultMatchedTags || []).slice(0, 3).join(', ');
      pushLog(`🎯 INSULT HIT (${tagList}) → +${insultBonus} dmg`);
      logEvent('wit.insult', {
        bonusDamage: insultBonus,
        matchCount: insultMatches,
        matchedTags: insultMatchedTags,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.34: any wit-lane target that resolves counts as casting a wit
    // Effect this turn — the player has "stayed on topic". End-of-turn
    // checks this together with unblockedThisTurn to tick the thread.
    if (target.lane === 'wit') {
      setCastWitEffectThisTurn(true);
      // v2.39: a wit target cast consumes the extend flag if armed. We clear
      // even when the target had no openingBonus (the bridge was spent the
      // moment you brought the room back to the opening). On turn 1 the flag
      // is mostly redundant (turn-1 already triggers the bonus), but we
      // still consume so a future cast doesn't double-dip.
      if (openingExtended) setOpeningExtended(false);
    }
    // Reset loudCount — the cast consumes the build-up. Future demanding
    // words in the same turn would re-arm if a second cast were possible,
    // but the cast cap is 1/turn so this is mostly a sanity reset.
    if (target.effect?.loudScaling) setLoudCount(0);
    // v2.11: deduct HP for stake immediately on cast. Refund (if any)
    // happens after damage lands.
    if (stakeAmount > 0) {
      setHp(h => Math.max(1, h - stakeAmount));
      pushLog(`💢 ALL IN: -${stakeAmount} HP → +${stakeBonus || 0} dmg`);
      logEvent('chutzpah.stake', {
        stakeAmount, bonusDamage: stakeBonus || 0,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }

    // Read-the-Room pierce + enemy effectiveness still applies.
    const eff = target.effect || {};
    const stat = eff.scaleBy || target.lane || 'wit';
    const piercing = pierceNextCast;
    if (piercing) setPierceNextCast(false);
    // v2.6: damageTypeFlip from "words to actions"-style modifiers.
    const dmgType = flippedDmgType || eff.damageType || 'composure';
    const enemyMult = piercing ? 1.0 : (enemy?.effectiveness?.[stat] ?? 1.0);
    const physMult = piercing ? 1.0 : (enemy?.effectiveness?.physical ?? 1.0);
    let dmg = rawDamage;
    if (dmgType === 'physical') dmg = Math.round(dmg * physMult);
    else                        dmg = Math.round(dmg * enemyMult);
    dmg = Math.round(dmg * playerDmgMult);
    // v2.47: DRUNKEN CONFIDENCE — +50% damage on every Effect/Spell cast
    // while the power is installed. Applied AFTER playerDmgMult so it
    // composes naturally with Vulnerable / Weak / annotation potency.
    // Reads the powers array directly (no fast-flag — install/uninstall
    // happen often enough that the per-cast walk is fine).
    const drunkenInstalled = powers.some(p => p.installPower?.id === 'drunken-confidence' || p.id === 'jv2-p-hold-my-drink');
    // v2.49: BABBLING — 2nd cast of the turn scales to 60% damage. Read
    // castsThisTurn directly; at this point the setter for THIS cast has been
    // queued but not flushed, so castsThisTurn === 1 means "this is the 2nd
    // cast." Applied AFTER drunken's +50% so the trade-offs compose cleanly:
    // 1.5 * 0.6 = 0.9× on a 2nd cast under both powers.
    const babblingInstalled = powers.some(p => p.installPower?.id === 'babbling' || p.id === 'jv2-p-wait-and-another-thing');
    const isSecondCast = babblingInstalled && castsThisTurn === 1;
    if (drunkenInstalled) {
      const preDrunk = dmg;
      dmg = Math.round(dmg * 1.5);
      const bonus = dmg - preDrunk;
      if (bonus > 0) {
        setDrunkenTelemetry(t => ({ ...t, castBonus: t.castBonus + bonus }));
        pushLog(`🍺 DRUNKEN CONFIDENCE → +${bonus} dmg (×1.5)`);
        logEvent('jnsq.drunken.castBonus', {
          bonusDamage: bonus, enemyId: enemy?.id, enemyTier: enemy?.tier,
        });
      }
    }
    // v2.12: chaos dice damage multiplier. Stronger if "is going to go
    // interesting." target is staged (1.5× the roll's effect — so a 1.5
    // becomes 1.75, a 2.0 becomes 2.5, etc.).
    if (chaosOutcome) {
      const scale = target.effect?.rollDamageScale || 1.0;
      // Scale the deviation from 1.0 by `scale` so a 0.5 becomes 0.5,
      // a 1.5 becomes (1 + 0.5*scale), a 2.0 becomes (1 + 1.0*scale).
      const effectiveMult = 1.0 + (chaosOutcome.dmgMult - 1.0) * scale;
      dmg = Math.round(dmg * effectiveMult);
      pushLog(`🎲 ROLLED ${chaosRoll} — ${chaosOutcome.name} (×${effectiveMult.toFixed(2)} dmg)`);
    }
    // v2.10: annotation bonusSpellDamage adds AFTER all multipliers
    // (so the +3 is a flat bonus, not amplified by tier multipliers).
    const annBonus = annoFx('bonusSpellDamage');
    if (annBonus > 0) dmg += annBonus;
    // v2.15: wit BURST — Cash In annotation for damage = turns × N.
    // Captures annotation turns BEFORE auto-attach can fire (we'll
    // clear/exile the annotation in the post-damage block below).
    const cashIn = target.effect?.cashInAnnotation;
    let cashedTurns = 0;
    if (cashIn && enemy?.annotation) {
      cashedTurns = enemy.annotation.turnsRemaining || 0;
      const cashBonus = cashedTurns * (cashIn.damagePerTurn || 0);
      dmg += cashBonus;
      pushLog(`📝 Cash-in: ${cashedTurns} turn${cashedTurns === 1 ? '' : 's'} → +${cashBonus} dmg`);
    }
    // v2.13: scaling annotation — Thesis-expanded bonus per prior cast.
    const annPerCast = annoFx('bonusSpellDamagePerCast');
    if (annPerCast > 0) dmg += annPerCast * castsThisCombat;
    setCastsThisCombat(c => c + 1);
    // v2.24: RAGE-only target safety net — if a requiresRage target made it
    // to cast time without RAGE active (e.g. the rage turn ended while the
    // card was staged), half-damage + exile-on-resolve. Staging is the
    // primary gate; this is the fallback.
    const rageMissing = !!target.effect?.requiresRage && !rageActive;
    if (rageMissing) {
      dmg = Math.round(dmg * 0.5);
      pushLog(`🔥 ${target.phrase || target.name} fired without RAGE — half damage, exiled.`);
    }
    // v2.26: STORMING OUT — if the target carries stormOut, every remaining
    // energy point AT CAST TIME (after the card's own cost was paid on stage)
    // converts to +bonusPerEnergy damage. The energy burns to zero, the turn
    // ends immediately after damage resolves, and the next intent is hidden.
    const stormOut = !!target.effect?.stormOut;
    const stormOutBonusPerEnergy = target.effect?.bonusPerEnergy || 0;
    const stormOutEnergySpent = stormOut ? energy : 0;
    if (stormOut && stormOutBonusPerEnergy > 0 && stormOutEnergySpent > 0) {
      const bonus = stormOutEnergySpent * stormOutBonusPerEnergy;
      dmg += bonus;
      pushLog(`🚪 STORM OUT — spent ${stormOutEnergySpent} Energy → +${bonus} dmg.`);
    }

    // v2.40: PATIENCE — if installed AND stacks > 0, add stacks × 2 flat
    // damage and clear the counter. The bonus is a flat add (not multiplied
    // by enemy effectiveness or playerDmgMult — already-resolved damage
    // pipeline). One bonus per cast; the next skipped turn starts the bank
    // over from 0.
    let patienceBonusDealt = 0;
    if (patienceInstalled && patienceStacks > 0) {
      patienceBonusDealt = patienceStacks * 2;
      dmg += patienceBonusDealt;
      pushLog(`🌿 Patience spent: +${patienceBonusDealt} damage.`);
      logEvent('wit.patience.spend', {
        stacks: patienceStacks, bonusDamage: patienceBonusDealt,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
      setPatienceStacks(0);
    }

    // Compose + log the full sentence.
    const sentence = composeSpellText(intro, subject, target, modifiers);
    pushLog(`✨ "${sentence}"`);

    // Strip enemy block before damage if modifier requested it.
    if (sideEffects.stripBlock) {
      setEnemyBlock(b => Math.max(0, b - sideEffects.stripBlock));
      pushLog(`🛇 Stripped ${sideEffects.stripBlock} enemy block.`);
    }
    // v2.49: BABBLING — final 0.6× scalar on 2nd cast of the turn. Applied
    // last so it scales the ENTIRE composed damage (drunken, chaos, patience,
    // riders, opening, etc.). Telemetry captures the damage AFTER scaling
    // — that's the actual delivered number, what matters for tuning.
    if (isSecondCast) {
      const preBabble = dmg;
      dmg = Math.round(dmg * 0.6);
      const delta = preBabble - dmg;
      pushLog(`🗯 BABBLING (2nd cast) → ${dmg} dmg (×0.6, -${delta})`);
      setBabblingTelemetry(t => ({ ...t, secondCasts: t.secondCasts + 1, secondCastDamage: t.secondCastDamage + dmg }));
      logEvent('jnsq.babbling.secondCast', {
        damage: dmg, reduction: delta, enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // Apply damage.
    let after = 0;
    if (dmgType === 'physical') after = applyDamageToEnemyHp(dmg);
    else                        after = applyDamageToEnemyComposure(dmg);
    // v2.11: stake refund (from "and I mean it." target). Half the
    // staked HP comes back when the cast lands non-zero damage.
    if (sideEffects.stakeRefundHalf && stakeAmount > 0 && dmg > 0) {
      const refund = Math.floor(stakeAmount / 2);
      if (refund > 0) {
        setHp(h => Math.min(maxHp, h + refund));
        pushLog(`💚 +${refund} HP (stake refund).`);
      }
    }
    // Reset stake — consumed by this cast.
    if (stakeAmount > 0) setStakeAmount(0);
    // v2.15: BURST card exiles the annotation it cashed in.
    if (cashedTurns > 0) {
      setEnemy(e => e ? { ...e, annotation: null } : e);
      pushLog(`📝 The footnote closes.`);
    }
    // v2.15: wit characters auto-attach a STUB annotation when casting
    // into a non-annotated enemy. The stub now does damageOnTurnEnd:1
    // (chip damage every turn) — even casual wit casts leave a sting,
    // and humans who manually attach get the upgraded version.
    // Skip if we just cashed in (don't re-attach what was just exiled).
    if (selectedCharacter?.lane === 'wit' && dmg > 0 && enemy && !enemy.annotation && cashedTurns === 0) {
      setEnemy(e => e ? {
        ...e,
        annotation: {
          id: 'wv2-ann-cited',
          name: 'Cited in passing',
          phrase: '*[cited]',
          effect: { damageOnTurnEnd: 1 },
          turnsRemaining: 2,
          stub: true,
        },
      } : e);
      pushLog(`📝 The remark lingers as a citation.`);
    }
    // v2.12: chaos roll side effects (after damage lands).
    if (chaosOutcome) {
      if (chaosOutcome.hpDelta < 0) {
        setHp(h => Math.max(1, h + chaosOutcome.hpDelta));
        pushLog(`💔 ${chaosOutcome.hpDelta} HP (chaos)`);
      }
      if (chaosOutcome.draw > 0) {
        drawCards(chaosOutcome.draw);
        pushLog(`📥 +${chaosOutcome.draw} draw (chaos)`);
      }
      if (chaosOutcome.discardRandom > 0 && hand.length > 0) {
        // Pick a random non-staged hand card to discard.
        const idx = Math.floor(Math.random() * hand.length);
        const lost = hand[idx];
        setHand(h => h.filter((_, i) => i !== idx));
        setDiscard(d => [...d, lost]);
        pushLog(`💨 Spilled: ${lost.name || lost.phrase} (chaos)`);
      }
      if (chaosOutcome.energyNext > 0) {
        // Granted as an immediate energy bump — the cast already happened
        // so "next turn" semantically means "the next thing you do".
        setEnergy(e => e + chaosOutcome.energyNext);
        pushLog(`⚡ +${chaosOutcome.energyNext} Energy (chaos)`);
      }
      if (chaosOutcome.vuln > 0) {
        adjustPlayerDmg(+0.25 * chaosOutcome.vuln);
        pushLog(`💫 +${25*chaosOutcome.vuln}% potency (cosmic alignment)`);
      }
      // Roll consumed; reset the opt-in toggle.
      setRollOptIn(false);
    }

    const tierLabel = tier === 3 ? 'DEVASTATING' : tier === 2 ? 'RESONANT' : 'COHERENT';
    const dmgTagSuffix = dmgType === 'physical'
      ? `${dmg} phys → ${after} HP${physMult === 0 ? ' (IMMUNE)' : ''}`
      : `${dmg} comp → ${after}${enemyMult === 0 ? ' (IMMUNE)' : enemyMult >= 1.5 ? ' (susceptible)' : enemyMult <= 0.5 ? ' (resistant)' : ''}`;
    pushLog(`🎯 ${tierLabel} (×${TIER_MULTIPLIER[tier] || 1.0}) → ${dmgTagSuffix}`);

    // Riders.
    if (riders.weak)       { adjustEnemyDmg(-0.25 * riders.weak);  pushLog(`💢 enemy −${25*riders.weak}% atk`); }
    if (riders.vulnerable) { adjustPlayerDmg(+0.25 * riders.vulnerable); pushLog(`💫 +${25*riders.vulnerable}% potency`); }
    if (riders.block)      { setBlock(b => b + riders.block); pushLog(`🛡 +${riders.block}`); }

    // Side effects (draw, self-composure cost, self-HP cost).
    if (sideEffects.drawCount) {
      drawCards(sideEffects.drawCount);
      pushLog(`📥 +${sideEffects.drawCount} draw`);
    }
    if (sideEffects.selfComposureCost) {
      setComposure(c => Math.max(0, c - sideEffects.selfComposureCost));
      pushLog(`💔 -${sideEffects.selfComposureCost} composure (self)`);
    }
    if (sideEffects.selfHpCost) {
      setHp(h => Math.max(0, h - sideEffects.selfHpCost));
      pushLog(`🩸 -${sideEffects.selfHpCost} HP (self)`);
    }

    // v2.25: DOUBLING DOWN — bank a corner token when a chutzpah target
    // with `doubleDown: true` resolves a cast. The token bills at end of
    // turn if the enemy is still alive. Counted on RAGE-missing casts too
    // — the cast still resolved (just at half damage), so the bravado
    // happened and the bill comes due.
    if (target.effect?.doubleDown) {
      setCornerTokens(n => n + 1);
      pushLog(`🏚 Backed into a corner: +1 token.`);
    }

    // v2.38: SAYING SOMETHING WRONG — queue a delayed Misstep token. The
    // rider fires on every successful cast of the target (including
    // RAGE-missing casts and tier-3 fails — the words were said either
    // way, the realisation arrives on the same timetable). `turnsRemaining`
    // starts at delay+1 because the endTurn decrement fires BEFORE the
    // delivery check, so an initial value of 2 means "lands two end-of-turns
    // from now" — i.e. delivered to hand at the start of turn N+2.
    if (target.effect?.delayedMisstep) {
      const dm = target.effect.delayedMisstep;
      const delay = dm.delay || 2;
      setPendingMissteps(arr => [...arr, { turnsRemaining: delay, selfDamage: dm.selfDamage || 3 }]);
      pushLog(`📜 A misstep is in motion — lands in ${delay} turn${delay === 1 ? '' : 's'}.`);
      logEvent('wit.missTepQueued', {
        delay, selfDamage: dm.selfDamage || 3,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }

    // v2.36: ACTUALLY— snapshot. Capture intro/subject/target/modifiers plus
    // the ctx that drove damage, BEFORE we discharge the cards. The
    // re-fire path re-calls computeSpellDamage on this snapshot at ×1.5,
    // so the staged-card references must be the SAME objects (footnote
    // riders, tier, tags, etc.) that resolved this cast — not freshly-
    // drawn copies. Snapshot taken on every successful cast (last write
    // wins), reset to null at end-of-turn.
    setLastCastSnapshot({
      intro, subject, target, modifiers,
      ctx, // re-use the same context that drove the original cast
      // Capture the resolved damage path so the re-fire applies through
      // the same effectiveness + pool routing. flippedDmgType wins over
      // eff.damageType when set (modifier-driven physical/composure flip).
      dmgType,
      enemyMult, physMult, // captured AFTER pierce resolved
      // playerDmgMult drifts each turn; capture the value used so the
      // re-fire on the SAME turn matches what the original cast saw.
      playerDmgMult,
    });

    // v2.46: WON'T SHUT UP — arm the commitment flag if the cast's target
    // carries `mustPlayAnotherJnsq`. The flag stays armed until the player
    // plays ANY jnsq-lane card this turn (cleared in playCard), OR end of
    // turn (3 HP penalty in endTurn). Armed on every successful resolve,
    // including RAGE-missing casts and tier-3 fails — the words were said.
    if (target.effect?.mustPlayAnotherJnsq) {
      setWontShutUpArmed(true);
      setWontShutUpTelemetry(t => ({ ...t, armed: t.armed + 1 }));
      pushLog(`🗣 Going on...`);
      logEvent('jnsq.wontShutUp.armed', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }

    // v2.51: TANGENT-ON-CAST — universe-sideways capstone fires the Tangent
    // dispatcher AS PART OF this resolve. Reuses applyEffectsCore's
    // `tangentFire` branch (v2.44) so the discard-from-draw + fire-random-
    // jnsq-from-discard pipeline matches the skill exactly. The tray was
    // just consumed by the capstone itself, so a surfaced target will
    // fizzle (resolveTangentCard guards on missing intro/subject) — that's
    // fine; the chaos is the point. Word/skill surfacing still has value.
    if (target.effect?.tangentOnCast) {
      setUniverseSidewaysTelemetry(t => ({
        ...t,
        tangentOnCastFires: (t.tangentOnCastFires || 0) + 1,
      }));
      pushLog(`🌀 ...and tangentially —`);
      // Defer to setTimeout to avoid running this inside the cast's
      // synchronous setState chain ([[feedback_react_pure_updaters]]).
      const tangentBits = [];
      setTimeout(() => applyEffectsCore({ tangentFire: true }, { logBits: tangentBits }), 0);
    }
    // v2.51: synergy-capstone cast counter (universe-sideways specifically).
    // Tracked alongside the tangent fires so a session report can compute
    // avg damage per capstone cast in-App.
    if (target.id === 'jv2-t-universe-sideways') {
      setUniverseSidewaysTelemetry(t => ({
        ...t,
        casts: (t.casts || 0) + 1,
        totalDamage: (t.totalDamage || 0) + dmg,
      }));
    }

    // Discharge cards. Intro / subject / modifiers → discard. Target →
    // exile if requiresTier3 failed AND exhaustOnFail is set; else discard.
    // v2.24: RAGE-required targets also exile on a rage-missing cast.
    setDiscard(d => [...d, intro, subject, ...modifiers]);
    if (sideEffects.exhaustTarget || rageMissing) setExiled(ex => [...ex, target]);
    else                                          setDiscard(d => [...d, target]);

    setTray(initialV2Tray({ effectFiredThisTurn: true }));
    applyPowerTriggers('onEffectCardPlayed');
    advanceTutorialStep('cast-spell');

    // v2.26: STORMING OUT — burn all remaining energy, hide the next intent,
    // and end the turn IMMEDIATELY. The bonus damage was already applied
    // above; here we close out the turn so no further actions, no block
    // phase, no end-of-turn-draw bonuses fire. The endTurn flow still runs
    // its normal sequence (enemy intent, debuff decay, refill hand) — the
    // ONLY thing we skip is the player's chance to keep acting.
    if (stormOut) {
      setEnergy(0);
      setIntentHidden(true);
      stormOutFiredRef.current = true;
      pushLog(`🚪 Storm out. Door slams. You don't see what comes next.`);
      setTimeout(() => endTurn(), 0);
    }
  }

  function castStagedSpell() {
    if (stage !== 'combat') return;
    // v2.9: enforce per-turn cast cap. Was uncapped, which let a player
    // stage+cast twice in a single turn at 3 energy. Now the second cast
    // is gated until next turn.
    if (castsThisTurn >= MAX_CASTS_PER_TURN) {
      pushLog(`✋ One spell per turn. End your turn to cast again.`);
      return;
    }
    const t = tray;

    // v2 path: intro + subject + target all filled → sentence-engine cast.
    if (t.intro && t.subject && t.target) {
      // v2.11: target may require a minimum stake (e.g. "is a big mistake. Huge.")
      const required = t.target.effect?.requiresStake || 0;
      if (required > 0 && stakeAmount < required) {
        pushLog(`🎯 ${t.target.phrase || t.target.name} requires ${required}+ HP staked.`);
        return;
      }
      // v2.12: target may require a prior 6 ("is the cosmic recoil.").
      const reqRoll = t.target.effect?.requiresPriorRoll || 0;
      if (reqRoll > 0 && !combatRolls.includes(reqRoll)) {
        pushLog(`🎯 ${t.target.phrase || t.target.name} requires a prior ${reqRoll} rolled this combat.`);
        return;
      }
      // v2.15: wit BURST gate — target may require an attached annotation.
      if (t.target.effect?.requiresAnnotation && !enemy?.annotation) {
        pushLog(`🎯 ${t.target.phrase || t.target.name} requires an annotation attached.`);
        return;
      }
      setCastsThisTurn(n => n + 1);
      return castV2SentenceSpell(t);
    }

    if (!t.intro && !t.subject && !t.target) { pushLog('Nothing staged yet — play an intro, subject, and target.'); return; }
    if (!t.target && !t.effectCard) { pushLog('Need a target (the spell-finisher) before you can cast.'); return; }
    if (!t.intro || !t.subject) { pushLog('Need both an intro and a subject before casting.'); return; }
    // Legacy fallback for back-compat event-grant cards: keep older
    // "words + effect" path alive but unreachable in normal v2 play.
    if (!t.effectCard) return;
    if ((t.words || []).length === 0) return;
    setCastsThisTurn(n => n + 1);

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
    // v2.9: poise — composure-pool shield.
    if (fx.poise) {
      setPoise(p => p + fx.poise);
      logBits.push(`🪞 +${fx.poise} Poise`);
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
      logBits.push(`🩸 enemy Vulnerable +${fx.vulnerable} (your spells +${25*fx.vulnerable}%)`);
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
    // v2.32: NOT LISTENING — debuff cleanse. removeWeak scrubs player-side
    // weakness (playerDmgMult below 1.0) back toward neutral; removeVulnerable
    // scrubs incoming-damage vulnerability (enemyDmgMult above 1.0) back
    // toward 1.0. Each stack adjusts 0.25, clamped at 1.0 so it can't flip
    // into a buff. No-op if already at/past neutral.
    if (fx.removeWeak && playerDmgMult < 1.0) {
      const target = Math.min(1.0, playerDmgMult + 0.25 * fx.removeWeak);
      setPlayerDmgMult(target);
      logBits.push(`🙉 cleansed Weak`);
    }
    if (fx.removeVulnerable && enemyDmgMult > 1.0) {
      const target = Math.max(1.0, enemyDmgMult - 0.25 * fx.removeVulnerable);
      setEnemyDmgMult(target);
      logBits.push(`🙉 cleansed Vulnerable`);
    }
    // v2.33: NOT LISTENING — absorbNextDebuff arms a one-shot token that
    // intercepts the next enemy Weak OR Vulnerable application this combat.
    // Tokens stack (replaying the skill arms +1). Decremented in the enemy-
    // attack flow (intent.kind === 'weak'/'vulnerable' and the rider checks).
    if (fx.absorbNextDebuff) {
      setNotListeningCharges(c => c + fx.absorbNextDebuff);
      logBits.push(`🙉 +${fx.absorbNextDebuff} Sorry — what?`);
    }
    // v2.47: DRUNKEN CONFIDENCE removal — uninstallPower: <id>. Walks the
    // powers array, removes the first match. No-op if nothing's installed.
    // Currently used only by the "sober second thought," skill, but the
    // dispatcher is id-driven so any future opt-out skill can reuse it.
    if (fx.uninstallPower) {
      const targetId = fx.uninstallPower;
      let removed = null;
      setPowers(ps => {
        const idx = ps.findIndex(p => p.installPower?.id === targetId || p.id === targetId);
        if (idx < 0) return ps;
        removed = ps[idx];
        const next = ps.slice();
        next.splice(idx, 1);
        return next;
      });
      // Defer the log to the next tick — setPowers is async so the
      // closure-captured `removed` lands after the state update commits.
      setTimeout(() => {
        if (removed) {
          pushLog(`🍺 ${removed.name} dispelled.`);
          logEvent('jnsq.drunken.uninstall', { enemyId: enemy?.id, enemyTier: enemy?.tier });
        }
      }, 0);
      logBits.push(`🍺 power dispelled`);
    }
    // v2.35: FOOTNOTE skill — arm the picker. Hand AND discard cards (intros,
    // subjects, modifiers) become clickable until the player picks one or
    // cancels. The skill itself is exhausted by playCard's normal exhaust
    // handling; the prompt is the payoff layer.
    if (fx.footnotePrompt) {
      setFootnotePromptActive(true);
      logBits.push(`📖 pick a phrase to footnote`);
    }
    // v2.36: ACTUALLY— re-fire the last cast at ×1.5. Reads lastCastSnapshot
    // captured at the end of castV2SentenceSpell. If null (no cast this turn),
    // no-op — the UI should have disabled the card already. Re-applies DAMAGE
    // ONLY (we deliberately skip rider re-application, annotation auto-attach,
    // sideEffect re-resolution, and tray clearing — the spec says "directly
    // re-resolve the last cast's damage formula"). Also stacks +1 to
    // arguingBackThisTurn (player-side debuff that bumps enemy raw damage).
    if (fx.refireLastCast) {
      if (lastCastSnapshot) {
        const snap = lastCastSnapshot;
        const reResult = computeSpellDamage(
          snap.intro, snap.subject, snap.target, snap.modifiers || [], snap.ctx || {});
        let reDmg = reResult.damage;
        // Re-apply the same effectiveness + playerDmgMult routing the snapshot
        // resolved through. We use the captured per-fire multipliers so any
        // drift between the original cast and the re-fire (turn-end decay)
        // doesn't change the math — Actually— recasts the room as it was.
        if (snap.dmgType === 'physical') reDmg = Math.round(reDmg * (snap.physMult ?? 1.0));
        else                              reDmg = Math.round(reDmg * (snap.enemyMult ?? 1.0));
        reDmg = Math.round(reDmg * (snap.playerDmgMult ?? 1.0));
        reDmg = Math.round(reDmg * 1.5);
        if (snap.dmgType === 'physical') applyDamageToEnemyHp(reDmg);
        else                              applyDamageToEnemyComposure(reDmg);
        pushLog(`✏ Actually— ${reDmg} ${snap.dmgType === 'physical' ? 'phys' : 'comp'} (re-fire ×1.5).`);
        logEvent('wit.actually', {
          bonusDamage: reDmg, dmgType: snap.dmgType,
          enemyId: enemy?.id, enemyTier: enemy?.tier,
        });
      } else {
        // Defensive — UI should have blocked this, but log if it slipped.
        pushLog(`✏ Actually— … but there's nothing to correct.`);
      }
      // The "arguing back" cost stacks regardless of whether a snapshot
      // existed (cast already exhausted via playCard, so the energy was
      // spent — the bill comes due either way).
      setArguingBackThisTurn(n => n + 1);
      logBits.push(`🗣 +1 arguing back`);
    }
    // v2.37: HOLD ON — arm a reactive interrupt that reduces the next
    // enemy attack's first swing by the player's CURRENT longThread
    // (snapshotted at play time). The flag arms regardless of LT value
    // — even at LT=0 the play still burns the slot (no free re-cast).
    // Consumed when applyEnemyIntent processes the next attack/attack-
    // multi; otherwise auto-clears at the start of the player's next
    // turn (see endTurn).
    if (fx.holdOnPrep) {
      const snap = longThread || 0;
      setHoldOnArmed(true);
      setHoldOnValue(snap);
      if (snap > 0) logBits.push(`🛑 Hold on — armed (−${snap} next swing)`);
      else          logBits.push(`🛑 Hold on — armed (no thread)`);
    }
    // v2.39: OPENING STATEMENT — "to revisit my opening point," skill arms
    // the openingExtended flag. The next wit target cast (this turn or a
    // later turn) still receives its openingBonus damage even past turn 1.
    // Idempotent: re-playing the skill while already armed re-arms (cost
    // already paid by playCard). Telemetry per play, regardless of whether
    // a target ever cashes it in.
    if (fx.extendOpening) {
      setOpeningExtended(true);
      logBits.push(`🎩 opening extended`);
      logEvent('wit.opening.extend', {
        combatTurn,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.40: PATIENCE skip-cast bank — "I'll let you finish," skill. If
    // Patience is installed, bump patienceStacks +1 (a deliberate skip-cast
    // signal without losing the turn). If Patience is NOT installed, the
    // card is still legal to play (no effect — the player should install
    // first). Telemetry per play that actually banked.
    if (fx.skipCastBank) {
      if (patienceInstalled) {
        setPatienceStacks(n => {
          const next = n + 1;
          logBits.push(`🌿 Patience +1 (${next})`);
          return next;
        });
        logEvent('wit.patience.bank', {
          enemyId: enemy?.id, enemyTier: enemy?.tier,
        });
      } else {
        logBits.push(`🌿 — Patience not installed`);
      }
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
    // v2.7: NOVEL subject mechanics ----------------------------------------
    // Block steal — strip enemy block AND give player block. The "your
    // hidden defenses" wit subject.
    if (fx.stealBlock) {
      const strip = fx.stealBlock.strip || 0;
      const gain = fx.stealBlock.gain || 0;
      if (strip > 0) setEnemyBlock(b => Math.max(0, b - strip));
      if (gain > 0)  setBlock(b => b + gain);
      logBits.push(`🛇 strip ${strip} · 🛡 +${gain}`);
    }
    // Refund energy — staging this card returns N energy. Tempo subject.
    if (fx.refundEnergy) {
      setEnergy(e => e + fx.refundEnergy);
      logBits.push(`⚡ +${fx.refundEnergy} refund`);
    }
    // Apply enemy DOT (damage-over-time). Chutzpah "your every breath".
    if (fx.applyDot) {
      const d = fx.applyDot;
      setEnemy(e => e ? { ...e, dot: { damage: d.damage, turnsRemaining: d.turns, total: d.turns } } : e);
      logBits.push(`🩸 Bleed ${d.damage}/turn × ${d.turns}`);
    }
    // v2.24: tunnel-vision pump from card side effects (Foaming at the mouth,).
    // Pushes the chutzpah RAGE meter without requiring the card to be played
    // as a particular slot — the effect itself is what fills.
    if (fx.tunnelVision) {
      setTunnelVision(n => n + fx.tunnelVision);
      logBits.push(`🔥 +${fx.tunnelVision} Tunnel`);
    }
    // Reveal enemy's next intent. Jnsq "the next thing you'll do".
    if (fx.revealNextIntent) {
      // Pre-roll the upcoming intent and store it for UI display.
      if (enemy) {
        const peeked = rollIntent(enemy, [enemyIntent?.kind].filter(Boolean));
        setPeekedNextIntent(peeked);
        logBits.push(`👁 peek: ${peeked.telegraph || peeked.kind}`);
      }
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
    // v2.45: APOLOGY — discard the entire spell tray (intro/subject/target/
    // modifiers all go to discard, no energy refund). The hp+4 and
    // vulnerable+1 keys ride alongside and are handled by the existing
    // branches above. Read current `tray` state directly (closure) to avoid
    // nesting setState inside another updater — [[feedback_react_pure_updaters]].
    if (fx.apologize) {
      const moved = [];
      if (tray.intro) moved.push(tray.intro);
      if (tray.subject) moved.push(tray.subject);
      if (tray.target) moved.push(tray.target);
      if (tray.modifiers && tray.modifiers.length) moved.push(...tray.modifiers);
      if (moved.length > 0) {
        setDiscard(d => [...d, ...moved]);
        logBits.push(`🙇 cleared ${moved.length} from tray`);
      } else {
        logBits.push(`🙇 cleared the tray`);
      }
      setTray(p => initialV2Tray({ effectFiredThisTurn: p.effectFiredThisTurn }));
      setApologyTelemetry(t => ({
        casts: t.casts + 1,
        hpHealed: t.hpHealed + (fx.hp || 0),
        trayDiscarded: t.trayDiscarded + moved.length,
      }));
    }
    // v2.45: IGNORE NEXT DEBUFF — alias onto the existing notListeningCharges
    // plumbing (the wit "Sorry — what?" absorb-token system). Each charge
    // intercepts the next enemy Weak/Vulnerable application this combat.
    if (fx.ignoreNextDebuff) {
      setNotListeningCharges(c => c + fx.ignoreNextDebuff);
      logBits.push(`🙉 +${fx.ignoreNextDebuff} sorry — restarting`);
    }
    // v2.44: SPEAKING OF WHICH — staging deepens the Tangent pool by
    // dumping one random hand card into the discard. Skipped if the hand
    // has 0 other cards. Read from `hand` (state); the card being staged
    // is already removed by the playCard splice above.
    if (fx.discardOnPlay) {
      setHand(h => {
        if (h.length === 0) return h;
        const idx = Math.floor(Math.random() * h.length);
        const lost = h[idx];
        setDiscard(d => [...d, lost]);
        logBits.push(`🌀 discarded ${lost.name || lost.phrase || 'a card'}`);
        return h.filter((_, i) => i !== idx);
      });
    }
    // v2.48: AWKWARD PAUSE — jnsq "...go on, I'm listening." skill. Arms
    // pauseHeld for the rest of THIS turn. At endTurn the flag graduates to
    // pauseHeldActive (the doubling bank for NEXT turn's cast). The tray
    // already persists by default (v2.1 persistent-tray rule), so this
    // mechanic is purely about the doubling — the "skip a turn" cost is
    // implicit (player can't cast usefully on the pause-played turn unless
    // they had already staged + had energy for both, which is rare).
    if (fx.awkwardPause) {
      setPauseHeld(true);
      setAwkwardPauseTelemetry(t => ({ ...t, pauses: t.pauses + 1 }));
      logBits.push(`🤫 paused — next cast doubles`);
      logEvent('jnsq.awkwardPause.play', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.52: DRUNKEN STAGGER — jnsq "sorry, I lost my balance for a second,"
    // skill. Arms staggerActive for the rest of THIS turn (until endTurn
    // clears it AFTER the enemy intent has had its chance to roll). While
    // armed, every enemy attack swing in applyEnemyIntent rolls 50/50 to
    // fully miss. Tracked via setStaggerTelemetry — plays here, hits/damage
    // in the enemy-intent branch.
    if (fx.staggerOn) {
      setStaggerActive(true);
      setStaggerTelemetry(t => ({ ...t, plays: t.plays + 1 }));
      pushLog(`🌀 Staggered — they might miss.`);
      logEvent('jnsq.stagger.play', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.44: TANGENT — "That reminds me," jnsq skill. (1) Discard 1 random
    // from draw pile. (2) Find all jnsq-lane cards in discard. (3) Pick
    // one at random and fire it: word → stage (replacing if filled,
    // refunded to hand for free); target → cast immediately if tray
    // intro+subject filled, else fizzle. The fired card is removed from
    // discard for free (no cost paid; no entry to hand).
    if (fx.tangentFire) {
      setTangentTelemetry(t => ({ ...t, fires: t.fires + 1 }));
      // Step 1: random discard from draw pile.
      setDeck(d => {
        if (d.length === 0) return d;
        const idx = Math.floor(Math.random() * d.length);
        const lost = d[idx];
        setDiscard(dd => [...dd, lost]);
        logBits.push(`📤 lost ${lost.name || lost.phrase || 'a card'} from draw`);
        return d.filter((_, i) => i !== idx);
      });
      // Step 2 + 3: pull a jnsq card from discard and resolve it. Defer to
      // setDiscard's callback form so we read the post-step-1 discard.
      setDiscard(discardPile => {
        const jnsqIdxs = discardPile
          .map((c, i) => (c.lane === 'jnsq' ? i : -1))
          .filter(i => i >= 0);
        if (jnsqIdxs.length === 0) {
          pushLog(`🌀 That reminds me... no, nothing.`);
          return discardPile;
        }
        const pick = jnsqIdxs[Math.floor(Math.random() * jnsqIdxs.length)];
        const fired = discardPile[pick];
        const newDiscard = discardPile.filter((_, i) => i !== pick);
        pushLog(`🌀 Tangent: ${fired.phrase || fired.name}`);
        // Defer the side-effect application via setTimeout so it runs
        // OUTSIDE this setState updater ([[feedback_react_pure_updaters]]).
        setTimeout(() => resolveTangentCard(fired), 0);
        return newDiscard;
      });
    }
  }

  // v2.44: TANGENT resolver — runs the fired card's effect outside of any
  // setState updater. Words stage into their slot (replacing if filled, with
  // the displaced card refunded to hand for free). Modifiers stage (up to 2).
  // Targets cast immediately if intro+subject filled; otherwise log fizzle.
  // No energy cost, no hand entry, no staging-discard cleanup (the source
  // card was already lifted out of discard before this fires).
  function resolveTangentCard(fired) {
    if (!fired) return;
    if (fired.slot === 'intro' || fired.slot === 'subject') {
      setTray(p => {
        const prev = p[fired.slot];
        if (prev) {
          setHand(h => [...h, prev]);
          pushLog(`↩ Tangent replaced ${fired.slot} ${prev.name || prev.phrase}.`);
        }
        return syncTrayLegacy({ ...p, [fired.slot]: fired });
      });
      // Stage-side effects fire for free (block, draw, vulnerable, etc.).
      const sideBits = [];
      applySideEffects(fired.effects || {}, sideBits);
      if (sideBits.length) pushLog(`🌀 ${sideBits.join(' · ')}`);
      setTangentTelemetry(t => ({ ...t, wordsStaged: t.wordsStaged + 1 }));
      return;
    }
    if (fired.slot === 'modifier') {
      setTray(p => {
        const mods = p.modifiers || [];
        if (mods.length >= 2) {
          // Replace the oldest modifier; refund to hand for free.
          const displaced = mods[0];
          setHand(h => [...h, displaced]);
          pushLog(`↩ Tangent replaced modifier ${displaced.name || displaced.phrase}.`);
          return syncTrayLegacy({ ...p, modifiers: [...mods.slice(1), fired] });
        }
        return syncTrayLegacy({ ...p, modifiers: [...mods, fired] });
      });
      const sideBits = [];
      applySideEffects(fired.effects || {}, sideBits);
      if (sideBits.length) pushLog(`🌀 ${sideBits.join(' · ')}`);
      setTangentTelemetry(t => ({ ...t, wordsStaged: t.wordsStaged + 1 }));
      return;
    }
    if (fired.slot === 'target' || fired.type === 'effect') {
      // Need intro + subject filled to cast. Read latest tray via setTray
      // callback form. If incomplete, fizzle — the target slides into the
      // discard pile (not exiled — Tangent is chaos, not punishment).
      setTray(p => {
        if (!p.intro || !p.subject) {
          pushLog(`🌀 That reminds me... [fizzled — no setup].`);
          setDiscard(d => [...d, fired]);
          setTangentTelemetry(t => ({ ...t, fizzles: t.fizzles + 1 }));
          return p;
        }
        // Replace any existing target; refund to hand for free.
        if (p.target) {
          setHand(h => [...h, p.target]);
          pushLog(`↩ Tangent replaced target ${p.target.name || p.target.phrase}.`);
        }
        const next = syncTrayLegacy({ ...p, target: fired });
        // Defer the actual cast — staging is now complete; the cast needs
        // to read the new tray. setTimeout pushes it after this updater.
        setTimeout(() => {
          castStagedSpell();
          setTangentTelemetry(t => ({ ...t, targetsCast: t.targetsCast + 1 }));
        }, 0);
        return next;
      });
      return;
    }
    // Gesture / skill / power / annotation — uncommon for jnsq pools, but
    // gracefully drop them back to discard so they're not lost.
    setDiscard(d => [...d, fired]);
    pushLog(`🌀 Tangent: ${fired.name || fired.phrase} — slipped past the table.`);
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

  // v2.35: FOOTNOTE — apply +1 footnote to the card instance with the given
  // uid. Searches hand AND discard. The rider scales the card's wit stat
  // in computeSpellDamage (introStat / subjectStat / modStat all read it).
  // Persists through reshuffles because drawCards spreads the card object;
  // the uid will change but `footnotes` rides along on the spread.
  // No-op if the uid can't be found. Clears the prompt either way (the
  // skill has already exhausted).
  function applyFootnote(cardUid) {
    if (!footnotePromptActive) return;
    let applied = false;
    setHand(h => h.map(c => {
      if (c.uid === cardUid) {
        applied = true;
        return { ...c, footnotes: (c.footnotes || 0) + 1 };
      }
      return c;
    }));
    if (!applied) {
      setDiscard(d => d.map(c => {
        if (c.uid === cardUid) {
          applied = true;
          return { ...c, footnotes: (c.footnotes || 0) + 1 };
        }
        return c;
      }));
    }
    setFootnotePromptActive(false);
    if (applied) {
      pushLog(`📖 Footnote attached.`);
      logEvent('wit.footnote', { cardUid });
    } else {
      pushLog(`📖 Footnote skill expired (no eligible card).`);
    }
  }

  // v2.35: FOOTNOTE — cancel an active prompt (Esc / click-outside / explicit
  // dismiss button). The skill is already exhausted; the player just loses
  // the install opportunity.
  // v2.85: resolve the pick-one-of-two forget prompt. Player clicked one
  // of the two candidates to lose. Remove it by uid (not index — the
  // deck order may have changed by reshuffles between offer and pick).
  function resolveForgetTwoChoice(cardUid) {
    if (!forgetTwoPrompt) return;
    const chosen = forgetTwoPrompt.cards.find(c => c.uid === cardUid);
    if (!chosen) { setForgetTwoPrompt(null); return; }
    setDeck(d => d.filter(c => c.uid !== cardUid));
    pushLog(`📜 Forgotten: ${chosen.name || chosen.phrase}.`);
    logEvent('forget.choose', { cardId: chosen.id, cardName: chosen.name, offered: forgetTwoPrompt.cards.map(c => c.id) });
    setForgetTwoPrompt(null);
  }

  function cancelFootnotePrompt() {
    if (!footnotePromptActive) return;
    setFootnotePromptActive(false);
    pushLog(`📖 Footnote skill dismissed without picking a phrase.`);
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
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      if (wDeck.length === 0) {
        if (wDiscard.length === 0) break;
        wDeck = shuffle(wDiscard);
        wDiscard = [];
      }
      const c = wDeck.shift();
      wHand.push({ ...c, uid: uid() });
      drawn++;
    }
    setDeck(wDeck);
    setDiscard(wDiscard);
    setHand(wHand);
    // v2.10: annotation damageOnDraw — composure damage per card drawn.
    const perDraw = annoFx('damageOnDraw');
    if (perDraw > 0 && drawn > 0) {
      applyDamageToEnemyComposure(perDraw * drawn);
      pushLog(`📝 Marginalia stings: -${perDraw * drawn} comp.`);
    }
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
    logEvent(TE.TURN_END, {
      enemyId: enemy?.id, hp, composure, energyLeft: energy, handSize: hand.length,
      trayStaged: (tray.intro ? 1 : 0) + (tray.subject ? 1 : 0) + (tray.target ? 1 : 0) + (tray.modifiers?.length || 0),
      // v2.84: surface multiplier state so vulnerability/sap stories can
      // be diagnosed from telemetry. playerDmgMult > 1 = enemy Vulnerable
      // to our spells; enemyDmgMult > 1 = we're Vulnerable to their
      // attacks. Same fields for the post-drift snapshot.
      playerDmgMult: Number(playerDmgMult?.toFixed?.(2) ?? 1),
      enemyDmgMult:  Number(enemyDmgMult?.toFixed?.(2) ?? 1),
    });

    // v2.24: RAGE turn ending — reset meter + undo the +0.5 potency bump.
    // We check this BEFORE the multiplier-drift block so the restore-to-1
    // doesn't double-count with the natural drift.
    if (rageActive) {
      adjustPlayerDmg(-0.5);
      setTunnelVision(0);
      setRageActive(false);
      pushLog(`🔥 Rage dissipates.`);
    }
    // v2.25: DOUBLING DOWN billing. If the player landed any chutzpah
    // doubleDown casts this turn and the enemy is still alive, eat
    // cornerTokens × 2 unblocked HP. Reset tokens either way.
    if (cornerTokens > 0) {
      const enemyAlive = enemy && enemyComposure > 0 && enemyHp > 0;
      if (enemyAlive) {
        const dmg = cornerTokens * 2;
        setHp(h => Math.max(0, h - dmg));
        pushLog(`🏚 Backed into a corner: -${dmg} HP (didn't close the deal).`);
      }
      setCornerTokens(0);
    }
    // v2.48: AWKWARD PAUSE — at end of turn, graduate pauseHeld (this turn's
    // skill-armed flag) into pauseHeldActive (the doubling bank for NEXT
    // turn's cast). The tray already persists (v2.1), so the doubling is
    // the only side-effect. If pauseHeldActive was ALREADY true coming
    // into this endTurn (player held + didn't cast), it stays true — the
    // bank carries forward into the turn after, mirroring the "multi-turn
    // buildup if patient" spec.
    if (pauseHeld) {
      setPauseHeld(false);
      setPauseHeldActive(true);
      pushLog(`🤫 The silence stretches. Next cast: ×2 staged stats.`);
    }
    // v2.46: WON'T SHUT UP — if still armed at end of turn, the player
    // didn't follow through. Eat 3 unblocked HP. Telemetry: damage++.
    // Clear flag either way (the contract is per-turn).
    if (wontShutUpArmed) {
      setHp(h => Math.max(0, h - 3));
      setWontShutUpTelemetry(t => ({ ...t, damage: t.damage + 1 }));
      pushLog(`🗣 Stopped abruptly. -3 HP.`);
      logEvent('jnsq.wontShutUp.damage', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
      setWontShutUpArmed(false);
    }

    // v2.38: SAYING SOMETHING WRONG — auto-play any Misstep tokens still in
    // hand at end of turn. Each token = -3 HP self-damage (snapshotted from
    // the queue, default 3) and exhausts. This happens BEFORE the hand
    // merges into discard so the tokens are diverted to exile, not cycled
    // back into the deck. The "did the player let it ride" branch — they
    // either pay 1 Energy to discard during their turn, or eat it now.
    // Telemetry routed through logEvent so the report can read aggregate
    // auto-play counts.
    const missteppedInHand = hand.filter(c => c?.id === MISSTEP_TOKEN.id);
    let endTurnHand = hand;
    let postMisstepHp = hp;
    if (missteppedInHand.length > 0) {
      let totalSelfDmg = 0;
      for (const tok of missteppedInHand) totalSelfDmg += (tok.selfDamage || 3);
      postMisstepHp = Math.max(0, hp - totalSelfDmg);
      setHp(postMisstepHp);
      setExiled(ex => [...ex, ...missteppedInHand]);
      pushLog(`📜 Misstep × ${missteppedInHand.length} auto-played: -${totalSelfDmg} HP. (You should not have said that.)`);
      logEvent('wit.missTepAutoPlay', {
        count: missteppedInHand.length, selfDamage: totalSelfDmg,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
      endTurnHand = hand.filter(c => c?.id !== MISSTEP_TOKEN.id);
      // If the misstep just killed the player, route into the defeat screen
      // (same path as enemy KO) and short-circuit the rest of endTurn so
      // we don't run the enemy intent / hand reshuffle on a corpse.
      if (postMisstepHp <= 0) {
        logEvent(TE.COMBAT_END, { enemyId: enemy?.id, outcome: 'lost', tier: enemy?.tier, hpAfter: 0, composureAfter: composure });
        logEvent(TE.RUN_END, { outcome: 'lost', killedBy: 'misstep', actIdx: currentActIdx, finalDeckSize: deck.length + hand.length + discard.length + exiled.length });
        setTimeout(() => setStage('defeat'), 200);
        return;
      }
    }

    // v2.1: persistent tray. Cards staged into intro/subject/target/modifier
    // slots carry across turns until the spell casts. This replaces the old
    // fizzle-on-turn-end behavior — players can now compose a sentence
    // across multiple turns, casting partial spells for tempo or holding
    // for a higher-tier cast next turn.
    // (Tray clears only when a cast fires or combat ends.)
    //
    // v2.82: PRE-STAGING COST. The carry-over wasn't free anymore — if you
    // didn't cast this turn AND any cards remain staged in the tray, each
    // one costs 1 composure. You're focusing on what you'll say next,
    // which means you're not paying as much attention to the enemy now.
    // Applies whether the player skipped on purpose (Awkward Pause) or
    // just didn't complete the spell. Doesn't apply if you cast — the
    // tray empties on cast, so there's nothing to carry.
    if (castsThisTurn === 0) {
      const staged = (tray.intro ? 1 : 0) + (tray.subject ? 1 : 0) + (tray.target ? 1 : 0) + (tray.modifiers?.length || 0);
      if (staged > 0) {
        const cost = staged;
        setComposure(c => Math.max(0, c - cost));
        pushLog(`🧠 Pre-staging: -${cost} composure (focused on next turn, not on them).`);
      }
    }

    // 1. End-of-turn power triggers.
    const killedByPowers = applyEndOfTurnPowerTriggers();
    if (killedByPowers) return;

    // v2.10: annotation damageOnTurnEnd — composure tick at end of player turn.
    const annTurnEnd = annoFx('damageOnTurnEnd');
    if (annTurnEnd > 0) {
      applyDamageToEnemyComposure(annTurnEnd);
      pushLog(`📝 Margin notes: -${annTurnEnd} comp.`);
    }

    // 2. Enemy turn begins. Enemy block expires here, before the intent
    // fires — so an enemy that blocks on consecutive turns gets a fresh
    // pool each time, and player attacks during the previous turn can't
    // free-rider through stale block.
    if (enemyBlock > 0) pushLog(`👹 ${enemy?.name || 'Enemy'}: 🛡 fades.`);
    setEnemyBlock(0);

    // 3. Enemy intent.
    if (enemyIntent) applyEnemyIntent(enemyIntent);
    if (hp <= 0 || composure <= 0) return;

    // v2.7: Bleed/DOT tick — happens AFTER the enemy's main action so the
    // bleed is a free chip on top of whatever the player set up. Decrements
    // remaining turns; expires at 0. Damages the enemy's composure pool.
    if (enemy?.dot?.turnsRemaining > 0) {
      const dot = enemy.dot;
      const dmg = dot.damage;
      const remaining = dot.turnsRemaining - 1;
      // Apply through enemyBlock first (it just got reset above to 0, but
      // a power could grant block on turn-start). Bleed → composure.
      let absorbed = 0;
      if (enemyBlock > 0) {
        absorbed = Math.min(enemyBlock, dmg);
        setEnemyBlock(b => Math.max(0, b - absorbed));
      }
      const toComp = dmg - absorbed;
      if (toComp > 0) {
        setEnemy(e => {
          if (!e) return e;
          const nextDot = remaining > 0 ? { ...dot, turnsRemaining: remaining } : null;
          return { ...e, composure: Math.max(0, (e.composure || 0) - toComp), dot: nextDot };
        });
      } else {
        setEnemy(e => e ? { ...e, dot: remaining > 0 ? { ...dot, turnsRemaining: remaining } : null } : e);
      }
      pushLog(`🩸 Bleed: ${dmg} (${remaining} turn${remaining === 1 ? '' : 's'} left)`);
    }

    // v2.34: LONG THREAD bookkeeping. Runs AFTER the enemy intent resolves
    // so `unblockedThisTurn` is final. Rules:
    //   - Took unblocked HP/composure damage → meter resets to 0.
    //   - Otherwise, if the player cast a wit Effect this turn → meter +1.
    //   - Otherwise (no wit cast, no unblocked hit) → meter is unchanged.
    // Reset the per-turn flags either way.
    if (unblockedThisTurn) {
      if (longThread > 0) pushLog(`🧵 Lost the thread.`);
      setLongThread(0);
    } else if (castWitEffectThisTurn) {
      setLongThread(n => {
        const next = n + 1;
        pushLog(`🧵 Long Thread: ${next}`);
        return next;
      });
    }
    setUnblockedThisTurn(false);
    setCastWitEffectThisTurn(false);

    // v2.40: PATIENCE — if installed AND the player did NOT cast this turn,
    // bank +1 stack. Reads castsThisTurn (the per-turn cast counter) which is
    // still the pre-reset value at this point (setCastsThisTurn(0) fires
    // later in the wrap-up). Skip turns get rewarded; casting clears nothing
    // here (the cast itself already consumed the bank in castV2SentenceSpell).
    if (patienceInstalled && castsThisTurn === 0) {
      setPatienceStacks(n => {
        const next = n + 1;
        pushLog(`🌿 Patience +1 (${next}).`);
        return next;
      });
    }

    // v2.36: ACTUALLY— reset per-turn state. arguingBackThisTurn is the
    // enemy-side surcharge; it cleared during the enemy intent that already
    // resolved above (the bill came due this turn). lastCastSnapshot is the
    // re-fire target; nuking it ensures Actually— on turn N+1 has no cast
    // from N-1 to re-fire — only THIS turn's casts qualify. Both clear
    // post-enemy-intent so the damage bump and re-fire both fire this turn.
    setArguingBackThisTurn(0);
    setLastCastSnapshot(null);

    // v2.52: DRUNKEN STAGGER — clear the dodge window AFTER the enemy intent
    // resolved. The skill arms staggerActive on play turn N; the enemy intent
    // at endTurn N rolls dodges; the flag clears here so player turn N+1
    // starts fresh (no carry-over). Defensive only — strictly one-turn window.
    if (staggerActive) {
      setStaggerActive(false);
    }

    // v2.37: HOLD ON — auto-clear if unused. The flag is meant to interrupt
    // the NEXT enemy attack, not linger as a delayed counter. If applyEnemyIntent
    // already consumed it, holdOnArmed is already false — this is a no-op.
    if (holdOnArmed) {
      pushLog(`🛑 Hold on — released, no one was talking.`);
      setHoldOnArmed(false);
      setHoldOnValue(0);
    }

    // 2.5. Block fades — explicit log so the player sees expiry happen even
    //      when a Hedgehog/Felt re-grant immediately tops it back up below.
    //      `block` here is the closure value at the top of the event handler;
    //      good enough for "you had block; it's gone now."
    if (block > 0) pushLog(`🛡 Block fades.`);
    if (poise > 0) pushLog(`🪞 Poise fades.`);
    setPoise(0);

    // 3. Debuff decay.
    // v2.21: drift was 0.5/turn. v2.65: now 0.10/turn. 0.25 was eating
    // the whole +0.25 stack of Amplify/Sap in a single turn, which made
    // the cards' "stacks; caps at +50%" text a lie — you could never
    // actually reach the cap. At 0.10/turn a single play survives 2-3
    // turns and stacking is achievable. The chip tooltips already say
    // "drifts toward 1.00 by 0.10/turn" so they're consistent.
    setEnemyDmgMult(m  => m > 1 ? Math.max(1, m - 0.10) : m < 1 ? Math.min(1, m + 0.10) : m);
    setPlayerDmgMult(m => m > 1 ? Math.max(1, m - 0.10) : m < 1 ? Math.min(1, m + 0.10) : m);

    // 4-5. Compose the new turn's piles + start-of-turn triggers
    //      synchronously, then commit all related state in one pass.
    // v2.38: endTurnHand is hand minus any Misstep tokens that auto-played
    // above — those went to exile, not discard, and shouldn't recycle.
    const stagedDiscard = [...discard, ...endTurnHand];
    const drawn = drawFromPiles(deck, stagedDiscard, HAND_SIZE);
    let wDeck     = drawn.deck;
    let wDiscard  = drawn.discard;
    const wHand   = [...drawn.hand];
    let wEnergy   = energyPerTurnRefill();
    // v2.33: Stubborn Block removed — block always resets to 0 at start of turn.
    let wBlock    = 0;

    // v2.10: annotation start-of-turn effects fire BEFORE the decrement.
    const annTurnStartDmg = annoFx('damageOnTurnStart');
    const annTurnStartEnergy = annoFx('energyOnTurnStart');
    if (annTurnStartDmg > 0) {
      applyDamageToEnemyComposure(annTurnStartDmg);
      pushLog(`📝 Read aloud: -${annTurnStartDmg} comp.`);
    }
    if (annTurnStartEnergy > 0) {
      wEnergy += annTurnStartEnergy;
      pushLog(`📝 +${annTurnStartEnergy} Energy (read aloud).`);
    }
    // v2.10: tick annotation duration. Annotations live 3-4 player turns;
    // tick fires AFTER the start-of-turn effect lands, so the player gets
    // every turn's benefit before expiry.
    if (enemy?.annotation) {
      const nextTurns = enemy.annotation.turnsRemaining - 1;
      if (nextTurns <= 0) {
        pushLog(`📝 The note on ${enemy.name} fades from memory.`);
        setEnemy(e => e ? { ...e, annotation: null } : e);
      } else {
        setEnemy(e => e ? { ...e, annotation: { ...e.annotation, turnsRemaining: nextTurns } } : e);
      }
    }
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

    // v2.38: SAYING SOMETHING WRONG — decrement pending Misstep timers and
    // deliver any that hit zero into the new turn's hand. Decrement runs
    // EVERY endTurn (it's the "two turns later" clock); a delay-2 cast on
    // turn N ticks at end of turn N (→1), end of turn N+1 (→0, delivered
    // into the wHand for turn N+2). The fresh token has a new uid and the
    // selfDamage payload it was created with, so a future card variant
    // that delivers heavier missteps can ride the same pipe.
    let nextPending = [];
    let deliveredCount = 0;
    for (const pm of pendingMissteps) {
      const next = (pm.turnsRemaining || 0) - 1;
      if (next <= 0) {
        wHand.push({ ...MISSTEP_TOKEN, uid: uid(), selfDamage: pm.selfDamage || 3 });
        deliveredCount += 1;
      } else {
        nextPending.push({ ...pm, turnsRemaining: next });
      }
    }
    if (deliveredCount > 0) {
      pushLog(`📜 Misstep × ${deliveredCount} surfaces in your hand. Play it (1 Energy) or eat -3 HP.`);
      logEvent('wit.missTepDelivered', {
        count: deliveredCount, enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    setPendingMissteps(nextPending);

    // Commit.
    setDeck(wDeck);
    setDiscard(wDiscard);
    setHand(wHand);
    setBlock(wBlock);
    setEnergy(wEnergy);
    // v2.9: reset per-turn cast cap.
    setCastsThisTurn(0);
    // v2.11: forget uncommitted stakes at turn boundary.
    setStakeAmount(0);
    // v2.29: reset saying-it-louder counter at turn boundary.
    setLoudCount(0);
    // v2.12: forget uncommitted roll-toggle at turn boundary.
    setRollOptIn(false);
    // v2.39: OPENING STATEMENT — bump the combat-turn counter. The first
    // player turn is combatTurn=1 (set on enterFight); after the first
    // endTurn we move to turn 2, etc. openingExtended persists across
    // turns until consumed by a wit target cast.
    setCombatTurn(n => n + 1);

    // v2.24: RAGE entry. If the chutzpah TUNNEL VISION meter is at 5+
    // entering the new player turn, flip into RAGE: +50% potency for
    // this turn. The bonus is applied to playerDmgMult (clamped at 1.5)
    // and rolled back at the top of the next endTurn call.
    if (tunnelVision >= 5 && !rageActive) {
      adjustPlayerDmg(+0.5);
      setRageActive(true);
      pushLog(`🔥 RAGE — chutzpah unleashed (+50% damage).`);
    }

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
      // v2.7: if a peeked intent is queued (from "the next thing you'll do"),
      // it locks the next intent — the peek is honest.
      if (peekedNextIntent) {
        setEnemyIntent(peekedNextIntent);
        setPeekedNextIntent(null);
      } else {
        setEnemyIntent(rollIntent(enemy, exclude));
      }
      setIntentTick(t => t + 1);
    }
    // v2.26: storm-out intent-hiding lifecycle. If THIS endTurn was the one
    // triggered by the storm-out cast itself, the ref is true — the intent
    // we just rolled is the one we want to hide for the upcoming turn, so
    // leave intentHidden true and just consume the ref. The NEXT endTurn
    // (after the player has played their hidden-intent turn) finds ref=false
    // and clears the flag — the intent rolled there reveals normally.
    if (stormOutFiredRef.current) {
      stormOutFiredRef.current = false;
    } else if (intentHidden) {
      setIntentHidden(false);
    }
  }

  function applyEnemyIntent(intent) {
    const e = enemy;
    if (!e) return;
    let playerDied = false;
    if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
      const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
      // v2.9: dual-shield routing.
      //   intent.pool === 'composure' → POISE absorbs, then composure pool
      //   default                     → BLOCK absorbs, then HP pool
      // Physical and composure defenses are NOW SEPARATE. A player who's
      // only built physical block has no answer to composure threats and
      // vice versa — forces dual defense management.
      const targetsComposure = intent.pool === 'composure';
      let raw = Math.round(intent.value * enemyDmgMult);
      // v2.36: ACTUALLY— arguing-back surcharge. Each Actually— played this
      // turn adds +1 to enemy raw damage value. Applied BEFORE annotation
      // reduction so a strong annotation can still scrub the surcharge (the
      // wit-defender's existing answer), but AFTER the enemyDmgMult roll so
      // the +1 is a clean flat bump, not multiplied by Vuln.
      if (arguingBackThisTurn > 0) raw += arguingBackThisTurn;
      // v2.47: DRUNKEN CONFIDENCE — while installed, every enemy attack
      // adds +2 raw damage BEFORE block routing. Block can still soak the
      // chunk; the +2 is partial-through-block by design (Stoneward-style
      // total bypass would be too punishing). Per-swing-loop check would
      // be more accurate for attack-multi, but the spec calls for a flat
      // pre-routing add — so we lift `raw` once and let the loop ride.
      const drunkenIncomingActive = powers.some(p => p.installPower?.id === 'drunken-confidence' || p.id === 'jv2-p-hold-my-drink');
      if (drunkenIncomingActive && raw > 0) {
        raw += 2;
        setDrunkenTelemetry(t => ({ ...t, incomingPenalty: t.incomingPenalty + 2 }));
      }
      // v2.10: annotation reduces incoming attack BEFORE shield routing.
      const annAtkRed = annoFx('enemyAtkReduction');
      if (annAtkRed > 0) raw = Math.max(0, raw - annAtkRed);
      // v2.37: HOLD ON — reactive interrupt. If the player armed the
      // "Hold on, hold on —" skill, the next attack's FIRST swing is
      // reduced by holdOnValue (snapshotted at skill play time). On an
      // attack-multi we apply the reduction once to the pre-swing-loop
      // `raw` value: the loop reuses `raw` for every swing, so reducing
      // it once would persist the reduction to ALL swings. Instead, we
      // capture the reduced raw as a per-first-swing override and
      // restore the unreduced raw for swings 2..N. The flag clears
      // unconditionally — no free re-cast.
      let holdOnFirstSwingRaw = null;
      if (holdOnArmed) {
        const reduced = Math.max(0, raw - (holdOnValue || 0));
        const prevented = raw - reduced;
        holdOnFirstSwingRaw = reduced;
        pushLog(`🛑 Hold on — reduced damage by ${holdOnValue || 0}.`);
        logEvent('wit.holdOn', {
          longThreadAtPlay: holdOnValue || 0,
          damagePrevented: prevented,
          enemyId: enemy?.id, enemyTier: enemy?.tier,
        });
        setHoldOnArmed(false);
        setHoldOnValue(0);
      }
      const rawReduction = effectSources().reduce((s, x) => s + (x.effect?.damageReduction || 0), 0)
                         + equipment.reduce((s, eq) => s + (eq.bonus?.damageReduction || 0), 0);
      const reduction = Math.min(2, rawReduction);
      // v2.9: Beetle's first-hit absorb — applied BEFORE shield routing
      // so it works against both pool types. Consumed on first hit only.
      if (beetleAbsorb > 0 && raw > 0) {
        const absorbed = Math.min(beetleAbsorb, raw);
        raw = Math.max(0, raw - absorbed);
        setBeetleAbsorb(0);
        pushLog(`🪲 Beetle absorbs ${absorbed}.`);
      }
      let wBlock = block;
      let wPoise = poise;
      let wHp = hp;
      let wComp = composure;
      // v2.27: Hit Me Again — per-swing recoil + charge accrual. Each swing
      // first eats `charges` self-damage on the enemy (composure if hp:999
      // sentinel, else HP — physical pool first if HP is real). Then resolves
      // its damage on the player. Then arms a new charge if the swing landed
      // (any damage > 0 reaching the player counts — block-absorbed still
      // counts per spec). Mutates local copies of enemy pools so the multi-
      // swing path doesn't lose state between swings.
      let recoilWComp = enemyComposure;
      let recoilWHp = enemyHp;
      let recoilCharges = hitMeAgainCharges;
      let recoilTotal = 0;
      for (let i = 0; i < hits; i++) {
        // Recoil fires BEFORE the swing's player-damage resolves.
        if (hitMeAgainInstalled && recoilCharges > 0) {
          const recoil = recoilCharges;
          // Prefer HP if it's a real pool; fall back to composure for hp:999
          // sentinels (Hollow Weaver, Silk Wraith, etc.).
          const enemyHpIsReal = (enemy?.hpMax || 0) < 900;
          if (enemyHpIsReal && recoilWHp > 0) {
            recoilWHp = Math.max(0, recoilWHp - recoil);
          } else {
            recoilWComp = Math.max(0, recoilWComp - recoil);
          }
          recoilTotal += recoil;
          if (recoilWComp <= 0 || (enemyHpIsReal && recoilWHp <= 0)) {
            // Enemy died to its own swing — stop here.
            break;
          }
        }
        // v2.37: HOLD ON applies ONLY to the first swing of an attack/
        // attack-multi. swings 1..N use the unreduced `raw`.
        let remaining = (i === 0 && holdOnFirstSwingRaw != null) ? holdOnFirstSwingRaw : raw;
        if (reduction > 0 && remaining > 0) remaining = Math.max(1, remaining - reduction);
        // v2.52: DRUNKEN STAGGER — per-swing 50% dodge. Rolled BEFORE the
        // shield-routing block so a missed swing zeroes out completely (no
        // block consumed, no recoil arm, no LongThread reset). attack-multi
        // rolls per swing — partial dodges feel chaotic, which is the point.
        if (staggerActive && remaining > 0 && Math.random() < 0.5) {
          const avoided = remaining;
          remaining = 0;
          setStaggerTelemetry(t => ({
            ...t,
            missesAvoided: t.missesAvoided + 1,
            damageAvoided: t.damageAvoided + avoided,
          }));
          pushLog(`🌀 Missed! Drunken stagger.`);
          logEvent('jnsq.stagger.dodge', {
            damageAvoided: avoided, swingIndex: i,
            enemyId: enemy?.id, enemyTier: enemy?.tier,
          });
          // Skip to next swing — no block consumption, no landed flag.
          continue;
        }
        let landed = false;
        if (targetsComposure) {
          if (wPoise > 0) {
            const absorbed = Math.min(wPoise, remaining);
            wPoise -= absorbed; remaining -= absorbed;
            if (absorbed > 0) landed = true;
          }
          if (remaining > 0) {
            const before = wComp;
            wComp = Math.max(0, wComp - remaining);
            if (before > wComp) landed = true;
          }
        } else {
          if (wBlock > 0) {
            const absorbed = Math.min(wBlock, remaining);
            wBlock -= absorbed; remaining -= absorbed;
            if (absorbed > 0) landed = true;
          }
          if (remaining > 0) {
            const before = wHp;
            wHp = Math.max(0, wHp - remaining);
            if (before > wHp) landed = true;
          }
        }
        // Arm a new charge — the swing landed somewhere (block or pool).
        // Per spec: "whether absorbed by block or hitting HP."
        if (hitMeAgainInstalled && landed) recoilCharges += 1;
        if (wHp <= 0 || wComp <= 0) break;
      }
      // Commit recoil + charge state.
      if (hitMeAgainInstalled && recoilTotal > 0) {
        setEnemyComposure(recoilWComp);
        setEnemyHp(recoilWHp);
        pushLog(`⚡ Hit me again recoils: -${recoilTotal} on ${enemy?.name || 'enemy'}.`);
        if (recoilWComp <= 0 || ((enemy?.hpMax || 0) < 900 && recoilWHp <= 0)) {
          setTimeout(() => onEnemyDefeated(), 200);
        }
      }
      if (hitMeAgainInstalled && recoilCharges !== hitMeAgainCharges) {
        setHitMeAgainCharges(recoilCharges);
      }
      setBlock(wBlock);
      setPoise(wPoise);
      setHp(wHp);
      setComposure(wComp);
      // Hit-shake the player HUD if either pool actually moved. Block-only
      // absorption (both pools unchanged) shouldn't shake — that beat is
      // "the bracing worked," visually distinct from "you got hit."
      if (wHp < hp || wComp < composure) setPlayerHitFlash(Date.now());
      // v2.34: LONG THREAD — record unblocked damage this turn so the
      // end-of-turn bookkeeping resets the meter. Block-absorbed-only
      // hits leave the thread intact (that's the wit defender's whole
      // point). Either pool moving downward counts as "the hit landed."
      if (wHp < hp || wComp < composure) setUnblockedThisTurn(true);
      pushLog(`👹 ${e.name}: ${intent.telegraph}`);
      // v2.10: reactive annotation damage on enemy attack.
      const annReactive = annoFx('damageOnEnemyAttack');
      if (annReactive > 0) {
        applyDamageToEnemyComposure(annReactive);
        pushLog(`📝 Annotation lashes back: -${annReactive} comp.`);
      }
      if (wHp <= 0 || wComp <= 0) playerDied = true;
    } else if (intent.kind === 'block') {
      setEnemyBlock(b => b + intent.value);
      pushLog(`👹 ${e.name}: 🛡 +${intent.value}`);
    } else if (intent.kind === 'vulnerable') {
      // Enemy applies vulnerable to player → enemy hits harder.
      // v2.32: NOT LISTENING — first debuff (Weak/Vuln) per combat is ignored.
      if (notListeningCharges > 0) {
        setNotListeningCharges(c => Math.max(0, c - 1));
        pushLog(`🙉 ${e.name}: ${intent.telegraph} — didn't hear it.`);
      } else {
        adjustEnemyDmg(+0.25 * intent.value);
        pushLog(`👹 ${e.name}: 💢 +${25*intent.value}% to incoming dmg.`);
      }
    } else if (intent.kind === 'weak') {
      // Enemy applies weak to player → player spells weaker.
      // v2.32: NOT LISTENING absorb.
      if (notListeningCharges > 0) {
        setNotListeningCharges(c => Math.max(0, c - 1));
        pushLog(`🙉 ${e.name}: ${intent.telegraph} — didn't hear it.`);
      } else {
        adjustPlayerDmg(-0.25 * intent.value);
        pushLog(`👹 ${e.name}: 💢 −${25*intent.value}% to your spell potency.`);
      }
    }
    // Riders: a combo intent can attach extra side-effects that fire AFTER
    // the main effect. Keys: weak (player potency down), vulnerable (player
    // damage taken up), block (enemy gains block). Riders apply even on
    // lethal attacks — that's flavor, not bug. Keep telegraphs honest: the
    // intent.telegraph string above should already advertise the rider.
    if (intent.riders) {
      const r = intent.riders;
      // v2.32: NOT LISTENING absorbs the FIRST debuff (weak OR vuln) it sees.
      // Riders on attack intents check the live charge count too. We use a
      // local consume-counter so a swing that carries BOTH weak and vuln only
      // burns one charge (the first one), per the "one absorb per combat" rule.
      let nlConsumed = false;
      const tryNlAbsorb = (label) => {
        if (!nlConsumed && notListeningCharges > 0) {
          nlConsumed = true;
          setNotListeningCharges(c => Math.max(0, c - 1));
          pushLog(`🙉 ${label} rider — didn't hear it.`);
          return true;
        }
        return false;
      };
      if (r.weak) {
        if (!tryNlAbsorb('Weak')) adjustPlayerDmg(-0.25 * r.weak);
      }
      if (r.vulnerable) {
        if (!tryNlAbsorb('Vulnerable')) adjustEnemyDmg(+0.25 * r.vulnerable);
      }
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
    // v2.22: post-combat heal nerfed 8% → 4% maxHp. Live playtest:
    // user finished act 1 hovering 50-70 HP, "truly hasn't worried about
    // damage taken once." Cutting to zero overshot in sim (0% wins).
    // 4% is a token recovery — meaningful only across many fights.
    const healHp = Math.floor(maxHp * 0.04);
    const healComp = Math.floor(composureMax * 0.04);
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
    // v2.68: act-scaled rarity weights. Per playtest: Act 2 rewards
    // felt all-common. STS-style scaling — later acts shift toward
    // uncommons + rares. Act 1 = early commons dominate; Act 2 = mix
    // tilted to uncommons; Act 3 (final) = uncommons + rares.
    const actIdx = currentActIdx || 0;
    let weights;
    if (enemy.tier === 'elite') {
      // Elites always shift up: Act 1 = uncommon-favored, Act 2+ = rare-favored.
      weights = actIdx === 0
        ? { common: 1, uncommon: 4, rare: 1 }
        : { common: 1, uncommon: 3, rare: 2 };
    } else {
      // Normal enemies: scale with act.
      weights = actIdx === 0 ? { common: 4, uncommon: 1 }
              : actIdx === 1 ? { common: 2, uncommon: 3, rare: 1 }
              :                { common: 1, uncommon: 4, rare: 2 };
    }
    const choices = [];
    const lane = selectedCharacter?.lane || null;
    // v2.60: rewards never offer cards that are already in the starting
    // deck — every reward should bring a new mechanic, not a vanilla
    // duplicate of what you opened with.
    const starterIds = lane ? buildStarterDeckForLane(lane) : [];
    const used = [...starterIds];
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
    if (kind === 'forget') {
      // v2.8: card removal. Same flow as upgrade — pick one card and
      // remove it from the deck. Rest node stays selected; the picker
      // returns to map on confirm or cancel.
      setStage('forget');
      return;
    }
  }

  // v2.8: Remove a card from the deck at a rest site. Mirrors
  // pickCardToUpgrade. cardUid === null cancels back to the rest screen.
  function pickCardToForget(cardUid) {
    if (cardUid === null) {
      logEvent('forget.cancel', { deckSize: deck.length });
      setStage('rest');
      return;
    }
    const target = deck.find(c => c.uid === cardUid);
    logEvent('forget.pick', { cardId: target?.id, cardName: target?.name, type: target?.type, deckSize: deck.length });
    setDeck(prev => prev.filter(c => c.uid !== cardUid));
    if (target) pushLog(`🛏 Forgot ${target.name || target.phrase}. Off the deck for good.`);
    setRestNode(null);
    returnToMap();
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

  if (stage === 'character-select') return <CharacterSelectScreen characters={CHARACTERS} onSelect={pickCharacter} onPractice={startTutorial} />;
  if (stage === 'supply-shop')   return <SupplyShopScreen offers={supplyOffers} onPick={pickSupplyOffer} character={selectedCharacter} />;
  if (stage === 'familiar-shop') return <FamiliarShopScreen onPick={pickFamiliar} />;
  if (stage === 'familiar-name') return <FamiliarNameScreen familiar={familiar} onConfirm={confirmFamiliarName} />;
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
  if (stage === 'forget')  return <ForgetCardScreen deck={deck} onPick={pickCardToForget} />;
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
      peekedNextIntent={peekedNextIntent}
      enemyDmgMult={enemyDmgMult} playerDmgMult={playerDmgMult}
      enemyHitFlash={enemyHitFlash} playerHitFlash={playerHitFlash} dmgFloaters={dmgFloaters}
      hp={hp} maxHp={maxHp}
      playerComposure={composure} playerComposureMax={composureMax}
      block={block} poise={poise} energy={energy} hand={hand}
      amplifyPlaysThisCombat={amplifyPlaysThisCombat}
      deck={deck} discard={discard} tray={tray}
      energyMax={energyPerTurnRefill()}
      equipment={equipment} powers={powers} relics={relics}
      familiar={familiar} familiarName={familiarName}
      onPlayCard={playCard} onEndTurn={endTurn}
      onUnstage={unstageCard} onCast={castStagedSpell}
      castPreview={previewCastDamage()}
      castsThisTurn={castsThisTurn} maxCastsPerTurn={MAX_CASTS_PER_TURN}
      isChutzpah={selectedCharacter?.lane === 'chutzpah'}
      stakeAmount={stakeAmount} setStakeAmount={setStakeAmount}
      isJnsq={selectedCharacter?.lane === 'jnsq'}
      rollOptIn={rollOptIn} setRollOptIn={setRollOptIn}
      lastRoll={lastRoll} combatRolls={combatRolls}
      tunnelVision={tunnelVision} rageActive={rageActive}
      cornerTokens={cornerTokens} intentHidden={intentHidden}
      loudCount={loudCount}
      longThread={longThread}
      isWit={selectedCharacter?.lane === 'wit'}
      footnotePromptActive={footnotePromptActive}
      onApplyFootnote={applyFootnote}
      onCancelFootnote={cancelFootnotePrompt}
      lastCastSnapshot={lastCastSnapshot}
      arguingBackThisTurn={arguingBackThisTurn}
      holdOnArmed={holdOnArmed}
      holdOnValue={holdOnValue}
      pendingMissteps={pendingMissteps}
      combatTurn={combatTurn}
      openingExtended={openingExtended}
      patienceInstalled={patienceInstalled}
      patienceStacks={patienceStacks}
      pauseHeld={pauseHeld}
      pauseHeldActive={pauseHeldActive}
      wontShutUpArmed={wontShutUpArmed}
      staggerActive={staggerActive}
      notListeningCharges={notListeningCharges}
      hitMeAgainCharges={hitMeAgainCharges}
      log={log}
    />
    {tutorialActive && <TutorialOverlay
      step={tutorialStep}
      lane={tutorialLane}
      onAdvance={() => setTutorialStep(s => s + 1)}
      onExit={exitTutorial}
    />}
    {/* v2.85: pick-one-of-two-to-forget modal. Fires when an event /
        sidequest triggered loseRandomCard. Modal blocks until the
        player picks one card to lose; the other stays in the deck. */}
    {forgetTwoPrompt && <ForgetTwoModal
      cards={forgetTwoPrompt.cards}
      onPick={resolveForgetTwoChoice}
    />}
  </>;
}

// =============================================================================
// 4. SUB-SCREENS
// =============================================================================

function MenuScreen({ onStart, onTutorial, onContinue, onDiscardSave }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="font-display text-6xl text-gold-300 tracking-widest text-center">Witch Mountain Bridge</h1>
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
function TutorialOverlay({ step, lane = 'wit', onAdvance, onExit }) {
  // Lane-flavored examples — same step structure, different signature
  // mechanic explainer at step 4.
  const laneName = lane === 'wit' ? 'Wit'
                 : lane === 'chutzpah' ? 'Chutzpah'
                 :                       'Je Ne Sais Quoi';
  const laneStat = lane === 'wit' ? '✨' : lane === 'chutzpah' ? '💪' : '🌀';
  // Lane-specific signature-mechanic explainer for step 4.
  const signatureBody = lane === 'wit' ? (<>
        <p><b>🧵 Long Thread</b> — your signature meter. Every turn you cast a wit Effect AND take no unblocked damage, your thread grows. Cards like <i>"is, perhaps, the natural conclusion."</i> deal <b>+N × thread</b> bonus damage. Defend like your life depends on the build.</p>
        <p className="mt-2">Other wit-only tools you'll see: <b>📖 Footnote</b> (attach +1 wit to a phrase permanently), <b>🛑 Hold On —</b> (interrupt an enemy attack), <b>🎩 Opening Statement</b> (turn-1 burst damage). Build patiently, finish big.</p>
      </>)
    : lane === 'chutzpah' ? (<>
        <p><b>🔥 Tunnel Vision</b> — your signature meter. Each chutzpah card played adds +1 to the meter. At <b>5+</b>, you enter <b>RAGE</b> next turn: all chutzpah damage +50%. Ride it for the burst, but you can't play Skills during RAGE.</p>
        <p className="mt-2">Other chutzpah-only tools: <b>🏚 Doubling Down</b> (corner tokens — bill you if the enemy survives), <b>📢 Saying it Louder</b> (demanding words stack damage), <b>⚡ Hit Me Again</b> (Power — enemy attacks bill the enemy back).</p>
      </>)
    : (<>
        <p><b>🌀 Tangent</b> — your signature trick. Skill cards like <i>"That reminds me,"</i> discard a random card from your draw pile and fire a random jnsq from your discard pile. Stack jnsq cards into discard so the chaos pool is rich.</p>
        <p className="mt-2">Other jnsq-only tools: <b>🤫 Awkward Pause</b> (hold the tray, double next cast), <b>🍺 Drunken Confidence</b> (Power — +50% damage but +2 incoming), <b>🗯 Babbling</b> (Power — cast twice per turn), <b>🌀 Stagger</b> (50% enemy miss chance).</p>
      </>);

  const STEPS = [
    {
      title: `Welcome — ${laneName} practice match.`,
      body: (<>
        <p>The Bursar has offered to spar with you. <i>Verbally</i>, of course — wizards prefer it that way. He's pulling his punches; you can't actually lose this match.</p>
        <p className="mt-2">Three things you'll need to know: <b>Words build spells</b>. <b>Effects (targets) cast them</b>. <b>Skills</b> (like Defend) do their thing immediately.</p>
        <p className="mt-2">Watch the <b>HP</b> (❤), <b>Composure</b> (✨), <b>Block</b> (🛡), <b>Poise</b> (🪞), and <b>Energy</b> (⚡) at the bottom of the screen. Energy refills every turn — spend it on cards.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 1 — Play a Word card.',
      body: (<>
        <p>Look at your hand. <b>Word cards</b> have slot labels like INTRO, SUBJECT, or MODIFIER (top-left). They don't damage the enemy alone — they add stat points to your <b>Spell Tray</b> above the hand.</p>
        <p className="mt-2">Play a Word card. Any will do. Watch the Tray fill up with the phrase.</p>
      </>),
      cta: '(play any Word card)',
      waitsForAction: true,
    },
    {
      title: 'Step 2 — Stage a Target and CAST.',
      body: (<>
        <p>Excellent. Your tray now has a {laneStat} {laneName} stat point.</p>
        <p className="mt-2"><b>Target cards</b> (slot label: TARGET) seal the spell. Click one — it goes to the tray. The tray shows a <b>Predicted damage</b> number. Click the big <b>✨ CAST</b> button to fire.</p>
        <p className="mt-2">A complete spell needs <b>intro + subject + target</b>. You can stage up to 2 modifiers for extra effects. Click a staged card to take it back.</p>
      </>),
      cta: '(stage a Target, then click CAST)',
      waitsForAction: true,
    },
    {
      title: 'Step 3 — Resistances, defense, and fizzling.',
      body: (<>
        <p>You drained some of the Bursar's <b>Composure</b> (the ✨ bar). Drain it to 0 and he concedes.</p>
        <p className="mt-2"><b>Effectiveness badges</b> next to the Intent show how the enemy reacts to each stat: <b>×1</b> baseline · <span className="text-moss-300">×1.5–2 susceptible</span> · <span className="text-ember-300">×0.5 resistant</span> · <span className="text-parchment-400">×0 immune</span>. Pick a wizard whose lane the enemy fears.</p>
        <p className="mt-2"><b>Defend</b> grants Block (🛡) — absorbs physical damage. <b>Compose Yourself</b> grants Poise (🪞) — absorbs composure damage. Block and Poise reset at start of YOUR next turn — spend them this turn or lose them.</p>
        <p className="mt-2">If you stage words but never play a Target, the spell <b>fizzles</b> at end of turn. The stat points vanish. Don't let that happen.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: `Step 4 — ${laneName}'s signature mechanic.`,
      body: signatureBody,
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 5 — Finish the match.',
      body: (<>
        <p>You've got the basics. Finish the Bursar at your leisure. Cards drift back into your deck via the discard pile; when your draw pile empties, the discard reshuffles in.</p>
        <p className="mt-2">After this match, you'll be returned to the wizard select. Choose a wizard for real and walk the path.</p>
      </>),
      cta: 'Got it — finish him',
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

// v2.54: per-character tutorial content rewritten for the
// conv-mechanics arc (v2.24-v2.53). Each lane teaches its NEW
// signature mechanics — Rage / Long Thread / Tangent — plus the
// 6-8 supporting primitives that landed across the 30 cycles.
// Surfaced under the character cards on the selection screen.
const WIZARD_TUTORIALS = {
  wit: {
    color: 'iris',
    icon: '🧵',
    title: 'The Wit Playstyle',
    subtitle: 'Build the thread. Defend the thread with itself.',
    overview: 'Wit wins by NOT taking unblocked hits. Every clean turn fattens the Long Thread, and every wit Effect card scales off it. You footnote your favorite phrases until they\'re crushing, you interrupt the fight to protect the argument you\'re still building, and you finish with a single in-summary capstone that quotes everything you\'ve already said. You are an unkindly correct librarian who refuses to be interrupted.',
    sections: [
      {
        heading: '🧵 LONG THREAD (the signature)',
        body: 'A persistent meter shown as 🧵 in your stat block (below the hand). Tick +1 at end of every turn where you cast a wit Effect AND took zero unblocked damage. Take ANY unblocked hit and it resets to zero. Wit Effect cards then read "+N per Long Thread" — at 3+ Thread your big casts are huge. The whole lane is about defending this number with your life.',
        examples: [
          { name: 'as I was saying,', text: 'Cheap intro. Adds +1 wit per Long Thread to this cast.' },
          { name: 'is, perhaps, the natural conclusion.', text: 'Mid-tier target. Final damage scales with current Thread.' },
        ],
      },
      {
        heading: '📌 FOOTNOTE — pin a phrase',
        body: 'A Skill card. Pick any Word in your hand or discard and stamp a permanent +1 wit footnote on it for the rest of combat. Stacks — the same phrase can be footnoted three or four times until it\'s a sledgehammer. Choose the word you plan to keep re-saying.',
        examples: [
          { name: 'As Hewn-Greaves notes in his footnotes,', text: 'The Footnote skill. Pick the word, mark it forever.' },
          { name: 'On reflection,', text: 'Self-footnotes itself — a phrase that gets sharper every reread.' },
        ],
      },
      {
        heading: '🗣 "ACTUALLY—" and HOLD ON —',
        body: 'Two conversational moves. Actually— re-fires your last cast at +50% scaling, but stacks an "arguing back" debuff that adds damage to enemy attacks until your turn ends. Hold On — plays REACTIVELY during the enemy intent reveal and reduces the incoming hit by your Long Thread. The Thread that\'s about to be broken protects itself.',
        examples: [
          { name: 'Actually—', text: 'Re-fire last cast +50%. Enemies hit harder this turn. Worth it on a kill.' },
          { name: 'Hold on, hold on —', text: 'Reactive interrupt. Negates X damage where X = your Long Thread.' },
        ],
      },
      {
        heading: '⏳ PATIENCE and OPENING STATEMENT',
        body: 'Two tempo tools. Patience (Power) banks every skip-cast turn into a stack; your next cast pays out per-stack. Opening Statement gives you turn-1 scaling on the first wit Effect you cast — and "to revisit my opening point," brings the bonus back later in combat. Wit rewards CHOOSING when to speak, not speaking constantly.',
      },
      {
        heading: '⚠ SAYING SOMETHING WRONG',
        body: 'High-scaling wit Effects queue a "Misstep" token that auto-plays from your hand 2 turns later — 3 damage to you, exhausts. Pay 1 energy on it the turn it lands to scrub it. The big cast is real damage NOW; the cost lands when you\'ve hopefully won.',
      },
      {
        heading: '🏛 CAPSTONE — "in summary,"',
        body: 'The synergy target "is, in summary, the inescapable conclusion." reads the WHOLE turn back: Long Thread scaling + opening-statement bonus + a delayed Misstep on the back end. Three of the lane\'s mechanics converge in one line. Build the engine, then say it.',
      },
      {
        heading: 'Your job, in one line',
        body: 'Block everything. Stack the Thread. Footnote your best Word. When the Thread is fat and you have an opening callback ready, fire the in-summary capstone and accept the Misstep.',
      },
    ],
  },
  chutzpah: {
    color: 'ember',
    icon: '🔥',
    title: 'The Chutzpah Playstyle',
    subtitle: 'Tunnel-vision the kill. Eat the rest later.',
    overview: 'Chutzpah wins by going RAGE-mode and dumping doubled damage into one enemy before consequences land. You stack a meter by playing chutzpah words, you eat HP-bills if you fail to close, and you have a capstone that does it all at once. You are Walter Sobchak at a meeting that has gone on too long.',
    sections: [
      {
        heading: '🔥 TUNNEL VISION → RAGE (the signature)',
        body: 'Every chutzpah Word you play adds +1 to the Tunnel Vision meter. At 5+ at the start of your turn you enter RAGE — all chutzpah damage +50%, but you CAN\'T play Skill cards (no Block, no Heal) and you can\'t see next-turn intent. Ride the rage and one-shot the enemy, or break it by playing a non-chutzpah turn before the threshold.',
        examples: [
          { name: 'Foaming at the mouth,', text: 'Chutzpah 3 intro — fills the meter fast.' },
          { name: 'Bare knuckles.', text: 'Pure chutzpah skill — fills the meter and gives you a turn of pressure.' },
        ],
      },
      {
        heading: '🩸 DOUBLING DOWN — corner tokens',
        body: 'Some chutzpah Effects carry a `doubleDown` rider. Each one adds a "Backed Into A Corner" token. If the enemy is still alive at end of turn, every token bills you 2 HP. Tokens clear either way. The math is: only commit if you\'re sure of the kill.',
        examples: [
          { name: '"and that\'s the LAST word on it."', text: 'doubleDown target. Big damage, but a corner token if you whiff.' },
          { name: 'or we\'ll see who blinks first.', text: 'doubleDown — the kill-or-bleed contract.' },
        ],
      },
      {
        heading: '💨 STORM OUT — commit-and-flee',
        body: 'A one-shot Effect that costs ALL your remaining energy and ends the turn immediately. Massive damage. Hides next-turn enemy intent (you\'re not looking). The whole turn is committed to one swing. Bring it out when the math says one big number ends the combat.',
        examples: [
          { name: 'is officially my last problem.', text: 'The Storm Out target. All-energy spend, no block phase, blind next turn.' },
        ],
      },
      {
        heading: '👊 HIT ME AGAIN (Power)',
        body: 'A reactive Power. While installed, every enemy attack that lands on you (blocked or not) adds +1 self-damage to their NEXT swing. You don\'t dodge — you BILL them. Stacks over the combat. Pairs beautifully with low-block chutzpah turns: take the hit, charge them for it.',
      },
      {
        heading: '📣 SAYING IT LOUDER & SMELL WEAKNESS',
        body: 'Two scaling levers. "I SAID." targets pay +damage per `demanding`-tag Word played this turn — Saying-It-Louder stacks repetition into damage. Smell-Weakness Effects add a predator rider when the enemy is already Vulnerable/Weak — the lane finishes wounded prey faster.',
        examples: [
          { name: 'I SAID.', text: 'Scales with the count of demanding Words you stacked this turn.' },
          { name: 'comes apart in your hands.', text: 'Predator target — extra damage vs Vulnerable enemies.' },
        ],
      },
      {
        heading: '💥 CAPSTONE — "AND I\'M NOT DONE."',
        body: 'The synergy target combines all three signature levers in one cast: doubleDown corner token, loud-scaling per demanding-tag, AND predator bonus vs weakened enemies. Pair with "I\'ve barely warmed up," for the modifier chain. This is the lane\'s nuke — and the bill if you miss.',
      },
      {
        heading: 'Your job, in one line',
        body: 'Stack chutzpah words to 5 Tunnel Vision, RAGE the next turn, and dump everything you have into one corner-token cast. If you don\'t kill, you bleed. That\'s the point.',
      },
    ],
  },
  jnsq: {
    color: 'moss',
    icon: '🌀',
    title: 'The Jnsq Playstyle',
    subtitle: 'Commit to the detour. The detour pays.',
    overview: 'Jnsq wins by leaning into chaos with AGENCY: you decide WHEN to spin, the universe decides what spills out. You stack jnsq cards in your discard so Tangent can fish from a richer pool. You install Drunken Confidence to scale everything +50% at the cost of taking +2 from every hit. You apologize when you over-commit and restart clean. You are Kramer entering every room sideways with a half-finished thought.',
    sections: [
      {
        heading: '🌀 TANGENT (the signature)',
        body: 'A Skill card. On play: discard a random card from your draw pile, then fire a random Jnsq card from your DISCARD pile this turn — costs 0 energy, resolves normally. AGENCY is the trick: you choose WHEN to take the detour, but not what surfaces. Stack jnsq into discard before you fire it.',
        examples: [
          { name: 'That reminds me,', text: 'The Tangent skill. Discard one, fire one jnsq from discard.' },
          { name: 'speaking of which,', text: 'Modifier — the same detour, mid-spell.' },
        ],
      },
      {
        heading: '🙇 THE APOLOGY — reset valve',
        body: 'When you\'ve over-committed and the tray is going sideways, an Apology clears it: discard the spell tray, heal 4 HP, apply +1 Vulnerable to the enemy. The trade is offense-for-survival, plus a debuff for the enemy. Use it when the spell would fizzle anyway.',
        examples: [
          { name: "I shouldn't have said that — have you eaten?", text: 'The Apology skill — clear, heal, vuln.' },
          { name: 'sorry, restarting,', text: 'Cheaper apology intro — opens a clean tray.' },
        ],
      },
      {
        heading: '🗨 WON\'T SHUT UP — commitment chain',
        body: 'Powerful jnsq Effects carry `mustPlayAnotherJnsq`. Cast one, and if you don\'t follow up with a SECOND jnsq this turn, you eat 3 damage at end of turn. The card is great, but only if your deck can chain. Build the jnsq pool before you cast.',
        examples: [
          { name: 'the soup, you see, was never the point.', text: 'Big payload. Commit-or-bleed clause attached.' },
        ],
      },
      {
        heading: '🥃 DRUNKEN CONFIDENCE (Power)',
        body: 'A Power that scales ALL your Effect cards +50%, at the cost of +2 incoming damage from every enemy attack. Discardable for free if it stops being worth it. Turn-by-turn judgment: when the enemy isn\'t hitting hard, the +50% is free money.',
      },
      {
        heading: '⏸ AWKWARD PAUSE & BABBLING',
        body: 'Two tempo levers borrowed from the gambler\'s mindset. Awkward Pause skips a casting turn — but the spell tray persists into next turn at DOUBLED stat values. Babbling (Power) gives you a 60% chance of a SECOND cast each turn. Both reward jnsq-heavy decks that don\'t mind variance.',
        examples: [
          { name: '"...go on, I\'m listening."', text: 'Awkward Pause skill — hold the tray, double next turn.' },
          { name: '"Wait — and another thing,"', text: 'Babbling power — installs the 60%-chance second cast.' },
        ],
      },
      {
        heading: '🌫 DRUNKEN STAGGER — chaotic defense',
        body: 'A Skill that grants a one-turn 50% miss chance on enemy attacks. Your defense is "the enemy whiffed." Pairs perfectly with Drunken Confidence — the +2 damage tax matters less when half the hits don\'t land.',
        examples: [
          { name: 'sorry, I lost my balance for a second,', text: 'Drunken Stagger — coin-flip incoming attacks this turn.' },
          { name: 'in the dimmest possible terms,', text: 'Modifier — works under the stagger to keep the cast affordable.' },
        ],
      },
      {
        heading: '🌌 CAPSTONE — "the universe went sideways."',
        body: 'The synergy target "and then the entire universe — and I mean THIS universe — went sideways." combines tangent-on-cast, per-tag jnsq bonus, AND the must-play-another-jnsq clause. Three mechanics, one line. Pair with "oh — actually, three things, sorry," for the extra chain piece.',
      },
      {
        heading: 'Your job, in one line',
        body: 'Stuff jnsq into discard. Install Drunken Confidence. Fire Tangents when the discard is fat. Apologize when the tray spirals. End on the universe-sideways capstone with a follow-up ready.',
      },
    ],
  },
};

function CharacterSelectScreen({ characters, onSelect, onPractice }) {
  const [tutorialLane, setTutorialLane] = useState(null);
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-6 max-w-6xl mx-auto">
      <h2 className="font-display text-5xl text-gold-300 tracking-widest text-center">Choose Your Wizard</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-2xl">
        The school taught you words. The graduation requires that you commit
        to one voice and walk the path with it. The path is the same path.
        The voice changes everything.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4 w-full">
        {characters.map(c => {
          const tut = WIZARD_TUTORIALS[c.lane];
          // Static class strings per lane so Tailwind's purge keeps them.
          const tutBtnClass = c.lane === 'wit'      ? 'border-iris-500 bg-iris-900 text-iris-200 hover:bg-iris-800'
                            : c.lane === 'chutzpah' ? 'border-ember-500 bg-ember-900 text-ember-200 hover:bg-ember-800'
                            :                         'border-moss-500 bg-moss-900 text-moss-200 hover:bg-moss-800';
          return (
            <div key={c.id}
              className="flex flex-col gap-3 p-6 bg-ink-700 border-2 border-ink-500 rounded-lg shadow-lg">
              <div className="text-xs uppercase tracking-widest text-gold-500">{c.lane === 'jnsq' ? 'Je Ne Sais Quoi' : c.lane}</div>
              <h3 className="font-display text-3xl text-gold-300">{c.name}</h3>
              <div className="text-sm italic text-parchment-200">{c.title}</div>
              <p className="font-quill text-parchment-100 leading-relaxed text-sm">{c.desc}</p>
              <div className="flex flex-wrap gap-1 mt-auto pt-3 border-t border-ink-500">
                {c.tagPalette.map(t => (
                  <span key={t} className="text-[10px] uppercase tracking-wide bg-ink-600 text-parchment-300 px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => onSelect(c.id)}
                  className="flex-1 btn btn-gold text-sm py-2">
                  Choose
                </button>
                {onPractice && (
                  <button onClick={() => onPractice(c.lane)}
                    className={`text-sm py-2 px-3 border-2 rounded ${tutBtnClass}`}
                    title={`Run a practice match as the ${c.lane} wizard — teaches the symbols, spell-tray, and lane signature.`}>
                    ⚔ Practice
                  </button>
                )}
                {tut && (
                  <button onClick={() => setTutorialLane(c.lane)}
                    className={`text-xs py-2 px-2 border-2 rounded ${tutBtnClass}`}
                    title={`Read a summary of the ${c.lane} playstyle.`}>
                    📖 Read
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="font-quill italic text-stone-400 text-xs text-center max-w-2xl mt-4">
        Each character has a unique combat mechanic. Click <b>How to play</b> for a walkthrough before committing.
      </p>
      {tutorialLane && (
        <WizardTutorialModal lane={tutorialLane} onClose={() => setTutorialLane(null)} />
      )}
    </div>
  );
}

function WizardTutorialModal({ lane, onClose }) {
  const tut = WIZARD_TUTORIALS[lane];
  if (!tut) return null;
  // Static class literals per lane so Tailwind's purge keeps them.
  const c = lane === 'wit'      ? { border: 'border-iris-500',  bg: 'bg-iris-900',   accent: 'text-iris-300' }
          : lane === 'chutzpah' ? { border: 'border-ember-500', bg: 'bg-ember-900',  accent: 'text-ember-300' }
          :                       { border: 'border-moss-500',  bg: 'bg-moss-900',   accent: 'text-moss-300' };
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`parchment-card-strong p-6 max-w-3xl w-full flex flex-col gap-4 border-2 ${c.border} my-4`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`text-xs uppercase tracking-widest ${c.accent}`}>{tut.icon} How to play</div>
            <h3 className={`font-display text-3xl ${c.accent}`}>{tut.title}</h3>
            <p className="font-quill italic text-parchment-300 text-base">{tut.subtitle}</p>
          </div>
          <button onClick={onClose} className="btn bg-ink-700 text-parchment-200 text-sm px-3 py-1">Close</button>
        </div>
        <p className="font-quill text-parchment-100 leading-relaxed text-base">{tut.overview}</p>
        <div className="flex flex-col gap-3">
          {tut.sections.map((s, i) => (
            <div key={i} className={`p-3 rounded border ${c.border} ${c.bg} bg-opacity-30`}>
              <div className={`font-display text-lg ${c.accent}`}>{s.heading}</div>
              <p className="text-sm font-quill text-parchment-100 leading-relaxed mt-1">{s.body}</p>
              {s.examples && s.examples.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {s.examples.map((ex, j) => (
                    <li key={j} className="text-xs text-parchment-200">
                      <span className={`font-bold ${c.accent}`}>{ex.name}</span>
                      <span className="text-parchment-300"> — {ex.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-2">
          <button onClick={onClose} className="btn btn-gold text-base px-8 py-2">Got it</button>
        </div>
      </div>
    </div>
  );
}

function SupplyShopScreen({ offers, onPick, character }) {
  if (!offers) return null;
  const { card, relic, boon } = offers;
  const laneColor = character?.lane === 'wit' ? 'text-iris-300'
                  : character?.lane === 'chutzpah' ? 'text-ember-300'
                  : 'text-moss-300';
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-5 max-w-5xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300">The Supply Shop</h2>
      {character && (
        <div className="text-sm text-gold-500 italic">
          For: <span className={laneColor}>{character.name}</span> · {character.lane}
        </div>
      )}
      <p className="font-quill italic text-parchment-200 text-center max-w-2xl">
        The proprietor lays out three things on the long table. "On the
        house," he says, with the conviction of a man who has watched many
        apprentices die. "<i>One</i>. Pick well."
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        {/* --- CARD OFFER --- */}
        {card && (
          <button onClick={() => onPick('card')}
            className="w-64 min-h-[320px] rounded-lg border-2 p-4 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 border-iris-500 hover:scale-105 hover:shadow-2xl cursor-pointer transition">
            <div className="text-[10px] uppercase tracking-widest text-iris-700 font-bold">📜 Card · Uncommon</div>
            <div className="flex justify-between items-center">
              <div className="font-display text-lg leading-tight">{card.name || card.phrase || ''}</div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">{card.cost}</div>
            </div>
            <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">
              {(card.slot || card.type)}{card.tier ? ` · T${card.tier}` : ''}
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
              </div>
            )}
            {card.tags && card.tags.length > 0 && (
              <div className="text-[11px] italic text-ink-500">✦ {card.tags.join(' · ')}</div>
            )}
            <div className="text-xs font-quill">{card.desc || ''}</div>
            {card.flavor && (
              <div className="text-[11px] italic opacity-70 mt-auto pt-1 border-t border-ink-300">"{card.flavor}"</div>
            )}
            <div className="text-[10px] italic text-iris-700 mt-1">Joins your deck.</div>
          </button>
        )}
        {/* --- RELIC OFFER --- */}
        {relic && (
          <button onClick={() => onPick('relic')}
            className="w-64 min-h-[320px] rounded-lg border-2 p-4 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl cursor-pointer transition">
            <div className="text-[10px] uppercase tracking-widest text-gold-700 font-bold">💎 Relic · Common</div>
            <div className="font-display text-lg leading-tight">{relic.name}</div>
            <div className="text-xs font-quill">{relic.desc}</div>
            {relic.flavor && (
              <div className="text-[11px] italic opacity-70 mt-auto pt-1 border-t border-ink-300">"{relic.flavor}"</div>
            )}
            <div className="text-[10px] italic text-gold-700 mt-1">Passive — lasts the whole run.</div>
          </button>
        )}
        {/* --- BOON OFFER --- */}
        {boon && (
          <button onClick={() => onPick('boon')}
            className="w-64 min-h-[320px] rounded-lg border-2 p-4 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 border-moss-500 hover:scale-105 hover:shadow-2xl cursor-pointer transition">
            <div className="text-[10px] uppercase tracking-widest text-moss-700 font-bold">✨ Boon · Permanent</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl">{boon.icon}</div>
              <div className="font-display text-lg leading-tight">{boon.name}</div>
            </div>
            <div className="text-xs font-quill">{boon.desc}</div>
            <div className="text-[10px] italic text-moss-700 mt-auto">Applied immediately and forever.</div>
          </button>
        )}
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

function CombatScreen({ enemy, enemyComposure, enemyHp, enemyBlock, enemyIntent, intentTick, peekedNextIntent,
                       enemyDmgMult, playerDmgMult,
                       enemyHitFlash, playerHitFlash, dmgFloaters,
                       hp, maxHp, playerComposure, playerComposureMax,
                       block, poise, energy, energyMax, hand, deck, discard, tray,
                       amplifyPlaysThisCombat,
                       equipment, powers, relics, familiar, familiarName,
                       onPlayCard, onEndTurn, onUnstage, onCast, castPreview, log,
                       castsThisTurn, maxCastsPerTurn,
                       isChutzpah, stakeAmount, setStakeAmount,
                       isJnsq, rollOptIn, setRollOptIn, lastRoll, combatRolls,
                       tunnelVision, rageActive, cornerTokens, intentHidden, loudCount,
                       longThread = 0, isWit = false,
                       footnotePromptActive = false, onApplyFootnote, onCancelFootnote,
                       lastCastSnapshot = null, arguingBackThisTurn = 0,
                       holdOnArmed = false, holdOnValue = 0,
                       pendingMissteps = [],
                       combatTurn = 1, openingExtended = false,
                       patienceInstalled = false, patienceStacks = 0,
                       pauseHeld = false, pauseHeldActive = false,
                       wontShutUpArmed = false, staggerActive = false,
                       notListeningCharges = 0, hitMeAgainCharges = 0 }) {
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
            {/* v2.65: removed duplicate Atk ×N chip — the STATUS row
                below now surfaces enemyDmgMult / playerDmgMult shifts
                more prominently. */}
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div key={`intent-${intentTick}`}
               className="intent-flash px-3 py-2 bg-ember-900 bg-opacity-60 rounded border border-ember-700 cursor-help"
               title={intentHidden
                 ? "You stormed out — you didn't see what they're winding up. Reveals next turn."
                 : (intentTooltip(enemyIntent) || 'No intent yet — it will telegraph what the enemy plans before their turn.')}>
            <div className="text-xs uppercase text-ember-300 tracking-widest">Intent <span className="text-ember-400">ⓘ</span></div>
            <div className="text-lg text-parchment-50">
              {intentHidden ? '🌫 ???' : (enemyIntent?.telegraph || '...')}
            </div>
            {/* v2.36: ACTUALLY— arguing-back surcharge. Each Actually—
                played this turn adds +1 to this enemy attack's raw damage.
                Shown inline with intent so the player sees the cost of
                their re-fires before the swing lands. */}
            {arguingBackThisTurn > 0 && (
              <div className="text-xs font-mono text-iris-300 mt-0.5"
                   title={`You corrected yourself ${arguingBackThisTurn}× — the enemy is paying attention. Next attack: +${arguingBackThisTurn} damage. Clears at end of your turn.`}>
                🗣 +{arguingBackThisTurn} (arguing back)
              </div>
            )}
          </div>
          {peekedNextIntent && (
            <div className="px-3 py-2 bg-iris-900 bg-opacity-60 rounded border border-iris-700"
                 title="You peeked the enemy's next move.">
              <div className="text-xs uppercase text-iris-300 tracking-widest">👁 Peek (next)</div>
              <div className="text-lg text-parchment-50">{peekedNextIntent.telegraph}</div>
            </div>
          )}
          {enemy?.annotation && (() => {
            const ae = enemy.annotation.effect || {};
            const parts = [];
            if (ae.enemyAtkReduction)         parts.push(`Enemy attacks deal −${ae.enemyAtkReduction} damage`);
            if (ae.damageOnDraw)              parts.push(`+${ae.damageOnDraw} composure damage each time you draw a card`);
            if (ae.damageOnTurnStart)         parts.push(`+${ae.damageOnTurnStart} composure damage at the start of every turn`);
            if (ae.damageOnTurnEnd)           parts.push(`+${ae.damageOnTurnEnd} composure damage at the end of every turn`);
            if (ae.damageOnEnemyAttack)       parts.push(`+${ae.damageOnEnemyAttack} composure damage to the enemy every time they attack`);
            if (ae.bonusSpellDamage)          parts.push(`Your spells deal +${ae.bonusSpellDamage} bonus damage`);
            if (ae.bonusSpellDamagePerCast)   parts.push(`Your spells deal +${ae.bonusSpellDamagePerCast} per cast already made this combat`);
            if (ae.energyOnTurnStart)         parts.push(`+${ae.energyOnTurnStart} energy at the start of every turn`);
            const effectSummary = parts.length > 0 ? parts.join('. ') + '.' : 'No active effect.';
            const tip = `${enemy.annotation.name} — ${enemy.annotation.turnsRemaining} turn${enemy.annotation.turnsRemaining === 1 ? '' : 's'} remaining.\n\nEffect: ${effectSummary}`;
            return (
              <div className="px-3 py-2 bg-iris-900 bg-opacity-40 rounded border border-iris-400 cursor-help"
                   title={tip}>
                <div className="text-xs uppercase text-iris-300 tracking-widest">📝 Annotated</div>
                <div className="text-sm italic text-parchment-50">{enemy.annotation.phrase} <span className="text-iris-300">({enemy.annotation.turnsRemaining}t)</span></div>
                <div className="text-[10px] text-iris-200 mt-0.5 leading-tight">{effectSummary}</div>
              </div>
            );
          })()}
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.chutzpah ?? 1)}`} title={`Chutzpah ${eff_label(eff.chutzpah ?? 1)}`}>💪 Chutz {eff_label(eff.chutzpah ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.wit ?? 1)}`} title={`Wit ${eff_label(eff.wit ?? 1)}`}>✨ Wit {eff_label(eff.wit ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.jnsq ?? 1)}`} title={`Jnsq ${eff_label(eff.jnsq ?? 1)}`}>🌀 Jnsq {eff_label(eff.jnsq ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.physical ?? 1)}`} title={`Physical ${eff_label(eff.physical ?? 1)}`}>⚔ Phys {eff_label(eff.physical ?? 1)}</span>
        </div>
        {/* v2.65: STATUS row — what YOU have done to the enemy this combat
            (and what they've done to you). Pulled out from the lane-chip
            row to a dedicated band with bigger styling so the player can
            see at a glance "I have +30% spell potency from 2 Amplifies"
            without parsing a row of similar-looking chips. Hidden when
            both multipliers are at baseline. */}
        {(playerDmgMult !== 1.0 || enemyDmgMult !== 1.0) && (
          <div className="mt-2 p-2 rounded bg-ink-700/60 border border-ink-500 flex gap-3 flex-wrap items-center">
            <span className="text-[10px] uppercase tracking-widest text-parchment-300">In effect</span>
            {/* v2.83: label disambiguation. Same word ("Vulnerable") was
                used for both player-side and enemy-side states, which was
                confusing. Now each badge spells out WHO the effect is on
                and WHAT changed. Color = good-for-player (iris) vs
                bad-for-player (ember).
                  playerDmgMult > 1 → enemy is taking more from us (good)
                  playerDmgMult < 1 → our spells weak (bad)
                  enemyDmgMult > 1 → we're vulnerable to their attacks (bad)
                  enemyDmgMult < 1 → enemy attacks sapped (good)
            */}
            {playerDmgMult > 1.0 && (
              <span className="px-3 py-1.5 rounded bg-iris-700 text-parchment-50 text-sm font-bold border border-iris-400"
                title={`Enemy is taking ×${playerDmgMult.toFixed(2)} damage from your spells. From Amplify on you, Vulnerable rider on enemy, predator hits, etc. Drifts toward 1.00 by 0.10/turn.`}>
                🩸 Enemy Vulnerable +{Math.round((playerDmgMult - 1) * 100)}%
              </span>
            )}
            {playerDmgMult < 1.0 && (
              <span className="px-3 py-1.5 rounded bg-ember-700 text-parchment-50 text-sm font-bold border border-ember-500"
                title={`Your spells deal ×${playerDmgMult.toFixed(2)} damage. Weak applied to you by enemy. Drifts toward 1.00 by 0.10/turn.`}>
                ⛧ Your spells {Math.round((playerDmgMult - 1) * 100)}% (Weak on you)
              </span>
            )}
            {enemyDmgMult > 1.0 && (
              <span className="px-3 py-1.5 rounded bg-ember-700 text-parchment-50 text-sm font-bold border border-ember-500"
                title={`You're vulnerable — enemy attacks hit you for ×${enemyDmgMult.toFixed(2)}. Applied by enemy intent. Drifts toward 1.00 by 0.10/turn.`}>
                🩸 You're Vulnerable +{Math.round((enemyDmgMult - 1) * 100)}% (incoming)
              </span>
            )}
            {enemyDmgMult < 1.0 && (
              <span className="px-3 py-1.5 rounded bg-iris-700 text-parchment-50 text-sm font-bold border border-iris-400"
                title={`Enemy attacks deal ×${enemyDmgMult.toFixed(2)} damage. From Sap card, Weak rider on enemy, etc. Drifts toward 1.00 by 0.10/turn.`}>
                ⛧ Enemy Weak {Math.round((enemyDmgMult - 1) * 100)}% (their attacks)
              </span>
            )}
          </div>
        )}
      </div>

      {/* v2 SENTENCE TRAY — intro + subject + target + 0-2 modifiers.
          Playing a target auto-casts. End the turn without a target and
          the spell fizzles. */}
      <V2SpellTray tray={tray} onUnstage={onUnstage} onCast={onCast}
        castsThisTurn={castsThisTurn} maxCastsPerTurn={maxCastsPerTurn}
        isChutzpah={isChutzpah} stakeAmount={stakeAmount} setStakeAmount={setStakeAmount}
        playerHp={hp}
        isJnsq={isJnsq} rollOptIn={rollOptIn} setRollOptIn={setRollOptIn}
        lastRoll={lastRoll} combatRolls={combatRolls} loudCount={loudCount}
        playerDmgMult={playerDmgMult} enemyDmgMult={enemyDmgMult}
        combatTurn={combatTurn} openingExtended={openingExtended}
        pauseHeldActive={pauseHeldActive} enemy={enemy} />

      {/* Relic chip row — persistent across the run, shown all combats. */}
      {relics.length > 0 && (
        <div className="parchment-card p-2 flex gap-2 flex-wrap items-center">
          <span className="text-[10px] uppercase tracking-widest text-gold-300 mr-1">📿 Relics</span>
          {relics.map(r => {
            const summary = relicEffectSummary(r);
            return (
              <span key={r.id}
                title={`${r.name}\n\n${r.desc || ''}${summary ? '\n\nEffects:\n' + summary : ''}${r.flavor ? '\n\n"' + r.flavor + '"' : ''}`}
                className="px-2 py-1 bg-gold-700 text-parchment-50 rounded border border-gold-500 text-xs cursor-help">
                {r.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Active Powers row — visible while at least one power is on the
          field OR a pending "Sorry — what?" absorb is armed. Hover shows
          the trigger + flavor. */}
      {(powers.length > 0 || notListeningCharges > 0 || staggerActive) && (
        <div className="parchment-card p-2 flex gap-2 flex-wrap items-center">
          <span className="text-[10px] uppercase tracking-widest text-iris-300 mr-1">📿 Powers in effect</span>
          {powers.map((p, i) => {
            const isHitMeAgain = p.installPower?.id === 'hit-me-again' || p.id === 'cv2-p-hit-me-again';
            const isPatience = p.installPower?.id === 'patience' || p.id === 'wv2-p-patience';
            const isDrunken  = p.installPower?.id === 'drunken-confidence' || p.id === 'jv2-p-hold-my-drink';
            const isBabbling = p.installPower?.id === 'babbling' || p.id === 'jv2-p-wait-and-another-thing';
            return (
              <span key={p.uid || i}
                title={isDrunken
                  ? 'Drunken Confidence — all your spell casts deal +50% damage, BUT every enemy attack adds +2 raw damage before block. Play "sober second thought," to remove.'
                  : isBabbling
                  ? 'Babbling — you can cast a SECOND spell per turn. The 2nd cast deals 60% damage. Re-stage required (the 1st cast empties the tray as usual).'
                  : `${p.desc}${p.flavor ? '\n\n' + p.flavor : ''}`}
                className="px-2 py-1 bg-iris-800 text-parchment-50 rounded border border-iris-600 text-xs cursor-help">
                {p.name}
                {isHitMeAgain && (
                  <span className="ml-1 px-1 rounded bg-ember-700 text-parchment-50">
                    ⚡{hitMeAgainCharges}
                  </span>
                )}
                {isPatience && (
                  <span className="ml-1 px-1 rounded bg-iris-700 text-parchment-50">
                    🌿{patienceStacks}
                  </span>
                )}
                {isDrunken && (
                  <span className="ml-1 px-1 rounded bg-ember-700 text-parchment-50">
                    🍺×1.5 / +2
                  </span>
                )}
                {isBabbling && (
                  <span className="ml-1 px-1 rounded bg-iris-700 text-parchment-50">
                    🗯 2× / 60%
                    {castsThisTurn === 1 && <span className="ml-1 text-[10px]">(2nd cast available)</span>}
                  </span>
                )}
              </span>
            );
          })}
          {notListeningCharges > 0 && (
            <span title="Sorry — what? — pending: the next enemy Weak/Vulnerable attempt is ignored."
              className="px-2 py-1 bg-iris-800 text-parchment-50 rounded border border-iris-600 text-xs cursor-help">
              Sorry — what?
              <span className="ml-1 px-1 rounded bg-iris-700 text-parchment-50">
                🙉{notListeningCharges}
              </span>
            </span>
          )}
          {staggerActive && (
            <span title="Drunken Stagger — this turn, every enemy attack swing has a 50% chance to fully miss."
              className="px-2 py-1 bg-iris-800 text-parchment-50 rounded border border-iris-600 text-xs cursor-help">
              Drunken Stagger
              <span className="ml-1 px-1 rounded bg-ember-700 text-parchment-50">
                🌀 50% miss
              </span>
            </span>
          )}
        </div>
      )}

      {/* v2.35: FOOTNOTE picker banner. Surfaces when the player has just
          played the "As Hewn-Greaves notes in his footnotes," skill and
          needs to pick a Word card (intro/subject/modifier) from hand or
          discard. Clicking any eligible card bumps its `footnotes` count
          by 1; cancelling dismisses the prompt without applying. */}
      {footnotePromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-iris-500 bg-iris-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-iris-100">
            <span className="font-bold">📖 Footnote:</span> click a Word card (intro / subject / modifier) in your hand or discard to attach a permanent +1 wit footnote.
          </div>
          <button onClick={onCancelFootnote}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2 flex-nowrap min-h-[260px] items-stretch justify-center overflow-x-auto">
        {hand.map((card, i) => {
          // Amplify gets +1 cost per prior play this combat. UI shows the
          // current (escalated) cost so the player doesn't get surprised.
          const effCost = card.id === 'c-amplify'
            ? (card.cost || 0) + (amplifyPlaysThisCombat || 0)
            : (card.cost || 0);
          // v2.35: FOOTNOTE picker — eligible cards are Word cards (intro,
          // subject, modifier). When the prompt is active, those cards
          // become clickable for footnoting INSTEAD of playing.
          const isFootnoteEligible = footnotePromptActive
            && (card.slot === 'intro' || card.slot === 'subject' || card.slot === 'modifier');
          // v2.36: ACTUALLY— gate. The skill is unplayable when no cast has
          // landed this turn (lastCastSnapshot === null). UI disables; sim
          // AI skips for the same reason.
          const isActuallySkill = !!card.effects?.refireLastCast;
          const actuallyBlocked = isActuallySkill && !lastCastSnapshot;
          const playable = !footnotePromptActive && effCost <= energy && !actuallyBlocked;
          const escalated = card.id === 'c-amplify' && amplifyPlaysThisCombat > 0;
          // v2.38: Misstep token override — bright red dashed border so it
          // stands out as an active hazard in hand. Pratchett tone: the
          // realisation that you said something wrong is visible on you.
          const isMisstepTok = card.id === 'wv2-tok-misstep';
          // Card frame tint. v2 cards: intro/subject = iris, target =
          // ember, modifier = gold. v1 fallback by card.type for utilities.
          const tint = isMisstepTok ? 'border-red-500 border-dashed'
                     : card.slot === 'intro' || card.slot === 'subject' ? 'border-iris-500'
                     : card.slot === 'target' ? 'border-ember-500'
                     : card.slot === 'modifier' ? 'border-gold-500'
                     : card.slot === 'annotation' ? 'border-iris-400 border-dashed' // v2.10
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
              onClick={() => isFootnoteEligible ? onApplyFootnote(card.uid) : onPlayCard(i)}
              disabled={!(playable || isFootnoteEligible)}
              className={`w-[180px] h-72 shrink-0 rounded-lg border-2 p-2.5 text-left flex flex-col gap-1.5 shadow-lg transition-all ${
                isFootnoteEligible
                  ? `bg-iris-900/60 text-iris-100 border-iris-400 ring-2 ring-iris-400 hover:scale-105 hover:shadow-2xl cursor-pointer`
                : playable
                  ? `bg-parchment-50 text-ink-800 ${tint} hover:scale-105 hover:shadow-2xl cursor-pointer`
                  : 'bg-ink-600 text-parchment-400 border-ink-500 opacity-50 cursor-not-allowed'
              }`}>
              <div className="flex justify-between items-start gap-1">
                <div className={`text-[10px] uppercase tracking-wider font-bold ${card.slot === 'target' ? 'text-ember-700' : card.slot === 'modifier' ? 'text-gold-700' : card.slot ? 'text-iris-700' : 'text-ink-400'}`}>
                  {displayLabel}{card.tier ? ` · T${card.tier}` : ''}
                </div>
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold ${playable ? (escalated ? 'bg-ember-500 text-parchment-50' : 'bg-gold-500 text-ink-800') : 'bg-ink-500 text-parchment-300'}`}
                  title={escalated ? `Amplify costs +${amplifyPlaysThisCombat} this combat (base ${card.cost}).` : undefined}>
                  {effCost}
                </div>
              </div>
              <div className="font-display text-[15px] leading-tight">{displayName}</div>
              {/* v2.10: annotation duration badge */}
              {card.slot === 'annotation' && (
                <div className="text-[11px] font-bold text-iris-700 uppercase tracking-wider">
                  📝 {card.duration || 3} turns · attach to enemy
                </div>
              )}
              {/* Word / intro / subject / modifier stats */}
              {(card.stats && (card.stats.chutzpah || card.stats.wit || card.stats.jnsq)) || (card.footnotes > 0) ? (
                <div className="flex gap-1 flex-wrap text-xs font-mono">
                  {card.stats?.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
                  {/* v2.35: FOOTNOTE — show footnote rider inline with the wit
                      stat. Live total = base + footnotes, with the
                      asterisk count surfaced so the player knows which
                      cards they've already invested in. */}
                  {(card.stats?.wit || card.footnotes > 0) ? (
                    <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800"
                          title={card.footnotes > 0 ? `Wit ${(card.stats?.wit || 0) + card.footnotes} = base ${card.stats?.wit || 0} + footnotes ${card.footnotes}` : undefined}>
                      ✨ {(card.stats?.wit || 0) + (card.footnotes || 0)}{card.footnotes > 0 ? ` ${'*'.repeat(Math.min(3, card.footnotes))}${card.footnotes > 3 ? `(${card.footnotes})` : ''}` : ''}
                    </span>
                  ) : null}
                  {card.stats?.jnsq     ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
                </div>
              ) : null}
              {/* On-stage status effects for intros/subjects — sized to be noticeable */}
              {card.effects && (card.effects.weak || card.effects.vulnerable || card.effects.block || card.effects.draw || card.effects.loseHp || card.effects.hp) && (
                <div className="flex flex-col gap-0.5 text-sm font-bold uppercase tracking-wide">
                  {card.effects.weak && <span className="text-ember-700">⛧ Weak {card.effects.weak}</span>}
                  {card.effects.vulnerable && <span className="text-ember-700">🩸 Vuln {card.effects.vulnerable}</span>}
                  {card.effects.block && <span className="text-iris-700">🛡 +{card.effects.block} Block</span>}
                  {card.effects.draw && <span className="text-moss-700">📥 Draw {card.effects.draw}</span>}
                  {card.effects.loseHp && <span className="text-ember-700">🩸 −{card.effects.loseHp} HP</span>}
                  {card.effects.hp && <span className="text-moss-700">💚 +{card.effects.hp} HP</span>}
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
                    <div className="text-sm font-bold text-ember-700 uppercase tracking-wide">
                      {Object.entries(card.effect.rider).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' · ')}
                    </div>
                  )}
                  {card.effect.loseHpOnCast && (
                    <div className="text-sm font-bold text-ember-700 uppercase tracking-wide">
                      🩸 −{card.effect.loseHpOnCast} HP on cast
                    </div>
                  )}
                  {card.effect.tier3Double && (
                    <div className="text-xs text-ember-700 font-bold italic">Doubles at Tier 3</div>
                  )}
                  {card.effect.requiresTier3 && (
                    <div className="text-xs text-ember-700 font-bold italic">Requires Tier 3 (else half damage)</div>
                  )}
                  {card.effect.perLaneTag && (
                    <div className="text-sm font-bold text-iris-700 uppercase tracking-wide"
                      title={`Tag-resonance bonus: this cast deals +${card.effect.perLaneTag.bonus} damage for each staged card whose tags include ${card.effect.perLaneTag.tags.join(' or ')}. Stack tagged words for big payoffs.`}>
                      ✦ +{card.effect.perLaneTag.bonus} per {card.effect.perLaneTag.tags.join(' / ')} tag
                    </div>
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
              {/* v2.63: Gesture summary — base damage, trayMultiplier
                  scaling, riders, strip, draw, exhaust status. Gestures
                  bypass the spell tray and fire immediately on play,
                  so the player needs the full mechanic surfaced in the
                  card itself. */}
              {card.slot === 'gesture' && card.gestureEffect && (() => {
                const ge = card.gestureEffect;
                const laneLabel = (card.lane || 'wit').toUpperCase();
                const dmgType = ge.damageType === 'physical' ? 'phys' : 'comp';
                return (
                  <div className="text-sm font-mono text-ink-700 leading-tight">
                    <div className="font-bold">
                      {ge.icon || '✊'} {ge.damage} {dmgType}
                      {ge.trayMultiplier ? ` + ${laneLabel}×${ge.trayMultiplier}` : ''}
                    </div>
                    {ge.rider && Object.keys(ge.rider).length > 0 && (
                      <div className="text-xs text-ember-700 font-bold uppercase">
                        {Object.entries(ge.rider).map(([k, v]) => `+${v} ${k}`).join(' · ')}
                      </div>
                    )}
                    {ge.stripEnemyBlock ? <div className="text-xs text-iris-700">🛇 strip {ge.stripEnemyBlock} block</div> : null}
                    {ge.draw ? <div className="text-xs text-moss-700">📥 draw {ge.draw}</div> : null}
                    <div className="text-[10px] italic text-ink-500">
                      {ge.exhaust === false ? 'Reusable · bypasses spell tray' : 'Exhausts · bypasses spell tray'}
                    </div>
                  </div>
                );
              })()}
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

      {/* v2.35: FOOTNOTE — discard-pile picker. Renders inline below the
          hand when the prompt is active. Only intros / subjects / modifiers
          are eligible (target cards aren't word slots; gestures /
          annotations / skills aren't wit-stat-bearing in the relevant
          way). Filtering by slot keeps the picker focused on the
          phrase-install spec. */}
      {footnotePromptActive && (
        <div className="mt-2 p-3 rounded border-2 border-iris-500/60 bg-iris-900/30">
          <div className="text-xs uppercase tracking-wider text-iris-200 mb-2">
            Discard pile — eligible cards ({discard.filter(c => c.slot === 'intro' || c.slot === 'subject' || c.slot === 'modifier').length})
          </div>
          {discard.filter(c => c.slot === 'intro' || c.slot === 'subject' || c.slot === 'modifier').length === 0 ? (
            <div className="text-sm italic text-parchment-400">No eligible cards in discard. Pick from hand instead.</div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {discard.map((c, i) => {
                if (c.slot !== 'intro' && c.slot !== 'subject' && c.slot !== 'modifier') return null;
                const fn = c.footnotes || 0;
                return (
                  <button key={`${c.uid}-${i}`}
                    onClick={() => onApplyFootnote(c.uid)}
                    className="px-2 py-1.5 bg-iris-800 text-iris-100 rounded border border-iris-400 hover:bg-iris-700 hover:scale-105 text-xs transition-all">
                    <div className="font-display text-sm">{c.name || c.phrase}</div>
                    <div className="text-[10px] text-iris-300">
                      {c.slot} · ✨ wit {(c.stats?.wit || 0) + fn}{fn > 0 ? ` (+${fn} *)` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* v2.62: player stat block moved below the hand cards (was above) so the hand sits higher on screen and the stat block anchors the bottom. */}
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
          <div title="Block — absorbs incoming PHYSICAL damage (⚔ attacks → HP). Resets to 0 at the start of your next turn.">
            <div className="text-xs uppercase text-parchment-300">Block <span className="text-parchment-500">ⓘ</span></div>
            <div className="text-2xl font-mono text-iris-300">🛡 {block}</div>
          </div>
          <div title="Poise — absorbs incoming COMPOSURE damage (🎭 mental attacks). Separate from Block. Resets to 0 at the start of your next turn.">
            <div className="text-xs uppercase text-parchment-300">Poise <span className="text-parchment-500">ⓘ</span></div>
            <div className="text-2xl font-mono text-moss-300">🪞 {poise}</div>
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
          {/* v2.24: chutzpah TUNNEL VISION pip + RAGE badge. Shown when the
              meter has anything in it OR rage is active. Color: ember (chutzpah
              palette). */}
          {(isChutzpah || tunnelVision > 0 || rageActive) && (
            <div title={`Tunnel Vision — chutzpah rage meter. At 5+ entering a turn, you enter RAGE: +50% potency for that turn, then the meter resets.`}>
              <div className="text-xs uppercase text-ember-300">Tunnel</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-mono text-ember-300">🔥 {tunnelVision}</span>
                {rageActive && (
                  <span className="px-2 py-1 rounded text-xs font-bold bg-ember-700 text-parchment-50 border border-ember-500"
                        title="RAGE — chutzpah unleashed (+50% damage this turn). Resets at end of turn.">
                    RAGE
                  </span>
                )}
              </div>
            </div>
          )}
          {/* v2.25: chutzpah DOUBLING DOWN pip. Each token bills 2 unblocked
              HP at end of turn IF the enemy is still alive. Resets every turn.
              Shown only when non-zero. */}
          {cornerTokens > 0 && (
            <div title={`Backed Into A Corner — ${cornerTokens} token${cornerTokens === 1 ? '' : 's'}. End of turn: if enemy isn't dead, you take ${cornerTokens * 2} unblocked HP. Resets each turn.`}>
              <div className="text-xs uppercase text-ember-300">Corner</div>
              <div className="text-2xl font-mono text-ember-300">🏚 {cornerTokens}</div>
            </div>
          )}
          {/* v2.29: chutzpah SAYING IT LOUDER pip. Each demanding-tagged
              chutzpah word card staged this turn adds +1; a target with
              loudScaling reads it for +3 dmg/loud. Resets each turn. */}
          {loudCount > 0 && (
            <div title={`Saying it Louder — ${loudCount} demanding word${loudCount === 1 ? '' : 's'} staged this turn. A target with "Said It Louder" gets +${loudCount * 3} flat dmg on cast. Resets each turn.`}>
              <div className="text-xs uppercase text-ember-300">Loud</div>
              <div className="text-2xl font-mono text-ember-300">📢 {loudCount}</div>
            </div>
          )}
          {/* v2.48: jnsq AWKWARD PAUSE pip. pauseHeld = armed this turn
              (graduates at end of turn). pauseHeldActive = doubling banked
              for THIS turn's cast. Both render the same 🤫 badge with
              different tooltips so the player can read where the pause is
              in its lifecycle. Cleared the moment a cast fires. */}
          {(pauseHeld || pauseHeldActive) && (
            <div title={pauseHeldActive
              ? `Awkward Pause — next cast doubles every staged card's jnsq stat contribution. Single-use; cast now to spend.`
              : `Paused — at end of turn the doubling banks. Hold the silence.`}>
              <div className="text-xs uppercase text-amber-300">{pauseHeldActive ? 'Pause: ×2' : 'Paused'}</div>
              <div className="text-2xl font-mono text-amber-200">🤫</div>
            </div>
          )}
          {/* v2.46: jnsq WON'T SHUT UP pip. Armed when a target with
              `mustPlayAnotherJnsq` resolves a cast. Player must play another
              jnsq-lane card this turn or eat 3 unblocked HP at end of turn.
              Cleared by any jnsq play after the rider fires. */}
          {wontShutUpArmed && (
            <div title={`Won't Shut Up — you committed mid-statement. Play any jnsq card before end of turn or take 3 HP.`}>
              <div className="text-xs uppercase text-amber-300">Going on</div>
              <div className="text-2xl font-mono text-amber-200">🗣 !</div>
            </div>
          )}
          {/* v2.34: wit LONG THREAD pip. Ticks +1 every turn the player
              casts a wit Effect AND takes zero unblocked HP damage. Resets
              to 0 when an unblocked hit lands. Wit targets with
              threadScaling read this for +N × LT flat dmg. Color: iris
              (wit palette). Shown whenever wit-committed OR meter > 0. */}
          {(isWit || longThread > 0) && (
            <div title={`Long Thread — wit's consecutive-turn scaling. Ticks +1 at end of turn IF you cast a wit Effect AND took no unblocked HP damage. Take an unblocked hit, lose the thread. Wit threadScaling targets get +N × Long Thread on cast.`}>
              <div className="text-xs uppercase text-iris-300">Thread</div>
              <div className="text-2xl font-mono text-iris-200">🧵 {longThread}</div>
            </div>
          )}
          {/* v2.39: OPENING STATEMENT — show "OPENING" pip while combat is
              on turn 1, or "REVISIT" pip while the to-revisit-my-opening-
              point bridge is armed. The pip tells the wit player whether
              their openingBonus cards are currently active. */}
          {isWit && (combatTurn === 1 || openingExtended) && (
            <div title={openingExtended
              ? `Opening extended — your next wit Effect cast still benefits from openingBonus damage, even though it's now turn ${combatTurn}.`
              : `Turn 1 — wit Effect cards with openingBonus deal their bonus damage. Cast now or hold "to revisit my opening point," to keep the bonus alive into a later turn.`}>
              <div className="text-xs uppercase text-iris-300">{openingExtended ? 'Revisit' : 'Opening'}</div>
              <div className="text-2xl font-mono text-iris-200">🎩{openingExtended ? '↩' : ''}</div>
            </div>
          )}
          {/* v2.40: PATIENCE pip. Shows the current banked stacks while
              the power is installed. Each stack = +2 flat damage on the
              next cast. Clears when the cast lands. */}
          {patienceInstalled && (
            <div title={`Patience — banked stacks. Each end-of-turn where you DID NOT cast adds +1 to the bank. The next cast adds Patience × 2 flat damage and clears the bank.`}>
              <div className="text-xs uppercase text-iris-300">Patience</div>
              <div className="text-2xl font-mono text-iris-200">🌿 {patienceStacks}</div>
            </div>
          )}
          {/* v2.37: HOLD ON armed indicator. Shows the snapshotted reduction
              that the next enemy swing will eat. Persists across turns
              until consumed (or auto-cleared at start of next turn — but
              endTurn fires the clear AFTER the enemy intent, so the
              indicator only disappears once the swing happened). */}
          {holdOnArmed && (
            <div title={`Hold On — armed. The next enemy swing's damage is reduced by ${holdOnValue} (snapshotted from your Long Thread at play time). Clears when the next attack resolves OR at the start of your next turn.`}>
              <div className="text-xs uppercase text-iris-300">Hold</div>
              <div className="text-2xl font-mono text-iris-200">🛑 −{holdOnValue}</div>
            </div>
          )}
          {/* v2.38: SAYING SOMETHING WRONG pip. Shows pending Misstep tokens
              counting down (the off-stage clock) AND the count of Misstep
              tokens currently in hand (the actual decision). Together: how
              many shoes are about to drop, and how many are already on the
              floor. Iris palette since this is a wit mechanic. */}
          {(pendingMissteps.length > 0 || (hand || []).some(c => c?.id === 'wv2-tok-misstep')) && (() => {
            const inHand = (hand || []).filter(c => c?.id === 'wv2-tok-misstep').length;
            const pendingTxt = pendingMissteps.length > 0
              ? pendingMissteps.map(p => `T-${p.turnsRemaining}`).join(' · ')
              : '—';
            return (
              <div title={`Missteps in flight. ${inHand > 0 ? `${inHand} in hand: discard for 1 Energy, or end-of-turn = -3 HP each. ` : ''}Pending: ${pendingTxt}.`}>
                <div className="text-xs uppercase text-iris-300">Misstep</div>
                <div className="text-2xl font-mono text-iris-200">
                  📜 {inHand > 0 ? <span className="text-ember-300">{inHand}!</span> : pendingMissteps.length}
                </div>
              </div>
            );
          })()}
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
                <span key={eq.id} className="text-gold-300 cursor-help"
                  title={`${eq.name}\n\n${eq.desc || ''}${equipmentEffectSummary(eq) ? '\n\nEffects:\n' + equipmentEffectSummary(eq) : ''}`}>⚜ {eq.name}</span>
              ))}
            </div>
          )}
        </div>
        <button onClick={onEndTurn} className="btn btn-ember text-base px-5 py-2">End Turn</button>
      </div>

      <div className="parchment-card p-3 max-h-40 overflow-y-auto text-sm font-quill text-parchment-200 space-y-0.5">
        {log.slice(-10).map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

function V2SpellTray({ tray, onUnstage, onCast, castsThisTurn = 0, maxCastsPerTurn = 1,
                       isChutzpah = false, stakeAmount = 0, setStakeAmount = () => {},
                       playerHp = 70,
                       isJnsq = false, rollOptIn = false, setRollOptIn = () => {},
                       lastRoll = null, combatRolls = [], loudCount = 0,
                       playerDmgMult = 1.0, enemyDmgMult = 1.0,
                       combatTurn = 1, openingExtended = false,
                       pauseHeldActive = false, enemy = null }) {
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
    const { damage, riders, stakeBonus, loudBonus, predatorBonus, openingBonus, insultBonus, insultMatches, insultMatchedTags } = computeSpellDamage(intro, subject, target, modifiers, { stakeAmount, loudCount, playerDmgMult, enemyDmgMult, combatTurn, openingExtended, insultVulnerabilities: enemy?.insultVulnerabilities || [], pauseDoubled: pauseHeldActive });
    predicted = { damage, riders, stakeBonus: stakeBonus || 0, loudBonus: loudBonus || 0, predatorBonus: predatorBonus || 0, openingBonus: openingBonus || 0, insultBonus: insultBonus || 0, insultMatches: insultMatches || 0, insultMatchedTags: insultMatchedTags || [] };
  }
  // v2.11: requirements + caps for ALL IN. v2.13 nerfed cap from
  // /3 → /4 (keeps "I bleed for damage" without uncapped spirals).
  const stakeMax = Math.max(0, Math.floor(playerHp / 4));
  const stakeRequired = target?.effect?.requiresStake || 0;
  const stakeBlocked = ready && stakeRequired > 0 && stakeAmount < stakeRequired;
  const stakeNudge = (delta) => setStakeAmount(Math.max(0, Math.min(stakeMax, stakeAmount + delta)));
  // v2.12: jnsq CHAOS DICE — auto-roll when a forceRoll modifier or
  // alwaysRolls target is staged; otherwise opt-in via toggle.
  const forcedRoll = ready && (
    modifiers.some(m => m?.modifierEffect?.forceRoll) ||
    target?.effect?.alwaysRolls === true
  );
  const rollRequired = target?.effect?.requiresPriorRoll || 0;
  const rollBlocked = ready && rollRequired > 0 && !combatRolls.includes(rollRequired);

  const tagCounts = {};
  for (const c of [intro, subject, target, ...modifiers]) {
    if (!c) continue;
    for (const t of c.tags || []) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }

  // v2.79: per-card stat contribution. The lane the target uses for
  // its scaleBy drives which stat the words contribute. For each staged
  // card show its `+N` stat in the lane plus, for targets, the base
  // damage. Helps the player see WHAT each card is adding to the cast.
  const castLane = target?.effect?.scaleBy || target?.lane || intro?.lane || 'wit';
  const cardContribution = (card, slotName) => {
    if (!card) return null;
    const laneStat = card.stats?.[castLane] || 0;
    const isTarget = slotName === 'target';
    const base = isTarget ? (card.effect?.base || 0) : 0;
    const mult = isTarget ? (card.effect?.multiplier || 1) : 0;
    // Footnote rider on word slots — adds to effective lane stat.
    const footnote = card.footnotes || 0;
    return { laneStat, base, mult, footnote };
  };

  const slotPill = (card, slotName, color) => {
    if (!card) {
      return (
        <div className={`px-3 py-2 rounded border border-dashed ${color.empty} text-xs italic text-center opacity-60 min-w-[110px]`}>
          {slotName}
        </div>
      );
    }
    const contrib = cardContribution(card, slotName);
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
        {contrib && (
          <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 rounded bg-ink-900/40 text-parchment-200"
            title={slotName === 'target'
              ? `Target contributes: ${contrib.base} base + (×${contrib.mult} on the stat sum).`
              : `Word contributes: +${contrib.laneStat + contrib.footnote} ${castLane} to the spell's stat sum${contrib.footnote > 0 ? ` (includes +${contrib.footnote} footnote)` : ''}.`}>
            {slotName === 'target'
              ? `${contrib.base} + ${castLane.slice(0, 4)}×${contrib.mult}`
              : `+${contrib.laneStat + contrib.footnote} ${castLane.slice(0, 4)}${contrib.footnote > 0 ? '*' : ''}`}
          </span>
        )}
      </motion.button>
    );
  };

  // v2.79: math breakdown — the step-by-step calculation that the
  // player can read alongside the predicted number. Surfaces tag-
  // resonance (perLaneTag), tier multiplier, enemy effectiveness, and
  // player potency contributions so the player sees WHERE the damage
  // comes from. Only computed when the spell is ready (full tray).
  let mathBreakdown = null;
  if (ready && predicted) {
    const introStat = (intro.stats?.[castLane] || 0) + (intro.footnotes || 0);
    const subjStat  = (subject.stats?.[castLane] || 0) + (subject.footnotes || 0);
    const tgtStat   = (target.stats?.[castLane] || 0);
    const modStat   = modifiers.reduce((s, m) => s + ((m?.stats?.[castLane] || 0) + (m?.footnotes || 0)), 0);
    const statTotal = introStat + subjStat + tgtStat + modStat;
    const baseDmg   = target.effect?.base || 0;
    const mult      = target.effect?.multiplier || 1;
    const preTier   = baseDmg + statTotal * mult;
    const preEnemy  = preTier * tierMult;
    const dmgType   = target.effect?.damageType || 'composure';
    const enemyEff  = enemy?.effectiveness
      ? (dmgType === 'physical' ? (enemy.effectiveness.physical ?? 1) : (enemy.effectiveness[castLane] ?? 1))
      : 1;
    // perLaneTag bonus from the target rider
    const perTag = target.effect?.perLaneTag;
    let tagBonus = 0;
    if (perTag) {
      const allTags = [intro, subject, target, ...modifiers]
        .flatMap(c => c?.tags || []);
      const matches = allTags.filter(t => perTag.tags.includes(t)).length;
      tagBonus = matches * perTag.bonus;
    }
    mathBreakdown = {
      statTotal, baseDmg, mult, preTier, tierMult, preEnemy,
      enemyEff, playerMult: playerDmgMult, tagBonus,
      castLane, dmgType,
    };
  }

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
                 title={`Tier ${tier} × ${tierMult.toFixed(1)} multiplier${predicted.stakeBonus ? `, +${predicted.stakeBonus} from stake` : ''}${predicted.predatorBonus ? `, +${predicted.predatorBonus} predator (enemy debuffed)` : ''}`}>
              {predicted.damage} <span className="text-sm text-parchment-300">{mathBreakdown?.dmgType === 'physical' ? 'phys' : 'comp'}</span>
              {predicted.stakeBonus > 0 && (
                <span className="text-xs text-ember-300 ml-1">(+{predicted.stakeBonus})</span>
              )}
              {predicted.predatorBonus > 0 && (
                <span className="text-xs text-ember-300 ml-1" title="Predator rider — enemy is Vulnerable or Weak.">🩸+{predicted.predatorBonus}</span>
              )}
              {/* v2.42: insult-hit chip — tag overlap with enemy.insultVulnerabilities */}
              {predicted.insultBonus > 0 && (
                <span className="text-xs text-iris-300 ml-1"
                  title={`Insult-hit: ${(predicted.insultMatchedTags || []).slice(0, 3).join(', ')} (${Math.min(predicted.insultMatches || 0, 3)} match${(predicted.insultMatches || 0) === 1 ? '' : 'es'} × pierce).`}>
                  🎯+{predicted.insultBonus}
                </span>
              )}
            </div>
          </div>
        )}
        {/* v2.79: math breakdown — full-width row INSIDE the same flex
            container (basis-full forces a new line). Surfaces every step
            of the damage formula so the player can SEE where the number
            comes from. Tag resonance, predator, opening, insult, stake
            bonuses get explicit callouts. */}
        {mathBreakdown && (
          <div className="basis-full mt-2 pt-2 border-t border-ink-500 text-[11px] font-mono text-parchment-300 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-iris-300 font-bold text-[10px] uppercase tracking-widest mr-1">Math:</span>
            <span>{mathBreakdown.baseDmg}</span>
            <span className="text-parchment-500">+</span>
            <span title={`Sum of ${mathBreakdown.castLane} stats across all staged cards × the target's multiplier.`}>
              {mathBreakdown.statTotal}×{mathBreakdown.mult}={mathBreakdown.statTotal * mathBreakdown.mult}
            </span>
            {tierMult !== 1 && (<>
              <span className="text-parchment-500">×</span>
              <span title={`Tier ${tier} multiplier — earned by tag-cohesive intro/subject/target.`}>
                {tierMult.toFixed(1)}{tier === 3 ? ' (T3)' : tier === 2 ? ' (T2)' : ''}
              </span>
            </>)}
            {mathBreakdown.enemyEff !== 1 && (<>
              <span className="text-parchment-500">×</span>
              <span className={mathBreakdown.enemyEff > 1 ? 'text-moss-300' : 'text-ember-300'}
                title={`Enemy is ${mathBreakdown.enemyEff > 1 ? 'susceptible' : 'resistant'} to ${mathBreakdown.castLane} (×${mathBreakdown.enemyEff}).`}>
                {mathBreakdown.enemyEff}× eff
              </span>
            </>)}
            {mathBreakdown.playerMult !== 1 && (<>
              <span className="text-parchment-500">×</span>
              <span className={mathBreakdown.playerMult > 1 ? 'text-iris-300' : 'text-ember-300'}
                title={`Your spell potency — adjusted by Amplify, Vulnerable on enemy, Weak on player, etc.`}>
                {mathBreakdown.playerMult.toFixed(2)}× pot
              </span>
            </>)}
            {mathBreakdown.tagBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-iris-300 font-bold"
                title={`Tag-resonance bonus from the target's perLaneTag rider — +N damage per matching tag in your staged cards.`}>
                ✦{mathBreakdown.tagBonus}
              </span>
            </>)}
            {predicted.loudBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-ember-300" title="Saying-it-Louder — +3 dmg per demanding-tagged chutzpah word staged.">📢+{predicted.loudBonus}</span>
            </>)}
            {predicted.openingBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-iris-300" title="Opening Statement — turn-1 (or revisit-extended) bonus.">🎩+{predicted.openingBonus}</span>
            </>)}
            {predicted.predatorBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-ember-300" title="Predator rider — enemy is debuffed.">🩸+{predicted.predatorBonus}</span>
            </>)}
            {predicted.insultBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-iris-300" title={`Insult-hit — staged-tag overlap with enemy's insultVulnerabilities.`}>🎯+{predicted.insultBonus}</span>
            </>)}
            {predicted.stakeBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-ember-300" title="ALL IN — staked HP buys damage.">🩸+{predicted.stakeBonus}</span>
            </>)}
            <span className="text-parchment-500">=</span>
            <span className="font-bold text-iris-200 text-sm">{predicted.damage}</span>
          </div>
        )}
        {/* v2.11: ALL IN — chutzpah-only HP-wager row. */}
        {isChutzpah && ready && (
          <div className="flex items-center gap-1 ml-2 px-2 py-1 rounded border border-ember-500 bg-ember-900 bg-opacity-30"
               title="Spend HP for bonus damage. +1.5 damage per HP. Capped at ⅓ of current HP.">
            <span className="text-[10px] uppercase tracking-wider text-ember-300 font-bold">ALL IN?</span>
            <button onClick={() => stakeNudge(-1)} disabled={stakeAmount <= 0}
              className={`w-6 h-6 rounded text-xs font-bold ${stakeAmount > 0 ? 'bg-ember-700 text-parchment-50 hover:bg-ember-600' : 'bg-ink-700 text-parchment-500 cursor-not-allowed'}`}>−</button>
            <span className={`font-mono text-sm font-bold ${stakeAmount > 0 ? 'text-ember-200' : 'text-parchment-400'} w-12 text-center`}>
              {stakeAmount > 0 ? `-${stakeAmount} HP` : '—'}
            </span>
            <button onClick={() => stakeNudge(1)} disabled={stakeAmount >= stakeMax}
              className={`w-6 h-6 rounded text-xs font-bold ${stakeAmount < stakeMax ? 'bg-ember-700 text-parchment-50 hover:bg-ember-600' : 'bg-ink-700 text-parchment-500 cursor-not-allowed'}`}>+</button>
            <button onClick={() => stakeNudge(2)} disabled={stakeAmount + 3 > stakeMax}
              className={`px-1.5 h-6 rounded text-[10px] font-bold ${stakeAmount + 3 <= stakeMax ? 'bg-ember-700 text-parchment-50 hover:bg-ember-600' : 'bg-ink-700 text-parchment-500 cursor-not-allowed'}`}>+3</button>
            <button onClick={() => setStakeAmount(stakeMax)} disabled={stakeAmount === stakeMax}
              className={`px-1.5 h-6 rounded text-[10px] font-bold ${stakeAmount < stakeMax ? 'bg-ember-700 text-parchment-50 hover:bg-ember-600' : 'bg-ink-700 text-parchment-500 cursor-not-allowed'}`}>MAX</button>
            {stakeRequired > 0 && (
              <span className={`ml-1 text-[10px] font-bold uppercase ${stakeBlocked ? 'text-ember-300' : 'text-moss-300'}`}>
                req {stakeRequired}+
              </span>
            )}
          </div>
        )}
        {/* v2.12: CHAOS DICE — jnsq-only roll toggle. */}
        {isJnsq && ready && (
          <div className="flex items-center gap-1 ml-2 px-2 py-1 rounded border border-moss-500 bg-moss-900 bg-opacity-30"
               title="Roll a 1d6 on this cast. Modifies damage and adds side effects per the outcome.">
            <button onClick={() => !forcedRoll && setRollOptIn(!rollOptIn)}
              disabled={forcedRoll}
              className={`px-2 h-7 rounded text-xs font-bold uppercase tracking-wide ${
                forcedRoll || rollOptIn
                  ? 'bg-moss-600 text-parchment-50 hover:bg-moss-500'
                  : 'bg-ink-700 text-parchment-300 hover:bg-ink-600'
              }`}>
              🎲 {forcedRoll ? 'FORCED' : rollOptIn ? 'WILL ROLL' : 'ROLL?'}
            </button>
            {lastRoll !== null && (
              <span className="text-xs text-moss-200 font-mono" title="Last roll this combat.">last: {lastRoll}</span>
            )}
            {combatRolls.length > 0 && (
              <span className="text-[10px] text-moss-300 font-mono opacity-70"
                    title={`Rolls this combat: ${combatRolls.join(', ')}`}>
                [{combatRolls.slice(-4).join(' · ')}]
              </span>
            )}
            {rollRequired > 0 && (
              <span className={`ml-1 text-[10px] font-bold uppercase ${rollBlocked ? 'text-ember-300' : 'text-moss-300'}`}
                    title={`Target requires a prior ${rollRequired} rolled this combat.`}>
                req {rollRequired}
              </span>
            )}
          </div>
        )}
        <button onClick={onCast}
          disabled={!ready || castsThisTurn >= maxCastsPerTurn || stakeBlocked || rollBlocked}
          title={
            stakeBlocked ? `Target requires ${stakeRequired}+ HP staked.` :
            rollBlocked ? `Target requires a prior ${rollRequired} rolled this combat.` :
            castsThisTurn >= maxCastsPerTurn ? 'One spell per turn. End your turn to cast again.' :
            'Cast the staged spell.'
          }
          className={`btn text-base px-6 py-2 ml-2 ${
            castsThisTurn >= maxCastsPerTurn || stakeBlocked || rollBlocked ? 'bg-ink-600 text-parchment-400 cursor-not-allowed' :
            ready ? 'btn-iris animate-pulse' : 'bg-ink-600 text-parchment-400 cursor-not-allowed'
          }`}>
          ✨ CAST {castsThisTurn > 0 && <span className="text-[10px] ml-1">({castsThisTurn}/{maxCastsPerTurn})</span>}
        </button>
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
                {card.effect.perLaneTag && (
                  <div className="text-[11px] text-iris-700 font-bold uppercase mt-0.5">
                    ✦ +{card.effect.perLaneTag.bonus} per {card.effect.perLaneTag.tags.join(' / ')} tag
                  </div>
                )}
              </div>
            )}
            {/* v2.82: gesture rendering — was invisible on the reward screen,
                so "Pontificate at length" looked blank. Mirrors the hand's
                gesture summary. */}
            {card.slot === 'gesture' && card.gestureEffect && (() => {
              const ge = card.gestureEffect;
              const laneLabel = (card.lane || 'wit').toUpperCase();
              const dmgType = ge.damageType === 'physical' ? 'phys' : 'comp';
              return (
                <div className="text-sm font-mono text-ink-700 leading-tight">
                  <div className="font-bold">
                    {ge.icon || '✊'} {ge.damage} {dmgType}
                    {ge.trayMultiplier ? ` + ${laneLabel}×${ge.trayMultiplier}` : ''}
                  </div>
                  {ge.rider && Object.keys(ge.rider).length > 0 && (
                    <div className="text-xs text-ember-700 font-bold uppercase">
                      {Object.entries(ge.rider).map(([k, v]) => `+${v} ${k}`).join(' · ')}
                    </div>
                  )}
                  {ge.stripEnemyBlock ? <div className="text-xs text-iris-700">🛇 strip {ge.stripEnemyBlock} block</div> : null}
                  {ge.draw ? <div className="text-xs text-moss-700">📥 draw {ge.draw}</div> : null}
                  <div className="text-[10px] italic text-ink-500">
                    {ge.exhaust === false ? 'Reusable · bypasses spell tray' : 'Exhausts · bypasses spell tray'}
                  </div>
                </div>
              );
            })()}
            {/* v2.82: annotation rendering — same gap, annotations were blank
                on the reward screen except for duration/desc. */}
            {card.slot === 'annotation' && card.annotationEffect && (
              <div className="text-sm font-mono text-ink-700 leading-tight">
                <div className="font-bold">📝 {card.duration || 3} turns</div>
                <div className="text-xs">
                  {Object.entries(card.annotationEffect).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </div>
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
    startTime: 0,
  });
  const [tracing, setTracing] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [progress, setProgress] = useState(0); // 0..1
  const [errorBucket, setErrorBucket] = useState('fine'); // current proximity feedback
  // v2.5: time-based grading. Player clicks "Ready" to start a live
  // timer; finish under 5s for master, under 7.5s for fine, slower for
  // rough. Accuracy still matters as a tie-breaker (must complete ≥70%
  // of the path to qualify above rough), but speed is the headline.
  const [phase, setPhase] = useState('idle'); // 'idle' | 'tracing' | 'done'
  const [elapsedTime, setElapsedTime] = useState(0); // live seconds display

  // Tick the live timer ~20fps while tracing.
  useEffect(() => {
    if (phase !== 'tracing') return;
    const id = setInterval(() => {
      const t = (Date.now() - stateRef.current.startTime) / 1000;
      setElapsedTime(t);
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  function startTrace() {
    stateRef.current = { tracing: false, totalError: 0, samples: 0, progressIdx: 0, cursor: null, startTime: Date.now() };
    setPhase('tracing');
    setProgress(0);
    setElapsedTime(0);
  }

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
    if (phase !== 'tracing') return; // must hit "Ready" first to start the timer
    const p = svgPointFrom(e);
    if (!p) return;
    const s = stateRef.current;
    // First press: must start near the green START dot.
    // Resume after pause (progress > 0): allow starting anywhere along the
    // traced portion so the player doesn't have to re-trace from scratch.
    if (s.progressIdx === 0) {
      const start = pathSamples[0];
      const startDist = Math.sqrt((p.x - start.x) ** 2 + (p.y - start.y) ** 2);
      if (startDist > 60) return;
    } else {
      // Resuming — must press near the current progress frontier (within
      // 60px of the last traced sample) so the trace continues forward.
      const head = pathSamples[s.progressIdx];
      const headDist = Math.sqrt((p.x - head.x) ** 2 + (p.y - head.y) ** 2);
      if (headDist > 60) return;
    }
    s.tracing = true;
    s.cursor = p;
    setTracing(true);
    setCursor(p);
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

  // v2.20: if the player clicked the START dot and lifted without
  // dragging (or dragged a tiny amount), DON'T auto-finalize. Reset the
  // attempt so they can try again.
  // v2.58: separate "pause tracing" (released pointer mid-drag) from
  // "finalize" (commit to a grade). Pointer-up only PAUSES — the player
  // explicitly clicks "Finish the cut" to lock in their grade. This lets
  // them resume tracing if they missed a section. Auto-finalize is gone;
  // mid-drag release no longer eats the run.
  function pauseTrace() {
    const s = stateRef.current;
    if (!s.tracing) return;
    const completion = s.progressIdx / (pathSamples.length - 1);
    // Mis-click guard: < 10% completion = treat as no attempt, reset.
    if (completion < 0.10) {
      s.tracing = false;
      s.progressIdx = 0;
      s.totalError = 0;
      s.samples = 0;
      s.cursor = null;
      setTracing(false);
      setCursor(null);
      setProgress(0);
      return;
    }
    // Pause — keep the progress so the player can either resume by
    // pressing-and-holding from the green dot OR click "Finish the cut".
    s.tracing = false;
    setTracing(false);
  }

  function finish() {
    const s = stateRef.current;
    const completion = s.progressIdx / (pathSamples.length - 1);
    s.tracing = false;
    setTracing(false);
    const elapsed = (Date.now() - s.startTime) / 1000;
    let grade;
    if (completion < 0.7) {
      grade = 'rough';
    } else if (elapsed < 5.0) {
      grade = 'master';
    } else if (elapsed < 7.5) {
      grade = 'fine';
    } else {
      grade = 'rough';
    }
    setPhase('done');
    setElapsedTime(elapsed);
    setTimeout(() => onComplete(grade), 600);
  }

  function onPointerUp() { pauseTrace(); }
  function onPointerLeave() { if (stateRef.current.tracing) pauseTrace(); }

  const pathD = (() => {
    const [first, ...rest] = controlPoints;
    return `M ${first.x} ${first.y} ` + rest.map(p => `L ${p.x} ${p.y}`).join(' ');
  })();

  // v2.58: traced-portion overlay. Built from pathSamples up to
  // progressIdx so the line visibly "lights up" as the player drags
  // through. Recomputed every render — cheap, samples are ~400 points.
  const tracedD = (() => {
    const upTo = stateRef.current.progressIdx || Math.round(progress * (pathSamples.length - 1));
    if (upTo <= 0) return '';
    const head = pathSamples.slice(0, upTo + 1);
    return `M ${head[0].x} ${head[0].y} ` + head.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  })();

  const proximityColor = errorBucket === 'master' ? '#7a9b3a'
                       : errorBucket === 'fine'   ? '#c79d44'
                       :                            '#a44a3f';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4 max-w-4xl mx-auto">
      <h2 className="font-display text-2xl text-moss-300">🛠 {eventTitle}</h2>
      <p className="text-sm text-parchment-300 italic max-w-xl text-center">{choiceLabel}</p>
      <p className="text-xs text-parchment-400 max-w-xl text-center">
        Click READY, then press and hold from the green START dot and drag to the red END dot.
        Release to pause; press again at the frontier of your traced line to resume.
        Click <b>Finish the cut</b> when done. Speed grading: <b className="text-moss-300">&lt; 5s = Master</b> · <b className="text-gold-300">&lt; 7.5s = Fine</b> · slower = Rough. Must trace ≥ 70% of the line.
      </p>
      {/* Timer + Ready button. */}
      <div className="flex items-center gap-4">
        {phase === 'idle' && (
          <button onClick={startTrace} className="btn btn-iris text-lg px-8 py-3 animate-pulse">
            ▶ Ready — Start Timer
          </button>
        )}
        {phase !== 'idle' && (
          <div className={`font-mono text-3xl font-bold ${elapsedTime < 5 ? 'text-moss-300' : elapsedTime < 7.5 ? 'text-gold-300' : 'text-ember-400'}`}>
            {elapsedTime.toFixed(2)}s
          </div>
        )}
      </div>
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
          {/* v2.58: traced overlay — bright solid line over the dotted
              target, drawn up to the player's furthest progress. Gives
              clear feedback that the cut is registering. */}
          {tracedD && (
            <path d={tracedD} fill="none" stroke="#dbb45f" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 0 4px #f4d77a)' }} />
          )}
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
      <div className="flex gap-4 items-center flex-wrap justify-center">
        <div className="text-xs text-parchment-300">Progress: <span className="font-mono text-gold-300">{Math.round(progress * 100)}%</span></div>
        <div className="text-xs text-parchment-300">Cut quality: <span className="font-mono" style={{ color: proximityColor }}>{errorBucket.toUpperCase()}</span></div>
        {phase === 'tracing' && !tracing && progress === 0 && (
          <div className="text-xs text-parchment-400 italic">Press and hold from the green dot.</div>
        )}
        {phase === 'tracing' && tracing && (
          <div className="text-xs text-parchment-400 italic">Tracing… release to pause.</div>
        )}
        {phase === 'tracing' && !tracing && progress > 0 && (
          <>
            <div className="text-xs text-parchment-400 italic">Paused — resume from the green dot or finish.</div>
            <button className="btn btn-iris text-sm" onClick={() => finish()}>Finish the cut</button>
          </>
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
        {/* v2.80: equipment install breakdown — mirror the spell-tray math
            pattern. Each bonus and material-derived effect surfaces as its
            own hoverable chip so the player sees exactly what the install
            grants, not just the prose desc. */}
        {!isCard && <EquipmentEffectBreakdown equipment={item} />}
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

// v2.80: equipment effect chips. Mirrors the v2.79 spell-tray math
// pattern — every bonus key gets its own hoverable chip with an
// explanation. Used on the CraftingResult screen AND the act-cleared
// summary. New keys must be added here to be visible to players.
function equipmentEffectSummary(equipment) {
  // String variant for use inside <span title=...> tooltips on the
  // equipment chips. Plain-text lines, one bullet per effect.
  const bonus = equipment?.bonus || {};
  const effect = equipment?.effect || {};
  const lines = [];
  if (bonus.maxHp)                 lines.push(`• +${bonus.maxHp} max HP (permanent)`);
  if (bonus.startBlock)            lines.push(`• +${bonus.startBlock} Block at the start of every combat`);
  if (bonus.healOnCombatStart)     lines.push(`• +${bonus.healOnCombatStart} HP at the start of every combat`);
  if (bonus.extraStartHand)        lines.push(`• +${bonus.extraStartHand} cards drawn on turn 1`);
  if (bonus.energyOnCombatStart)   lines.push(`• +${bonus.energyOnCombatStart} Energy on turn 1`);
  if (bonus.permanentEnergyBonus)  lines.push(`• +${bonus.permanentEnergyBonus} Energy every turn (permanent)`);
  if (bonus.damageReduction)       lines.push(`• −${bonus.damageReduction} dmg per incoming hit (capped at 2 across equipment)`);
  if (bonus.startCombatVulnerable) lines.push(`• Enemy starts +${bonus.startCombatVulnerable * 25}% incoming damage`);
  if (bonus.startCombatWeak)       lines.push(`• Enemy starts -${bonus.startCombatWeak * 25}% attack damage`);
  if (bonus.strikeBonus)           lines.push(`• +${bonus.strikeBonus} dmg to any Effect card named "Strike"`);
  if (effect.startOfTurnBlock)     lines.push(`• +${effect.startOfTurnBlock} Block at the start of every turn`);
  if (effect.firstHitReduction)    lines.push(`• −${effect.firstHitReduction} damage on the FIRST enemy hit each combat`);
  if (effect.combatEndHeal)        lines.push(`• +${effect.combatEndHeal} HP at the end of every combat`);
  if (effect.startCombatPoise)     lines.push(`• +${effect.startCombatPoise} Poise at the start of every combat`);
  if (effect.startCombatVulnerable) lines.push(`• Enemy starts +${effect.startCombatVulnerable * 25}% incoming damage`);
  if (effect.startCombatWeak)      lines.push(`• Enemy starts -${effect.startCombatWeak * 25}% attack damage`);
  if (effect.onCombatStart) {
    const oc = effect.onCombatStart;
    if (oc.block)  lines.push(`• +${oc.block} Block at the start of every combat`);
    if (oc.draw)   lines.push(`• +${oc.draw} cards drawn on turn 1`);
    if (oc.energy) lines.push(`• +${oc.energy} Energy on turn 1`);
    if (oc.hp)     lines.push(`• +${oc.hp} HP at the start of every combat`);
  }
  return lines.join('\n');
}

// v2.81: relic effect chips + tooltip string — same math-bar pattern
// applied to passive relics. Used on the relic HUD chips and (when a
// grant screen lands) on the relic preview. New relic effect keys must
// be handled in BOTH functions to surface to players.
function relicEffectSummary(relic) {
  const e = relic?.effect || {};
  const lines = [];
  if (e.passiveStrikeBonus)        lines.push(`• +${e.passiveStrikeBonus} dmg to any Effect named "Strike"`);
  if (e.permanentEnergyBonus)      lines.push(`• +${e.permanentEnergyBonus} Energy every turn (permanent)`);
  if (e.onCombatStart) {
    const oc = e.onCombatStart;
    if (oc.block)  lines.push(`• +${oc.block} Block at the start of every combat`);
    if (oc.draw)   lines.push(`• +${oc.draw} cards drawn on turn 1 of every combat`);
    if (oc.energy) lines.push(`• +${oc.energy} Energy on turn 1 of every combat`);
    if (oc.hp)     lines.push(`• +${oc.hp} HP at the start of every combat`);
  }
  if (e.onEnemyDefeated) {
    const od = e.onEnemyDefeated;
    if (od.heal)   lines.push(`• +${od.heal} HP each time you defeat an enemy`);
    if (od.draw)   lines.push(`• Draw ${od.draw} when you defeat an enemy`);
    if (od.energy) lines.push(`• +${od.energy} Energy when you defeat an enemy`);
  }
  if (e.onCombatEnd) {
    const ce = e.onCombatEnd;
    if (ce.heal)   lines.push(`• +${ce.heal} HP at the end of every combat won`);
  }
  if (e.everyNthEffect) {
    const en = e.everyNthEffect;
    lines.push(`• Every ${en.n}th Effect you cast deals +${en.extraDamage} damage`);
  }
  return lines.join('\n');
}

function RelicEffectBreakdown({ relic }) {
  const e = relic?.effect || {};
  const chips = [];
  if (e.passiveStrikeBonus)        chips.push({ icon: '⚔',  label: `+${e.passiveStrikeBonus} dmg on Strike casts`, title: `Any Effect card named "Strike" gets +${e.passiveStrikeBonus} base damage.` });
  if (e.permanentEnergyBonus)      chips.push({ icon: '⚡',  label: `+${e.permanentEnergyBonus} Energy every turn`, title: `Permanent: your Energy refill is +${e.permanentEnergyBonus} above baseline every turn.` });
  if (e.onCombatStart) {
    const oc = e.onCombatStart;
    if (oc.block)  chips.push({ icon: '🛡', label: `+${oc.block} Block at combat start`, title: `Every combat begins with ${oc.block} Block.` });
    if (oc.draw)   chips.push({ icon: '🃏', label: `+${oc.draw} draw at combat start`,   title: `Draw ${oc.draw} extra cards on turn 1 of every combat.` });
    if (oc.energy) chips.push({ icon: '⚡', label: `+${oc.energy} Energy on turn 1`,     title: `Gain ${oc.energy} extra Energy on turn 1 (one-shot per combat).` });
    if (oc.hp)     chips.push({ icon: '💚', label: `+${oc.hp} HP at combat start`,        title: `Heal ${oc.hp} HP at the start of every combat.` });
  }
  if (e.onEnemyDefeated) {
    const od = e.onEnemyDefeated;
    if (od.heal)   chips.push({ icon: '💚', label: `+${od.heal} HP per enemy defeated`, title: `Heal ${od.heal} HP each time you defeat an enemy.` });
    if (od.draw)   chips.push({ icon: '🃏', label: `+${od.draw} draw per enemy defeated`, title: `Draw ${od.draw} when you defeat an enemy.` });
    if (od.energy) chips.push({ icon: '⚡', label: `+${od.energy} Energy per enemy defeated`, title: `+${od.energy} Energy when you defeat an enemy.` });
  }
  if (e.onCombatEnd) {
    const ce = e.onCombatEnd;
    if (ce.heal)   chips.push({ icon: '💚', label: `+${ce.heal} HP at combat end`,      title: `Heal ${ce.heal} HP at the end of every combat won.` });
  }
  if (e.everyNthEffect) {
    const en = e.everyNthEffect;
    chips.push({ icon: '✦', label: `Every ${en.n}th cast +${en.extraDamage} dmg`, title: `Every ${en.n}th Effect you cast deals +${en.extraDamage} bonus damage.` });
  }
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 pt-2 border-t border-ink-500">
      <div className="text-[10px] uppercase tracking-widest text-gold-300 font-bold mb-1.5">Effects</div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <span key={i} title={c.title}
            className="text-[11px] font-mono px-2 py-1 rounded bg-gold-800/50 border border-gold-600 text-parchment-100 cursor-help">
            {c.icon} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function EquipmentEffectBreakdown({ equipment }) {
  const bonus = equipment?.bonus || {};
  const effect = equipment?.effect || {};
  const chips = [];
  // ---- bonus.* (standard install keys) ----
  if (bonus.maxHp)                 chips.push({ icon: '❤',  label: `+${bonus.maxHp} max HP`,                       title: `Permanent: your maximum HP is raised by ${bonus.maxHp}.` });
  if (bonus.startBlock)            chips.push({ icon: '🛡',  label: `+${bonus.startBlock} Block at combat start`,   title: `Every combat begins with ${bonus.startBlock} Block already up.` });
  if (bonus.healOnCombatStart)     chips.push({ icon: '💚',  label: `+${bonus.healOnCombatStart} HP at combat start`, title: `Heal ${bonus.healOnCombatStart} HP at the start of every combat.` });
  if (bonus.extraStartHand)        chips.push({ icon: '🃏',  label: `+${bonus.extraStartHand} draw on turn 1`,       title: `Draw ${bonus.extraStartHand} extra card on the first turn of every combat.` });
  if (bonus.energyOnCombatStart)   chips.push({ icon: '⚡',  label: `+${bonus.energyOnCombatStart} Energy on turn 1`, title: `Gain ${bonus.energyOnCombatStart} extra Energy on turn 1 of each combat (one-shot).` });
  if (bonus.permanentEnergyBonus)  chips.push({ icon: '⚡',  label: `+${bonus.permanentEnergyBonus} Energy every turn`, title: `Permanent: your Energy refills to +${bonus.permanentEnergyBonus} above baseline every turn.` });
  if (bonus.damageReduction)       chips.push({ icon: '🛡✦', label: `−${bonus.damageReduction} damage per hit`,       title: `Every incoming damage instance is reduced by ${bonus.damageReduction} (min 1 dmg taken). Capped at 2 total across equipment.` });
  if (bonus.startCombatVulnerable) chips.push({ icon: '🩸',  label: `+${bonus.startCombatVulnerable} Vuln to enemy at start`, title: `Enemy starts every combat at +${bonus.startCombatVulnerable * 25}% incoming damage (Vulnerable).` });
  if (bonus.startCombatWeak)       chips.push({ icon: '⛧',  label: `+${bonus.startCombatWeak} Weak to enemy at start`, title: `Enemy attacks deal -${bonus.startCombatWeak * 25}% damage at the start of every combat.` });
  if (bonus.strikeBonus)           chips.push({ icon: '⚔',  label: `+${bonus.strikeBonus} dmg to Strike casts`,       title: `Any Effect card named "Strike" gets +${bonus.strikeBonus} base damage on cast.` });
  // ---- effect.* (material-derived hooks read by the combat loop) ----
  if (effect.startOfTurnBlock)     chips.push({ icon: '🛡',  label: `+${effect.startOfTurnBlock} Block every turn`,   title: `At the start of every turn, gain ${effect.startOfTurnBlock} Block.` });
  if (effect.firstHitReduction)    chips.push({ icon: '🪨',  label: `−${effect.firstHitReduction} damage on first hit per combat`, title: `The very first enemy hit each combat is reduced by ${effect.firstHitReduction}.` });
  if (effect.combatEndHeal)        chips.push({ icon: '💚',  label: `+${effect.combatEndHeal} HP at combat end`,      title: `Heal ${effect.combatEndHeal} HP at the end of every combat (win or lose).` });
  if (effect.startCombatPoise)     chips.push({ icon: '🪞',  label: `+${effect.startCombatPoise} Poise at combat start`, title: `Every combat begins with ${effect.startCombatPoise} Poise (absorbs composure damage).` });
  if (effect.startCombatVulnerable) chips.push({ icon: '🩸',  label: `+${effect.startCombatVulnerable} Vuln to enemy at start`, title: `Enemy starts every combat at +${effect.startCombatVulnerable * 25}% incoming damage.` });
  if (effect.startCombatWeak)      chips.push({ icon: '⛧',  label: `+${effect.startCombatWeak} Weak to enemy at start`, title: `Enemy attacks deal -${effect.startCombatWeak * 25}% damage at the start of every combat.` });
  if (effect.onCombatStart) {
    const oc = effect.onCombatStart;
    if (oc.block)  chips.push({ icon: '🛡', label: `+${oc.block} Block at combat start`,  title: `Every combat begins with ${oc.block} Block.` });
    if (oc.draw)   chips.push({ icon: '🃏', label: `+${oc.draw} draw at combat start`,    title: `Draw ${oc.draw} extra cards on the first turn of every combat.` });
    if (oc.energy) chips.push({ icon: '⚡', label: `+${oc.energy} Energy at combat start`, title: `Gain ${oc.energy} extra Energy on turn 1 (one-shot).` });
    if (oc.hp)     chips.push({ icon: '💚', label: `+${oc.hp} HP at combat start`,         title: `Heal ${oc.hp} HP at the start of every combat.` });
  }
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 pt-2 border-t border-ink-500">
      <div className="text-[10px] uppercase tracking-widest text-iris-300 font-bold mb-1.5">Effects</div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <span key={i} title={c.title}
            className="text-[11px] font-mono px-2 py-1 rounded bg-iris-800/50 border border-iris-600 text-parchment-100 cursor-help">
            {c.icon} {c.label}
          </span>
        ))}
      </div>
    </div>
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
        <button onClick={() => onChoose('forget')}  className="btn btn-iris">Forget a card — remove one from your deck</button>
      </div>
    </div>
  );
}

function UpgradeCardScreen({ deck, onPick }) {
  // Show NON-upgraded cards. v2 sentence cards are upgradable via the
  // auto-derived path in upgradeCard(), so the eligibility check now
  // accepts either an explicit `upgrade` field OR a v2 `slot` field.
  const isUpgradable = (c) => !c.upgraded && (c.upgrade || (c.slot && c.lane));
  const eligible = deck.filter(isUpgradable);
  const ineligible = deck.filter(c => !isUpgradable(c));
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
            const dispName = card.name || card.phrase || '';
            const upDispName = upgraded.name || upgraded.phrase || dispName;
            const dispLabel = card.slot || card.type;
            return (
              <button key={card.uid} onClick={() => setPendingUid(card.uid)}
                className="w-52 rounded-md border-2 p-3 text-left bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl transition flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <div className={`text-[10px] uppercase tracking-wider font-bold ${card.slot === 'target' ? 'text-ember-700' : card.slot === 'modifier' ? 'text-gold-700' : card.slot ? 'text-iris-700' : 'text-ink-400'}`}>
                    {dispLabel}{card.tier ? ` · T${card.tier}` : ''}
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">{card.cost}</div>
                </div>
                <div className="font-display text-base">{dispName}</div>
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
                  </div>
                )}
                <div className="text-xs mt-auto pt-2 border-t border-ink-300 text-moss-700">
                  → <b>{upDispName}</b>{(() => {
                    if (upgraded.effect && card.effect) {
                      const dBase = (upgraded.effect.base || 0) - (card.effect.base || 0);
                      if (dBase > 0) return `: base ${card.effect.base} → ${upgraded.effect.base}`;
                    }
                    if (upgraded.stats && card.stats) {
                      const k = ['chutzpah','wit','jnsq'].find(s => (upgraded.stats[s] || 0) > (card.stats[s] || 0));
                      if (k) return `: ${k} ${card.stats[k]} → ${upgraded.stats[k]}`;
                    }
                    return summarizeEffects(upgraded.effects, upgraded.power, upgraded.cost, upgraded.stats, upgraded.effect);
                  })()}
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
            {ineligible.map(c => <span key={c.uid}>{c.name || c.phrase || c.id}</span>)}
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

// v2.8: Remove a card from the deck at a rest site. Click → confirm.
// Same layout as the upgrade picker so the player recognizes the flow.
// v2.86: full card body — mirrors the hand-render card content so other
// surfaces (forget screens, reward previews, draft confirmations) all
// show the same level of detail. Returns the inner content; caller
// provides the button wrapper / hover affordances.
function CardFullBody({ card }) {
  const displayName = card.name || card.phrase || '';
  const displayDesc = card.desc || (card.flavor ? `"${card.flavor}"` : '');
  const displayLabel = card.slot || card.type || '';
  const dmgType = card.type === 'effect' || card.slot === 'target' ? card.effect?.damageType : null;
  const dmgLabel = dmgType === 'physical' ? 'Physical dmg' : dmgType === 'composure' ? 'Composure dmg' : null;
  const dmgChip = dmgType === 'physical' ? 'text-ember-700 bg-ember-100' : 'text-iris-700 bg-iris-100';
  const tagOrResonance =
    card.tags && card.tags.length > 0
      ? <div className="text-[11px] text-ink-500 italic">✦ {card.tags.join(' · ')}</div>
      : card.type === 'effect' && card.effect?.resonatesWith && card.effect.resonatesWith.length > 0
      ? <div className="text-[11px] text-iris-700 italic">✦ {card.effect.resonatesWith.join(', ')}{card.effect.resonanceBonus?.perTag ? ` (+${card.effect.resonanceBonus.perTag})` : ''}</div>
      : null;
  return (
    <>
      <div className="flex justify-between items-start gap-1">
        <div className={`text-[10px] uppercase tracking-wider font-bold ${card.slot === 'target' ? 'text-ember-700' : card.slot === 'modifier' ? 'text-gold-700' : card.slot ? 'text-iris-700' : 'text-ink-400'}`}>
          {displayLabel}{card.tier ? ` · T${card.tier}` : ''}{card.rarity ? ` · ${card.rarity}` : ''}
        </div>
        <div className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">
          {card.cost ?? 0}
        </div>
      </div>
      <div className="font-display text-[15px] leading-tight">{displayName}</div>
      {card.slot === 'annotation' && (
        <div className="text-[11px] font-bold text-iris-700 uppercase tracking-wider">
          📝 {card.duration || 3} turns · attach to enemy
        </div>
      )}
      {(card.stats && (card.stats.chutzpah || card.stats.wit || card.stats.jnsq)) || (card.footnotes > 0) ? (
        <div className="flex gap-1 flex-wrap text-xs font-mono">
          {card.stats?.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
          {(card.stats?.wit || card.footnotes > 0) ? (
            <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">
              ✨ {(card.stats?.wit || 0) + (card.footnotes || 0)}{card.footnotes > 0 ? ` ${'*'.repeat(Math.min(3, card.footnotes))}` : ''}
            </span>
          ) : null}
          {card.stats?.jnsq ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
        </div>
      ) : null}
      {card.effects && (card.effects.weak || card.effects.vulnerable || card.effects.block || card.effects.draw || card.effects.loseHp || card.effects.hp) && (
        <div className="flex flex-col gap-0.5 text-sm font-bold uppercase tracking-wide">
          {card.effects.weak && <span className="text-ember-700">⛧ Weak {card.effects.weak}</span>}
          {card.effects.vulnerable && <span className="text-ember-700">🩸 Vuln {card.effects.vulnerable}</span>}
          {card.effects.block && <span className="text-iris-700">🛡 +{card.effects.block} Block</span>}
          {card.effects.draw && <span className="text-moss-700">📥 Draw {card.effects.draw}</span>}
          {card.effects.loseHp && <span className="text-ember-700">🩸 −{card.effects.loseHp} HP</span>}
          {card.effects.hp && <span className="text-moss-700">💚 +{card.effects.hp} HP</span>}
        </div>
      )}
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
            <div className="text-sm font-bold text-ember-700 uppercase tracking-wide">
              {Object.entries(card.effect.rider).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' · ')}
            </div>
          )}
          {card.effect.loseHpOnCast && (
            <div className="text-sm font-bold text-ember-700 uppercase tracking-wide">
              🩸 −{card.effect.loseHpOnCast} HP on cast
            </div>
          )}
          {card.effect.tier3Double && <div className="text-xs text-ember-700 font-bold italic">Doubles at Tier 3</div>}
          {card.effect.requiresTier3 && <div className="text-xs text-ember-700 font-bold italic">Requires Tier 3 (else half damage)</div>}
          {card.effect.perLaneTag && (
            <div className="text-sm font-bold text-iris-700 uppercase tracking-wide">
              ✦ +{card.effect.perLaneTag.bonus} per {card.effect.perLaneTag.tags.join(' / ')} tag
            </div>
          )}
        </>
      )}
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
      {card.slot === 'gesture' && card.gestureEffect && (() => {
        const ge = card.gestureEffect;
        const laneLabel = (card.lane || 'wit').toUpperCase();
        const gType = ge.damageType === 'physical' ? 'phys' : 'comp';
        return (
          <div className="text-sm font-mono text-ink-700 leading-tight">
            <div className="font-bold">
              {ge.icon || '✊'} {ge.damage} {gType}
              {ge.trayMultiplier ? ` + ${laneLabel}×${ge.trayMultiplier}` : ''}
            </div>
            {ge.rider && Object.keys(ge.rider).length > 0 && (
              <div className="text-xs text-ember-700 font-bold uppercase">
                {Object.entries(ge.rider).map(([k, v]) => `+${v} ${k}`).join(' · ')}
              </div>
            )}
            {ge.stripEnemyBlock ? <div className="text-xs text-iris-700">🛇 strip {ge.stripEnemyBlock} block</div> : null}
            {ge.draw ? <div className="text-xs text-moss-700">📥 draw {ge.draw}</div> : null}
            <div className="text-[10px] italic text-ink-500">
              {ge.exhaust === false ? 'Reusable · bypasses spell tray' : 'Exhausts · bypasses spell tray'}
            </div>
          </div>
        );
      })()}
      {card.slot === 'annotation' && card.annotationEffect && (
        <div className="text-sm font-mono text-ink-700 leading-tight">
          <div className="text-xs">
            {Object.entries(card.annotationEffect).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </div>
        </div>
      )}
      <div className="text-sm flex-1 font-quill leading-snug italic">{displayDesc}</div>
      {(card.effects?.exhaust || card.effect?.exhaust) && <div className="text-[10px] italic text-ember-700">Exhaust</div>}
      {tagOrResonance && (
        <div className="mt-auto pt-1.5 border-t border-ink-300">{tagOrResonance}</div>
      )}
    </>
  );
}

// v2.85: pick-one-of-two-to-forget modal. Used when an event triggers
// loseRandomCard — instead of silently dropping a random card, the
// player sees two candidates and explicitly chooses which to forget.
// No back button: the consequence has to land.
function ForgetTwoModal({ cards, onPick }) {
  return (
    <div className="fixed inset-0 bg-ink-900 bg-opacity-85 flex items-center justify-center z-50 p-6">
      <div className="parchment-card-strong p-6 max-w-3xl w-full flex flex-col gap-4">
        <div className="text-center">
          <h2 className="font-display text-3xl text-ember-300">Forget a Card</h2>
          <p className="text-sm text-parchment-300 italic mt-1">
            Pick one of the two. The other returns to your deck. The chosen card is gone for the rest of this run.
          </p>
        </div>
        <div className="flex gap-4 justify-center flex-wrap">
          {cards.map(card => (
            <button key={card.uid} onClick={() => onPick(card.uid)}
              className="w-[200px] min-h-[290px] rounded-md border-2 p-3 text-left bg-parchment-50 text-ink-800 border-ember-500 hover:scale-105 hover:shadow-2xl transition flex flex-col gap-1.5">
              <CardFullBody card={card} />
            </button>
          ))}
        </div>
        <div className="text-[11px] text-parchment-400 italic text-center">Click the card you'd rather lose.</div>
      </div>
    </div>
  );
}

function ForgetCardScreen({ deck, onPick }) {
  const [pendingUid, setPendingUid] = useState(null);
  const pendingCard = pendingUid ? deck.find(c => c.uid === pendingUid) : null;
  return (
    <div className="min-h-screen flex flex-col p-6 gap-4 max-w-5xl mx-auto">
      <div className="text-center">
        <h2 className="font-display text-4xl text-iris-300">Forget a Card</h2>
        <p className="text-base text-parchment-300 italic mt-1">Pick one to lose forever. Slim decks hit harder.</p>
      </div>
      <div className="parchment-card p-3">
        <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">Your deck ({deck.length})</div>
        <div className="flex flex-wrap gap-3">
          {deck.length === 0 && (
            <div className="text-sm italic text-parchment-400">Empty deck. Nothing to forget.</div>
          )}
          {deck.map(card => (
            <button key={card.uid} onClick={() => setPendingUid(card.uid)}
              className="w-[200px] min-h-[290px] rounded-md border-2 p-3 text-left bg-parchment-50 text-ink-800 border-iris-500 hover:scale-105 hover:shadow-2xl transition flex flex-col gap-1.5">
              <CardFullBody card={card} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        <button onClick={() => onPick(null)} className="btn bg-ink-700 text-parchment-200">Back</button>
      </div>
      {pendingCard && (
        <div className="fixed inset-0 bg-ink-900 bg-opacity-80 flex items-center justify-center z-50 p-6">
          <div className="parchment-card-strong p-6 max-w-md flex flex-col gap-4 items-center">
            <h3 className="font-display text-2xl text-iris-300">Forget this card?</h3>
            <div className="font-display text-lg">{pendingCard.name || pendingCard.phrase}</div>
            <div className="text-xs italic text-parchment-300">Once forgotten, it's out of your deck for the rest of the run.</div>
            <div className="flex gap-3">
              <button onClick={() => setPendingUid(null)} className="btn bg-ink-700 text-parchment-200">Cancel</button>
              <button onClick={() => onPick(pendingUid)} className="btn btn-iris">Forget</button>
            </div>
          </div>
        </div>
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
        {/* v2.18: surface gesture / annotation specifics so upgrade diff is visible */}
        {card.slot === 'gesture' && card.gestureEffect && (
          <div className="text-sm font-mono text-ink-700">
            {card.gestureEffect.icon || '✊'} {card.gestureEffect.damage} {card.gestureEffect.damageType === 'physical' ? 'phys' : 'comp'}
            {card.gestureEffect.stripEnemyBlock ? ` · strip ${card.gestureEffect.stripEnemyBlock}` : ''}
            {card.gestureEffect.draw ? ` · draw ${card.gestureEffect.draw}` : ''}
            {card.gestureEffect.rider && Object.keys(card.gestureEffect.rider).length > 0
              ? ' · ' + Object.entries(card.gestureEffect.rider).map(([k,v]) => `${k}${v}`).join('·') : ''}
          </div>
        )}
        {card.slot === 'annotation' && card.annotationEffect && (
          <div className="text-sm font-mono text-ink-700">
            📝 {card.duration} turns · {Object.entries(card.annotationEffect).map(([k,v]) => `${k}:${v}`).join(' · ')}
          </div>
        )}
        {card.slot === 'modifier' && card.modifierEffect && (
          <div className="text-sm font-mono text-ink-700">
            {card.modifierEffect.damageMult ? `×${card.modifierEffect.damageMult} dmg` : ''}
            {card.modifierEffect.rider?.block ? ` · block ${card.modifierEffect.rider.block}` : ''}
            {card.modifierEffect.diceShift ? ` · roll +${card.modifierEffect.diceShift}` : ''}
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
