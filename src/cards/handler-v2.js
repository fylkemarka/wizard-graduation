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
// STARTER CARDS — the basic utility starters that ship with every
// Handler deck regardless of build.
// =============================================================================
const STARTER_CARDS = [
  { id: 'cv2-k-square-up', slot: 'skill', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'skill',
    name: 'Square Up', phrase: 'Square Up',
    tags: ['threatening', 'direct'],
    effects: { block: 7, loseHp: 1, exhaust: true },
    desc: 'Lose 1 HP. Gain 7 Block. Exhaust.',
    flavor: 'You take a step closer. The room rearranges itself slightly.' },
];

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
    lane: LANE, rarity: 'basic', tier: 1,
    summon: { animalId: 'salmon', turnsToArrive: 2 },
    desc: 'Stage. A Salmon arrives in 2 turns. If you leave it for 2 more turns, a BEAR arrives.',
    flavor: 'Smells of yesterday.' },
  { id: 'cv2-l-birdseed', name: 'Birdseed', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'basic', tier: 1,
    summon: { animalId: 'sparrow', turnsToArrive: 1 },
    desc: 'Stage. A Sparrow arrives next turn.',
    flavor: 'You scatter it like you mean it.' },
  { id: 'cv2-l-cheese', name: 'Cheese', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'basic', tier: 1,
    summon: { animalId: 'field-mouse', turnsToArrive: 1 },
    desc: 'Stage. A Field Mouse arrives next turn.',
    flavor: 'Aged. Slightly judgmental.' },
];

export const HANDLER_V2 = [...STARTER_CARDS, ...LURE_CARDS];
export const HANDLER_V2_BY_SLOT = {
  intro: [],
  subject: [],
  target: [],
  modifier: [],
  gesture: [],
  power: [],
  skill: [...STARTER_CARDS.filter(c => c.slot === 'skill')],
  lure: [...LURE_CARDS],
};
