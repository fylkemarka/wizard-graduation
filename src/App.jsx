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

import { useState } from 'react';
import { motion } from 'framer-motion';

// =============================================================================
// 1. DATA
// =============================================================================
const CARDS = [
  // =============================================================================
  // WORD CARDS — phrase fragments. They contribute stat points to the
  // spell tray for this turn. The `phrase` text reads out in the log
  // as the spell builds.
  // =============================================================================
  // ---- BASIC (starter) ----
  { id: 'w-respect', name: 'With all due respect,', cost: 0, type: 'word', rarity: 'basic',
    stats: { wit: 1 }, tags: ['formal', 'sarcastic'], phrase: 'with all due respect,',
    upgrade: { stats: { wit: 2 } },
    desc: '+1 Wit to your spell.',
    flavor: 'Almost none of it is due.' },
  { id: 'w-frankly', name: 'Frankly,', cost: 0, type: 'word', rarity: 'basic',
    stats: { chutzpah: 1 }, tags: ['dismissive', 'sarcastic'], phrase: 'frankly,',
    upgrade: { stats: { chutzpah: 2 } },
    desc: '+1 Chutzpah to your spell.',
    flavor: 'The word is doing a lot of work.' },
  { id: 'w-erm', name: 'Erm…', cost: 0, type: 'word', rarity: 'basic',
    stats: { jnsq: 1 }, tags: ['chaotic'], phrase: 'erm…',
    upgrade: { stats: { jnsq: 2 } },
    desc: '+1 Jnsq to your spell.',
    flavor: 'You haven\'t worked out the next bit yet.' },

  // ---- COMMON ----
  { id: 'w-actually', name: 'Actually,', cost: 0, type: 'word', rarity: 'common',
    stats: { wit: 1, chutzpah: 1 }, tags: ['sarcastic', 'dismissive'], phrase: 'actually,',
    upgrade: { stats: { wit: 2, chutzpah: 1 } },
    desc: '+1 Wit, +1 Chutzpah.',
    flavor: 'Slightly louder than the surrounding sentence.' },
  { id: 'w-look-here', name: 'Look here,', cost: 0, type: 'word', rarity: 'common',
    stats: { chutzpah: 2 }, tags: ['booming', 'threatening'], phrase: 'look here,',
    upgrade: { stats: { chutzpah: 3 } },
    desc: '+2 Chutzpah.',
    flavor: 'Don\'t actually look. The room behind you is more important.' },
  { id: 'w-suppose', name: 'Suppose, hypothetically,', cost: 1, type: 'word', rarity: 'common',
    stats: { wit: 3 }, tags: ['academic', 'rhetorical'], phrase: 'suppose, hypothetically,',
    upgrade: { stats: { wit: 4 } },
    desc: '+3 Wit.',
    flavor: 'It is never hypothetically.' },
  { id: 'w-mutters', name: 'Mutters dark Latin', cost: 0, type: 'word', rarity: 'common',
    stats: { jnsq: 2 }, tags: ['mystical', 'chaotic'], phrase: '(mutters dark Latin)',
    upgrade: { stats: { jnsq: 3 } },
    desc: '+2 Jnsq.',
    flavor: 'You half-recognise the verb. It is not encouraging.' },
  { id: 'w-stares', name: 'Stares', cost: 0, type: 'word', rarity: 'common',
    stats: { chutzpah: 1, jnsq: 1 }, tags: ['threatening', 'theatrical'], phrase: '(stares)',
    upgrade: { stats: { chutzpah: 2, jnsq: 1 } },
    desc: '+1 Chutzpah, +1 Jnsq.',
    flavor: 'For longer than is socially comfortable.' },
  { id: 'w-footnote', name: 'A Lengthy Footnote', cost: 1, type: 'word', rarity: 'common',
    stats: { wit: 2, jnsq: 1 }, tags: ['academic', 'rhetorical'], phrase: '— see footnote 17 —',
    upgrade: { stats: { wit: 3, jnsq: 1 } },
    desc: '+2 Wit, +1 Jnsq.',
    flavor: 'Footnote 17 was always the dangerous one.' },

  // ---- UNCOMMON ----
  { id: 'w-rhetorical', name: 'A Rhetorical Question', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { wit: 4 }, tags: ['rhetorical', 'academic'], phrase: 'but is it really, though?',
    upgrade: { stats: { wit: 5 } },
    desc: '+4 Wit.',
    flavor: 'It does not require an answer. It demands one.' },
  { id: 'w-thundering', name: 'Thundering Aside', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { chutzpah: 4 }, tags: ['booming', 'formal'], phrase: 'and FURTHERMORE,',
    upgrade: { stats: { chutzpah: 5 } },
    desc: '+4 Chutzpah.',
    flavor: 'It was supposed to be quieter than that.' },
  { id: 'w-non-sequitur', name: 'Non Sequitur', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { jnsq: 4 }, tags: ['absurd', 'chaotic'], phrase: 'speaking of cheese,',
    upgrade: { stats: { jnsq: 5 } },
    desc: '+4 Jnsq.',
    flavor: 'No one was speaking of cheese.' },
  { id: 'w-dramatic-pause', name: 'Dramatic Pause', cost: 0, type: 'word', rarity: 'uncommon',
    stats: { chutzpah: 1, wit: 1, jnsq: 1 }, tags: ['theatrical', 'mystical'], phrase: '…',
    effects: { draw: 1 },
    upgrade: { effects: { draw: 2 }, stats: { chutzpah: 1, wit: 1, jnsq: 1 } },
    desc: '+1 to each stat. Draw 1.',
    flavor: 'A bit longer than that. Hold it.' },

  // =============================================================================
  // EFFECT CARDS — seal the spell. Consume the tray, deal damage of
  // `damageType` ('composure' or 'physical') = (base + tray[scaleBy] *
  // multiplier) * enemy.effectiveness[scaleBy]. Composure → enemy
  // verbal track. Physical → enemy HP (most enemies are essentially
  // physical-immune by design; a few are not).
  // =============================================================================
  // ---- BASIC (starter) ----
  { id: 'e-persuade', name: 'Persuade', cost: 1, type: 'effect', rarity: 'basic',
    effect: { scaleBy: 'wit', base: 2, multiplier: 2, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } },
    phrase: '…and so, surely, the matter is settled.',
    upgrade: { effect: { scaleBy: 'wit', base: 4, multiplier: 2, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 2 + Wit×2 Composure. Resonates: rhetorical, academic.',
    flavor: 'You have brought receipts.' },
  { id: 'e-bluster', name: 'Bluster', cost: 1, type: 'effect', rarity: 'basic',
    effect: { scaleBy: 'chutzpah', base: 2, multiplier: 2, damageType: 'composure',
              resonatesWith: ['booming', 'threatening'], resonanceBonus: { perTag: 2 } },
    phrase: '…and that is FINAL.',
    upgrade: { effect: { scaleBy: 'chutzpah', base: 4, multiplier: 2, damageType: 'composure',
              resonatesWith: ['booming', 'threatening'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 2 + Chutzpah×2 Composure. Resonates: booming, threatening.',
    flavor: 'You said it with your whole chest.' },
  { id: 'e-bewilder', name: 'Bewilder', cost: 1, type: 'effect', rarity: 'basic',
    effect: { scaleBy: 'jnsq', base: 2, multiplier: 2, damageType: 'composure',
              resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 2 } },
    phrase: '…and the moon, of course, is a kind of biscuit.',
    upgrade: { effect: { scaleBy: 'jnsq', base: 4, multiplier: 2, damageType: 'composure',
              resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 2 + Jnsq×2 Composure. Resonates: absurd, mystical.',
    flavor: 'They\'re thinking about it. They shouldn\'t be.' },

  // ---- COMMON ----
  { id: 'e-convince', name: 'Convince', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'wit', base: 4, multiplier: 2, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } },
    phrase: '…which, logically, you must accept.',
    upgrade: { effect: { scaleBy: 'wit', base: 5, multiplier: 3, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 4 + Wit×2 Composure. Resonates: rhetorical, academic.',
    flavor: 'They nod before they realise.' },
  { id: 'e-intimidate', name: 'Intimidate', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'chutzpah', base: 4, multiplier: 2, damageType: 'composure',
              rider: { weak: 1 }, resonatesWith: ['threatening', 'booming'], resonanceBonus: { perTag: 2 } },
    phrase: '…or what, exactly, would you do about it?',
    upgrade: { effect: { scaleBy: 'chutzpah', base: 5, multiplier: 3, damageType: 'composure',
              rider: { weak: 1 }, resonatesWith: ['threatening', 'booming'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 4 + Chutzpah×2 Composure. Apply 1 Weak. Resonates: threatening, booming.',
    flavor: 'You are taller than you ought to be.' },
  { id: 'e-misdirect', name: 'Misdirect', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 2, damageType: 'composure',
              rider: { vulnerable: 1 }, resonatesWith: ['chaotic', 'absurd'], resonanceBonus: { perTag: 2 } },
    phrase: '…and look — a falling pigeon.',
    upgrade: { effect: { scaleBy: 'jnsq', base: 5, multiplier: 3, damageType: 'composure',
              rider: { vulnerable: 1 }, resonatesWith: ['chaotic', 'absurd'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 4 + Jnsq×2 Composure. Apply 1 Vulnerable. Resonates: chaotic, absurd.',
    flavor: 'It is not, but the look is enough.' },
  { id: 'e-strike', name: 'Strike', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'chutzpah', base: 6, multiplier: 1, damageType: 'composure',
              resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } },
    phrase: '*pokes them, verbally, in the chest*',
    upgrade: { effect: { scaleBy: 'chutzpah', base: 9, multiplier: 1, damageType: 'composure',
              resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 6 + Chutzpah Composure. Resonates: dismissive, petty.',
    flavor: 'A simple closing remark.' },

  // ---- UNCOMMON ----
  { id: 'e-refute', name: 'Refute', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } },
    phrase: '…you appear to be misremembering your own earlier words.',
    upgrade: { effect: { scaleBy: 'wit', base: 10, multiplier: 4, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 8 + Wit×3 Composure. Resonates: rhetorical, academic.',
    flavor: 'They turn pale. Or maybe always were.' },
  { id: 'e-cutting-remark', name: 'A Cutting Remark', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } },
    phrase: '…and the hat does not suit you.',
    upgrade: { effect: { scaleBy: 'chutzpah', base: 10, multiplier: 4, damageType: 'composure',
              resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 8 + Chutzpah×3 Composure. Resonates: dismissive, petty.',
    flavor: 'It is a perfectly normal hat.' },
  { id: 'e-bamboozle', name: 'Bamboozle', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'jnsq', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 2 } },
    phrase: '…the third inflection is the most important.',
    upgrade: { effect: { scaleBy: 'jnsq', base: 10, multiplier: 4, damageType: 'composure',
              resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 8 + Jnsq×3 Composure. Resonates: absurd, mystical.',
    flavor: 'There were no inflections. There still aren\'t.' },

  // ---- PHYSICAL EFFECT CARDS — for wizards who still want to throw something ----
  { id: 'e-spark', name: 'Spark', cost: 0, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'jnsq', base: 3, multiplier: 1, damageType: 'physical',
              resonatesWith: ['chaotic'], resonanceBonus: { perTag: 2 } },
    phrase: '(a small sharp light leaves your fingertips)',
    upgrade: { effect: { scaleBy: 'jnsq', base: 5, multiplier: 1, damageType: 'physical',
              resonatesWith: ['chaotic'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 3 + Jnsq physical damage. Resonates: chaotic.',
    flavor: 'It is not very impressive. It is also not very pleasant.' },
  { id: 'e-magic-missile', name: 'Magic Missile', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'jnsq', base: 9, multiplier: 2, damageType: 'physical',
              resonatesWith: ['mystical'], resonanceBonus: { perTag: 2 } },
    phrase: '(the air parts in a straight line ahead of you)',
    upgrade: { effect: { scaleBy: 'jnsq', base: 12, multiplier: 3, damageType: 'physical',
              resonatesWith: ['mystical'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 9 + Jnsq×2 physical damage. Resonates: mystical.',
    flavor: 'It always misses the bookshelves. Always.' },
  { id: 'e-sword-logic', name: 'Sword Logic', cost: 1, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'chutzpah', base: 5, multiplier: 2, damageType: 'physical',
              resonatesWith: ['threatening', 'dismissive'], resonanceBonus: { perTag: 2 } },
    phrase: '(hits them, mid-sentence)',
    upgrade: { effect: { scaleBy: 'chutzpah', base: 8, multiplier: 2, damageType: 'physical',
              resonatesWith: ['threatening', 'dismissive'], resonanceBonus: { perTag: 2 } } },
    desc: 'Cast: 5 + Chutzpah×2 physical damage. Resonates: threatening, dismissive.',
    flavor: 'The argument was won earlier, in a closet, with a board.' },

  // ---- RARE EFFECT CARDS ----
  { id: 'e-devastating', name: 'Devastating Truth', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'wit', base: 12, multiplier: 3, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 3 } },
    phrase: '…and that is what your tutor used to say about you, isn\'t it?',
    upgrade: { effect: { scaleBy: 'wit', base: 16, multiplier: 4, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 3 } } },
    desc: 'Cast: 12 + Wit×3 Composure. Resonates: rhetorical, academic (+3).',
    flavor: 'You found it in the library. It found you first.' },
  { id: 'e-coup-de-grace', name: 'Coup de Grâce', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'chutzpah', base: 14, multiplier: 3, damageType: 'composure', exhaust: true,
              resonatesWith: ['dismissive', 'formal'], resonanceBonus: { perTag: 3 } },
    phrase: '…and frankly that should have settled it ten minutes ago.',
    upgrade: { effect: { scaleBy: 'chutzpah', base: 18, multiplier: 4, damageType: 'composure', exhaust: true,
              resonatesWith: ['dismissive', 'formal'], resonanceBonus: { perTag: 3 } } },
    desc: 'Cast: 14 + Chutzpah×3 Composure. Exhaust. Resonates: dismissive, formal (+3).',
    flavor: 'You walk away mid-syllable. They notice eventually.' },
  { id: 'e-paradox', name: 'A Functional Paradox', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'jnsq', base: 6, multiplier: 4, damageType: 'composure',
              rider: { vulnerable: 2 }, resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 3 } },
    phrase: '…the door is also, in this case, the question.',
    upgrade: { effect: { scaleBy: 'jnsq', base: 8, multiplier: 5, damageType: 'composure',
              rider: { vulnerable: 2 }, resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 3 } } },
    desc: 'Cast: 6 + Jnsq×4 Composure. Apply 2 Vulnerable. Resonates: absurd, mystical (+3).',
    flavor: 'They are working on it. They will be for some time.' },

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

  // ---- RARE ----
  { id: 'c-aegis', name: 'Aegis', cost: 2, type: 'skill', rarity: 'rare',
    effects: { block: 16 }, upgrade: { effects: { block: 21 } },
    desc: 'Gain 16 Block.' },

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

// 9-card starter. One word per stat (chutzpah / wit / jnsq), one effect
// per stat (Bluster / Persuade / Bewilder), three Defends. With 5-card
// hands you'll see at least one effect ~95% of turns; fizzling is real
// when you draw all three effects with no words to feed them.
const STARTER_DECK = [
  'w-respect', 'w-frankly', 'w-erm',
  'e-persuade', 'e-bluster', 'e-bewilder',
  'c-defend', 'c-defend', 'c-defend',
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
  { id: 'e1-acolyte', act: 1, name: 'Lost Acolyte', composureMax: 20, hpMax: 18, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
    ] },
  { id: 'e1-imp', act: 1, name: 'Pact Imp', composureMax: 18, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 4, weight: 3, telegraph: '⚔ 4' },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '🌀 Weak 1' },
    ] },
  { id: 'e1-shrine-rat', act: 1, name: 'Shrine Rat Pack', composureMax: 16, hpMax: 12, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.0, physical: 2.0 },
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3, telegraph: '⚔ 2×3' },
      { kind: 'block',  value: 4, weight: 1, telegraph: '🛡 4' },
    ] },
  { id: 'e1-tutor', act: 1, name: 'Stern Tutor', composureMax: 32, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 2.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 8, weight: 3, telegraph: '⚔ 8' },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7' },
    ] },
  { id: 'e1-thicket', act: 1, name: 'Living Thicket', composureMax: 999, hpMax: 38, tier: 'elite',
    effectiveness: { chutzpah: 0, wit: 0, jnsq: 0, physical: 1.5 },
    behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'block',  value: 9, weight: 2, telegraph: '🛡 9' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🌀 Vuln' },
    ] },
  { id: 'e1-boss-thornlord', act: 1, name: 'The Thornlord', composureMax: 60, hpMax: 80, tier: 'boss',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11' },
      { kind: 'attack-multi', value: 4, count: 3, weight: 2, telegraph: '⚔ 4×3' },
      { kind: 'block',  value: 12, weight: 1, telegraph: '🛡 12' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🌀 Vuln 2' },
    ] },

  // ===== ACT 2 — The Thread Path =====
  { id: 'e2-hollow-weaver', act: 2, name: 'Hollow Weaver', composureMax: 28, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 7, weight: 3, telegraph: '⚔ 7' },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '🌀 Weak 1' },
    ] },
  { id: 'e2-silk-wraith', act: 2, name: 'Silk Wraith', composureMax: 22, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack-multi', value: 3, count: 3, weight: 3, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 6, weight: 1, telegraph: '🛡 6' },
    ] },
  { id: 'e2-loom-familiar', act: 2, name: 'Loom Familiar', composureMax: 30, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'block',  value: 8, weight: 2, telegraph: '🛡 8' },
    ] },
  { id: 'e2-pattern-maker', act: 2, name: 'The Pattern-Maker', composureMax: 44, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 10, weight: 2, telegraph: '⚔ 10' },
      { kind: 'attack-multi', value: 4, count: 3, weight: 1, telegraph: '⚔ 4×3' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🌀 Vuln 2' },
    ] },
  { id: 'e2-silent-spinner', act: 2, name: 'The Silent Spinner', composureMax: 50, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.5, wit: 0.5, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'block',  value: 12, weight: 2, telegraph: '🛡 12' },
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'weak',   value: 2, weight: 1, telegraph: '🌀 Weak 2' },
    ] },
  { id: 'e2-boss-tapestry', act: 2, name: 'The Tapestry Walker', composureMax: 80, hpMax: 999, tier: 'boss',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 1.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, telegraph: '⚔ 4×4' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🌀 Vuln 2' },
      { kind: 'block',  value: 15, weight: 1, telegraph: '🛡 15' },
    ] },

  // ===== ACT 3 — The Stone Path =====
  { id: 'e3-geode-crab', act: 3, name: 'Geode Crab', composureMax: 999, hpMax: 36, tier: 'normal',
    effectiveness: { chutzpah: 0, wit: 0, jnsq: 0, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'block',  value: 12, weight: 2, telegraph: '🛡 12' },
    ] },
  { id: 'e3-glow-mite', act: 3, name: 'Glow Mite Swarm', composureMax: 26, hpMax: 26, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.5, physical: 1.5 },
    behaviors: [
      { kind: 'attack-multi', value: 3, count: 4, weight: 3, telegraph: '⚔ 3×4' },
      { kind: 'weak',   value: 1, weight: 1, telegraph: '🌀 Weak 1' },
    ] },
  { id: 'e3-crystal-beetle', act: 3, name: 'Crystal Beetle', composureMax: 999, hpMax: 34, tier: 'normal',
    effectiveness: { chutzpah: 0, wit: 0, jnsq: 0, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 8, weight: 3, telegraph: '⚔ 8' },
      { kind: 'attack', value: 14, weight: 1, telegraph: '⚔ 14' },
    ] },
  { id: 'e3-quartz-sentinel', act: 3, name: 'Quartz Sentinel', composureMax: 56, hpMax: 56, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 12, weight: 2, telegraph: '⚔ 12' },
      { kind: 'block',  value: 15, weight: 2, telegraph: '🛡 15' },
      { kind: 'attack-multi', value: 4, count: 3, weight: 1, telegraph: '⚔ 4×3' },
    ] },
  { id: 'e3-vein-devourer', act: 3, name: 'Vein Devourer', composureMax: 999, hpMax: 62, tier: 'elite',
    effectiveness: { chutzpah: 0, wit: 0, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 13, weight: 3, telegraph: '⚔ 13' },
      { kind: 'attack-multi', value: 5, count: 3, weight: 1, telegraph: '⚔ 5×3' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🌀 Vuln 2' },
    ] },
  { id: 'e3-boss-geode', act: 3, name: 'The Awakened Geode', composureMax: 100, hpMax: 100, tier: 'boss',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 13, weight: 2, telegraph: '⚔ 13' },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, telegraph: '⚔ 5×4' },
      { kind: 'block',  value: 18, weight: 1, telegraph: '🛡 18' },
      { kind: 'vulnerable', value: 3, weight: 1, telegraph: '🌀 Vuln 3' },
    ] },

  // ===== ACT 4 — The Forge Path =====
  { id: 'e4-apprentice-shade', act: 4, name: "Apprentice's Shade", composureMax: 42, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 0.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 10, weight: 3, telegraph: '⚔ 10' },
      { kind: 'block',  value: 10, weight: 2, telegraph: '🛡 10' },
    ] },
  { id: 'e4-failed-initiate', act: 4, name: 'Failed Initiate', composureMax: 38, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 0.5, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack-multi', value: 4, count: 4, weight: 3, telegraph: '⚔ 4×4' },
      { kind: 'weak',   value: 2, weight: 1, telegraph: '🌀 Weak 2' },
    ] },
  { id: 'e4-mirror-past', act: 4, name: 'Mirror of the Past', composureMax: 44, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 1.5, jnsq: 1.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 12, weight: 2, telegraph: '⚔ 12' },
      { kind: 'vulnerable', value: 2, weight: 2, telegraph: '🌀 Vuln 2' },
      { kind: 'block',  value: 8, weight: 1, telegraph: '🛡 8' },
    ] },
  { id: 'e4-forgotten-master', act: 4, name: 'The Forgotten Master', composureMax: 70, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 15, weight: 2, telegraph: '⚔ 15' },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, telegraph: '⚔ 5×4' },
      { kind: 'block',  value: 16, weight: 1, telegraph: '🛡 16' },
    ] },
  { id: 'e4-test-wraith', act: 4, name: 'The Test Wraith', composureMax: 64, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.0, wit: 0, jnsq: 1.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 14, weight: 2, telegraph: '⚔ 14' },
      { kind: 'vulnerable', value: 3, weight: 1, telegraph: '🌀 Vuln 3' },
      { kind: 'weak',   value: 3, weight: 1, telegraph: '🌀 Weak 3' },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1, telegraph: '⚔ 4×4' },
    ] },
  { id: 'e4-boss-headmaster', act: 4, name: "The Headmaster's Shadow", composureMax: 130, hpMax: 999, tier: 'boss',
    effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 16, weight: 2, telegraph: '⚔ 16' },
      { kind: 'attack-multi', value: 5, count: 5, weight: 2, telegraph: '⚔ 5×5' },
      { kind: 'block',  value: 20, weight: 1, telegraph: '🛡 20' },
      { kind: 'vulnerable', value: 3, weight: 1, telegraph: '🌀 Vuln 3' },
    ] },

  // ===== TUTORIAL =====
  // Low-stakes practice partner. All-baseline effectiveness so the
  // player sees clean numbers. Light incoming damage so they learn
  // Block without ever being in danger.
  { id: 'tutorial-bursar', act: 0, name: 'The Bursar (Practice Match)', composureMax: 24, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 3, weight: 2, telegraph: '⚔ 3 (gentle)' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
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
    flavor: 'A leather-bound book lies open on a rock. The page reads, in fading copperplate: BORROWED — RETURN BY THE EQUINOX OR FACE THE STACK CRONE. There is no further explanation, which is somehow more concerning.',
    choices: [
      { label: 'Read on. (gain a random Common card)', effects: { gainCommonCard: 1 } },
      { label: 'Tear the page out. Pocket it. (+4 HP — felt powerful)', effects: { heal: 4 } },
      { label: 'Pretend you saw nothing.', effects: {} },
    ],
  },
  {
    id: 'ev-spring',
    title: 'Quiet Spring',
    flavor: 'A small spring bubbles between two stones. The water is cold, clear, and almost certainly not deliberately enchanted.',
    choices: [
      { label: 'Drink deeply. (+8 HP)', effects: { heal: 8 } },
      { label: 'Fill a flask carefully. (+4 HP, +1 max HP)', effects: { heal: 4, maxHp: 1 } },
      { label: 'Leave it for the next traveller.', effects: {} },
    ],
  },
  {
    id: 'ev-stranger',
    title: 'The Stranger',
    flavor: 'A figure in slightly-too-grey robes waits at a fork in the path. They produce a card from a satchel with the air of someone who has rehearsed this. Twice.',
    choices: [
      { label: 'Accept the card. (gain a random Uncommon card)', effects: { gainUncommonCard: 1 } },
      { label: 'Bargain. They look you up and down. (-5 HP, gain a random Rare card)', effects: { loseHp: 5, gainRareCard: 1 } },
      { label: 'Refuse politely. They expected this.', effects: {} },
    ],
  },
  {
    id: 'ev-shrine',
    title: 'Roadside Shrine',
    flavor: 'A weathered stone shrine to no god in particular. The donations bowl has been emptied recently. The donations bowl is, you suspect, emptied daily.',
    choices: [
      { label: 'Pray sincerely. (heal 5)', effects: { heal: 5 } },
      { label: 'Pray sarcastically. (+2 max HP, -3 HP)', effects: { maxHp: 2, loseHp: 3 } },
      { label: 'Walk on without looking. (Surely fine.)', effects: {} },
    ],
  },
  {
    id: 'ev-snake',
    title: 'Coiled Adder',
    flavor: 'A small green snake watches you pass. Its eyes are bright, deliberate, and noticeably more focused than yours have been all morning.',
    choices: [
      { label: 'Pick it up. (-4 HP, gain a Rare card)', effects: { loseHp: 4, gainRareCard: 1 } },
      { label: 'Offer it a crumb. (+3 HP)', effects: { heal: 3 } },
      { label: 'Step around it, politely.', effects: {} },
    ],
  },
  {
    id: 'ev-mirror',
    title: 'A Shard of Mirror',
    flavor: 'A piece of broken mirror, propped against a stump. The version of you in the glass is harder around the eyes. They are not exactly your eyes. You are pretty sure.',
    choices: [
      { label: 'Study it carefully. (gain an Uncommon card)', effects: { gainUncommonCard: 1 } },
      { label: 'Break it further. (+5 max HP, -2 HP)', effects: { maxHp: 5, loseHp: 2 } },
      { label: 'Leave the shard. Leave quickly.', effects: {} },
    ],
  },
  {
    id: 'ev-pilgrim',
    title: 'Pilgrim on the Path',
    flavor: 'An old pilgrim sets out half a meal between you. "Eat," they say, "the path is longer than you think. Everybody\'s path is longer than they think. That\'s the trick of paths."',
    choices: [
      { label: 'Eat with gratitude. (+10 HP)', effects: { heal: 10 } },
      { label: 'Trade words instead. (gain a Common card)', effects: { gainCommonCard: 1 } },
      { label: 'Decline politely and continue.', effects: {} },
    ],
  },
  {
    id: 'ev-vow',
    title: 'A Vow Offered',
    flavor: 'A stone altar, carved with a single grand line: STRENGTH FOR STILLNESS. Beneath it, in much smaller letters: TERMS APPLY. CONSULT THE STELE.',
    choices: [
      { label: 'Take the vow. (-6 HP, +1 max HP, gain a Rare card)', effects: { loseHp: 6, maxHp: 1, gainRareCard: 1 } },
      { label: 'Read the small print, decline. (gain an Uncommon card)', effects: { gainUncommonCard: 1 } },
      { label: 'Walk away. The altar is unmoved.', effects: {} },
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
  // Supply shop draft state. Cleared after exit.
  const [supplyChoices, setSupplyChoices] = useState([]); // 5 candidate cards
  const [supplyPicks, setSupplyPicks] = useState([]);     // indices already picked (max 2)
  // Player debuffs (mirror of enemy ones). Tick down at end of turn.
  const [playerVulnerable, setPlayerVulnerable] = useState(0);
  const [playerWeak, setPlayerWeak] = useState(0);
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
  const [enemyVulnerable, setEnemyVulnerable] = useState(0);
  const [enemyWeak, setEnemyWeak] = useState(0);

  // Spell tray — accumulates as the player plays word cards this turn.
  // `phrases` is the running list of fragment text; `effectFiredThisTurn`
  // tracks whether ANY effect card has resolved the tray (used to detect
  // fizzles at end-of-turn).
  const [tray, setTray] = useState({ chutzpah: 0, wit: 0, jnsq: 0, phrases: [], tags: [], words: [], effectCard: null, effectFiredThisTurn: false });

  // Tutorial — when active, a scripted Bursar fight teaches the verbal
  // combat system step-by-step. Step advances on specific player actions
  // (see advanceTutorialStep). `tutorialActive` short-circuits onEnemyDefeated
  // and applyDamageToPlayer's KO path so the player can learn safely.
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Reward / event / forge / rest state
  const [rewardChoices, setRewardChoices] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [forgeChoice, setForgeChoice] = useState(null);
  const [restNode, setRestNode] = useState(null);
  // When set, shows the "you received this card" modal. Used after
  // events / shops that hand the player cards silently. Shape:
  // { cards: [...card objects...], title?, body? } — null means no modal.
  const [cardGrantPrompt, setCardGrantPrompt] = useState(null);
  // Card-upgrade picker at rest sites. When set, shows the deck and lets
  // the player pick one non-upgraded card to upgrade.
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Log
  const [log, setLog] = useState([]);
  const pushLog = (s) => setLog(prev => [...prev.slice(-20), s]);

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
  function startTutorial() {
    setMaxHp(STARTING_MAX_HP);
    setHp(STARTING_MAX_HP);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    setExiled([]);
    setEquipment([]);
    setPowers([]);
    setRelics([]);
    setFamiliar(null);
    setFamiliarName('');
    setPlayerVulnerable(0);
    setPlayerWeak(0);
    setEffectCount(0);
    setTray({ chutzpah: 0, wit: 0, jnsq: 0, phrases: [], tags: [], words: [], effectCard: null, effectFiredThisTurn: false });
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
    setPowers([]);
    setRelics([]);
    setFamiliar(null);
    setFamiliarName('');
    setPlayerVulnerable(0);
    setPlayerWeak(0);
    setEffectCount(0);
    setTray({ chutzpah: 0, wit: 0, jnsq: 0, phrases: [], tags: [], words: [], effectCard: null, effectFiredThisTurn: false });
    setClearedNodes([]);
    setLog([]);
    setCurrentActIdx(0);
    setMap(null);
    setCurrentNodeId(null);
    // Roll 5 candidate cards for the supply shop (common-weighted, no dupes).
    const supply = [];
    const used = [];
    while (supply.length < 5) {
      const c = pickCardByRarity({ common: 4, uncommon: 1 }, used);
      if (!c) break;
      supply.push(c); used.push(c.id);
    }
    setSupplyChoices(supply);
    setSupplyPicks([]);
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
    setSupplyPicks(prev => {
      const next = [...prev, idx];
      // Auto-advance once two picks are made.
      if (next.length >= 2) {
        setTimeout(() => {
          setSupplyChoices([]);
          setSupplyPicks([]);
          setStage('familiar-shop');
        }, 300);
      }
      return next;
    });
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
    setStage('familiar-name');
  }

  function confirmFamiliarName(name) {
    const trimmed = (name || '').trim();
    const final = trimmed || familiar?.species || 'Familiar';
    setFamiliarName(final);
    pushLog(`🐾 You name your ${familiar?.species || 'familiar'} ${final}.`);
    // Now spin up the Act 1 map and begin.
    setMap(generateActMap(ACTS[0].rows, ACTS[0].width));
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
  // `opts.forcedHand` / `opts.forcedDeck` — arrays of card IDs. When
  // passed, the opening hand and deck are seeded deterministically
  // (skipping the shuffle). Used by the tutorial; everyone else relies
  // on the normal pile-shuffle draw.
  function enterFight(enemyId, opts = {}) {
    const tmpl = ENEMIES_BY_ID[enemyId];
    if (!tmpl) return;
    const e = { ...tmpl };
    setEnemy(e);
    setEnemyComposure(e.composureMax);
    setEnemyHp(e.hpMax);
    setEnemyBlock(0);
    setEnemyVulnerable(0);
    setEnemyWeak(0);
    setEnemyIntent(rollIntent(e));
    // Powers don't persist between combats.
    setPowers([]);
    // Reset per-combat counters and player debuffs.
    setPlayerVulnerable(0);
    setPlayerWeak(0);
    setTray({ chutzpah: 0, wit: 0, jnsq: 0, phrases: [], tags: [], words: [], effectCard: null, effectFiredThisTurn: false });

    // Apply start-of-combat effects from equipment AND relics.
    let startBlockTotal = 0;
    let startEnergyBonus = 0;
    let startHandBonus = 0;
    let healOnStart = 0;
    let startDrawBonus = 0;
    for (const eq of equipment) {
      if (eq.bonus?.startBlock)          startBlockTotal      += eq.bonus.startBlock;
      if (eq.bonus?.energyOnCombatStart) startEnergyBonus     += eq.bonus.energyOnCombatStart;
      if (eq.bonus?.extraStartHand)      startHandBonus       += eq.bonus.extraStartHand;
      if (eq.bonus?.healOnCombatStart)   healOnStart          += eq.bonus.healOnCombatStart;
    }
    let startCombatVulnTotal = 0;
    for (const { effect } of effectSources()) {
      const oc = effect?.onCombatStart;
      if (oc) {
        if (oc.block)  startBlockTotal += oc.block;
        if (oc.draw)   startDrawBonus  += oc.draw;
        if (oc.energy) startEnergyBonus += oc.energy;
        if (oc.hp)     healOnStart     += oc.hp;
      }
      if (effect?.startCombatVulnerable) startCombatVulnTotal += effect.startCombatVulnerable;
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
      setEnemyVulnerable(startCombatVulnTotal);
      pushLog(`🌀 ${e.name} starts Vulnerable +${startCombatVulnTotal}.`);
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

  function playCard(handIdx) {
    if (stage !== 'combat') return;
    const card = hand[handIdx];
    if (!card) return;
    if (card.cost > energy) { pushLog(`Not enough energy for ${card.name}.`); return; }
    setEnergy(e => e - card.cost);
    const logBits = [card.name];

    // Powers don't apply effects directly — they install themselves on the
    // player's `powers` array and trigger via the turn-hooks instead.
    if (card.type === 'power') {
      setPowers(ps => [...ps, card]);
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(`📿 ${card.name} — power active.`);
      return;
    }

    // WORD CARD — stage in the spell tray. Stats / phrase / tags add to
    // the tray totals. Energy spent at staging; refundable via unstageCard.
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
      // On-play side-effects (Dramatic Pause's draw etc.) STILL fire on
      // stage — those are immediate, not part of the spell payload.
      applySideEffects(card.effects || {}, logBits);
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(logBits.join(' · ') + `  →  📜 staged`);
      advanceTutorialStep('played-word');
      return;
    }

    // EFFECT CARD — stage as the spell's sealer. Only one effect at a
    // time; staging a new one returns the previous to hand (with energy
    // refunded, of course).
    if (card.type === 'effect') {
      const prevEffect = tray.effectCard;
      setTray(prev => ({ ...prev, effectCard: card }));
      if (prevEffect) {
        // Return the previously-staged effect to hand + refund its cost.
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
    // Try word first.
    const wordIdx = tray.words.findIndex(w => w.uid === cardUid);
    if (wordIdx >= 0) {
      const w = tray.words[wordIdx];
      const stats = w.stats || {};
      const tags = w.tags || [];
      setTray(prev => {
        const newWords = prev.words.filter((_, i) => i !== wordIdx);
        // Recompute everything from the remaining words to be safe.
        const c = { chutzpah: 0, wit: 0, jnsq: 0 };
        const phrases = [];
        const allTags = [];
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
      setTray(prev => ({ ...prev, effectCard: null }));
      setHand(h => [...h, e]);
      setEnergy(en => en + (e.cost || 0));
      pushLog(`↩ Unstaged ${e.name}.`);
    }
  }

  // CAST — resolve the staged spell. Requires at least one word AND a
  // staged effect. Computes the full damage (including resonance, Strike
  // bonus, every-nth-effect, weak/vuln, effectiveness), applies damage
  // and any riders, and clears the tray.
  function castStagedSpell() {
    if (stage !== 'combat') return;
    if (!tray.effectCard) { pushLog('No Effect staged — nothing to cast.'); return; }
    if (tray.words.length === 0) { pushLog('No Word staged — Effect cards need at least one word.'); return; }

    const card = tray.effectCard;
    const eff = card.effect || {};
    let base = eff.base || 0;
    if (card.name === 'Strike' || card.name === 'Strike+') base += strikeBonusTotal();
    base += consumeEveryNthEffectBonus();
    const stat = eff.scaleBy || 'wit';
    const trayVal = tray[stat] || 0;
    const rawSpell = base + trayVal * (eff.multiplier || 0);
    const dmgType = eff.damageType || 'composure';
    const eff_mult = enemy?.effectiveness?.[stat] ?? 1.0;
    const phys_mult = enemy?.effectiveness?.physical ?? 1.0;
    let dmg = rawSpell;
    if (dmgType === 'physical') dmg = Math.round(dmg * phys_mult);
    else                        dmg = Math.round(dmg * eff_mult);
    const rWith = eff.resonatesWith || [];
    const perTag = eff.resonanceBonus?.perTag || 0;
    const matchedTags = (tray.tags || []).filter(t => rWith.includes(t));
    const resonanceBonus = matchedTags.length * perTag;
    if (resonanceBonus > 0) dmg += resonanceBonus;
    if (playerWeak > 0) dmg = Math.floor(dmg * 0.75);
    if (enemyVulnerable > 0) dmg = Math.ceil(dmg * 1.5);

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
    if (rider.weak)       { setEnemyWeak(w => w + rider.weak);       pushLog(`🌀 +${rider.weak} Weak`); }
    if (rider.vulnerable) { setEnemyVulnerable(v => v + rider.vulnerable); pushLog(`🌀 +${rider.vulnerable} Vuln`); }
    if (rider.block)      { setBlock(b => b + rider.block);          pushLog(`🛡 +${rider.block}`); }
    if (rider.draw)       { drawCards(rider.draw);                   pushLog(`+${rider.draw} draw`); }

    // Send all staged cards to discard / exile based on flags.
    const wordsToDiscard = tray.words.filter(w => !w.effects?.exhaust);
    const wordsToExile   = tray.words.filter(w =>  w.effects?.exhaust);
    if (eff.exhaust) setExiled(ex => [...ex, ...wordsToExile, card]);
    else             { setDiscard(d => [...d, ...wordsToDiscard, card]); if (wordsToExile.length) setExiled(ex => [...ex, ...wordsToExile]); }
    if (!eff.exhaust && wordsToDiscard.length === tray.words.length) {
      // already handled in the else branch above
    }

    setTray({ chutzpah: 0, wit: 0, jnsq: 0, phrases: [], tags: [], words: [], effectCard: null, effectFiredThisTurn: true });
    applyPowerTriggers('onEffectCardPlayed');
    advanceTutorialStep('cast-spell');
  }

  // Compute the predicted damage if you CAST right now. Used by the
  // tray UI's preview. Pure read of current state — no mutations.
  function previewCastDamage() {
    if (!tray.effectCard) return null;
    const card = tray.effectCard;
    const eff = card.effect || {};
    let base = eff.base || 0;
    if (card.name === 'Strike' || card.name === 'Strike+') base += strikeBonusTotal();
    // Peek the everyNth bonus (don't consume).
    for (const { effect } of effectSources()) {
      const every = effect?.everyNthEffect;
      if (!every) continue;
      if ((effectCount + 1) % every.n === 0) base += every.extraDamage || 0;
    }
    const stat = eff.scaleBy || 'wit';
    const trayVal = tray[stat] || 0;
    const rawSpell = base + trayVal * (eff.multiplier || 0);
    const dmgType = eff.damageType || 'composure';
    const eff_mult = enemy?.effectiveness?.[stat] ?? 1.0;
    const phys_mult = enemy?.effectiveness?.physical ?? 1.0;
    let dmg = rawSpell;
    if (dmgType === 'physical') dmg = Math.round(dmg * phys_mult);
    else                        dmg = Math.round(dmg * eff_mult);
    const rWith = eff.resonatesWith || [];
    const perTag = eff.resonanceBonus?.perTag || 0;
    const matchedTags = (tray.tags || []).filter(t => rWith.includes(t));
    const resonanceBonus = matchedTags.length * perTag;
    if (resonanceBonus > 0) dmg += resonanceBonus;
    if (playerWeak > 0) dmg = Math.floor(dmg * 0.75);
    if (enemyVulnerable > 0) dmg = Math.ceil(dmg * 1.5);
    return { dmg, dmgType, resonanceBonus, matchedTags, eff_mult, phys_mult, base, trayVal, multiplier: eff.multiplier || 0, stat };
  }

  // Side-effects shared between skill cards and word cards' on-play block.
  // Mutates the logBits array in place.
  function applySideEffects(fx, logBits) {
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
    if (fx.hp) {
      setHp(h => clamp(h + fx.hp, 0, maxHp));
      logBits.push(`+${fx.hp} HP`);
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
      if (playerWeak > 0) dmg = Math.floor(dmg * 0.75);
      if (enemyVulnerable > 0) dmg = Math.ceil(dmg * 1.5);
      const after = applyDamageToEnemyComposure(dmg);
      bits.push(`✨ ${dmg} comp → ${after}`);
    }
    if (effects.block) {
      setBlock(b => b + effects.block);
      bits.push(`🛡 +${effects.block}`);
    }
    if (effects.vulnerable) {
      setEnemyVulnerable(v => v + effects.vulnerable);
      bits.push(`🌀 +${effects.vulnerable} Vuln`);
    }
    if (effects.weak) {
      setEnemyWeak(w => w + effects.weak);
      bits.push(`🌀 +${effects.weak} Weak`);
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
    let wEnemyVuln = enemyVulnerable;
    let wEnemyWeak = enemyWeak;
    let wPlayerBlock = block;
    for (const p of powers) {
      const trig = p.power?.endOfTurn;
      if (!trig) continue;
      const bits = [`📿 ${p.name}`];
      if (trig.composure) {
        const eff_mult = enemy?.effectiveness?.wit ?? 1.0;
        let dmg = Math.round(trig.composure * eff_mult);
        if (playerWeak > 0) dmg = Math.floor(dmg * 0.75);
        if (wEnemyVuln > 0) dmg = Math.ceil(dmg * 1.5);
        const absorbed = Math.min(wEnemyBlock, dmg);
        wEnemyBlock -= absorbed; dmg -= absorbed;
        wComposure = Math.max(0, wComposure - dmg);
        bits.push(`✨ → ${wComposure} comp`);
      }
      if (trig.block) { wPlayerBlock += trig.block; bits.push(`🛡 +${trig.block}`); }
      if (trig.vulnerable) { wEnemyVuln += trig.vulnerable; bits.push(`🌀 +${trig.vulnerable} Vuln`); }
      if (trig.weak)       { wEnemyWeak += trig.weak;       bits.push(`🌀 +${trig.weak} Weak`); }
      pushLog(bits.join(' · '));
      if (wComposure <= 0 || wHp <= 0) break;
    }
    setBlock(wPlayerBlock);
    setEnemyBlock(wEnemyBlock);
    setEnemyComposure(wComposure);
    setEnemyHp(wHp);
    setEnemyVulnerable(wEnemyVuln);
    setEnemyWeak(wEnemyWeak);
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

    // 0. Fizzle check — if any cards were staged but no CAST happened,
    //    the spell does not arrive. Staged cards go to discard (you
    //    spent the energy; you don't get the cards back).
    if ((tray.words.length > 0 || tray.effectCard) && !tray.effectFiredThisTurn) {
      pushLog(`💨 "${tray.phrases.join(' ')}" …trails off. The spell does not arrive.`);
      const dropped = [...tray.words];
      if (tray.effectCard) dropped.push(tray.effectCard);
      setDiscard(d => [...d, ...dropped]);
    }
    setTray({ chutzpah: 0, wit: 0, jnsq: 0, phrases: [], tags: [], words: [], effectCard: null, effectFiredThisTurn: false });

    // 1. End-of-turn power triggers.
    const killedByPowers = applyEndOfTurnPowerTriggers();
    if (killedByPowers) return;

    // 2. Enemy intent.
    if (enemyIntent) applyEnemyIntent(enemyIntent);
    if (hp <= 0) return;

    // 3. Debuff decay.
    setEnemyVulnerable(v => Math.max(0, v - 1));
    setEnemyWeak(w => Math.max(0, w - 1));
    setPlayerVulnerable(v => Math.max(0, v - 1));
    setPlayerWeak(w => Math.max(0, w - 1));

    // 4-5. Compose the new turn's piles + start-of-turn triggers
    //      synchronously, then commit all related state in one pass.
    const stagedDiscard = [...discard, ...hand];
    const drawn = drawFromPiles(deck, stagedDiscard, HAND_SIZE);
    let wDeck     = drawn.deck;
    let wDiscard  = drawn.discard;
    const wHand   = [...drawn.hand];
    let wEnergy   = energyPerTurnRefill();
    let wBlock    = 0;
    let wEnemyVuln = enemyVulnerable;  // not the decayed value, but the
    let wEnemyWeak = enemyWeak;        // power triggers haven't fired yet;
                                       // decay will happen via the setters
                                       // above; powers add ON TOP after decay
    // Familiar-style startOfTurnBlock (e.g. Hedgehog): fires every turn,
    // including turn 1 (handled separately in enterFight's startBlockTotal).
    for (const { effect } of effectSources()) {
      if (effect?.startOfTurnBlock) wBlock += effect.startOfTurnBlock;
    }
    // Apply start-of-turn power triggers in working locals.
    for (const p of powers) {
      const trig = p.power?.startOfTurn;
      if (!trig) continue;
      const bits = [`📿 ${p.name}`];
      if (trig.block)      { wBlock += trig.block;   bits.push(`🛡 +${trig.block}`); }
      if (trig.energy)     { wEnergy += trig.energy; bits.push(`+${trig.energy} Energy`); }
      if (trig.vulnerable) { wEnemyVuln += trig.vulnerable; bits.push(`🌀 +${trig.vulnerable} Vuln`); }
      if (trig.weak)       { wEnemyWeak += trig.weak; bits.push(`🌀 +${trig.weak} Weak`); }
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
    // Power triggers' Vuln/Weak adds — the decay setters above used the
    // CURRENT enemyVulnerable closure, so they decay correctly; the power
    // additions are stacked on top via these direct setters (read inside
    // the next render). Net: decayed-current + power-additions.
    if (wEnemyVuln !== enemyVulnerable) {
      const stackedFromPowers = wEnemyVuln - enemyVulnerable;
      setEnemyVulnerable(v => Math.max(0, v - 1) + stackedFromPowers);
    }
    if (wEnemyWeak !== enemyWeak) {
      const stackedFromPowers = wEnemyWeak - enemyWeak;
      setEnemyWeak(w => Math.max(0, w - 1) + stackedFromPowers);
    }

    // 6. New intent.
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
      pushLog(`👹 ${e.name}: ${intent.telegraph}`);
    } else if (intent.kind === 'block') {
      setEnemyBlock(b => b + intent.value);
      pushLog(`👹 ${e.name}: 🛡 +${intent.value}`);
    } else if (intent.kind === 'vulnerable') {
      setPlayerVulnerable(v => v + intent.value);
      pushLog(`👹 ${e.name}: 🌀 You're Vulnerable +${intent.value}.`);
    } else if (intent.kind === 'weak') {
      setPlayerWeak(w => w + intent.value);
      pushLog(`👹 ${e.name}: 🌀 You're Weak +${intent.value}.`);
    }
  }

  function applyDamageToPlayer(damage) {
    let remaining = damage;
    if (playerVulnerable > 0) remaining = Math.ceil(remaining * 1.5);
    // Flat damageReduction from effect sources (Beetle familiar etc.).
    // Floored so a hit always deals at least 1 — Beetle is meant to chip,
    // not no-sell encounters.
    const reduction = effectSources().reduce((s, x) => s + (x.effect?.damageReduction || 0), 0);
    if (reduction > 0 && remaining > 0) remaining = Math.max(1, remaining - reduction);
    let newBlock = block;
    let newHp = hp;
    if (newBlock > 0) {
      const absorbed = Math.min(newBlock, remaining);
      newBlock -= absorbed; remaining -= absorbed;
    }
    newHp = Math.max(0, newHp - remaining);
    setBlock(newBlock); setHp(newHp);
    if (newHp <= 0) {
      // In the tutorial we never let the player die — the Bursar isn't
      // out for blood. Restore HP and continue.
      if (tutorialActive) { setHp(maxHp); return; }
      setTimeout(() => setStage('defeat'), 200);
    }
  }

  function onEnemyDefeated() {
    if (!enemy) return;
    // Tutorial short-circuit: skip rewards, route to the wrap-up screen.
    if (tutorialActive) {
      pushLog(`✓ The Bursar concedes the match. "Well argued."`);
      setTutorialActive(false);
      setStage('tutorial-complete');
      return;
    }
    pushLog(`✓ ${enemy.name} defeated.`);
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
      // Boss kill → grant Master tier for this act's slot.
      const slot = currentAct.slot;
      const master = EQUIPMENT[slot]?.master;
      if (master && !equipment.find(eq => eq.id === master.id)) {
        const next = [...equipment, master];
        setEquipment(next);
        applyEquipmentMaxHp(master);
        pushLog(`👑 Master ${SLOT_LABEL[slot]} claimed: ${master.name}.`);
      }
      // Plus a random Rare relic from the boss chest. Skip duplicates.
      const rareRelic = pickRelicByRarity({ rare: 1 }, relics.map(r => r.id));
      if (rareRelic) {
        setRelics(prev => [...prev, rareRelic]);
        pushLog(`📿 Boss relic claimed: ${rareRelic.name}.`);
      }
      setDeck(d => [...d, ...hand, ...discard, ...exiled]);
      setHand([]); setDiscard([]); setExiled([]);
      setStage('act-cleared');
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
    const grantedCards = [];
    if (fx.gainCommonCard) {
      const c = pickCardByRarity({ common: 1 });
      if (c) { setDeck(d => [...d, { ...c, uid: uid() }]); logBits.push(`+ ${c.name}`); grantedCards.push(c); }
    }
    if (fx.gainUncommonCard) {
      const c = pickCardByRarity({ uncommon: 1 });
      if (c) { setDeck(d => [...d, { ...c, uid: uid() }]); logBits.push(`+ ${c.name}`); grantedCards.push(c); }
    }
    if (fx.gainRareCard) {
      const c = pickCardByRarity({ rare: 1 });
      if (c) { setDeck(d => [...d, { ...c, uid: uid() }]); logBits.push(`+ ${c.name}`); grantedCards.push(c); }
    }
    pushLog(logBits.join(' · '));
    const eventTitle = activeEvent?.title;
    setActiveEvent(null);
    // If the event granted cards, queue them up in the modal and defer
    // returning to the map until the player acknowledges them.
    if (grantedCards.length > 0) {
      setCardGrantPrompt({
        cards: grantedCards,
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

  function resolveRestChoice(kind) {
    if (kind === 'heal') {
      const amount = Math.floor(maxHp * 0.3);
      setHp(h => clamp(h + amount, 0, maxHp));
      pushLog(`🛏 Rest: +${amount} HP.`);
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
      setUpgradeOpen(false);
      setStage('rest');
      return;
    }
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
  if (stage === 'menu')               return <MenuScreen onStart={startRun} onTutorial={startTutorial} />;
  if (stage === 'tutorial-complete')  return <TutorialCompleteScreen onStart={startRun} onMenu={() => setStage('menu')} />;
  if (stage === 'defeat')             return <EndScreen win={false} onRetry={startRun} />;
  if (stage === 'graduation')         return <GraduationScreen equipment={equipment} familiar={familiar} familiarName={familiarName} onRetry={startRun} />;
  // Card-grant modal sits on top of whatever stage triggered it — render
  // the modal as an overlay below.

  if (stage === 'supply-shop')   return <SupplyShopScreen choices={supplyChoices} picks={supplyPicks} onPick={pickSupplyCard} />;
  if (stage === 'familiar-shop') return <FamiliarShopScreen onPick={pickFamiliar} />;
  if (stage === 'familiar-name') return <FamiliarNameScreen familiar={familiar} onConfirm={confirmFamiliarName} />;

  if (stage === 'act-cleared') {
    return <ActClearedScreen act={currentAct} equipment={equipment}
      isFinalAct={currentActIdx === ACTS.length - 1}
      onContinue={() => {
        if (currentActIdx === ACTS.length - 1) setStage('graduation');
        else advanceToNextAct();
      }} />;
  }
  if (stage === 'reward') return <RewardScreen choices={rewardChoices} onPick={pickReward} />;
  if (stage === 'card-grant') return <CardGrantScreen prompt={cardGrantPrompt} onDismiss={dismissCardGrant} />;
  if (stage === 'event')  return <EventScreen event={activeEvent} onChoose={resolveEventChoice} />;
  if (stage === 'rest')   return <RestScreen onChoose={resolveRestChoice} />;
  if (stage === 'upgrade') return <UpgradeCardScreen deck={deck} onPick={pickCardToUpgrade} />;
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
      player={{ hp, maxHp, equipment, relics, deckSize: deck.length, familiar, familiarName }}
      onPick={pickNode} log={log} />;
  }

  // Combat
  return <>
    <CombatScreen
      enemy={enemy} enemyComposure={enemyComposure} enemyHp={enemyHp}
      enemyBlock={enemyBlock} enemyIntent={enemyIntent}
      enemyVulnerable={enemyVulnerable} enemyWeak={enemyWeak}
      hp={hp} maxHp={maxHp} block={block} energy={energy} hand={hand}
      deck={deck} discard={discard} tray={tray}
      energyMax={energyPerTurnRefill()}
      equipment={equipment} powers={powers} relics={relics}
      familiar={familiar} familiarName={familiarName}
      playerVulnerable={playerVulnerable} playerWeak={playerWeak}
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

function MenuScreen({ onStart, onTutorial }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="font-display text-6xl text-gold-300 tracking-widest text-center">Wizard Graduation</h1>
      <p className="font-quill text-parchment-200 italic max-w-xl text-center">
        The school has taught you what it can. To graduate, you must walk the
        Path of Mastery — gather your staff, robes, gem, and ring, each from
        a trial worthier than the last.
      </p>
      <div className="flex flex-col gap-2 items-center">
        <button onClick={onStart}    className="btn btn-gold text-lg px-8 py-3">Begin the Path</button>
        <button onClick={onTutorial} className="btn btn-ink  text-sm px-6 py-2">First time? Practice with the Bursar →</button>
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

// ---- TOWN INTRO ----

function SupplyShopScreen({ choices, picks, onPick }) {
  const remaining = 2 - picks.length;
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-5 max-w-5xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300">The Supply Shop</h2>
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
                <div className="font-display text-base leading-tight">{card.name}</div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">
                  {card.cost}
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider opacity-70">{card.type} · {card.rarity}</div>
              <div className="text-xs font-quill">{card.desc}</div>
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
        <div className="text-xs flex gap-4 items-center">
          {player.familiar && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-ink-600 border border-ink-400">
              <span className="text-base leading-none">{player.familiar.emoji}</span>
              <span className="text-gold-300">{player.familiarName || player.familiar.species}</span>
            </span>
          )}
          <span>❤️ {player.hp} / {player.maxHp}</span>
          <span>📜 {player.deckSize} cards</span>
          <span>⚜ {player.equipment.length} equipment</span>
        </div>
      </div>

      <div className="parchment-card p-4 flex flex-col items-center">
        {(() => {
          // Fog-of-war visibility per node:
          //   cleared : in clearedNodes — path you've already walked
          //   current : your current spot
          //   next    : directly reachable from current — choose-from set
          //   peek    : reachable from a 'next' node (2 steps away) — shape
          //             visible as "?" silhouette, type masked
          //   hidden  : further out — tiny faint dot only, no type or edge
          // Player picks among 'next'. As they advance the window slides.
          const reachableSet = new Set(reachable);
          const clearedSet = new Set(clearedNodes);
          const peekSet = new Set();
          for (const nextId of reachable) {
            for (const beyondId of (map.edges[nextId] || [])) {
              if (!reachableSet.has(beyondId) && !clearedSet.has(beyondId) && beyondId !== currentNodeId) {
                peekSet.add(beyondId);
              }
            }
          }
          const visibilityOf = (nodeId) => {
            if (clearedSet.has(nodeId))   return 'cleared';
            if (nodeId === currentNodeId) return 'current';
            if (reachableSet.has(nodeId)) return 'next';
            if (peekSet.has(nodeId))      return 'peek';
            return 'hidden';
          };
          return (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl">
              {Object.entries(map.edges).map(([fromId, tos]) => {
                const from = map.nodes.find(n => n.id === fromId);
                return tos.map(toId => {
                  const to = map.nodes.find(n => n.id === toId);
                  if (!from || !to) return null;
                  const fromVis = visibilityOf(fromId);
                  const toVis   = visibilityOf(toId);
                  // Edges between two hidden nodes — render barely-there or
                  // skip. Between a visible node and a hidden one — faint.
                  const bothHidden = fromVis === 'hidden' && toVis === 'hidden';
                  if (bothHidden) return null;
                  const someHidden = fromVis === 'hidden' || toVis === 'hidden';
                  const cleared = fromVis === 'cleared' && toVis === 'cleared';
                  const onCurrentPath = currentNodeId === fromId;
                  let stroke, strokeWidth, opacity;
                  if (cleared)               { stroke = '#5d7e3f'; strokeWidth = 1.5; opacity = 0.55; }
                  else if (onCurrentPath)    { stroke = '#c79d44'; strokeWidth = 3;   opacity = 1;    }
                  else if (someHidden)       { stroke = '#2b2418'; strokeWidth = 1;   opacity = 0.2;  }
                  else                       { stroke = '#3d3325'; strokeWidth = 1.5; opacity = 0.7;  }
                  return (
                    <line key={`${fromId}->${toId}`}
                      x1={xScale(from.x)} y1={yScale(from.y)}
                      x2={xScale(to.x)} y2={yScale(to.y)}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      strokeDasharray={cleared ? '6,3' : '0'} />
                  );
                });
              })}
              {map.nodes.map(n => {
                const vis = visibilityOf(n.id);
                // Hidden node: tiny faint dot, no interaction.
                if (vis === 'hidden') {
                  return (
                    <circle key={n.id} cx={xScale(n.x)} cy={yScale(n.y)} r={2}
                      fill="#5a4d3a" opacity={0.4} />
                  );
                }
                // Peek node: medium "?" silhouette, no type info, no click.
                if (vis === 'peek') {
                  return (
                    <g key={n.id}>
                      <circle cx={xScale(n.x)} cy={yScale(n.y)} r={14}
                        fill="#241b10" stroke="#5a4d3a" strokeWidth={1.5}
                        opacity={0.78} />
                      <text x={xScale(n.x)} y={yScale(n.y) + 4} textAnchor="middle"
                        className="select-none" fill="#a8895a" fontSize={14}
                        opacity={0.85}>?</text>
                    </g>
                  );
                }
                // Cleared / current / next: full type-color circle.
                const isCurrent   = vis === 'current';
                const isCleared   = vis === 'cleared';
                const isReachable = vis === 'next';
                const fill   = nodeColor(n.type, isCleared, isCurrent);
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
          );
        })()}
        <div className="mt-3 text-xs text-parchment-300 flex gap-3 flex-wrap justify-center">
          <Legend glyph="⚔" label="Combat" />
          <Legend glyph="☠" label="Elite" />
          <Legend glyph="🛏" label="Rest" />
          <Legend glyph="📜" label="Event" />
          <Legend glyph="🛠" label="Forge" />
          <Legend glyph="👑" label="Boss" />
          <Legend glyph="·" label="Start" />
          <Legend glyph="?" label="Glimpsed" />
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

function CombatScreen({ enemy, enemyComposure, enemyHp, enemyBlock, enemyIntent, enemyVulnerable, enemyWeak,
                       hp, maxHp, block, energy, energyMax, hand, deck, discard, tray,
                       equipment, powers, relics, familiar, familiarName,
                       playerVulnerable, playerWeak,
                       onPlayCard, onEndTurn, onUnstage, onCast, castPreview, log }) {
  const composureMax = enemy?.composureMax ?? 999;
  const hpMax = enemy?.hpMax ?? 999;
  const showComposure = composureMax < 999;
  const showHp = hpMax < 999;
  const eff = enemy?.effectiveness || { chutzpah: 1, wit: 1, jnsq: 1, physical: 1 };
  const eff_label = (v) => v === 0 ? 'immune' : v >= 1.5 ? `×${v} susceptible` : v <= 0.5 ? `×${v} resistant` : `×${v}`;
  const eff_color = (v) => v === 0 ? 'bg-ink-500 text-parchment-300' : v >= 1.5 ? 'bg-moss-700 text-parchment-50' : v <= 0.5 ? 'bg-ember-800 text-parchment-100' : 'bg-ink-600 text-parchment-200';
  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-6xl mx-auto">
      <div className="parchment-card-strong p-4">
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
          <div className="px-3 py-2 bg-ember-900 bg-opacity-60 rounded border border-ember-700">
            <div className="text-xs uppercase text-ember-300 tracking-widest">Intent</div>
            <div className="text-lg text-parchment-50">{enemyIntent?.telegraph || '...'}</div>
          </div>
          {enemyVulnerable > 0 && <span className="px-2 py-1 bg-iris-700 text-parchment-50 rounded text-sm">🌀 Vuln {enemyVulnerable}</span>}
          {enemyWeak > 0 && <span className="px-2 py-1 bg-iris-700 text-parchment-50 rounded text-sm">🌀 Weak {enemyWeak}</span>}
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.chutzpah ?? 1)}`} title={`Chutzpah ${eff_label(eff.chutzpah ?? 1)}`}>💪 Chutz {eff_label(eff.chutzpah ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.wit ?? 1)}`} title={`Wit ${eff_label(eff.wit ?? 1)}`}>✨ Wit {eff_label(eff.wit ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.jnsq ?? 1)}`} title={`Jnsq ${eff_label(eff.jnsq ?? 1)}`}>🌀 Jnsq {eff_label(eff.jnsq ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.physical ?? 1)}`} title={`Physical ${eff_label(eff.physical ?? 1)}`}>⚔ Phys {eff_label(eff.physical ?? 1)}</span>
        </div>
      </div>

      {/* SPELL TRAY — staging area. Word + Effect cards get queued here.
          Click CAST to resolve. End the turn without casting and the
          spell fizzles (energy lost, cards discarded). */}
      <div className={`parchment-card p-3 border-l-4 ${
        (tray.words.length > 0 || tray.effectCard) ? 'border-l-iris-400' : 'border-l-ink-500'
      }`}>
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs uppercase tracking-widest text-iris-300 font-bold">📜 Spell Tray</div>
          <div className="flex gap-3 text-sm">
            <span className={tray.chutzpah > 0 ? 'text-ember-300 font-bold' : 'text-parchment-400'}>💪 {tray.chutzpah}</span>
            <span className={tray.wit > 0 ? 'text-iris-200 font-bold' : 'text-parchment-400'}>✨ {tray.wit}</span>
            <span className={tray.jnsq > 0 ? 'text-moss-300 font-bold' : 'text-parchment-400'}>🌀 {tray.jnsq}</span>
          </div>
        </div>

        {/* Phrase preview */}
        <div className="text-sm font-quill italic text-parchment-100 min-h-[1.5rem] mb-2">
          {tray.phrases.length === 0
            ? <span className="text-parchment-400">(empty — click a Word card to stage it)</span>
            : <span>"{tray.phrases.join(' ')} {tray.effectCard ? <span className="text-iris-200 not-italic">{tray.effectCard.phrase}</span> : <span className="text-parchment-400 not-italic">… (need an Effect to seal)</span>}"</span>
          }
        </div>

        {/* Theme chip row */}
        {tray.tags && tray.tags.length > 0 && (() => {
          const counts = {};
          for (const t of tray.tags) counts[t] = (counts[t] || 0) + 1;
          return (
            <div className="mb-2 flex gap-1 flex-wrap text-xs font-mono">
              <span className="text-iris-300">✦</span>
              {Object.entries(counts).map(([tag, n]) => (
                <span key={tag} className="px-2 py-0.5 rounded bg-iris-800 text-parchment-100">
                  {tag}{n > 1 ? ` ×${n}` : ''}
                </span>
              ))}
            </div>
          );
        })()}

        {/* Staged cards + CAST button row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-parchment-400 mr-1">Staged:</div>
          {tray.words.map((w) => (
            <button key={w.uid} onClick={() => onUnstage(w.uid)}
              title="Click to unstage (refunds energy)"
              className="px-2 py-1 rounded bg-iris-700 hover:bg-iris-600 border border-iris-400 text-parchment-50 text-xs flex items-center gap-1">
              <span>{w.name}</span> <span className="text-parchment-400 text-[10px]">×</span>
            </button>
          ))}
          {tray.effectCard ? (
            <button onClick={() => onUnstage(tray.effectCard.uid)}
              title="Click to unstage (refunds energy)"
              className="px-2 py-1 rounded bg-ember-700 hover:bg-ember-600 border border-ember-400 text-parchment-50 text-sm font-bold flex items-center gap-1">
              <span>🎯 {tray.effectCard.name}</span> <span className="text-parchment-300 text-[10px]">×</span>
            </button>
          ) : (
            <span className="px-2 py-1 rounded bg-ink-700 border border-dashed border-ink-400 text-parchment-400 text-xs italic">need an Effect card</span>
          )}
          <div className="flex-1" />
          {castPreview && tray.effectCard && tray.words.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] uppercase text-parchment-300">Predicted</div>
              <div className={`text-2xl font-bold font-mono ${castPreview.dmgType === 'physical' ? 'text-ember-300' : 'text-iris-200'}`}
                title={`${castPreview.base} base + ${castPreview.trayVal}×${castPreview.multiplier} from ${castPreview.stat} ${castPreview.resonanceBonus ? `+ ${castPreview.resonanceBonus} resonance` : ''} × ${castPreview.dmgType === 'physical' ? castPreview.phys_mult : castPreview.eff_mult} effectiveness`}>
                {castPreview.dmg} <span className="text-sm text-parchment-300">{castPreview.dmgType === 'physical' ? 'phys' : 'comp'}</span>
              </div>
            </div>
          )}
          <button onClick={onCast}
            disabled={!tray.effectCard || tray.words.length === 0}
            className={`btn text-base px-6 py-2 ml-2 ${
              tray.effectCard && tray.words.length > 0
                ? 'btn-iris animate-pulse'
                : 'bg-ink-600 text-parchment-400 cursor-not-allowed'
            }`}>
            ✨ CAST
          </button>
        </div>
      </div>

      <div className="parchment-card p-3 flex justify-between items-center">
        <div className="flex gap-4 items-center flex-wrap">
          <div>
            <div className="text-xs uppercase text-parchment-300">HP</div>
            <div className="text-2xl font-mono text-moss-300">{hp} <span className="text-sm text-parchment-300">/ {maxHp}</span></div>
          </div>
          <div>
            <div className="text-xs uppercase text-parchment-300">Block</div>
            <div className="text-2xl font-mono text-iris-300">🛡 {block}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-parchment-300">Energy</div>
            <div className="text-2xl font-mono text-gold-300">⚡ {energy} / {energyMax}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-parchment-300">Deck</div>
            <div className="text-base font-mono text-parchment-200">{deck.length} ▸ {discard.length}</div>
          </div>
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
          {playerVulnerable > 0 && (
            <span className="px-2 py-1 bg-ember-700 text-parchment-50 rounded text-sm" title="You take +50% damage from incoming attacks.">🌀 Vuln {playerVulnerable}</span>
          )}
          {playerWeak > 0 && (
            <span className="px-2 py-1 bg-ember-700 text-parchment-50 rounded text-sm" title="Your attacks deal -25% damage.">🌀 Weak {playerWeak}</span>
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

      <div className="flex gap-3 flex-wrap min-h-[200px] items-center justify-center">
        {hand.map((card, i) => {
          const playable = card.cost <= energy;
          // Card frame tint by type — word = iris, effect = ember,
          // skill = moss, power = gold.
          const tint = card.type === 'word'   ? 'border-iris-500'
                     : card.type === 'effect' ? 'border-ember-500'
                     : card.type === 'power'  ? 'border-gold-500'
                     :                          'border-moss-500';
          return (
            <motion.button key={card.uid}
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={() => onPlayCard(i)} disabled={!playable}
              className={`w-48 h-64 rounded-lg border-2 p-3 text-left flex flex-col gap-1.5 shadow-lg transition-all ${
                playable
                  ? `bg-parchment-50 text-ink-800 ${tint} hover:scale-105 hover:shadow-2xl cursor-pointer`
                  : 'bg-ink-600 text-parchment-400 border-ink-500 opacity-50 cursor-not-allowed'
              }`}>
              <div className="flex justify-between items-start gap-1">
                <div className="font-display text-base leading-tight">{card.name}</div>
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold ${playable ? 'bg-gold-500 text-ink-800' : 'bg-ink-500 text-parchment-300'}`}>
                  {card.cost}
                </div>
              </div>
              <div className="text-xs uppercase tracking-wider text-ink-400">
                {card.type}
                {card.type === 'effect' && card.effect?.damageType === 'physical' && <span className="ml-1 text-ember-700">phys</span>}
              </div>
              {/* Word stat row + tag row */}
              {card.type === 'word' && card.stats && (
                <>
                  <div className="flex gap-1 flex-wrap text-xs font-mono">
                    {card.stats.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
                    {card.stats.wit      ? <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">✨ {card.stats.wit}</span> : null}
                    {card.stats.jnsq     ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
                  </div>
                  {card.tags && card.tags.length > 0 && (
                    <div className="text-xs text-ink-500 italic" title="Themes this fragment contributes. Effects that resonate with a theme deal extra damage.">
                      ✦ {card.tags.join(' · ')}
                    </div>
                  )}
                </>
              )}
              {/* Effect formula + resonance row */}
              {card.type === 'effect' && card.effect && (
                <>
                  <div className="text-xs font-mono text-ink-700">
                    {card.effect.base} + {card.effect.scaleBy?.toUpperCase()}×{card.effect.multiplier}
                    <span className={card.effect.damageType === 'physical' ? 'text-ember-700' : 'text-iris-700'}>
                      {' '}{card.effect.damageType === 'physical' ? 'phys' : 'comp'}
                    </span>
                  </div>
                  {card.effect.resonatesWith && card.effect.resonatesWith.length > 0 && (
                    <div className="text-xs text-iris-700 italic" title={`+${card.effect.resonanceBonus?.perTag || 0} damage per matching theme in your spell tray.`}>
                      ✦ resonates: {card.effect.resonatesWith.join(', ')} <span className="text-ink-500">(+{card.effect.resonanceBonus?.perTag || 0})</span>
                    </div>
                  )}
                </>
              )}
              <div className="text-sm flex-1 font-quill leading-snug">{card.desc}</div>
              {card.flavor && <div className="text-xs italic text-ink-500 leading-tight">"{card.flavor}"</div>}
              {(card.effects?.exhaust || card.effect?.exhaust) && <div className="text-xs italic text-ember-700">Exhaust</div>}
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
              <div className="font-display text-base leading-tight">{card.name}</div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">{card.cost}</div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400">{card.type} · {card.rarity}</div>
            <div className="text-xs font-quill">{card.desc}</div>
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

function RestScreen({ onChoose }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-md mx-auto">
      <h2 className="font-display text-3xl text-moss-300">A Rest Site</h2>
      <p className="font-quill italic text-parchment-200 text-center">A small campfire, a flat rock, the unmistakable feeling that someone has Recently Camped Here. The path will still be there in the morning. It's that kind of path.</p>
      <div className="flex flex-col gap-2 w-full">
        <button onClick={() => onChoose('heal')}    className="btn btn-moss">Sleep — heal 30% max HP</button>
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
  return (
    <div className="min-h-screen flex flex-col p-6 gap-4 max-w-5xl mx-auto">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold-300">Study a Card</h2>
        <p className="text-sm text-parchment-300 italic mt-1">Pick one to commit to memory. (Already-upgraded cards are listed for reference only.)</p>
      </div>
      <div className="parchment-card p-3">
        <div className="text-[10px] uppercase text-parchment-300 mb-2 tracking-widest">Eligible ({eligible.length})</div>
        <div className="flex flex-wrap gap-2">
          {eligible.length === 0 && (
            <div className="text-xs italic text-parchment-400">Nothing left to study — every card has been upgraded already. Sleep instead?</div>
          )}
          {eligible.map(card => {
            const upgraded = upgradeCard(card);
            return (
              <button key={card.uid} onClick={() => onPick(card.uid)}
                className="w-44 rounded-md border-2 p-2 text-left bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl transition flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <div className="font-display text-sm">{card.name}</div>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm bg-gold-500 text-ink-800">{card.cost}</div>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-ink-400">{card.type}</div>
                <div className="text-xs">{card.desc}</div>
                <div className="text-[10px] mt-1 pt-1 border-t border-ink-300 text-moss-700">
                  → <b>{upgraded.name}</b>: {summarizeEffects(upgraded.effects, upgraded.power, upgraded.cost, upgraded.stats, upgraded.effect)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {ineligible.length > 0 && (
        <div className="parchment-card p-3">
          <div className="text-[10px] uppercase text-parchment-400 mb-1 tracking-widest">Already studied or no upgrade path ({ineligible.length})</div>
          <div className="text-xs text-parchment-400 italic flex flex-wrap gap-2">
            {ineligible.map(c => <span key={c.uid}>{c.name}</span>)}
          </div>
        </div>
      )}
      <button onClick={() => onPick(null)} className="btn btn-ink self-center">Back to rest</button>
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
