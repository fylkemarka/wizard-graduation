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

export const HANDLER_V2 = [...LURE_CARDS];
export const HANDLER_V2_BY_SLOT = {
  intro: [],
  subject: [],
  target: [],
  modifier: [],
  gesture: [],
  power: [],
  skill: [],
  lure: [...LURE_CARDS],
};
