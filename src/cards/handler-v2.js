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
  // Slice 5 (Alan, 2026-06-08): foundational pools narrowed 3→2 so there's no
  // raw-stat ladder inside a pool — each option is a distinct ROLE gamble.
  // Birdseed = heavy hitter (goose) vs armor-stripper (raven). The dropped
  // disruptor (rabid-scrubjay) survives as the single-species "A Shiny Bauble".
  { id: 'cv2-l-birdseed', name: 'Birdseed', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'basic', tier: 1, feedKey: 'bird',
    summon: { animalIds: ['goose', 'raven'], turnsToArrive: 1 },
    desc: 'In 1T, summons a Goose (heavy hitter) or a Raven (armor-stripper). Feeds: birds.',
    flavor: 'You scatter it like you mean it. Something always turns up.' },
  // Tender Greens = value-cycler (field-mouse) vs burst (young-buck). The
  // dropped swarm (rabbit) survives as the single-species "A Clover Patch".
  { id: 'cv2-l-tender-greens', name: 'Tender Greens', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'basic', tier: 1, feedKey: 'small-land',
    summon: { animalIds: ['field-mouse', 'young-buck'], turnsToArrive: 1, summonSet: 'tender-greens' },
    desc: 'In 1T, summons a Field Mouse (the cycler) or a Young Buck (the burst). Feeds: small land animals.',
    flavor: 'Lettuce, mostly. Whatever turns up will have to make do.' },
];

// =============================================================================
// SPECIAL UTILITY LURES (Alan, 2026-06-03) — each summons ONE specific named
// animal that brings a gameplay VERB rather than stats. Offered ONLY in the
// normal-combat reward draft (exactly one of the three cards), never in the
// elite/boss foundational-lure pool — kept out of HANDLER_V2_BY_SLOT.lure for
// that reason. These animals never need feeding (no feedKey on the animal);
// replaying the SAME lure while the animal is staged extends it +1 turn.
// Mirrored in sim/playSimV2.js HANDLER_SPECIAL_LURES.
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
    desc: 'In 1T, summons a Porcupine (0 attack). It absorbs up to 5 damage from each enemy attack and jabs the absorbed amount back as composure. No feeding needed; replay to extend.',
    flavor: 'Bruised, generous, and entirely beside the point.' },
  { id: 'cv2-l-low-branch', name: 'A Low, Slow Branch', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'rare', tier: 2, special: true,
    summon: { animalId: 'sloth', turnsToArrive: 3 }, // 4 → 3 (Alan, 2026-06-08)
    desc: 'In 3T, summons a Sloth (0 attack). While it hangs around, the enemy acts at half speed — skipping every other turn. Stays 4 turns. No feeding needed; replay to extend.',
    flavor: 'An invitation with no particular deadline. It will be honoured eventually.' },
  // Batch 2 — player-activated abilities. Click the on-board animal to spend
  // its verb (App.jsx activateAnimalFromSlot).
{ id: 'cv2-l-stale-crust', name: 'A Stale Crust', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'uncommon', tier: 2, special: true,
    summon: { animalId: 'pigeon', turnsToArrive: 1 },
    desc: "In 1T, summons a Pigeon. Click once a turn to scramble the enemy's intent into a different one. No feeding needed; replay to extend.",
    flavor: 'It was bread once. The pigeon does not hold this against it.' },
  { id: 'cv2-l-eucalyptus', name: 'A Sprig of Eucalyptus', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'rare', tier: 2, special: true,
    summon: { animalId: 'kangaroo', turnsToArrive: 1 },
    desc: 'In 1T, summons a Kangaroo. Click and spend 2 energy to duck into the pouch — end your turn, take no damage next turn. No feeding needed; replay to extend.',
    flavor: 'Smells like somewhere far away with better weather and more kicking.' },
  // Slice 5 single-species lures (Alan, 2026-06-08) — the two animals dropped
  // from the narrowed foundational pools survive as their own dedicated lures,
  // each summoning ONE named animal whose role the desc spells out. Unlike the
  // other specials these carry a feedKey (the animal still needs feeding), so
  // the species-feed button keeps them on the board.
  { id: 'cv2-l-clover-patch', name: 'A Clover Patch', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'uncommon', tier: 2, special: true, feedKey: 'small-land',
    summon: { animalId: 'rabbit', turnsToArrive: 1 },
    desc: 'In 1T, summons a Rabbit — THE SWARM. Draws a card and goes wide: after 2 turns it spawns a Rabbit in each adjacent empty slot. Feeds: small land animals.',
    flavor: 'Statistically, one of them is lucky. The rest are just thorough.' },
  { id: 'cv2-l-shiny-bauble', name: 'A Shiny Bauble', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'uncommon', tier: 2, special: true, feedKey: 'bird',
    summon: { animalId: 'rabid-scrubjay', turnsToArrive: 1 },
    desc: "In 1T, summons a Rabid Scrubjay — THE DISRUPTOR. Chips composure, then on exit turns the enemy's next attack back on themselves. Feeds: birds.",
    flavor: 'It is not valuable. It is, however, extremely shiny, which is most of the way there.' },
  // KEEPER lure (Alan, 2026-06-08) — the Anchor. Summons a Drystone Ox: a
  // defensive keeper you devote a slot to and strengthen into a wall.
  { id: 'cv2-l-bag-of-oats', name: 'A Bag of Oats', cost: 1, type: 'lure', slot: 'lure',
    lane: LANE, rarity: 'uncommon', tier: 2, special: true,
    summon: { animalId: 'ox', turnsToArrive: 1 },
    desc: 'In 1T, summons a Drystone Ox — a keeper. Stays 6 turns, braces for 6 Block each turn, chips 2 composure. Never needs feeding. Strengthen it into a wall.',
    flavor: 'It is, you are assured, the good oats. The ox will be the judge of that.' },
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
