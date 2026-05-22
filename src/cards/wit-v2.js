// Wit lane v2 — The Scholar's deck. 75 cards.
//
// 25 intros + 25 subjects + 15 targets + 10 modifiers.
// Each card has slot/tier/rarity/lane fields; see shared.js for the schema.

const LANE = 'wit';

// =============================================================================
// INTROS (25) — set the rhetorical move; carry their own connector.
// =============================================================================

const INTROS = [
  // ---- Basic (5) — cost 0, +1 wit, tier 1 ----
  { id: 'wv2-i-frankly', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Frankly,', tags: ['dismissive', 'cutting'], stats: { wit: 2 },
    flavor: 'The dictionary definition of confidence preceded by a comma.' },
  { id: 'wv2-i-actually', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Actually,', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    effects: { draw: 1 },
    flavor: "You haven't even said anything yet, but here we are." },
  { id: 'wv2-i-honestly', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Honestly,', tags: ['observational', 'cutting'], stats: { wit: 2 },
    effects: { block: 2 },
    flavor: 'Honesty has never been the issue.' },
  { id: 'wv2-i-truly', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Truly,', tags: ['observational', 'dismissive'], stats: { wit: 2 },
    flavor: "Said with the gravity of someone who knows they've said it before." },
  { id: 'wv2-i-curiously', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Curiously,', tags: ['observational', 'ironic'], stats: { wit: 2 },
    flavor: 'Curiosity is, of course, the polite name for it.' },

  // ---- Common (12) — cost 0, +2 wit, tier 1 ----
  { id: 'wv2-i-strikes-me', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'It strikes me that', tags: ['observational', 'dismissive'], stats: { wit: 2 },
    flavor: 'The strike is yours. The me is not.' },
  { id: 'wv2-i-i-should-think', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'I should think that', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    flavor: 'Should-think being a softer cousin of must-acknowledge.' },
  { id: 'wv2-i-pardon-saying', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Pardon my saying,', tags: ['academic', 'observational'], stats: { wit: 2 },
    flavor: 'You will not pardon it. That is rather the point.' },
  { id: 'wv2-i-strictly-speaking', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Strictly speaking,', tags: ['academic', 'cutting'], stats: { wit: 2 },
    effects: { weak: 1 },
    flavor: 'Strictness is, today, a virtue worth performing.' },
  { id: 'wv2-i-memory-serves', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'If memory serves,', tags: ['academic', 'ironic'], stats: { wit: 2 },
    flavor: 'Memory is serving. The food is leftovers.' },
  { id: 'wv2-i-by-any-measure', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'By any measure,', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    flavor: 'Most measures, anyway. Certainly the kind one.' },
  { id: 'wv2-i-speaking-plainly', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Speaking plainly,', tags: ['cutting', 'observational'], stats: { wit: 2 },
    effects: { vulnerable: 1 },
    flavor: 'Plainness is the most decorated of the rhetorical arts.' },
  { id: 'wv2-i-or-rather', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Or rather,', tags: ['observational', 'ironic'], stats: { wit: 2 },
    effects: { draw: 1 },
    flavor: 'The revision is the point. The original was scaffolding.' },
  { id: 'wv2-i-it-would-appear', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'It would appear that', tags: ['observational', 'dismissive'], stats: { wit: 2 },
    flavor: 'Appearances, in matters like this, are the entire substance.' },
  { id: 'wv2-i-being-honest', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "If we're being honest,", tags: ['dismissive', 'cutting'], stats: { wit: 2 },
    effects: { draw: 1, loseHp: 1 },
    flavor: 'The we is presumptuous. It always is.' },
  { id: 'wv2-i-one-could-argue', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'One could argue that', tags: ['academic', 'ironic'], stats: { wit: 2 },
    flavor: "One could. One won't have to." },
  { id: 'wv2-i-let-the-record', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Let the record show that', tags: ['academic'], stats: { wit: 2 },
    flavor: 'There is no record. The phrasing is the record.' },

  // ---- Uncommon (6) — cost 1, +3 wit, tier 2 ----
  { id: 'wv2-i-permit-me-observe', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Permit me to observe that', tags: ['academic', 'observational'], stats: { wit: 3 },
    flavor: 'Observation, in this dialect, is a verb that lands.' },
  { id: 'wv2-i-charitable', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Were I being charitable,', tags: ['ironic', 'dismissive'], stats: { wit: 3 },
    flavor: 'Charity is a discipline. You may not be ready for it.' },
  { id: 'wv2-i-setting-aside', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Setting aside the obvious,', tags: ['academic', 'cutting'], stats: { wit: 3 },
    flavor: 'The obvious is a heavy thing. You leave it on the table for now.' },
  { id: 'wv2-i-if-records-trusted', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'If the records can be trusted,', tags: ['academic', 'ironic'], stats: { wit: 3 },
    flavor: 'They can. That is, in fact, the worst part.' },
  { id: 'wv2-i-put-generously', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'To put it generously,', tags: ['ironic', 'dismissive'], stats: { wit: 3 },
    flavor: 'Generosity, here, is an act of restraint. Witnessed.' },
  { id: 'wv2-i-purely-analytical', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'From a purely analytical perspective,', tags: ['academic', 'observational'], stats: { wit: 3 },
    flavor: 'The analysis is purely a courtesy. The conclusion arrived earlier.' },

  // ---- Rare (2) — cost 2, +4 wit, tier 3 ----
  { id: 'wv2-i-reasonable-observer', slot: 'intro', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'By the standards of any reasonable observer,', tags: ['academic', 'cutting'], stats: { wit: 4 },
    flavor: 'Reasonable observers are a small population. You are, suddenly, one.' },
  { id: 'wv2-i-full-possession', slot: 'intro', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'And I say this with full possession of the facts,', tags: ['academic', 'cutting'], stats: { wit: 4 },
    flavor: 'The facts have been alphabetized. Indexed. Cross-referenced. Their footnotes have footnotes.' },
];

// =============================================================================
// SUBJECTS (25) — noun phrase; what the sentence is about.
// =============================================================================

const SUBJECTS = [
  // ---- Basic (5) ----
  { id: 'wv2-s-your-reasoning', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'your reasoning', tags: ['academic', 'observational'], stats: { wit: 2 },
    flavor: 'Reasoning, in this case, having done its part by trying.' },
  { id: 'wv2-s-this-argument', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'this argument', tags: ['academic', 'observational'], stats: { wit: 2 },
    flavor: 'The argument, taken on its own terms, having arrived too sure of itself.' },
  { id: 'wv2-s-your-conclusion', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'your conclusion', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    flavor: "The conclusion is the part that didn't survive the road." },
  { id: 'wv2-s-your-sources', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'your sources', tags: ['academic', 'cutting'], stats: { wit: 2 },
    effects: { weak: 1 },
    flavor: "Where they go is not, strictly, anyone's concern. But they go somewhere." },
  { id: 'wv2-s-the-matter', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'the matter at hand', tags: ['observational'], stats: { wit: 2 },
    flavor: 'The matter has been at hand for some time. It is patient.' },

  // ---- Common (12) ----
  { id: 'wv2-s-your-dissertation', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your dissertation', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    flavor: 'Bound, defended, and from this distance — undamaged.' },
  { id: 'wv2-s-this-entire-enterprise', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'this entire enterprise', tags: ['dismissive', 'observational'], stats: { wit: 2 },
    flavor: 'The word entire being asked to do unusual lifting today.' },
  { id: 'wv2-s-the-very-premise', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the very premise', tags: ['academic', 'cutting'], stats: { wit: 2 },
    flavor: 'Very is the most generous adverb in the philosophical lexicon.' },
  { id: 'wv2-s-your-standards', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your standards', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    flavor: 'They are, at the very least, your own.' },
  { id: 'wv2-s-your-taste', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your taste', tags: ['observational', 'cutting'], stats: { wit: 2 },
    effects: { vulnerable: 1 },
    flavor: 'Taste is a private matter that has, unfortunately, become public.' },
  // v2.7: NOVEL — Tag Amplifier. When in tray, perLaneTag/perSharedTag
  // bonuses on the cast are DOUBLED. Rewards committed tag-cohesive decks.
  { id: 'wv2-s-sheer-academic', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the sheer academic of the thing', tags: ['academic', 'cutting'], stats: { wit: 3 },
    tagAmpMult: 2,
    flavor: 'Academic, here, being a verb. Spoken academically.' },
  // v2.7: NOVEL — Block Steal. On stage, strip 5 enemy block and gain 3
  // player block. Aggressive-defensive hybrid.
  { id: 'wv2-s-your-hidden-defenses', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your hidden defenses', tags: ['observational', 'cutting'], stats: { wit: 3 },
    effects: { stealBlock: { strip: 5, gain: 3 } },
    flavor: "The defenses, on inspection, were ornamental. Useful to neither party." },
  { id: 'wv2-s-the-syllabus', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the syllabus', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    effects: { draw: 1 },
    flavor: 'A reading list, in the older and more honest sense.' },
  { id: 'wv2-s-the-bibliography', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "the bibliography you've assembled", tags: ['academic', 'ironic'], stats: { wit: 2 },
    flavor: 'Assembled, here, being a polite word for collected and shrugged at.' },
  { id: 'wv2-s-your-central-thesis', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your central thesis', tags: ['academic', 'cutting'], stats: { wit: 2 },
    flavor: 'Centrality is a function of geometry. Theses, of bone structure.' },
  { id: 'wv2-s-foundation', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the very foundation of your argument', tags: ['academic'], stats: { wit: 2 },
    flavor: 'Foundations being load-bearing is, again, a generous reading.' },
  { id: 'wv2-s-your-methodology', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your methodology', tags: ['academic'], stats: { wit: 2 },
    flavor: 'Method, ology, and the silence between them.' },
  { id: 'wv2-s-so-called-proof', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'this so-called proof', tags: ['academic', 'ironic'], stats: { wit: 2 },
    flavor: 'So-called by the kindest among us. The rest have other words.' },
  { id: 'wv2-s-conclusions-drawn', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "the conclusions you've drawn", tags: ['academic', 'observational'], stats: { wit: 2 },
    flavor: 'Drawn the way water is — that is, with effort, and not for long.' },

  // ---- Uncommon (6) ----
  { id: 'wv2-s-elaborate-edifice', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the elaborate edifice of your reasoning', tags: ['academic', 'ironic'], stats: { wit: 3 },
    flavor: 'Elaborate, in architecture, often signals load-bearing fashion.' },
  { id: 'wv2-s-studied-opacity', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the studied opacity of your prose', tags: ['academic', 'cutting'], stats: { wit: 3 },
    flavor: 'Opacity, when studied, becomes a style. A bad one.' },
  { id: 'wv2-s-quietly-imported', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "every assumption you've quietly imported", tags: ['academic', 'cutting'], stats: { wit: 3 },
    flavor: 'Quietness is, on inspection, the most audible thing here.' },
  { id: 'wv2-s-passes-for-rigor', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'what passes for rigor here', tags: ['academic', 'dismissive'], stats: { wit: 3 },
    flavor: 'Passes, in this context, being a verb of movement, not validation.' },
  { id: 'wv2-s-breathtaking-confidence', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the breathtaking confidence of your claim', tags: ['observational', 'ironic'], stats: { wit: 3 },
    flavor: 'Breath is being lost, certainly. The reason is unclear.' },
  { id: 'wv2-s-unexamined-certainty', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your impressively unexamined certainty', tags: ['observational', 'cutting'], stats: { wit: 3 },
    flavor: 'Impressively because it has lasted this long. Unexamined for the same reason.' },

  // ---- Rare (2) ----
  { id: 'wv2-s-slow-architecture', slot: 'subject', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'the slow architecture of your self-deception', tags: ['academic', 'cutting', 'ironic'], stats: { wit: 4 },
    flavor: 'Slow because it had time. Architecture because someone clearly drew plans.' },
  { id: 'wv2-s-not-thought-through', slot: 'subject', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'everything you have not thought through carefully', tags: ['academic', 'cutting', 'observational'], stats: { wit: 4 },
    flavor: 'Everything is a strong word. It is, here, the precisely correct one.' },
];

// =============================================================================
// TARGETS (15) — verb phrase that LANDS; carries base damage + multiplier.
// =============================================================================

const TARGETS = [
  // ---- Common (5) — cost 1 ----
  { id: 'wv2-t-shows', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'shows.', tags: ['cutting'],
    effect: { scaleBy: 'wit', base: 4, multiplier: 3, damageType: 'composure' },
    flavor: 'The whole sentence is a setup. This is the snap.' },
  { id: 'wv2-t-what-i-expected', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'is exactly what I expected.', tags: ['dismissive', 'observational'],
    effect: { scaleBy: 'wit', base: 4, multiplier: 3, damageType: 'composure', rider: { weak: 1 } },
    flavor: 'Expectations, in this case, were a kindness.' },
  { id: 'wv2-t-not-survive-scrutiny', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'will not survive this scrutiny.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 4, multiplier: 3, damageType: 'composure', rider: { vulnerable: 1 } },
    flavor: 'Survival being a matter of one careful look.' },
  { id: 'wv2-t-politely-overlooked', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'has been politely overlooked, until now.', tags: ['ironic', 'dismissive'],
    effect: { scaleBy: 'wit', base: 6, multiplier: 3, damageType: 'composure', drawAfterCast: 1 },
    flavor: 'Politeness is a renewable resource. Today it ran out.' },
  { id: 'wv2-t-questions-you-fear', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'invites the questions you most fear.', tags: ['cutting', 'observational'],
    effect: { scaleBy: 'wit', base: 5, multiplier: 3, damageType: 'composure' },
    flavor: 'The fear is the answer. The questions are formality.' },

  // ---- Uncommon (6) — cost 2 ----
  { id: 'wv2-t-lacks-seriousness', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'lacks the seriousness it pretends to.', tags: ['academic', 'dismissive'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 2, damageType: 'composure', rider: { weak: 1 } },
    flavor: 'The pretense was the only weight it carried.' },
  { id: 'wv2-t-drunk-parrot', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'could have been written by a slightly drunk parrot.', tags: ['ironic', 'cutting'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    flavor: 'Slightly drunk because the parrot, like you, has standards.' },
  { id: 'wv2-t-mistakes-vehemence', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'mistakes vehemence for vigor.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure', rider: { vulnerable: 1 } },
    flavor: 'The two have, at this point, never even been introduced.' },
  { id: 'wv2-t-dried-apricot', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'has the texture of a dried apricot.', tags: ['ironic', 'observational'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    flavor: 'The apricot, to be fair, never claimed to be more.' },
  { id: 'wv2-t-remembered-briefly', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'will be remembered, briefly, with embarrassment.', tags: ['cutting', 'dismissive'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    flavor: 'Briefly, because embarrassment is exhausting work.' },
  { id: 'wv2-t-too-dull', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'survives only by being too dull to attack.', tags: ['ironic', 'cutting'],
    effect: { scaleBy: 'wit', base: 9, multiplier: 2, damageType: 'composure' },
    flavor: 'And yet, here we are.' },

  // ---- Rare (4) — cost 2-3 ----
  { id: 'wv2-t-generous-error', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, in the most generous reading, an error.', tags: ['academic', 'ironic'],
    effect: { scaleBy: 'wit', base: 10, multiplier: 3, damageType: 'composure', rider: { weak: 2 } },
    flavor: 'Less generous readings have been collected and indexed.' },
  { id: 'wv2-t-future-studies', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'will be cited in future studies of what to avoid.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 12, multiplier: 3, damageType: 'composure', tier3Double: true },
    flavor: 'The citation is the gift. The avoidance is the lesson.' },
  { id: 'wv2-t-announces-itself', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'announces itself, repeatedly, while saying nothing.', tags: ['observational', 'ironic', 'cutting'],
    effect: { scaleBy: 'wit', base: 11, multiplier: 3, damageType: 'composure' },
    flavor: 'The announcement was the entire content. Loudness mistaken for substance.' },
  { id: 'wv2-t-own-punctuation', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 3, type: 'effect',
    phrase: 'collapses under the weight of its own punctuation.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 14, multiplier: 3, damageType: 'composure',
             requiresTier3: { failureDamageMult: 0.5, exhaustOnFail: true } },
    flavor: 'Em dashes can carry a great deal. Not, however, this.' },
];

// =============================================================================
// MODIFIERS (10) — 4th optional slot; bend the spell.
// =============================================================================

const MODIFIERS = [
  // ---- Common (4) ----
  { id: 'wv2-m-due-respect', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'modifier',
    modifierKind: 'pre', phrase: 'With all due respect,', tags: ['academic'], stats: { wit: 1 },
    modifierEffect: { addsTag: 'academic' },
    flavor: 'Respect is, in this dialect, a verb tense.' },
  { id: 'wv2-m-obviously', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'post', phrase: '— obviously,', tags: ['dismissive'],
    modifierEffect: { addsTag: 'dismissive', rider: { weak: 1 } },
    flavor: 'Obviousness has, in this case, taken its sweet time.' },
  { id: 'wv2-m-i-daresay', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'pre', phrase: 'I daresay,', tags: ['academic'], stats: { wit: 1 },
    modifierEffect: { addsTag: 'academic', drawAfterCast: 1 },
    flavor: 'Daresay being the verb form of having said it earlier in private.' },
  { id: 'wv2-m-and-i-quote', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'post', phrase: '— and I quote,', tags: ['academic'],
    modifierEffect: { addsTag: 'academic', conditionalMult: { tier2Plus: 1.5 } },
    flavor: 'Quotation marks are, on their best day, a small gift.' },

  // ---- Uncommon (4) ----
  { id: 'wv2-m-stares-meaningfully', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'replaces-intro', phrase: '(stares meaningfully)', tags: ['observational'],
    modifierEffect: { addsTag: 'observational', rider: { vulnerable: 1 } },
    flavor: 'The staring is the rhetoric. The meaningful is the multiplier.' },
  { id: 'wv2-m-apologies-mother', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: '— with apologies to your mother,', tags: ['cutting'],
    modifierEffect: { addsTag: 'cutting', damageMult: 1.5 },
    flavor: 'Apologies being the only honest part of the sentence.' },
  { id: 'wv2-m-back-row-hears', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'pre', phrase: '(shouted clearly so the back row hears,)', tags: ['dismissive'],
    modifierEffect: { addsTag: 'dismissive', rider: { weak: 2 }, selfComposureCost: 1 },
    flavor: 'Volume is, on rare occasions, the entire argument.' },
  { id: 'wv2-m-three-ways', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: "— and I mean this in three ways,", tags: ['ironic'],
    modifierEffect: { perSharedTag: 3 },
    flavor: 'Three ways being a polite undercount.' },

  // ---- Rare (2) ----
  { id: 'wv2-m-needlepoint', slot: 'modifier', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: '— to be made into a needlepoint by your enemies,', tags: ['cutting', 'ironic'],
    modifierEffect: { tier3Payoff: { damageMult: 2.0, rider: { vulnerable: 2 } } },
    flavor: 'The needlepoint will hang in their hallway. They will see it daily.' },
  { id: 'wv2-m-anyone-with-eyes', slot: 'modifier', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'pre', phrase: '(as anyone with eyes can see,)', tags: ['observational'],
    modifierEffect: { addsTag: 'observational', stripEnemyBlock: 2, damageMult: 1.5 },
    flavor: 'The eyes have, until now, been politely closed.' },
  // Defensive modifier — block on cast.
  { id: 'wv2-m-measured-restraint', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'post', phrase: '— with measured restraint,', tags: ['formal', 'academic'],
    modifierEffect: { addsTag: 'formal', rider: { block: 4 } },
    flavor: 'Restraint, in this case, being a verb performed at audience.' },
];

// =============================================================================
// GESTURES (1) — v2.5 one-shot immediate-damage cards. Bypass the spell
// tray. Hand gestures, theatrical asides; the thing you DO when you can't
// quite finish a sentence.
// =============================================================================

const GESTURES = [
  { id: 'wv2-g-adjusts-spectacles', slot: 'gesture', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'gesture',
    phrase: '(adjusts spectacles,)', tags: ['observational'],
    gestureEffect: { icon: '👓', damage: 5, damageType: 'composure', trayMultiplier: 1, rider: { weak: 1 }, exhaust: true },
    flavor: 'The lenses are clean. The look behind them, less so.' },
  // v2.6: PONTIFICATION — high cost, big damage, NON-exhaust (the card
  // goes back into the deck after firing, so it's reusable across combat).
  { id: 'wv2-g-pontificate', slot: 'gesture', tier: 2, rarity: 'uncommon', lane: LANE, cost: 3, type: 'gesture',
    phrase: 'Pontificate at length:', tags: ['academic', 'cutting'],
    gestureEffect: { icon: '📚', damage: 11, damageType: 'composure', trayMultiplier: 2, exhaust: false },
    flavor: 'The pontifex pontificates. The audience reconsiders their afternoon.' },
  // v2.6: QUIP — light damage gesture that strips enemy block.
  { id: 'wv2-g-quip-correction', slot: 'gesture', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'gesture',
    phrase: '(quip: a small correction,)', tags: ['academic', 'cutting'],
    gestureEffect: { icon: '🖊', damage: 4, damageType: 'composure', stripEnemyBlock: 6, exhaust: false },
    flavor: 'Six points of block, removed in passing. The footnote is sharper than the body.' },
];

// =============================================================================
// UNIQUE TARGETS (1) — v2.5 mechanic variety beyond stat-stick targets.
// "footnote-bears-out" scales with discard pile size — rewards committed
// deck-cycling.
// =============================================================================

const UNIQUE_TARGETS = [
  { id: 'wv2-t-footnote-bears-out', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: '…as the long footnote bears out.', tags: ['academic', 'ironic'],
    effect: { scaleBy: 'wit', base: 4, multiplier: 2, damageType: 'composure', perDiscardCard: 1 },
    flavor: 'The footnote is on page 814. The page is, technically, also a footnote.' },
];

// v2.6: NEW MODIFIERS — say-again (×2 damage rare) + words-to-actions
// (damage-type flip from composure to physical).
const NEW_MODIFIERS_V26 = [
  { id: 'wv2-m-say-again', slot: 'modifier', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: "— and I'll say it again,", tags: ['cutting', 'dismissive'],
    modifierEffect: { damageMult: 2.0 },
    flavor: 'The first time was free. The second time is on record.' },
  { id: 'wv2-m-words-actions', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: '— turning my words to actions,', tags: ['cutting', 'observational'],
    modifierEffect: { damageTypeFlip: true },
    flavor: "Actions speak louder than words. We're using both, today." },
];

// =============================================================================
// ANNOTATIONS (v2.10) — wit-only. Persistent enemy-attached debuffs that
// don't enter the spell tray. One annotation slot per enemy; new ones
// replace old. Duration ticks at end of each enemy turn. Effect hooks
// fire at: damage incoming (reduction), card draw, turn end, turn start,
// spell cast, and reactively on enemy attack.
// =============================================================================
const ANNOTATIONS = [
  // ---- Basic (1) — joins the starter deck ----
  { id: 'wv2-ann-footnote-credibility', slot: 'annotation', tier: 1, rarity: 'basic',
    lane: LANE, cost: 2, type: 'annotation',
    name: 'Footnote on its credibility', phrase: '*[on its credibility]',
    duration: 3, annotationEffect: { enemyAtkReduction: 2 },
    desc: 'Attach. While attached (3 turns): enemy attacks deal -2 damage.',
    flavor: 'The footnote does the work the body cannot.' },

  // ---- Common (2) ----
  { id: 'wv2-ann-marginalia-posture', slot: 'annotation', tier: 1, rarity: 'common',
    lane: LANE, cost: 2, type: 'annotation',
    name: 'Marginalia on its posture', phrase: '*[on its posture]',
    duration: 3, annotationEffect: { damageOnDraw: 1 },
    desc: 'Attach. While attached (3 turns): each card you DRAW deals 1 composure damage.',
    flavor: 'The handwriting in the margin is, if anything, ruder than the text.' },
  { id: 'wv2-ann-margin-notes', slot: 'annotation', tier: 1, rarity: 'common',
    lane: LANE, cost: 2, type: 'annotation',
    name: 'Margin notes, throughout', phrase: '*[throughout]',
    duration: 3, annotationEffect: { damageOnTurnEnd: 2 },
    desc: 'Attach. While attached (3 turns): at end of your turn, deal 2 composure damage.',
    flavor: 'You ran out of margin halfway down. The notes continue, smaller.' },

  // ---- Uncommon (2) ----
  { id: 'wv2-ann-subtext-italics', slot: 'annotation', tier: 2, rarity: 'uncommon',
    lane: LANE, cost: 3, type: 'annotation',
    name: 'Subtext, in italics', phrase: '*[in italics]',
    duration: 3, annotationEffect: { bonusSpellDamage: 3 },
    desc: 'Attach. While attached (3 turns): your spells deal +3 composure damage.',
    flavor: 'The text was already saying it. The italics insist you noticed.' },
  { id: 'wv2-ann-read-aloud', slot: 'annotation', tier: 2, rarity: 'uncommon',
    lane: LANE, cost: 3, type: 'annotation',
    name: 'Read aloud, slowly', phrase: '*[read aloud, slowly]',
    duration: 3, annotationEffect: { damageOnTurnStart: 1, energyOnTurnStart: 1 },
    desc: 'Attach. While attached (3 turns): at start of your turn, deal 1 composure damage AND gain 1 Energy.',
    flavor: 'The act of reading them out loud is, mysteriously, energizing.' },

  // ---- Rare (1) ----
  { id: 'wv2-ann-asterisked-concern', slot: 'annotation', tier: 3, rarity: 'rare',
    lane: LANE, cost: 3, type: 'annotation',
    name: 'Asterisked with concern', phrase: '*[*]',
    duration: 4, annotationEffect: { damageOnEnemyAttack: 3 },
    desc: 'Attach. While attached (4 turns): whenever enemy attacks, they take 3 composure damage.',
    flavor: 'Your concern is, technically, written down. The asterisk is doing the wounding.' },
];

// =============================================================================
// EXPORTS
// =============================================================================

export const WIT_V2 = [...INTROS, ...SUBJECTS, ...TARGETS, ...MODIFIERS, ...NEW_MODIFIERS_V26, ...GESTURES, ...UNIQUE_TARGETS, ...ANNOTATIONS];
export const WIT_V2_BY_SLOT = {
  intro: INTROS,
  subject: SUBJECTS,
  target: [...TARGETS, ...UNIQUE_TARGETS],
  gesture: GESTURES,
  modifier: [...MODIFIERS, ...NEW_MODIFIERS_V26],
  annotation: ANNOTATIONS,
};
