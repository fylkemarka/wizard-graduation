// Handler lane v2 — Animal Summoner pivot (2026-05-31). See memory:
// project_wg_chutzpah_animal_summoner. The Handler bait-and-times animals
// onto the board to fight for them.
//
// This file used to host the chutzpah word-pool (~75 cards: intros,
// subjects, targets, mechanic-specific cards for Loudness / Tunnel Vision /
// RAGE / Saying It Louder / Smell Weakness / Synergy Capstone / Hit Me
// Again / Not Listening). All of that was retired with the pivot and
// stripped 2026-05-31. Gesture cards (Shove, Slams Table, Pontificate,
// Quip Eyebrow, Headbutt) were also removed at Alan's request — the
// Animal Summoner doesn't need physical-action chip cards; the animals
// are the direct line of attack.

const LANE = 'handler';

// =============================================================================
// STARTER CARDS — formerly Square Up + Shove. Both removed 2026-05-31.
// The Handler doesn't fight; the animals do. Starter is just lures +
// colorless utility.
// =============================================================================
const STARTER_CARDS = [];

// =============================================================================
// LURE CARDS — Animal Summoner engine (slice 1, 2026-05-31). Each lure
// carries a `summon` payload referencing an animalId in App.jsx's ANIMALS
// table. On play, the lure is placed into the first empty stage slot; over
// the next `turnsToArrive` end-of-turn ticks the lure transforms into its
// summoned animal in that slot, which then auto-attacks each end-of-turn
// until its duration expires.
//
// Lures do NOT exhaust. When the lure transforms into its animal, the lure
// card is sent to discard so it can be redrawn and re-staged.
// =============================================================================
const LURE_CARDS = [
  { id: 'cv2-l-fish-food', name: 'Fish Food', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'uncommon', tier: 2,
    summon: { animalId: 'salmon', turnsToArrive: 1 },
    desc: 'Stage. A Salmon arrives next turn and flops for 2 turns. Each turn, 50% chance to attract a predator — usually a bird, sometimes a bear. High risk.',
    flavor: 'Smells of yesterday. Something downstream has already noticed.' },
  { id: 'cv2-l-birdseed', name: 'Birdseed', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'basic', tier: 1, feedKey: 'bird',
    summon: { animalIds: ['rabid-scrubjay', 'goose', 'raven'], turnsToArrive: 1 },
    desc: 'In 1T, summons a Rabid Scrubjay, Goose, or Raven. Feeds: birds.',
    flavor: 'You scatter it like you mean it. Something always turns up.' },
  { id: 'cv2-l-tender-greens', name: 'Tender Greens', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'basic', tier: 1, feedKey: 'small-land',
    summon: { animalIds: ['field-mouse', 'rabbit', 'young-buck'], turnsToArrive: 1, summonSet: 'tender-greens' },
    desc: 'In 1T, summons a field mouse, rabbit, or young buck. Feeds: small land animals.',
    flavor: 'Lettuce, mostly. Whatever turns up will have to make do.' },
];

// =============================================================================
// SPECIAL UTILITY LURES (Alan, 2026-06-03) — each summons ONE specific named
// animal that brings a gameplay VERB rather than stats. Offered ONLY in the
// normal-combat reward draft (exactly one of the three cards), never in the
// elite/boss foundational-lure pool — kept out of HANDLER_V2_BY_SLOT.lure for
// that reason. These animals never need feeding (no feedKey on the animal);
// replaying the SAME lure while the animal is staged extends it +1 turn.
// `slots` > 1 marks a multi-slot footprint (Kangaroo in batch 2). Mirrored in
// sim/playSimV2.js HANDLER_SPECIAL_LURES.
// =============================================================================
const SPECIAL_LURE_CARDS = [
  { id: 'cv2-l-shepherds-whistle', name: "A Shepherd's Whistle", cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'rare', tier: 2, special: true,
    summon: { animalId: 'sheepdog', turnsToArrive: 1 },
    desc: 'In 1T, summons a Sheepdog (0 attack). Animals in adjacent slots deal +50% — the middle slot reaches both. No feeding needed; replay to extend.',
    flavor: 'Two short notes. Somewhere, a professional gets to work.' },
  { id: 'cv2-l-curious-noise', name: 'A Curious Noise', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'uncommon', tier: 2, special: true,
    summon: { animalId: 'lyrebird', turnsToArrive: 1 },
    desc: 'In 1T, summons a Lyrebird. Each turn it copies the attack of the animal to its left (its own 2 otherwise). No feeding needed; replay to extend.',
    flavor: 'You made a sound once. It has been working on it ever since.' },
  { id: 'cv2-l-windfall-apple', name: 'A Windfall Apple', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'uncommon', tier: 2, special: true,
    summon: { animalId: 'porcupine', turnsToArrive: 1 },
    desc: 'In 1T, summons a Porcupine (0 attack). Whenever the enemy attacks you, it takes 4 composure in return. No feeding needed; replay to extend.',
    flavor: 'Bruised, generous, and entirely beside the point.' },
  { id: 'cv2-l-low-branch', name: 'A Low, Slow Branch', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'rare', tier: 2, special: true,
    summon: { animalId: 'sloth', turnsToArrive: 4 },
    desc: 'In 4T (it is, after all, a sloth), summons a Sloth (0 attack). While it hangs around, the enemy acts at half speed — skipping every other turn. No feeding needed; replay to extend.',
    flavor: 'An invitation with no particular deadline. It will be honoured eventually.' },
];

export const HANDLER_V2 = [...LURE_CARDS, ...SPECIAL_LURE_CARDS];
export { SPECIAL_LURE_CARDS };
export const HANDLER_V2_BY_SLOT = {
  intro: [],
  subject: [],
  target: [],
  modifier: [],
  gesture: [],
  power: [],
  skill: [],
  // Foundational lures only — special utility lures are injected into the
  // normal-combat draft directly, never the elite/boss lure pool.
  lure: [...LURE_CARDS],
};
