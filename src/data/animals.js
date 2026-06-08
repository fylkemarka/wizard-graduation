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
    // No attack, no defense — the salmon flops. Its job is to be bait. Each
    // turn it's on the board it rolls predatorRoll.chance to attract a
    // predator and transform in place (weighted: usually a bird, sometimes a
    // bear). Two turns on the board = two rolls. If neither hits, it just
    // departs — no feeding, no exit bonus. A maybe/maybe-not gamble (Alan,
    // 2026-06-02), replacing the old deterministic feed-gated Salmon→Bear.
    attack: 0,
    attackPool: 'composure',
    duration: 2,
    predatorRoll: {
      chance: 0.65,
      table: [
        { weight: 65, ids: ['hawk', 'owl'] },
        { weight: 35, ids: ['bear'] },
      ],
    },
    flavor: 'Flops with surprising authority. Something is always watching.',
    desc: 'Flops for 2 turns. Each turn, 65% chance to attract a predator — usually a bird, sometimes a bear. If nothing comes, it just leaves.',
  },
  'rabid-scrubjay': {
    name: 'Rabid Scrubjay',
    icon: '🐦',
    attack: 4,
    attackPool: 'composure',
    duration: 3,
    feedKey: 'bird',
    // Spittle Peck: on exit, the enemy's next attack is turned back on them.
    onExit: { redirectEnemyAttack: true, healComp: 1 },
    flavor: 'Foams a little. Means well. Aims worse — at everyone but you.',
    desc: 'Attacks for 4 composure each turn for 3 turns. Spittle Peck: on exit, the enemy turns their next attack on themselves. +1 composure on exit.',
    upgrade: { attack: 6, onExit: { redirectEnemyAttack: true, healComp: 3, healHp: 1 } },
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
    // exit damage 6 → 3 (Alan, 2026-06-07).
    onExit: { damage: 3, damageType: 'composure', healHp: 1 },
    flavor: 'Bold. Brief. Largely correct.',
    desc: 'Attacks for 5 composure each turn for 2 turns. Kicks for 3 composure and heals 1 HP on exit.',
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
    // exit damage 9 → 4 (Alan, 2026-06-07).
    onExit: { damage: 4, damageType: 'composure', healHp: 2 },
    flavor: 'Looks the room over slowly. The room looks worse for it.',
    desc: 'Elite Young Buck. 8 composure / turn for 2 turns. 4 composure kick and 2 HP heal on exit.',
  },
  hawk: {
    name: 'Hawk',
    icon: '🦅',
    attack: 4,
    attackPool: 'composure',
    duration: 3,
    // No feedKey: a hawk is not lured or fed by Birdseed. It arrives uninvited
    // by swooping on a staged Field Mouse, Rabbit, or Salmon (hawk/owl swoop
    // pre-pass). On its EXIT turn it can eat ONE adjacent prey to move into
    // that square and stay one more turn — once only, it cannot be fed again.
    // (Alan, 2026-06-02. Cannot be upgraded.)
    eatsAdjacent: ['field-mouse', 'rabbit', 'salmon'],
    onExit: { applyWeak: 1, weakTurns: 1 },
    flavor: 'Arrived suddenly. The field mouse, presumably, is no longer a topic.',
    desc: 'Attacks for 4 composure each turn. On its exit turn, eats one adjacent Field Mouse, Rabbit, or Salmon to stay one more turn (once). Applies Weak 1 to the enemy on exit.',
  },
  goose: {
    name: 'Goose',
    icon: '🪿',
    attack: 6,
    attackPool: 'composure',
    duration: 3,
    feedKey: 'bird',
    // exit damage 4 → 3 (Alan, 2026-06-07).
    onExit: { damage: 3, damageType: 'composure' },
    flavor: 'It has strong opinions about your personal space.',
    desc: 'Attacks for 6 composure each turn for 3 turns. Parting hiss: 3 composure on exit.',
    upgrade: { attack: 8, duration: 3, onExit: { damage: 5, damageType: 'composure', healHp: 2 } },
  },
  // Birdseed variety (2026-06-01, Flock pass — addresses playtest note #2:
  // "need more animals summoned with birdseed"). Raven = burst + armor strip;
  // Owl = the thinking bird, exposes weakness on each peck.
  raven: {
    name: 'Raven',
    icon: '🐦‍⬛',
    attack: 6,
    attackPool: 'composure',
    duration: 2,
    feedKey: 'bird',
    // Bird Theft: on the turn the raven is set to exit (durationRemaining === 1),
    // before any animal attacks, strip `birdTheft` Block from the enemy.
    // Handled in the end-of-turn pre-pass (mirrors hawk/bear). (2026-06-02.)
    birdTheft: 6,
    onExit: { healHp: 1 },
    flavor: 'It has counted you. It will remember the number. It will also take your things.',
    desc: 'Attacks for 6 composure each turn for 2 turns. Bird Theft: strips 6 Block from the enemy on the turn it exits. +1 HP on exit.',
    upgrade: { attack: 8, birdTheft: 9, onExit: { healHp: 2, healComp: 2 } },
  },
  owl: {
    name: 'Owl',
    icon: '🦉',
    attack: 3,
    attackPool: 'composure',
    duration: 3,
    // Same arrival/feeding as the Hawk: no feedKey, arrives by swoop, and on
    // its exit turn eats one adjacent prey to stay one more turn (once). Its
    // Vulnerable is applied in a PRE-PASS before any animal attacks, so the
    // whole menagerie's hits land into the debuff the same turn. (Alan,
    // 2026-06-02. Cannot be upgraded.)
    eatsAdjacent: ['field-mouse', 'rabbit', 'salmon'],
    prePassVulnerable: 1,
    flavor: 'It asks the obvious question. The enemy has no good answer.',
    desc: 'Attacks for 3 composure each turn. Applies Vulnerable 1 to the enemy before your animals attack. On its exit turn, eats one adjacent prey to stay one more turn (once).',
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
    onForm: { damage: 14, pool: 'composure' },
    onExit: { healComp: 5 },
    flavor: 'They were, you realise, organising the whole time.',
    desc: 'On forming: bursts for 14 composure. Then attacks for 8 composure each turn for 2 turns. Applies Vulnerable 1 to the enemy with each attack. Heals 5 Composure on exit.',
    // Combine payoff, not a summon you train — cannot be upgraded at an Inn
    // (Alan, 2026-06-01). The reward is forming it, not training it.
  },
  'long-hare': {
    name: 'The Long Hare',
    // attack 8 → 10 (Alan, 2026-06-07): three rabbits do 3×3 = 9/turn, so
    // the combine must beat 9 to be worth assembling.
    icon: '🐇',
    attack: 10,
    attackPool: 'composure',
    duration: 2,
    onAttackEffect: { applyWeak: 1 },
    turnGrant: { poise: 5 },
    onForm: { damage: 14, pool: 'composure', applyVulnerable: 2 },
    onExit: { healComp: 5 },
    flavor: 'It is many. It is one. It is, frankly, late.',
    desc: 'On forming: bursts for 14 composure and applies Vulnerable 2. Then attacks for 10 composure and applies Weak 1 each turn for 2 turns. Grants 5 Poise per turn. Heals 5 Composure on exit.',
  },
  mccloven: {
    name: 'McCloven',
    icon: '🦌',
    attack: 10,
    attackPool: 'composure',
    duration: 2,
    turnGrant: { block: 5 },
    onForm: { damage: 18, pool: 'composure' },
    onExit: { healHp: 5 },
    flavor: 'A great cloven thing has, by collective vote, decided.',
    desc: 'On forming: bursts for 18 composure. Then attacks for 10 composure each turn for 2 turns. Grants 5 Block per turn. Heals 5 HP on exit.',
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

  // ─────────────────────────────────────────────────────────────────────
  // SPECIAL UTILITY ANIMALS (Alan, 2026-06-03) — single-animal lures from
  // the reward pool. Each brings a distinct gameplay VERB rather than stats;
  // most do little/no combat damage. They never need feeding (no feedKey, so
  // the feed gate always reads them as fed), BUT replaying their OWN lure
  // while they're on the board extends them +1 turn (per-lure feed, distinct
  // from the foundational feedKey-family feed). Footprint is the cost: a
  // multi-slot animal (`slots`) fills more of the tray and so can't combo.
  // Slot ORDER is the synergy axis (Sheepdog middle = both neighbors; Lyrebird
  // copies its LEFT). New engine fields are mirrored in App.jsx AND the sim.
  // ─────────────────────────────────────────────────────────────────────

  // GROUP C — AMPLIFY. Sheepdog: pure aura, 0 attack. Adjacent animals deal
  // +50%; placed in the MIDDLE slot it reaches both neighbors. The piece that
  // makes you think about where everything stands.
  sheepdog: {
    name: 'Sheepdog',
    icon: '🐕',
    attack: 0,
    attackPool: 'composure',
    duration: 3,
    special: true,
    amplifyAdjacent: 0.5,
    flavor: 'Not interested in fighting. Interested in everyone being where they should be.',
    desc: 'Does not attack. Animals in adjacent slots deal +50% (the middle slot reaches both). Stays 3 turns; replay its lure to extend.',
  },
  // GROUP C — Lyrebird: directional mimic. Each turn it copies the attack of
  // the animal immediately to its LEFT (earlier tray slot). With nothing to
  // its left it does its own small 2.
  lyrebird: {
    name: 'Lyrebird',
    icon: '🎙️',
    attack: 2,
    attackPool: 'composure',
    duration: 3,
    special: true,
    copiesLeft: true,
    flavor: 'An uncanny impression of whatever just happened. Including the parts you would rather it did not.',
    desc: "Each turn, copies the attack of the animal to its left (its own 2 composure if there's nothing there). Stays 3 turns; replay its lure to extend.",
  },
  // GROUP B — DEFENSE. Porcupine: a reflecting shield. `thorns` is the per-
  // swing ABSORB cap — that much of an incoming attack never reaches the
  // player, and the absorbed amount is jabbed back as composure (quills-first,
  // before Block; multiple porcupines stack the cap).
  porcupine: {
    name: 'Porcupine',
    icon: '🦔',
    attack: 0,
    attackPool: 'composure',
    duration: 3,
    special: true,
    thorns: 5,
    flavor: 'Best admired from a conversational distance.',
    desc: 'Does not attack. Absorbs up to 5 damage from each enemy attack (you take that much less) and deals the absorbed amount back as composure. Stays 3 turns; replay its lure to extend.',
  },
  // GROUP A — TEMPO. Sloth: slowest arrival in the game (4 turns), 0 attack.
  // Time dilation — while it hangs around, the enemy acts at HALF SPEED,
  // skipping every other turn. The long wait buys a sustained multi-turn
  // tempo lock, not a one-shot (Alan: "needs a bigger payoff than a slow
  // Mime"). Feed its own lure to keep the lock going.
  sloth: {
    name: 'Sloth',
    icon: '🦥',
    attack: 0,
    attackPool: 'composure',
    duration: 4, // 3 → 4 (Alan, 2026-06-08): stays one turn longer.
    special: true,
    slowsEnemy: true,
    flavor: 'It will get here. It has every intention of getting here.',
    desc: 'Slow to arrive, and does not attack. While it hangs around, time dilates: the enemy acts at half speed, skipping every other turn. Stays 4 turns; replay its lure to extend.',
  },
  // ─────────────────────────────────────────────────────────────────────
  // BATCH 2 — PLAYER-ACTIVATED abilities (Alan, 2026-06-05). These don't act
  // on their own each turn; the player CLICKS the on-board animal to spend its
  // verb at the moment of their choosing — timing/planning is the payoff. The
  // `activatedAbility` descriptor drives both the click affordance and the
  // dispatcher (App.jsx activateAnimalFromSlot + sim aiTurnHandler). Fields:
  //   id            — branch key in the dispatcher
  //   label         — button/hint text
  //   cadence       — 'self-consume' (one shot, animal leaves) | 'per-turn'
  //   endsTurn      — true: activating immediately ends the player's turn
  // ─────────────────────────────────────────────────────────────────────

  // GROUP A — TEMPO. Mime: one invisible wall. Activate to make the enemy skip
  // its NEXT turn outright, then the Mime is spent and leaves. The whole point
  // of the summon is that single, well-timed stop.
  mime: {
    name: 'Mime',
    icon: '🤫',
    attack: 0,
    attackPool: 'composure',
    duration: 3,
    special: true,
    activatedAbility: { id: 'mime-wall', label: '🧱 mime a wall — enemy skips its next turn', cadence: 'self-consume' },
    flavor: 'It insists there is a wall. The enemy, against its better judgement, agrees.',
    desc: 'Does not attack. Click to mime an invisible wall: the enemy skips its next turn, then the Mime takes its bow and leaves. One use; replay its lure for another.',
  },
  // GROUP A — TEMPO. Pigeon: struts across the enemy's plans. Activate to
  // SCRAMBLE the telegraphed intent — it re-rolls into something different.
  // A gamble button you can pull once a turn while the pigeon's around.
  pigeon: {
    name: 'Pigeon',
    icon: '🐦',
    attack: 1,
    attackPool: 'composure',
    duration: 3,
    special: true,
    activatedAbility: { id: 'pigeon-scramble', label: "🐦 scramble the enemy's intent", cadence: 'per-turn' },
    flavor: 'It has no plan either, but at least it commits.',
    desc: "Click once a turn to scramble the enemy's next move into a different one (a gamble — it might get worse). Stays 3 turns; replay its lure to extend.",
  },
  // GROUP B — DEFENSE. Kangaroo: activate to DUCK INTO THE POUCH — you give up
  // the rest of your turn, and in return take NO damage on the next enemy turn.
  // A clean tempo-for-safety trade. Single-slot (Alan, 2026-06-05): giving up a
  // stage slot to a non-combat animal is already a steep price; one is enough.
  kangaroo: {
    name: 'Kangaroo',
    icon: '🦘',
    attack: 3,
    attackPool: 'composure',
    duration: 3,
    special: true,
    activatedAbility: { id: 'kangaroo-pouch', label: '🦘 duck into the pouch (2 energy) — end your turn, take no damage next turn', cadence: 'per-turn', endsTurn: true, energyCost: 2 },
    flavor: 'Roomy, surprisingly clean, smells faintly of eucalyptus. You have had worse hiding places.',
    desc: 'Click and spend 2 energy to duck into the pouch: your turn ends and you take no damage on the next enemy turn. Stays 3 turns; replay its lure to extend.',
  },
  // Fodder body (Alan, 2026-06-08) — summoned in pairs by the Strays card.
  // 1-turn life, small swing; exists to be sacrificed or to leave and feed
  // Memorial / Light the Mound. No feedKey (never asks to be fed).
  stray: {
    name: 'Stray',
    icon: '🐈‍⬛',
    attack: 2,
    attackPool: 'composure',
    duration: 1,
    special: true,
    flavor: 'It has decided you are family now. The arrangement is, at best, provisional.',
    desc: 'A 1-turn body. Swings for 2, then wanders off — fodder for sacrifice or Memorial.',
  },

  // ─────────────────────────────────────────────────────────────────────
  // KEEPERS (Alan, 2026-06-08) — the menagerie as a TEAM you form, retain,
  // and buff, not a conveyor of disposable summons. A keeper has a long stay
  // and never needs feeding (no feedKey → the feed gate always reads it as
  // fed), so it sticks around to be invested in. Buffs from Basic Training
  // (slot.attackBonus / slot.blockBonus) are PERMANENT for that summon — lose
  // the keeper (maul, sacrifice, expiry) and you lose the investment.
  // See memory: project_wg_handler_team_retool.
  // ─────────────────────────────────────────────────────────────────────
  // The Anchor — the first defensive keeper. Grants a set Block EACH TURN
  // (resets like player Block), and that per-turn grant is buffable. Devote
  // one slot to the wall; strengthen it; fight out of the other two.
  ox: {
    name: 'Drystone Ox',
    icon: '🐂',
    attack: 2,
    attackPool: 'composure',
    duration: 6,        // keeper: long stay so you can invest in it
    keeper: true,
    turnGrant: { block: 6 },
    flavor: 'It was here before you. It will be here after. It is, in the meantime, in the way.',
    desc: 'A keeper. Stays 6 turns and never needs feeding. Braces for 6 Block each turn and chips 2 composure. Strengthen it to grow the wall — and the swing.',
    upgrade: { attack: 3, duration: 7, turnGrant: { block: 9 } },
  },
};

// ─────────────────────────────────────────────────────────────────────
// ADJACENCY COMBOS (Alan, 2026-06-02)
// ─────────────────────────────────────────────────────────────────────
// When two specific species sit in ADJACENT stage slots, they perform a
// joint special attack — once per pair-type per turn, every turn the pair
// holds. Animals can't be repositioned (they land where the lure was
// placed), so lining up a combo is a planned-but-luck-influenced payoff.
// Each combo is the convergence target of the lure-narrowing skill: narrow
// a multi-species lure down to its two combo species and the pair becomes
// reliable. Pairs are chosen to NOT collide with the eat-adjacent pre-passes
// (bear↔salmon, raptor↔prey).
//
// Mirrored as a pre-pass in BOTH App.jsx (end-of-turn tick) and
// sim/playSimV2.js. `a`/`b` are unordered. Effect keys: damage/pool (the
// special attack), plus optional applyWeak / applyVulnerable / draw / block.
export const ADJACENCY_COMBOS = [
  {
    a: 'field-mouse', b: 'rabbit',
    name: 'Warren Rush', icon: '🐭',
    damage: 6, pool: 'composure', draw: 1,
    desc: 'Field Mouse beside Rabbit: a scurrying rush for 6 composure and draw 1.',
  },
  {
    a: 'goose', b: 'raven',
    name: 'Fowl Play', icon: '🪿',
    damage: 8, pool: 'composure', applyWeak: 1,
    desc: 'Goose beside Raven: a mobbing for 8 composure and Weak 1.',
  },
];
