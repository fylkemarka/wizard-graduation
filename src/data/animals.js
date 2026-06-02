// Handler Animal Summoner roster. Extracted from App.jsx 2026-06-01 so
// the sim imports the SAME source of truth and cannot drift. Edit HERE.

// ─────────────────────────────────────────────────────────────────────
// ANIMALS — Handler Animal Summoner engine (slice 1, 2026-05-31)
// ─────────────────────────────────────────────────────────────────────
// Animals are summoned entities, not cards. They occupy a stage slot for
// `duration` turns and attack at end of each player turn.
//
// Slot lifecycle:
//   1. Player stages a LURE card in a slot. Slot becomes
//      { kind: 'lure', card, turnsRemaining, animalId }.
//   2. At end of each player turn, lure.turnsRemaining decrements. When it
//      reaches 0, the lure transforms into an animal in that same slot:
//      { kind: 'animal', animalId, durationRemaining, predatorProgress }.
//   3. At end of each player turn, animal attacks the enemy (deals
//      `attack` to `attackPool`), then duration decrements. When the
//      animal's duration hits 0, the slot empties.
//   4. PREDATOR CHAIN: if the animal has a `predatorChain`, predatorProgress
//      increments at end-of-turn. When it reaches `turnsToTrigger`, the
//      animal transforms into the predator (fresh duration).
//
// Slice-1 deferred: enemies attacking staged cards, three-of-a-kind, mixed
// combos, adjacency restrictions, treats. See memory:
// project_wg_chutzpah_animal_summoner for full design notes.
export const ANIMALS = {
  salmon: {
    name: 'Salmon',
    icon: '🐟',
    // No attack, no defense — the salmon flops. Its job is to wait. The
    // predator chain (see hidden field below) is the payoff for patience;
    // surfaced ONLY when the bear actually arrives, not on the card or
    // the slot pill. Discovery is the design.
    attack: 0,
    attackPool: 'composure',
    duration: 3,
    feedKey: 'fish',
    predatorChain: { animalId: 'bear', turnsToTrigger: 2 },
    hidePredatorChain: true,
    flavor: 'Flops with surprising authority.',
    desc: 'Flops. Does nothing. Waits.',
    // T2 upgrade: bear arrives one turn faster.
    upgrade: { predatorChain: { animalId: 'bear', turnsToTrigger: 1 } },
  },
  sparrow: {
    name: 'Sparrow',
    icon: '🐦',
    attack: 5,
    attackPool: 'composure',
    duration: 2,
    feedKey: 'bird',
    flavor: "Pecks like it's making a point.",
    desc: 'Attacks for 5 composure each turn for 2 turns.',
    upgrade: { attack: 7, duration: 3 },
  },
  'field-mouse': {
    name: 'Field Mouse',
    icon: '🐭',
    attack: 2,
    attackPool: 'composure',
    duration: 3,
    feedKey: 'small-land',
    onAttack: { draw: 1 },
    onExit: { block: 3, healComp: 2 },
    flavor: 'A small contribution. Steady.',
    desc: 'Attacks for 2 composure AND draws 1 card each turn for 3 turns. +3 Block and +2 Composure on exit.',
    upgrade: { attack: 3, onExit: { block: 5, healComp: 3 } },
    elite: 'mecha-mouse', // 3.5% chance at summon
  },
  // Elite (3.5% summon chance) — 50% better numbers on every effect.
  'mecha-mouse': {
    name: 'Mecha-Mouse',
    icon: '🦾',
    attack: 3,
    attackPool: 'composure',
    duration: 3,
    feedKey: 'small-land',
    onAttack: { draw: 1 },
    onExit: { block: 5, healComp: 3 },
    flavor: 'The field mouse has been upgraded. Considerably.',
    desc: 'Elite Field Mouse. 3 composure + draw per turn for 3 turns. +5 Block and +3 Composure on exit.',
  },
  rabbit: {
    name: 'Rabbit',
    icon: '🐰',
    attack: 3,
    attackPool: 'composure',
    duration: 3,
    feedKey: 'small-land',
    onAttack: { draw: 1 },
    onExit: { healComp: 2 },
    adjacentSpawn: { animalId: 'rabbit', turnsToTrigger: 2, extendSelfTurns: 2 },
    flavor: 'There were always going to be more of them.',
    desc: 'Attacks for 3 composure AND draws 1 card each turn for 3 turns. After 2 turns, spawns a Rabbit in each adjacent empty slot and stays 2 more turns. +2 Composure on exit.',
    upgrade: { attack: 4, onExit: { healComp: 3 }, adjacentSpawn: { animalId: 'rabbit', turnsToTrigger: 2, extendSelfTurns: 3 } },
    elite: 'bonzai-bunaroo',
  },
  'bonzai-bunaroo': {
    name: 'Bonzai Bunaroo',
    icon: '🥋',
    attack: 5,
    attackPool: 'composure',
    duration: 3,
    feedKey: 'small-land',
    onAttack: { draw: 1 },
    onExit: { healComp: 3 },
    // 50% more spawn extension: 2 → 3.
    adjacentSpawn: { animalId: 'bonzai-bunaroo', turnsToTrigger: 2, extendSelfTurns: 3 },
    flavor: 'Disciplined. Smaller. Hits harder than it has any right to.',
    desc: 'Elite Rabbit. 5 composure + draw per turn for 3 turns. Spawns more Bonzai Bunaroos after 2 turns; stays 3 more turns. +3 Composure on exit.',
  },
  'young-buck': {
    name: 'Young Buck',
    icon: '🦌',
    attack: 5,
    attackPool: 'composure',
    duration: 2,
    feedKey: 'small-land',
    onExit: { damage: 6, damageType: 'composure', healHp: 1 },
    flavor: 'Bold. Brief. Largely correct.',
    desc: 'Attacks for 5 composure each turn for 2 turns. Kicks for 6 composure and heals 1 HP on exit.',
    upgrade: { attack: 6, duration: 3, onExit: { damage: 8, damageType: 'composure', healHp: 2 } },
    elite: 'james-deer',
  },
  'james-deer': {
    name: 'James Deer',
    icon: '🕶️',
    attack: 8, // 5 × 1.5 = 7.5 → 8
    attackPool: 'composure',
    duration: 2,
    feedKey: 'small-land',
    onExit: { damage: 9, damageType: 'composure', healHp: 2 }, // 6 × 1.5 = 9; heal 1 × 1.5 → 2
    flavor: 'Looks the room over slowly. The room looks worse for it.',
    desc: 'Elite Young Buck. 8 composure / turn for 2 turns. 9 composure kick and 2 HP heal on exit.',
  },
  hawk: {
    name: 'Hawk',
    icon: '🦅',
    attack: 4,
    attackPool: 'composure',
    duration: 3,
    // No feedKey: a hawk is not lured or fed by Birdseed. To make it STAY,
    // stage a Field Mouse, Rabbit, or Salmon next to it — the hawk eats the
    // adjacent prey, moves into its square, and refreshes its stay (handled in
    // the end-of-turn pre-pass). (Alan, 2026-06-01.)
    eatsAdjacent: ['field-mouse', 'rabbit', 'salmon'],
    onExit: { applyWeak: 1, weakTurns: 1 },
    flavor: 'Arrived suddenly. The field mouse, presumably, is no longer a topic.',
    desc: 'Attacks for 4 composure each turn for 3 turns. Eats an adjacent Field Mouse, Rabbit, or Salmon to stay. Applies Weak 1 to the enemy on exit.',
    upgrade: { attack: 6, onExit: { applyWeak: 2, weakTurns: 1 } },
  },
  goose: {
    name: 'Goose',
    icon: '🪿',
    attack: 6,
    attackPool: 'composure',
    duration: 2,
    feedKey: 'bird',
    onExit: { damage: 5, damageType: 'composure' },
    flavor: 'It has strong opinions about your personal space.',
    desc: 'Attacks for 6 composure each turn for 2 turns. Parting hiss: 5 composure on exit.',
    upgrade: { attack: 8, onExit: { damage: 7, damageType: 'composure' } },
  },
  // Birdseed variety (2026-06-01, Flock pass — addresses playtest note #2:
  // "need more animals summoned with birdseed"). Crow = steady uptime;
  // Owl = the thinking bird, exposes weakness on each peck.
  crow: {
    name: 'Crow',
    icon: '🐦‍⬛',
    attack: 5,
    attackPool: 'composure',
    duration: 3,
    feedKey: 'bird',
    flavor: 'It has counted you. It will remember the number.',
    desc: 'Attacks for 5 composure each turn for 3 turns.',
    upgrade: { attack: 7, duration: 3 },
  },
  owl: {
    name: 'Owl',
    icon: '🦉',
    attack: 3,
    attackPool: 'composure',
    duration: 3,
    feedKey: 'bird',
    onAttackEffect: { applyVulnerable: 1 },
    flavor: 'It asks the obvious question. The enemy has no good answer.',
    desc: 'Attacks for 3 composure and applies Vulnerable 1 each turn for 3 turns.',
    upgrade: { attack: 5, onAttackEffect: { applyVulnerable: 1 } },
  },
  // Mouse House — formed when all three slots hold Field Mice. The mice
  // combine into one Mouse House in the center slot (subject); the
  // outer slots empty. Mouse House attacks 8 composure each turn for 2
  // turns AND applies Vulnerable 1 to the enemy each attack.
  // ---- COMBINE ANIMALS (formed by a three-of-a-kind pre-pass at end of
  // turn). They never need feeding — feedKey is intentionally absent so the
  // feed gate (isUnfed) always sees them as "fed" and grants the full
  // duration + exit bonus. They also don't carry an eatenThisTurn flag on
  // formation: they attack and grant defense the same turn they combine.
  'mouse-house': {
    name: 'Mouse House',
    icon: '🏠',
    attack: 8,
    attackPool: 'composure',
    duration: 2,
    onAttackEffect: { applyVulnerable: 1 },
    onExit: { healComp: 5 },
    flavor: 'They were, you realise, organising the whole time.',
    desc: 'Attacks for 8 composure each turn for 2 turns. Applies Vulnerable 1 to the enemy with each attack. Heals 5 Composure on exit.',
    upgrade: { attack: 10, duration: 3, onExit: { healComp: 7 } },
  },
  'long-hare': {
    name: 'The Long Hare',
    icon: '🐇',
    attack: 8,
    attackPool: 'composure',
    duration: 2,
    onAttackEffect: { applyWeak: 1 },
    turnGrant: { poise: 5 },
    onExit: { healComp: 5 },
    flavor: 'It is many. It is one. It is, frankly, late.',
    desc: 'Attacks for 8 composure and applies Weak 1 each turn for 2 turns. Grants 5 Poise per turn. Heals 5 Composure on exit.',
  },
  mccloven: {
    name: 'McCloven',
    icon: '🦌',
    attack: 10,
    attackPool: 'composure',
    duration: 2,
    turnGrant: { block: 5 },
    onExit: { healHp: 5 },
    flavor: 'A great cloven thing has, by collective vote, decided.',
    desc: 'Attacks for 10 composure each turn for 2 turns. Grants 5 Block per turn. Heals 5 HP on exit.',
  },
  bear: {
    name: 'Bear',
    icon: '🐻',
    attack: 9,
    attackPool: 'composure',
    duration: 3,
    // No feedKey: a bear arrives having already eaten the salmon, so it is
    // never "unfed". It does NOT eat Fish Food (the lure) — it eats actual
    // salmon. A standing bear consumes any salmon staged adjacent for +2
    // turns (handled in the end-of-turn pre-pass). (Alan, 2026-06-01.)
    flavor: "He came for the salmon. He's staying for the rest of you.",
    upgrade: { attack: 11, duration: 4 },
    desc: 'Attacks for 9 composure each turn for 3 turns. Eats an adjacent Salmon for +2 turns.',
  },
};
