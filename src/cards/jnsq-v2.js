// Jnsq lane v2 — The Fool's deck. 75 cards.
//
// Voice: Kramer / Charlie Kelly. Non-sequiturs, mystical references,
// cosmic timing claims, theatrical asides.
// Tags: mystical, absurd, chaotic, theatrical, conspiratorial.

const LANE = 'jnsq';

// =============================================================================
// INTROS (25)
// =============================================================================

const INTROS = [
  // ---- Basic (5) ----
  { id: 'jv2-i-speaking-of', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Speaking of which,', tags: ['chaotic', 'conspiratorial'], stats: { jnsq: 2 },
    flavor: "You weren't speaking of anything. That's the point." },
  { id: 'jv2-i-astrally', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Astrally,', tags: ['mystical', 'theatrical'], stats: { jnsq: 2 },
    effects: { draw: 1 },
    flavor: 'The astral plane is involved. Bring a sweater.' },
  { id: 'jv2-i-on-a-tuesday', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'On a Tuesday,', tags: ['chaotic', 'absurd'], stats: { jnsq: 2 },
    flavor: 'Which Tuesday: any. All. The concept itself.' },
  { id: 'jv2-i-now', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Now,', tags: ['theatrical', 'chaotic'], stats: { jnsq: 2 },
    flavor: 'Now is a long time in jnsq.' },
  { id: 'jv2-i-funny-thing', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Funny thing —', tags: ['conspiratorial', 'chaotic'], stats: { jnsq: 2 },
    effects: { vulnerable: 1 },
    flavor: 'It will not be funny. It will be a thing.' },

  // ---- Common (12) ----
  { id: 'jv2-i-remiss-not-mention', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'It would be remiss not to mention', tags: ['theatrical', 'conspiratorial'], stats: { jnsq: 2 },
    flavor: 'Remiss being a word from the dictionary nobody uses.' },
  { id: 'jv2-i-third-moon', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'The third moon would tell you', tags: ['mystical', 'conspiratorial'], stats: { jnsq: 2 },
    flavor: "There are three. You haven't been paying attention." },
  { id: 'jv2-i-speaking-of-nine', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Speaking of nine, which I was,', tags: ['chaotic', 'absurd'], stats: { jnsq: 2 },
    flavor: "You weren't. You also haven't been speaking. Doesn't matter." },
  { id: 'jv2-i-trace-orbit', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'If you trace the orbit,', tags: ['mystical', 'theatrical'], stats: { jnsq: 2 },
    flavor: 'Orbit being a verb, in the right dialect.' },
  { id: 'jv2-i-not-saying-lentils', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "Now I'm not saying it was the lentils,", tags: ['conspiratorial', 'absurd'], stats: { jnsq: 2 },
    effects: { draw: 1 },
    flavor: 'But.' },
  { id: 'jv2-i-between-you-void', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Between you and the void,', tags: ['mystical', 'theatrical'], stats: { jnsq: 2 },
    flavor: 'Two parties. One participant.' },
  { id: 'jv2-i-morning-side', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'On the morning side of yesterday,', tags: ['chaotic', 'mystical'], stats: { jnsq: 2 },
    flavor: 'Yesterday has, on inspection, sides. This is the one.' },
  { id: 'jv2-i-birds-arent-real', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "If we agree that birds aren't real,", tags: ['conspiratorial', 'absurd'], stats: { jnsq: 2 },
    flavor: 'The if is the only honest part.' },
  { id: 'jv2-i-cat-standards', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'By the standards of the cat,', tags: ['mystical', 'absurd'], stats: { jnsq: 2 },
    flavor: 'The cat has standards. The cat has, in fact, only standards.' },
  { id: 'jv2-i-certain-angle', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'From a certain angle,', tags: ['theatrical', 'chaotic'], stats: { jnsq: 2 },
    flavor: 'Angles are involved. Geometry, for once, agrees.' },
  { id: 'jv2-i-backwards-keyhole', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Backwards through the keyhole,', tags: ['theatrical', 'absurd'], stats: { jnsq: 2 },
    flavor: 'Forwards being the way ordinary people go.' },
  { id: 'jv2-i-walk-with-me', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Walk with me on this:', tags: ['conspiratorial', 'theatrical'], stats: { jnsq: 2 },
    effects: { block: 2 },
    flavor: 'Walking being, here, a metaphor for staying very still.' },

  // ---- Uncommon (6) ----
  { id: 'jv2-i-seventh-nothing', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'It is, of course, the seventh of nothing,', tags: ['mystical', 'absurd'], stats: { jnsq: 3 },
    flavor: 'The of course doing most of the heavy lifting.' },
  { id: 'jv2-i-momentary-tangent', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "If you'd permit me a momentary tangent and a hat,", tags: ['theatrical', 'chaotic'], stats: { jnsq: 3 },
    flavor: 'The hat will come later. Or earlier. Recently.' },
  { id: 'jv2-i-read-in-dream', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "I read this in a dream and I'm pretty sure it counts,", tags: ['conspiratorial', 'mystical'], stats: { jnsq: 3 },
    flavor: 'The dream had footnotes. The footnotes had footnotes. It was a thorough dream.' },
  { id: 'jv2-i-horse-knows', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "Now imagine, if you will, a horse that knows it's a horse,", tags: ['theatrical', 'absurd'], stats: { jnsq: 3 },
    flavor: 'The horse is incidental. The knowing is the verb.' },
  { id: 'jv2-i-dont-ask-how-i-know', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "Look — and don't ask me how I know this —", tags: ['conspiratorial', 'theatrical'], stats: { jnsq: 3 },
    flavor: "The answer to how is, often, the lentils. We don't discuss the lentils." },
  { id: 'jv2-i-three-tuesdays-locally', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Three Tuesdays ago, but only locally,', tags: ['chaotic', 'mystical'], stats: { jnsq: 3 },
    flavor: 'The locally is doing all the work. Globally, no Tuesdays.' },

  // ---- Rare (2) ----
  { id: 'jv2-i-kitchen-sacred', slot: 'intro', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'By the slow rotation of the kitchen, which is sacred,', tags: ['mystical', 'conspiratorial', 'theatrical'], stats: { jnsq: 4 },
    flavor: 'The kitchen has been rotating since you arrived. Slowly. Nobody else noticed.' },
  { id: 'jv2-i-moon-disagrees', slot: 'intro', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: "And here's the part where the moon usually disagrees with me, but —", tags: ['mystical', 'theatrical'], stats: { jnsq: 4 },
    flavor: 'The moon has, today, been overruled.' },
  // v2.12: CHAOS DICE synergy — rerolls 1s and 2s.
  { id: 'jv2-i-feeling-about-this', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'I have a feeling about this —', tags: ['conspiratorial', 'mystical'],
    stats: { jnsq: 2 }, diceReroll: { onResults: [1, 2] },
    desc: 'If chaos roll lands 1 or 2 on this cast, reroll once.',
    flavor: 'The feeling is mostly right. Mostly.' },
];

// =============================================================================
// SUBJECTS (25)
// =============================================================================

const SUBJECTS = [
  // ---- Basic (5) ----
  { id: 'jv2-s-your-aura', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'your aura', tags: ['mystical'], stats: { jnsq: 2 },
    flavor: 'The aura is doing things. We will discuss what.' },
  { id: 'jv2-s-the-moon', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'the moon', tags: ['mystical', 'theatrical'], stats: { jnsq: 2 },
    flavor: 'The moon is involved. The moon is always involved.' },
  { id: 'jv2-s-this-afternoon', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'this whole afternoon', tags: ['chaotic'], stats: { jnsq: 2 },
    flavor: 'Afternoons being, in jnsq, structurally suspect.' },
  { id: 'jv2-s-the-rug', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'the rug', tags: ['absurd', 'theatrical'], stats: { jnsq: 2 },
    effects: { block: 2 },
    flavor: 'The rug knows what it did.' },
  { id: 'jv2-s-the-situation', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'the situation', tags: ['conspiratorial', 'theatrical'], stats: { jnsq: 2 },
    flavor: 'Said with the gravity of a man who reads paint labels.' },

  // ---- Common (12) ----
  { id: 'jv2-s-third-cousin', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the third cousin of your argument', tags: ['chaotic', 'conspiratorial'], stats: { jnsq: 2 },
    flavor: 'Family resemblance is light. The reasoning was at a different wedding.' },
  { id: 'jv2-s-your-timing', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your timing', tags: ['mystical', 'theatrical'], stats: { jnsq: 2 },
    flavor: 'Timing being a measurement only loosely related to clocks.' },
  { id: 'jv2-s-the-calendar', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the calendar', tags: ['mystical', 'absurd'], stats: { jnsq: 2 },
    flavor: 'The calendar has opinions. They are not your opinions.' },
  { id: 'jv2-s-face-that-lies', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the part of your face that lies', tags: ['theatrical', 'absurd'], stats: { jnsq: 2 },
    flavor: 'That part. The other parts may be considered later.' },
  { id: 'jv2-s-this-month-concept', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'this entire month, as a concept', tags: ['mystical', 'theatrical'], stats: { jnsq: 2 },
    flavor: 'Concepts being negotiable. Months less so. The combination: unstable.' },
  { id: 'jv2-s-small-mistakes-shadow', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the small mistakes your shadow keeps making', tags: ['mystical', 'conspiratorial'], stats: { jnsq: 2 },
    flavor: "Your shadow has been busy. We've been keeping track." },
  { id: 'jv2-s-ambient-noise', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "the ambient noise you've been generating", tags: ['theatrical'], stats: { jnsq: 2 },
    flavor: 'Generating being a verb of involuntary production.' },
  { id: 'jv2-s-hands-admitting', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'what your hands have been admitting', tags: ['conspiratorial', 'mystical'], stats: { jnsq: 2 },
    flavor: 'The hands have, in private, said too much.' },
  { id: 'jv2-s-cosmic-ledger', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the cosmic ledger', tags: ['mystical', 'conspiratorial'], stats: { jnsq: 2 },
    flavor: 'The ledger exists. It is large. You are in it.' },
  { id: 'jv2-s-yesterday-version', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "yesterday's version of you", tags: ['chaotic', 'mystical'], stats: { jnsq: 2 },
    flavor: "Yesterday's was, frankly, taller. We don't talk about this in public." },
  { id: 'jv2-s-walk-into-rooms', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the way you walk into rooms', tags: ['theatrical', 'absurd'], stats: { jnsq: 2 },
    flavor: 'Walking being a martial art with practitioners and amateurs.' },
  { id: 'jv2-s-eyebrows-say', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the things your eyebrows say', tags: ['theatrical', 'absurd'], stats: { jnsq: 2 },
    flavor: 'The eyebrows have been editorial. The page count is climbing.' },
  // v2.7: NOVEL — Tier Wildcard. This card counts as the highest tier
  // among the other staged cards for spell-tier calculation. A T2-only
  // hand becomes T3-eligible if THIS is the subject. Strategic flex.
  { id: 'jv2-s-sideways-situation', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'this whole sideways situation', tags: ['chaotic', 'mystical'], stats: { jnsq: 3 },
    tierWildcard: true,
    flavor: 'Sideways being the geometry of the truly committed.' },
  // v2.7: NOVEL — Intent Reveal. On stage, peek the enemy's next intent
  // (after the one currently showing). Tactical info card.
  { id: 'jv2-s-next-thing-youll-do', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "the next thing you'll do", tags: ['conspiratorial', 'mystical'], stats: { jnsq: 3 },
    effects: { revealNextIntent: 1 },
    flavor: 'The next thing being not, perhaps, the thing you intended.' },

  // ---- Uncommon (6) ----
  { id: 'jv2-s-small-dog', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the very small dog of your reasoning', tags: ['absurd', 'chaotic'], stats: { jnsq: 3 },
    flavor: 'Small dogs are dogs. Reasoning, less reliably.' },
  { id: 'jv2-s-slow-song-subconscious', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the slow song your subconscious has been humming', tags: ['mystical', 'theatrical'], stats: { jnsq: 3 },
    flavor: 'The song has lyrics. The lyrics are about the subject. Not flatteringly.' },
  { id: 'jv2-s-patient-stupidity', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the patient stupidity of the moment', tags: ['chaotic', 'theatrical'], stats: { jnsq: 3 },
    flavor: 'Patient because it has, frankly, all night.' },
  { id: 'jv2-s-seven-curtains', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the seven hidden assumptions of the curtains', tags: ['mystical', 'absurd', 'conspiratorial'], stats: { jnsq: 3 },
    flavor: 'The curtains know. The curtains have always known.' },
  { id: 'jv2-s-fate-wrong-invoice', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the way your fate keeps showing up on the wrong invoice', tags: ['mystical', 'chaotic'], stats: { jnsq: 3 },
    flavor: 'Fate has been miscoded. Accounting has been informed. Accounting does not care.' },
  { id: 'jv2-s-not-having-yet', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "the conversation we're not having yet but will", tags: ['conspiratorial', 'theatrical'], stats: { jnsq: 3 },
    flavor: 'The future tense is the only honest one available.' },

  // ---- Rare (2) ----
  { id: 'jv2-s-geometric-impossibility', slot: 'subject', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'the geometric impossibility of you, right now, here, in this configuration', tags: ['mystical', 'theatrical', 'absurd'], stats: { jnsq: 4 },
    flavor: 'Geometry, like the bouncer, has been called.' },
  { id: 'jv2-s-universe-preparing-mention', slot: 'subject', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'everything the universe has been very patiently preparing to mention', tags: ['mystical', 'conspiratorial', 'theatrical'], stats: { jnsq: 4 },
    flavor: 'Patience having an end. This end is approximately now.' },
];

// =============================================================================
// TARGETS (15)
// =============================================================================

const TARGETS = [
  // ---- Common (5) ----
  // v2.9: jnsq common bases bumped (was 2/2/5/5/6 avg 4 — significantly
  // below chutzpah's avg 6, which combined with act-2's jnsq×0.5 made the
  // lane unviable). New avg matches the other two lanes.
  { id: 'jv2-t-wrong-color', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'is the wrong color.', tags: ['absurd'],
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 3, damageType: 'composure',
              perLaneTag: { tags: ['absurd', 'chaotic'], bonus: 2 } },
    flavor: 'Color being, on inspection, definite.' },
  { id: 'jv2-t-owes-nothing', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'owes you nothing.', tags: ['mystical'],
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 3, damageType: 'composure',
              perLaneTag: { tags: ['mystical', 'conspiratorial'], bonus: 2 } },
    flavor: 'Debts being, in this currency, a private matter.' },
  { id: 'jv2-t-forgotten-name', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'has forgotten its own name.', tags: ['mystical', 'absurd'],
    effect: { scaleBy: 'jnsq', base: 7, multiplier: 3, damageType: 'composure', drawAfterCast: 1 },
    flavor: 'Names being a function of being seen by the right people.' },
  { id: 'jv2-t-levitating', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'is, frankly, levitating.', tags: ['theatrical', 'absurd'],
    effect: { scaleBy: 'jnsq', base: 7, multiplier: 3, damageType: 'composure', rider: { vulnerable: 1 } },
    flavor: 'Frankly being a word that, here, carries no weight. Like the subject.' },
  { id: 'jv2-t-not-from-here', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: "isn't even from around here.", tags: ['mystical'],
    effect: { scaleBy: 'jnsq', base: 8, multiplier: 3, damageType: 'composure' },
    flavor: 'Origin being a question with, in this case, an unsatisfying answer.' },

  // ---- Uncommon (6) ----
  { id: 'jv2-t-read-backwards', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is being read backwards by the moon.', tags: ['mystical', 'theatrical'],
    effect: { scaleBy: 'jnsq', base: 7, multiplier: 3, damageType: 'composure', rider: { weak: 1 } },
    flavor: 'The moon reads. The moon has, increasingly, opinions.' },
  { id: 'jv2-t-wrong-legs', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'has the wrong number of legs for that opinion.', tags: ['absurd', 'chaotic'],
    effect: { scaleBy: 'jnsq', base: 8, multiplier: 3, damageType: 'composure' },
    flavor: 'Opinions and legs being, in jnsq cosmology, related quantities.' },
  { id: 'jv2-t-cat-warned', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is what the cat warned us about.', tags: ['mystical', 'conspiratorial'],
    effect: { scaleBy: 'jnsq', base: 8, multiplier: 2, damageType: 'composure', rider: { vulnerable: 1 } },
    flavor: 'The cat has been right before. The cat will be right again.' },
  { id: 'jv2-t-never-invited', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'was never properly invited.', tags: ['theatrical'],
    effect: { scaleBy: 'jnsq', base: 9, multiplier: 2, damageType: 'composure' },
    flavor: 'Proper invitations being a niche art.' },
  { id: 'jv2-t-third-tuesday', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is exactly what the third Tuesday looks like.', tags: ['chaotic', 'absurd'],
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 3, damageType: 'composure',
              perLaneTag: { tags: ['chaotic', 'absurd', 'mystical'], bonus: 3 } },
    flavor: 'Tuesdays having visual qualities, once you start looking.' },
  { id: 'jv2-t-become-goose', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'has, somehow, become a goose.', tags: ['absurd', 'theatrical'],
    effect: { scaleBy: 'jnsq', base: 9, multiplier: 2, damageType: 'composure', rider: { weak: 1 } },
    flavor: 'The somehow is the part the enemy is going to dwell on for years.' },

  // ---- Rare (4) ----
  { id: 'jv2-t-problem-for-bees', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is now a problem for the bees.', tags: ['absurd', 'chaotic', 'mystical'],
    effect: { scaleBy: 'jnsq', base: 10, multiplier: 3, damageType: 'composure', rider: { vulnerable: 2 } },
    flavor: "The bees are, technically, the local authority. Don't argue." },
  { id: 'jv2-t-lies-down-refuses', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is the part of the sentence that lies down and refuses.', tags: ['theatrical', 'absurd'],
    effect: { scaleBy: 'jnsq', base: 12, multiplier: 3, damageType: 'composure', tier3Double: true },
    flavor: 'Sentences have, in jnsq, anatomy. This is the spine.' },
  { id: 'jv2-t-explained-rocks', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is being slowly explained to the rocks.', tags: ['mystical', 'theatrical', 'conspiratorial'],
    effect: { scaleBy: 'jnsq', base: 11, multiplier: 3, damageType: 'composure' },
    flavor: 'The rocks are listening. The rocks have, frankly, been listening for years.' },
  { id: 'jv2-t-religion-france', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 3, type: 'effect',
    phrase: 'has, in the way these things do, become a small religion in southern France.', tags: ['absurd', 'chaotic', 'mystical'],
    effect: { scaleBy: 'jnsq', base: 14, multiplier: 3, damageType: 'composure',
             requiresTier3: { failureDamageMult: 0.5, exhaustOnFail: true } },
    flavor: 'Southern France being, as everyone now knows, susceptible.' },
  // v2.12: CHAOS DICE targets.
  { id: 'jv2-t-go-interesting', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: "is going to go interesting.", tags: ['mystical', 'chaotic'],
    effect: { scaleBy: 'jnsq', base: 6, multiplier: 3, damageType: 'composure',
              alwaysRolls: true, rollDamageScale: 1.5 },
    desc: 'Cast: 6 + Jnsq comp. Always rolls. Roll multiplier 1.5× stronger.',
    flavor: 'Interesting being a word doing a lot of work today.' },
  { id: 'jv2-t-cosmic-recoil', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is the cosmic recoil.', tags: ['mystical', 'theatrical', 'absurd'],
    effect: { scaleBy: 'jnsq', base: 22, multiplier: 3, damageType: 'composure',
              requiresPriorRoll: 6 },
    desc: 'REQUIRES a prior 6 rolled this combat. 22 + Jnsq comp.',
    flavor: 'The cosmos owes you. The cosmos has receipts. The cosmos pays.' },
];

// =============================================================================
// MODIFIERS (10)
// =============================================================================

const MODIFIERS = [
  // ---- Common (4) ----
  { id: 'jv2-m-cosmic-sense', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'modifier',
    modifierKind: 'pre', phrase: 'In a cosmic sense,', tags: ['mystical'], stats: { jnsq: 1 },
    modifierEffect: { addsTag: 'mystical' },
    flavor: 'Cosmic being a measurement of seriousness, not size.' },
  { id: 'jv2-m-allegedly', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'post', phrase: '— allegedly,', tags: ['conspiratorial'],
    modifierEffect: { addsTag: 'conspiratorial', rider: { weak: 1 } },
    flavor: 'Allegedly being a verb in disguise.' },
  { id: 'jv2-m-weirdly-enough', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'pre', phrase: 'Weirdly enough,', tags: ['chaotic'],
    modifierEffect: { addsTag: 'chaotic', drawAfterCast: 1 },
    flavor: 'Weirdness being, in jnsq, the price of admission.' },
  { id: 'jv2-m-didnt-hear-from-me', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'post', phrase: "— you didn't hear it from me.", tags: ['conspiratorial'],
    modifierEffect: { addsTag: 'conspiratorial', conditionalMult: { tier2Plus: 1.5 } },
    flavor: 'The disavowal is, here, the most honest part of the speech.' },

  // ---- Uncommon (4) ----
  { id: 'jv2-m-whispers-lamp', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'replaces-intro', phrase: '(whispers to the lamp,)', tags: ['theatrical', 'mystical'],
    modifierEffect: { addsTag: 'theatrical', rider: { vulnerable: 1 } },
    flavor: 'The lamp has, on several occasions, given useful counsel.' },
  { id: 'jv2-m-bees-agree', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: '— the bees agree,', tags: ['absurd', 'mystical'],
    modifierEffect: { addsTag: 'mystical', damageMult: 1.5 },
    flavor: 'The bees vote. The bees have always voted.' },
  { id: 'jv2-m-unwraps-object', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'pre', phrase: '(unwraps a small object,)', tags: ['theatrical', 'chaotic'],
    modifierEffect: { addsTag: 'theatrical', stripEnemyBlock: 2, rider: { vulnerable: 1 } },
    flavor: 'The object was always there. You just didn\'t see it. Few do.' },
  { id: 'jv2-m-also-moon', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: '— also, the moon,', tags: ['mystical'],
    modifierEffect: { perLaneTag: { tags: ['mystical'], bonus: 2 } },
    flavor: 'The moon being, in jnsq combat, a multiplier.' },

  // ---- Rare (2) ----
  { id: 'jv2-m-lentils-clear', slot: 'modifier', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: '— as the lentils made clear,', tags: ['conspiratorial', 'absurd'],
    modifierEffect: { tier3Payoff: { damageMult: 2.0, rider: { weak: 2 } } },
    flavor: 'The lentils are, on this question, unanimous.' },
  { id: 'jv2-m-becomes-stork', slot: 'modifier', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'pre', phrase: '(briefly, becomes a stork,)', tags: ['theatrical', 'absurd', 'mystical'],
    modifierEffect: { addsTag: 'theatrical', damageMult: 2.0, rider: { vulnerable: 2 } },
    flavor: 'The stork is brief. The implication, lasting.' },
  // Defensive modifier — block on cast.
  { id: 'jv2-m-behind-lamp', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'pre', phrase: '(hides briefly behind a lamp,)', tags: ['theatrical', 'absurd'],
    modifierEffect: { addsTag: 'theatrical', rider: { block: 4 } },
    flavor: 'The lamp is, in this matter, complicit.' },
];

// v2.5/2.6: gestures, pontifications, quips.
const GESTURES = [
  { id: 'jv2-g-three-snaps', slot: 'gesture', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'gesture',
    phrase: '(snaps three times,)', tags: ['theatrical', 'mystical'],
    gestureEffect: { icon: '✨', damage: 4, damageType: 'composure', trayMultiplier: 1, draw: 1, exhaust: true },
    flavor: 'Three. Always three. The reasons are sacred and absurd.' },
  // v2.6: Pontification — long mystical monologue, non-exhaust.
  { id: 'jv2-g-pontificate', slot: 'gesture', tier: 2, rarity: 'uncommon', lane: LANE, cost: 3, type: 'gesture',
    phrase: 'Now imagine, hypothetically, but stay with me —', tags: ['mystical', 'conspiratorial'],
    gestureEffect: { icon: '🌀', damage: 10, damageType: 'composure', trayMultiplier: 2, draw: 2, exhaust: false },
    flavor: 'The hypothetical lasts thirteen minutes. The body, somewhat longer.' },
  // v2.6: Quip — light damage + persistent vulnerable.
  { id: 'jv2-g-quip-koan', slot: 'gesture', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'gesture',
    phrase: '(quip-koan: "is a stork a borrowed neck?")', tags: ['absurd', 'mystical'],
    gestureEffect: { icon: '🦢', damage: 4, damageType: 'composure', rider: { vulnerable: 2 }, exhaust: false },
    flavor: 'The koan is bad. The vulnerability of being asked it is real.' },
];

// v2.6: Modifiers for jnsq.
const NEW_MODIFIERS_V26 = [
  { id: 'jv2-m-say-again', slot: 'modifier', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: '— as the moon would have me say again,', tags: ['mystical', 'theatrical'],
    modifierEffect: { damageMult: 2.0 },
    flavor: 'The moon is, frankly, on a roll.' },
  // v2.12: CHAOS DICE modifiers.
  { id: 'jv2-m-universe-rolls', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'modifier',
    modifierKind: 'post', phrase: '— and the universe rolls a die,',
    tags: ['chaotic', 'mystical'], stats: { jnsq: 1 },
    modifierEffect: { forceRoll: true },
    desc: 'Forces a chaos roll on this cast, no opt-in required.',
    flavor: 'The universe needs an opinion. The universe has one.' },
  { id: 'jv2-m-loaded-dice', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'post', phrase: '— with loaded dice,', tags: ['conspiratorial', 'absurd'],
    stats: { jnsq: 1 }, modifierEffect: { diceShift: 1 },
    desc: 'Your chaos roll on this cast is +1 (caps at 6).',
    flavor: 'Loaded in your favor, technically. Loaded all the same.' },
];

// v2.5: UNIQUE TARGET — damage scales with the player's deck size, the
// "weirdness compounds" jnsq identity.
const UNIQUE_TARGETS = [
  { id: 'jv2-t-too-many-things', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'has become too many things at once.', tags: ['absurd', 'chaotic', 'mystical'],
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 2, damageType: 'composure', perDeckCard: 0.5 },
    flavor: 'It is, simultaneously, six things. Most of which are weather.' },
];

export const JNSQ_V2 = [...INTROS, ...SUBJECTS, ...TARGETS, ...MODIFIERS, ...NEW_MODIFIERS_V26, ...GESTURES, ...UNIQUE_TARGETS];
export const JNSQ_V2_BY_SLOT = {
  intro: INTROS, subject: SUBJECTS, target: [...TARGETS, ...UNIQUE_TARGETS], modifier: [...MODIFIERS, ...NEW_MODIFIERS_V26], gesture: GESTURES,
};
