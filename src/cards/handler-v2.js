// Handler lane v2 — Animal Summoner pivot (2026-05-31). See memory:
// project_wg_chutzpah_animal_summoner. The Handler bait-and-times animals
// onto the board to fight for them.
//
// This file used to host the chutzpah word-pool (~75 cards: intros,
// subjects, targets, mechanic-specific cards for Loudness / Tunnel Vision /
// RAGE / Saying It Louder / Smell Weakness / Synergy Capstone / Hit Me
// Again / Not Listening). All of that was retired with the pivot and
// stripped 2026-05-31. What remains is the still-relevant transitional
// pool: gestures (lane-flavored physical actions), the two utility
// starter cards (Square Up + Shove), and the Animal Summoner lure cards.

const LANE = 'handler';

// =============================================================================
// GESTURES — physical-action cards that bypass the stage tray. Same shape
// as wit gestures (rendered via the gesture handler in App.jsx).
// =============================================================================
const GESTURES = [
  { id: 'cv2-g-slams-table', slot: 'gesture', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'gesture',
    phrase: '(SLAMS THE TABLE,)', tags: ['threatening', 'direct'],
    gestureEffect: { icon: '💥', damage: 6, damageType: 'composure', trayMultiplier: 1, rider: { vulnerable: 1 }, exhaust: true },
    desc: 'Bypasses tray. Deal 6 composure. Apply 1 Vulnerable. Exhaust.',
    flavor: 'The table was a witness. The table is now also a victim.' },
  { id: 'cv2-g-pontificate', slot: 'gesture', tier: 2, rarity: 'uncommon', lane: LANE, cost: 3, type: 'gesture',
    phrase: 'GET A LOAD OF THIS:', tags: ['swaggering', 'direct'],
    gestureEffect: { icon: '📣', damage: 12, damageType: 'composure', trayMultiplier: 2, exhaust: false },
    desc: 'Bypasses tray. Deal 12 composure. Reusable (does not exhaust).',
    flavor: 'A load is exactly what they are about to get.' },
  { id: 'cv2-g-quip-eyebrow', slot: 'gesture', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'gesture',
    phrase: '(quip, with raised eyebrow,)', tags: ['dismissive', 'swaggering'],
    gestureEffect: { icon: '😏', damage: 4, damageType: 'composure', stripEnemyBlock: 6, exhaust: false },
    desc: 'Bypasses tray. Deal 4 composure. Strip 6 enemy Block. Reusable.',
    flavor: 'The eyebrow is the threat. The quip is the apology for the eyebrow.' },
  { id: 'cv2-g-headbutt', slot: 'gesture', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'gesture',
    phrase: '(headbutt — no commentary)', tags: ['direct', 'threatening'],
    gestureEffect: { icon: '🪨', damage: 4, damageType: 'composure', rider: { nextAttackSwingReduction: 1 }, exhaust: true },
    desc: "Bypasses tray. Deal 4 composure. Enemy's next attack: each swing −1 damage. Exhaust.",
    flavor: 'A philosophical question, answered with a noun.' },
];

// =============================================================================
// STARTER CARDS — the basic utility / gesture starters that ship with
// every Handler deck regardless of build.
// =============================================================================
const STARTER_CARDS = [
  { id: 'cv2-k-square-up', slot: 'skill', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'skill',
    name: 'Square Up', phrase: 'Square Up',
    tags: ['threatening', 'direct'],
    effects: { block: 7, loseHp: 1, exhaust: true },
    desc: 'Lose 1 HP. Gain 7 Block. Exhaust.',
    flavor: 'You take a step closer. The room rearranges itself slightly.' },
  { id: 'cv2-g-shove', slot: 'gesture', tier: 1, rarity: 'basic', lane: LANE, cost: 1, type: 'gesture',
    name: 'Shove', phrase: '(a shove, brief and chiropractic,)',
    tags: ['threatening', 'direct'],
    gestureEffect: { icon: '👊', damage: 5, damageType: 'composure', exhaust: true },
    desc: 'Bypasses tray. Deal 5 composure. Exhaust.',
    flavor: 'It is not subtle. It does not need to be.' },
];

// =============================================================================
// LURE CARDS — Animal Summoner engine (slice 1, 2026-05-31). Each lure
// carries a `summon` payload referencing an animalId in App.jsx's ANIMALS
// table. On play, the lure is placed into the first empty stage slot; over
// the next `turnsToArrive` end-of-turn ticks the lure transforms into its
// summoned animal in that slot, which then auto-attacks each end-of-turn
// until its duration expires.
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

export const HANDLER_V2 = [...GESTURES, ...STARTER_CARDS, ...LURE_CARDS];
export const HANDLER_V2_BY_SLOT = {
  intro: [],
  subject: [],
  target: [],
  modifier: [],
  gesture: [...GESTURES, ...STARTER_CARDS.filter(c => c.slot === 'gesture')],
  power: [],
  skill: [...STARTER_CARDS.filter(c => c.slot === 'skill')],
  lure: [...LURE_CARDS],
};
