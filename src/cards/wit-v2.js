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
    phrase: 'Frankly,', tags: ['dismissive', 'cutting'], stats: { wit: 1 },
    setId: 'atelier-4', setSlot: 'intro', tierId: 'atelier',
    flavor: 'The dictionary definition of confidence preceded by a comma.' },
  { id: 'wv2-i-actually', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Actually,', tags: ['academic', 'dismissive'], stats: { wit: 1 },
    effects: { draw: 1 },
    setId: 'transportation-4', setSlot: 'intro', tierId: 'transportation',
    flavor: "You haven't even said anything yet, but here we are." },
  { id: 'wv2-i-honestly', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Honestly,', tags: ['observational', 'cutting'], stats: { wit: 1 },
    effects: { block: 2 },
    setId: 'transportation-5', setSlot: 'intro', tierId: 'transportation',
    flavor: 'Honesty has never been the issue.' },
  { id: 'wv2-i-truly', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Truly,', tags: ['observational', 'dismissive'], stats: { wit: 1 },
    setId: 'hygiene-4', setSlot: 'intro', tierId: 'hygiene',
    flavor: "Said with the gravity of someone who knows they've said it before." },
  { id: 'wv2-i-curiously', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Curiously,', tags: ['observational', 'ironic'], stats: { wit: 1 },
    setId: 'hygiene-5', setSlot: 'intro', tierId: 'hygiene',
    flavor: 'Curiosity is, of course, the polite name for it.' },

  // ---- Common (12) — cost 0, +2 wit, tier 1 ----
  { id: 'wv2-i-strikes-me', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'It strikes me that', tags: ['observational', 'dismissive'], stats: { wit: 2 },
    setId: 'hygiene-8', setSlot: 'intro', tierId: 'hygiene',
    flavor: 'The strike is yours. The me is not.' },
  { id: 'wv2-i-i-should-think', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'I should think that', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    setId: 'transportation-3', setSlot: 'intro', tierId: 'transportation',
    flavor: 'Should-think being a softer cousin of must-acknowledge.' },
  { id: 'wv2-i-pardon-saying', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Pardon my saying,', tags: ['academic', 'observational'], stats: { wit: 2 },
    setId: 'hygiene-2', setSlot: 'intro', tierId: 'hygiene',
    flavor: 'You will not pardon it. That is rather the point.' },
  { id: 'wv2-i-strictly-speaking', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Strictly speaking,', tags: ['academic', 'cutting'], stats: { wit: 2 },
    effects: { weak: 1 },
    setId: 'transportation-2', setSlot: 'intro', tierId: 'transportation',
    flavor: 'Strictness is, today, a virtue worth performing.' },
  { id: 'wv2-i-memory-serves', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'If memory serves,', tags: ['academic', 'ironic'], stats: { wit: 2 },
    setId: 'atelier-8', setSlot: 'intro', tierId: 'atelier',
    flavor: 'Memory is serving. The food is leftovers.' },
  { id: 'wv2-i-by-any-measure', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'By any measure,', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    setId: 'atelier-3', setSlot: 'intro', tierId: 'atelier',
    flavor: 'Most measures, anyway. Certainly the kind one.' },
  { id: 'wv2-i-speaking-plainly', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Speaking plainly,', tags: ['cutting', 'observational'], stats: { wit: 2 },
    effects: { vulnerable: 1 },
    setId: 'atelier-5', setSlot: 'intro', tierId: 'atelier',
    flavor: 'Plainness is the most decorated of the rhetorical arts.' },
  { id: 'wv2-i-or-rather', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Or rather,', tags: ['observational', 'ironic'], stats: { wit: 2 },
    effects: { draw: 1 },
    setId: 'hygiene-3', setSlot: 'intro', tierId: 'hygiene',
    flavor: 'The revision is the point. The original was scaffolding.' },
  { id: 'wv2-i-it-would-appear', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'It would appear that', tags: ['observational', 'dismissive'], stats: { wit: 2 },
    setId: 'atelier-6', setSlot: 'intro', tierId: 'atelier',
    flavor: 'Appearances, in matters like this, are the entire substance.' },
  { id: 'wv2-i-being-honest', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "If we're being honest,", tags: ['dismissive', 'cutting'], stats: { wit: 2 },
    effects: { draw: 1, loseHp: 1 },
    flavor: 'The we is presumptuous. It always is.' },
  { id: 'wv2-i-one-could-argue', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'One could argue that', tags: ['academic', 'ironic'], stats: { wit: 2 },
    setId: 'transportation-6', setSlot: 'intro', tierId: 'transportation',
    flavor: "One could. One won't have to." },
  { id: 'wv2-i-let-the-record', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Let the record show that', tags: ['academic'], stats: { wit: 2 },
    setId: 'transportation-7', setSlot: 'intro', tierId: 'transportation',
    flavor: 'There is no record. The phrasing is the record.' },
  // v2.34: LONG THREAD — wit's signature consecutive-turn scaling. The
  // 'continuing' tag is reserved for future thread-payoff cards that key
  // off carrying the argument forward; right now it's narrative.
  { id: 'wv2-i-as-i-was-saying', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'as I was saying,', tags: ['continuing', 'elaborate'], stats: { wit: 2 },
    flavor: 'The thread, after all, was never broken — only set aside briefly.' },

  // ---- Uncommon (6) — cost 1, +3 wit, tier 2 ----
  { id: 'wv2-i-permit-me-observe', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Permit me to observe that', tags: ['academic', 'observational'], stats: { wit: 3 },
    setId: 'atelier-2', setSlot: 'intro', tierId: 'atelier',
    flavor: 'Observation, in this dialect, is a verb that lands.' },
  { id: 'wv2-i-charitable', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Were I being charitable,', tags: ['ironic', 'dismissive'], stats: { wit: 3 },
    setId: 'atelier-7', setSlot: 'intro', tierId: 'atelier',
    flavor: 'Charity is a discipline. You may not be ready for it.' },
  { id: 'wv2-i-setting-aside', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Setting aside the obvious,', tags: ['academic', 'cutting'], stats: { wit: 3 },
    setId: 'hygiene-6', setSlot: 'intro', tierId: 'hygiene',
    flavor: 'The obvious is a heavy thing. You leave it on the table for now.' },
  { id: 'wv2-i-if-records-trusted', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'If the records can be trusted,', tags: ['academic', 'ironic'], stats: { wit: 3 },
    setId: 'hygiene-7', setSlot: 'intro', tierId: 'hygiene',
    flavor: 'They can. That is, in fact, the worst part.' },
  { id: 'wv2-i-put-generously', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'To put it generously,', tags: ['ironic', 'dismissive'], stats: { wit: 3 },
    flavor: 'Generosity, here, is an act of restraint. Witnessed.' },
  { id: 'wv2-i-purely-analytical', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'From a purely analytical perspective,', tags: ['academic', 'observational'], stats: { wit: 3 },
    setId: 'transportation-8', setSlot: 'intro', tierId: 'transportation',
    flavor: 'The analysis is purely a courtesy. The conclusion arrived earlier.' },

  // ---- Rare (2) — cost 2, +4 wit, tier 3 ----
  { id: 'wv2-i-reasonable-observer', slot: 'intro', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'By the standards of any reasonable observer,', tags: ['academic', 'cutting'], stats: { wit: 4 },
    flavor: 'Reasonable observers are a small population. You are, suddenly, one.' },
  { id: 'wv2-i-full-possession', slot: 'intro', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'And I say this with full possession of the facts,', tags: ['academic', 'cutting'], stats: { wit: 4 },
    flavor: 'The facts have been alphabetized. Indexed. Cross-referenced. Their footnotes have footnotes.' },

  // ---- FFT Sample Rows (Phase 2 — three sample intros, one per tier) ----
  // Linen Truths (Atelier) — "As I was saying to the fabric merchant,"
  { id: 'wv2-i-fabric-merchant', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'As I was saying to the fabric merchant,', tags: ['observational', 'continuing'], stats: { wit: 3 },
    setId: 'atelier-1', setSlot: 'intro', tierId: 'atelier',
    flavor: 'The fabric merchant has, in fact, been waiting for the conclusion of that thought.' },
  // The First Principle (Hygiene) — "Specifically speaking,"
  { id: 'wv2-i-specifically-speaking', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Specifically speaking,', tags: ['academic', 'cutting'], stats: { wit: 3 },
    setId: 'hygiene-1', setSlot: 'intro', tierId: 'hygiene',
    flavor: 'Specificity, here, is a politeness. The general case is worse.' },
  // The Long Signal (Transportation) — "Civically speaking,"
  { id: 'wv2-i-civically-speaking', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Civically speaking,', tags: ['academic', 'observational'], stats: { wit: 3 },
    setId: 'transportation-1', setSlot: 'intro', tierId: 'transportation',
    flavor: 'Civic, here, being the only frame that contains the offence.' },
];

// =============================================================================
// SUBJECTS (25) — noun phrase; what the sentence is about.
// =============================================================================

const SUBJECTS = [
  // ---- Basic (5) ----
  { id: 'wv2-s-your-reasoning', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 1, type: 'word',
    phrase: 'your reasoning', tags: ['academic', 'observational'], stats: { wit: 1 },
    flavor: 'Reasoning, in this case, having done its part by trying.' },
  { id: 'wv2-s-this-argument', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 1, type: 'word',
    phrase: 'this argument', tags: ['academic', 'observational'], stats: { wit: 1 },
    flavor: 'The argument, taken on its own terms, having arrived too sure of itself.' },
  { id: 'wv2-s-your-conclusion', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 1, type: 'word',
    phrase: 'your conclusion', tags: ['academic', 'dismissive'], stats: { wit: 1 },
    flavor: "The conclusion is the part that didn't survive the road." },
  { id: 'wv2-s-your-sources', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 1, type: 'word',
    phrase: 'your sources', tags: ['academic', 'cutting'], stats: { wit: 1 },
    effects: { weak: 1 },
    flavor: "Where they go is not, strictly, anyone's concern. But they go somewhere." },
  { id: 'wv2-s-the-matter', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 1, type: 'word',
    phrase: 'the matter at hand', tags: ['observational'], stats: { wit: 1 },
    flavor: 'The matter has been at hand for some time. It is patient.' },

  // ---- Common (12) ----
  { id: 'wv2-s-your-dissertation', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'your dissertation', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    flavor: 'Bound, defended, and from this distance — undamaged.' },
  { id: 'wv2-s-this-entire-enterprise', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'this entire enterprise', tags: ['dismissive', 'observational'], stats: { wit: 2 },
    flavor: 'The word entire being asked to do unusual lifting today.' },
  { id: 'wv2-s-the-very-premise', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'the very premise', tags: ['academic', 'cutting'], stats: { wit: 2 },
    flavor: 'Very is the most generous adverb in the philosophical lexicon.' },
  { id: 'wv2-s-your-standards', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'your standards', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    flavor: 'They are, at the very least, your own.' },
  { id: 'wv2-s-your-taste', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'your taste', tags: ['observational', 'cutting'], stats: { wit: 2 },
    effects: { vulnerable: 1 },
    setId: 'atelier-1', setSlot: 'subject', tierId: 'atelier',
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
  { id: 'wv2-s-the-syllabus', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'the syllabus', tags: ['academic', 'dismissive'], stats: { wit: 2 },
    effects: { draw: 1 },
    flavor: 'A reading list, in the older and more honest sense.' },
  { id: 'wv2-s-the-bibliography', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: "the bibliography you've assembled", tags: ['academic', 'ironic'], stats: { wit: 2 },
    flavor: 'Assembled, here, being a polite word for collected and shrugged at.' },
  { id: 'wv2-s-your-central-thesis', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'your central thesis', tags: ['academic', 'cutting'], stats: { wit: 2 },
    flavor: 'Centrality is a function of geometry. Theses, of bone structure.' },
  { id: 'wv2-s-foundation', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'the very foundation of your argument', tags: ['academic'], stats: { wit: 2 },
    flavor: 'Foundations being load-bearing is, again, a generous reading.' },
  { id: 'wv2-s-your-methodology', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'your methodology', tags: ['academic'], stats: { wit: 2 },
    flavor: 'Method, ology, and the silence between them.' },
  { id: 'wv2-s-so-called-proof', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
    phrase: 'this so-called proof', tags: ['academic', 'ironic'], stats: { wit: 2 },
    flavor: 'So-called by the kindest among us. The rest have other words.' },
  { id: 'wv2-s-conclusions-drawn', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'word',
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

  // ---- FFT Sample Rows (Phase 2 — two new subjects; Atelier reuses your-taste) ----
  // The First Principle (Hygiene) — "the gentleman who skips the bidet"
  { id: 'wv2-s-gentleman-bidet', slot: 'subject', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'the gentleman who skips the bidet', tags: ['observational', 'cutting'], stats: { wit: 4 },
    setId: 'hygiene-1', setSlot: 'subject', tierId: 'hygiene',
    flavor: 'A small distinction. A defining one.' },
  // The Long Signal (Transportation) — "your relationship to the turn signal"
  { id: 'wv2-s-turn-signal', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your relationship to the turn signal', tags: ['academic', 'observational'], stats: { wit: 3 },
    setId: 'transportation-1', setSlot: 'subject', tierId: 'transportation',
    flavor: 'A relationship, evidently, of mutual tolerance.' },

  // ---- FFT Phase 2 batch — Atelier-2, Atelier-3, Hygiene-2, Hygiene-3,
  //      Transportation-2, Transportation-3 (subjects) ----
  { id: 'wv2-s-linen-october', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'linen, in October,', tags: ['observational', 'cutting'], stats: { wit: 3 },
    setId: 'atelier-2', setSlot: 'subject', tierId: 'atelier',
    flavor: 'October being, in fact, the cardinal sin of fabrics.' },
  { id: 'wv2-s-your-cuff', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your cuff', tags: ['observational', 'cutting'], stats: { wit: 3 },
    setId: 'atelier-3', setSlot: 'subject', tierId: 'atelier',
    flavor: 'It has a posture. It is, regrettably, the wrong one.' },
  { id: 'wv2-s-dry-shaving', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'dry shaving', tags: ['observational', 'cutting'], stats: { wit: 3 },
    setId: 'hygiene-2', setSlot: 'subject', tierId: 'hygiene',
    flavor: 'A practice, not a tradition. Tradition requires defenders.' },
  { id: 'wv2-s-dental-schedule', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your dental schedule', tags: ['academic', 'observational'], stats: { wit: 3 },
    setId: 'hygiene-3', setSlot: 'subject', tierId: 'hygiene',
    flavor: 'A schedule, technically. A regimen, generously.' },
  { id: 'wv2-s-yield-sign', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your relationship to the yield sign', tags: ['academic', 'observational'], stats: { wit: 3 },
    setId: 'transportation-2', setSlot: 'subject', tierId: 'transportation',
    flavor: 'The sign is a contract. The contract is in dispute.' },
  { id: 'wv2-s-your-volvo', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your Volvo', tags: ['observational', 'continuing'], stats: { wit: 3 },
    setId: 'transportation-3', setSlot: 'subject', tierId: 'transportation',
    flavor: 'A patient car. A patient car with opinions.' },

  // ---- FFT Phase 2 batch 2 — Atelier-4/5, Hygiene-4/5, Transportation-4/5 ----
  { id: 'wv2-s-boucle-suggestion', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your bouclé suggestion', tags: ['observational', 'ironic'], stats: { wit: 3 },
    setId: 'atelier-4', setSlot: 'subject', tierId: 'atelier',
    flavor: 'A suggestion that, mercifully, can be revoked.' },
  { id: 'wv2-s-evening-wear', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your evening wear', tags: ['observational', 'continuing'], stats: { wit: 3 },
    setId: 'atelier-5', setSlot: 'subject', tierId: 'atelier',
    flavor: 'Evening wear being, of course, time-stamped.' },
  { id: 'wv2-s-standards-of-upkeep', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your standards of upkeep', tags: ['academic', 'cutting'], stats: { wit: 3 },
    setId: 'hygiene-4', setSlot: 'subject', tierId: 'hygiene',
    flavor: 'Standards being, broadly, what one calls the absence of them.' },
  { id: 'wv2-s-towel-rotation', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your towel rotation', tags: ['observational', 'cutting'], stats: { wit: 3 },
    setId: 'hygiene-5', setSlot: 'subject', tierId: 'hygiene',
    flavor: 'A rotation, technically. A cycle, generously. A habit, charitably.' },
  { id: 'wv2-s-parallel-parking', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your parallel parking attempt', tags: ['observational', 'ironic'], stats: { wit: 3 },
    setId: 'transportation-4', setSlot: 'subject', tierId: 'transportation',
    flavor: 'The attempt is the moral. The result is the comedy.' },
  { id: 'wv2-s-left-lane-behavior', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your left-lane behavior', tags: ['academic', 'cutting'], stats: { wit: 3 },
    setId: 'transportation-5', setSlot: 'subject', tierId: 'transportation',
    flavor: 'The left lane is a covenant. You have, somehow, declined to sign.' },

  // ---- FFT Phase 2 final batch — Atelier 6-8, Hygiene 6-8, Transportation 6-8 ----
  { id: 'wv2-s-wool-spring', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your wool, in spring,', tags: ['observational', 'ironic'], stats: { wit: 3 },
    setId: 'atelier-6', setSlot: 'subject', tierId: 'atelier',
    flavor: 'Wool, in spring, being a sartorial cry for help.' },
  { id: 'wv2-s-hem-garment', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the hem of that garment', tags: ['observational', 'cutting'], stats: { wit: 3 },
    setId: 'atelier-7', setSlot: 'subject', tierId: 'atelier',
    flavor: 'The hem is, in tailoring, where the honesty lives.' },
  { id: 'wv2-s-silk-before-8', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the silk one wears before 8', tags: ['academic', 'continuing'], stats: { wit: 3 },
    setId: 'atelier-8', setSlot: 'subject', tierId: 'atelier',
    flavor: 'A specific silk. He has, of course, an example.' },
  { id: 'wv2-s-bathroom-door', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your bathroom door', tags: ['observational', 'cutting'], stats: { wit: 3 },
    setId: 'hygiene-6', setSlot: 'subject', tierId: 'hygiene',
    flavor: 'A door whose function, somehow, has not been internalised.' },
  { id: 'wv2-s-evening-regimen', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your evening regimen', tags: ['academic', 'observational'], stats: { wit: 3 },
    setId: 'hygiene-7', setSlot: 'subject', tierId: 'hygiene',
    flavor: 'A regimen, generously. A pattern, charitably. A habit, factually.' },
  { id: 'wv2-s-post-meal-ritual', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your post-meal ritual', tags: ['academic', 'cutting'], stats: { wit: 3 },
    setId: 'hygiene-8', setSlot: 'subject', tierId: 'hygiene',
    flavor: 'Ritual being, in any civilised house, the entire compact.' },
  { id: 'wv2-s-roundabout', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your relationship to the roundabout', tags: ['academic', 'ironic'], stats: { wit: 3 },
    setId: 'transportation-6', setSlot: 'subject', tierId: 'transportation',
    flavor: 'A roundabout requires a thesis. You arrived with a question.' },
  { id: 'wv2-s-speed-limit', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your relationship to the speed limit', tags: ['academic', 'observational'], stats: { wit: 3 },
    setId: 'transportation-7', setSlot: 'subject', tierId: 'transportation',
    flavor: 'A limit being, in fact, an upper bound. Not a target.' },
  { id: 'wv2-s-four-way-stop', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your relationship to the four-way stop', tags: ['academic', 'cutting'], stats: { wit: 3 },
    setId: 'transportation-8', setSlot: 'subject', tierId: 'transportation',
    flavor: 'A choreography. You have, somehow, not been taught the steps.' },
];

// =============================================================================
// TARGETS (15) — verb phrase that LANDS; carries base damage + multiplier.
// =============================================================================

const TARGETS = [
  // ---- Basic (1, v2.95 — starter-only weak target) ----
  // v2.95.1: basic mult 3 (matches commons); smaller base 4 vs 5-7 and
  // no rider are the visible upgrades when picking a common target.
  // v3.0 (cycle 2): added threadScaling: 1 so EVERY wit player has the
  // Long Thread mechanic firing damage from turn 1. Previously the
  // rider triggered 0 times in 100-run sims because the only targets
  // with threadScaling (uncommon Natural Conclusion, rare Revelation)
  // were rarely picked. Putting it on the starter target gives the
  // wit-defender identity a payoff loop from the opening hand.
  { id: 'wv2-t-thats-not-it', slot: 'target', tier: 1, rarity: 'basic', lane: LANE, cost: 1, type: 'effect',
    phrase: "that's not it.", tags: ['observational', 'cutting'],
    effect: { scaleBy: 'wit', base: 4, multiplier: 3, damageType: 'composure', threadScaling: 1 },
    desc: 'Cast: 4 + Wit×3 + Long Thread × 1 composure.',
    flavor: 'Said gently. Heard sharply.' },
  // ---- Common (5) — cost 1 ----
  // v2.15: common target bases bumped +1 (sim showed +2 overshot wit
  // from 8.2% to 24.4%; +1 lands closer to the 16-18% target).
  { id: 'wv2-t-shows', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'shows.', tags: ['cutting'],
    effect: { scaleBy: 'wit', base: 5, multiplier: 3, damageType: 'composure' },
    flavor: 'The whole sentence is a setup. This is the snap.' },
  { id: 'wv2-t-what-i-expected', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'is exactly what I expected.', tags: ['dismissive', 'observational'],
    effect: { scaleBy: 'wit', base: 5, multiplier: 3, damageType: 'composure', rider: { weak: 1 } },
    flavor: 'Expectations, in this case, were a kindness.' },
  { id: 'wv2-t-not-survive-scrutiny', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'will not survive this scrutiny.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 5, multiplier: 3, damageType: 'composure', rider: { vulnerable: 1 } },
    flavor: 'Survival being a matter of one careful look.' },
  { id: 'wv2-t-politely-overlooked', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'has been politely overlooked, until now.', tags: ['ironic', 'dismissive'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure', drawAfterCast: 1 },
    flavor: 'Politeness is a renewable resource. Today it ran out.' },
  { id: 'wv2-t-questions-you-fear', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'invites the questions you most fear.', tags: ['cutting', 'observational'],
    effect: { scaleBy: 'wit', base: 6, multiplier: 3, damageType: 'composure' },
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
  // v2.34: LONG THREAD payoff target. Cast damage = base 6 + Wit×3 +
  // (Long Thread × 3). Wit's first thread-scaling card — at LT=3 it's
  // +9 dmg, at LT=5 it's +15. Pays off conservative defensive play.
  { id: 'wv2-t-natural-conclusion', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, perhaps, the natural conclusion.', tags: ['rhetorical', 'elaborate'],
    effect: { scaleBy: 'wit', base: 6, multiplier: 3, damageType: 'composure', threadScaling: 3 },
    desc: 'Cast: 6 + Wit×3 + Long Thread × 3 composure.',
    flavor: 'Natural is doing some work here, but it gets to.' },

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
  // v2.38: SAYING SOMETHING WRONG — wit's delayed-consequence target. Heavy
  // damage now; in TWO turns a "Misstep" token appears in your hand. The
  // token can be paid off for 1 Energy (discard, exhaust) or it auto-plays
  // at end of that turn for 3 HP self-damage and exhausts. The Pratchettian
  // beat is the long pause between the assertion and the realising-you-
  // were-wrong; mechanically it's the wit version of chutzpah's corner
  // tokens — bravado that has to be reckoned with later.
  { id: 'wv2-t-saying-something-wrong', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, I am afraid, where you said something rather wrong.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 13, multiplier: 3, damageType: 'composure',
              delayedMisstep: { delay: 2, selfDamage: 3 } },
    desc: 'Cast: 13 + Wit×3 composure. In 2 turns, a Misstep token appears in hand: discard for 1 Energy, or end-of-turn = -3 HP. Exhausts either way.',
    flavor: 'You said it with conviction. The conviction is, on reflection, the problem.' },
  // v2.39: OPENING STATEMENT — wit's strong-start target. Tier-1 common with a
  // built-in +4 first-turn rider. On turn 1 of combat (or in any turn extended
  // by "to revisit my opening point,"), cast = 5 + Wit×3 + 4. Late-turn it
  // drops back to a baseline 5 + Wit×3 — you held it too long. Pratchett-tone
  // dovetails with the existing 'rhetorical' / 'continuing' wit cluster.
  { id: 'wv2-t-let-me-begin', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'is what I propose to begin by saying.', tags: ['rhetorical', 'continuing'],
    effect: { scaleBy: 'wit', base: 5, multiplier: 3, damageType: 'composure', openingBonus: 4 },
    desc: 'Cast: 5 + Wit×3 composure (+4 on turn 1 OR while the opening is extended).',
    flavor: 'A standard convocation. The standard is the trick.' },

  // ---- FFT Sample Rows (Phase 2 — three sample targets, one per tier) ----
  // Linen Truths (Atelier)
  { id: 'wv2-t-not-tolerated-after-8', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'would not be tolerated after 8.', tags: ['observational', 'cutting'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'atelier-1', setSlot: 'target', tierId: 'atelier',
    flavor: 'Eight being, of course, the appointed hour for everything that matters.' },
  // The First Principle (Hygiene)
  { id: 'wv2-t-not-a-gentleman', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is not a gentleman at all.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 11, multiplier: 3, damageType: 'composure' },
    setId: 'hygiene-1', setSlot: 'target', tierId: 'hygiene',
    flavor: 'A conclusion arrived at, regretfully, by direct observation.' },
  // The Long Signal (Transportation)
  { id: 'wv2-t-entire-drive', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'lasts, somehow, the entire drive.', tags: ['observational', 'cutting'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'transportation-1', setSlot: 'target', tierId: 'transportation',
    flavor: 'Lasts being, on this evidence, an indictment.' },

  // ---- FFT Phase 2 batch — targets for rows 2-3 of each tier ----
  // The Off-Season (Atelier-2)
  { id: 'wv2-t-precisely-what-one-does-not-do', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is precisely what one does not do.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'atelier-2', setSlot: 'target', tierId: 'atelier',
    flavor: 'One being, in this case, the entire civilised population.' },
  // The Cuff (Atelier-3)
  { id: 'wv2-t-wrong-and-proud', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, somehow, both wrong and proud.', tags: ['observational', 'ironic'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'atelier-3', setSlot: 'target', tierId: 'atelier',
    flavor: 'The pride is the worse half. The wrongness is just the setup.' },
  // Dry Shaving (Hygiene-2)
  { id: 'wv2-t-aesthetic-failure-first', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, frankly, an aesthetic failure first.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    setId: 'hygiene-2', setSlot: 'target', tierId: 'hygiene',
    flavor: 'Aesthetics being, in his school, the only ethics that hold up.' },
  // Dental (Hygiene-3)
  { id: 'wv2-t-politely-call-memorial', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is what the rest of us would politely call a memorial.', tags: ['ironic', 'cutting'],
    effect: { scaleBy: 'wit', base: 10, multiplier: 3, damageType: 'composure' },
    setId: 'hygiene-3', setSlot: 'target', tierId: 'hygiene',
    flavor: 'Politeness, in a memorial setting, is the entire performance.' },
  // The Yield (Transportation-2)
  { id: 'wv2-t-suggestion-at-best', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, on review, a suggestion at best.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'transportation-2', setSlot: 'target', tierId: 'transportation',
    flavor: 'A suggestion being, legally speaking, a contract you ignored.' },
  // The Volvo Sermon (Transportation-3)
  { id: 'wv2-t-conversation-with-you-itself', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'would have, by now, had the conversation with you itself.', tags: ['observational', 'ironic'],
    effect: { scaleBy: 'wit', base: 10, multiplier: 3, damageType: 'composure' },
    setId: 'transportation-3', setSlot: 'target', tierId: 'transportation',
    flavor: 'Volvos are patient. The conversation has been queued since 2003.' },

  // ---- FFT Phase 2 batch 2 — targets for rows 4-5 of each tier ----
  // The Bouclé Suggestion (Atelier-4)
  { id: 'wv2-t-fabric-stops-asking', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is what happens when fabric stops asking permission.', tags: ['observational', 'ironic'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'atelier-4', setSlot: 'target', tierId: 'atelier',
    flavor: 'Permission, in fabric, is the entire moral system.' },
  // Late Pajamas (Atelier-5)
  { id: 'wv2-t-8-has-been-and-gone', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'announces, with regret, that 8 has been and gone.', tags: ['observational', 'cutting'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    setId: 'atelier-5', setSlot: 'target', tierId: 'atelier',
    flavor: 'The regret is the giveaway. Eight was, in fact, a deadline.' },
  // Standards (Hygiene-4)
  { id: 'wv2-t-soft-start', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'are what the rest of us call a soft start.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'hygiene-4', setSlot: 'target', tierId: 'hygiene',
    flavor: 'Softness, here, is a clinical observation. Not a kindness.' },
  // The Towel (Hygiene-5)
  { id: 'wv2-t-did-not-ask-to-know', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'tells us things we did not ask to know.', tags: ['observational', 'cutting'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    setId: 'hygiene-5', setSlot: 'target', tierId: 'hygiene',
    flavor: 'We did not ask. The towel still spoke.' },
  // The Parallel (Transportation-4)
  { id: 'wv2-t-essence-public-service', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, in essence, a public service.', tags: ['observational', 'ironic'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'transportation-4', setSlot: 'target', tierId: 'transportation',
    flavor: 'The service being free entertainment for everyone watching.' },
  // The Left Lane (Transportation-5)
  { id: 'wv2-t-jurisdiction-moral-failing', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, in this jurisdiction, a moral failing.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    setId: 'transportation-5', setSlot: 'target', tierId: 'transportation',
    flavor: 'Most jurisdictions, in fact. Civilised ones, certainly.' },

  // ---- FFT Phase 2 final batch — targets for rows 6-8 of each tier ----
  // Wool's Opinions (Atelier-6)
  { id: 'wv2-t-its-own-opinions', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'has its own opinions.', tags: ['observational', 'ironic'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'atelier-6', setSlot: 'target', tierId: 'atelier',
    flavor: 'Wool develops opinions. Linen, in spring, simply behaves.' },
  // The Hem (Atelier-7)
  { id: 'wv2-t-still-be-unkind', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'would still be unkind.', tags: ['cutting', 'observational'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    setId: 'atelier-7', setSlot: 'target', tierId: 'atelier',
    flavor: 'Charity has its limits. The hem has, regretfully, exposed them.' },
  // Silk by Eight (Atelier-8)
  { id: 'wv2-t-not-what-one-wears-after', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is not what one wears after.', tags: ['academic', 'continuing'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'atelier-8', setSlot: 'target', tierId: 'atelier',
    flavor: 'Before 8 and after 8 being, in textiles, two different gravities.' },
  // Civic Cleanliness (Hygiene-6)
  { id: 'wv2-t-rest-follows', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is left open, often, and the rest follows.', tags: ['observational', 'cutting'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    setId: 'hygiene-6', setSlot: 'target', tierId: 'hygiene',
    flavor: 'The rest, in his house, being a long list of consequences.' },
  // The Regimen (Hygiene-7)
  { id: 'wv2-t-in-fact-ongoing', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, in fact, ongoing.', tags: ['academic', 'observational'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'hygiene-7', setSlot: 'target', tierId: 'hygiene',
    flavor: 'Ongoing being a verb-form, here, with weight.' },
  // The Civilizing Hour (Hygiene-8)
  { id: 'wv2-t-optional-in-your-house', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, regrettably, optional in your house.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    setId: 'hygiene-8', setSlot: 'target', tierId: 'hygiene',
    flavor: 'Optional being, in this case, a synonym for "absent altogether."' },
  // Roundabouts (Transportation-6)
  { id: 'wv2-t-insurance-forms', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is what insurance forms are for.', tags: ['observational', 'ironic'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    setId: 'transportation-6', setSlot: 'target', tierId: 'transportation',
    flavor: 'The forms have been pre-filled. By the underwriter. With a sigh.' },
  // Speed Limits (Transportation-7)
  { id: 'wv2-t-generously-aspirational', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, generously, aspirational.', tags: ['academic', 'ironic'],
    effect: { scaleBy: 'wit', base: 7, multiplier: 3, damageType: 'composure' },
    setId: 'transportation-7', setSlot: 'target', tierId: 'transportation',
    flavor: 'Aspiration, here, being a polite name for "regularly exceeded."' },
  // The Four-Way Stop (Transportation-8)
  { id: 'wv2-t-category-of-confusion', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, on its own, a category of confusion.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure' },
    setId: 'transportation-8', setSlot: 'target', tierId: 'transportation',
    flavor: 'The category is small. You are, somehow, its sole member.' },
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
  // v2.35: FOOTNOTE supporting modifier. Pure hedge — pairs naturally with
  // the footnote skill since this card's wit stat scales further every
  // time it's footnoted. The 'continuing' tag makes it eligible for any
  // future long-thread payoff card that keys off carrying the argument.
  { id: 'wv2-m-on-reflection', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'modifier',
    modifierKind: 'pre', phrase: 'On reflection,', tags: ['hedge', 'continuing'], stats: { wit: 1 },
    modifierEffect: { addsTag: 'hedge' },
    flavor: 'Reflection being the second-most-honest of the rhetorical positions.' },
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
  // v2.15: BURST card — wit's signature payoff. Cash in the attached
  // annotation for damage = remaining_turns × 5. Requires an annotation
  // to exist; consumed (exiled) on cast. Provides wit's missing damage
  // ceiling — converts a slow accelerant into a payout.
  { id: 'wv2-t-finally-answered', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is finally answered, in full.', tags: ['academic', 'cutting'],
    effect: { scaleBy: 'wit', base: 4, multiplier: 2, damageType: 'composure',
              requiresAnnotation: true, cashInAnnotation: { damagePerTurn: 5 } },
    desc: 'REQUIRES an annotation attached. Cast: 4 + Wit comp + 5 × (annotation turns remaining). Exiles the annotation.',
    flavor: 'Every footnote has, eventually, a reckoning.' },
];

// =============================================================================
// SKILLS (v2.35) — wit non-tray utility. The FOOTNOTE skill installs a
// permanent +1 wit rider on a chosen Word card instance — the phrase you
// commit to making sharper.
// =============================================================================
const SKILLS = [
  // v2.35: FOOTNOTE — the phrase-fragment install. Cost 1, exhausts on play.
  // On play, the player picks a Word card (intro/subject/modifier) in hand
  // OR discard. That instance gains footnotes += 1; footnotes adds to the
  // card's wit stat in computeSpellDamage. Stacks (a card can be footnoted
  // multiple times). Persists through deck reshuffles within combat — the
  // footnotes field rides along on the card object's spread; the uid will
  // change on each redraw but the rider survives. Reset between combats
  // (card instances are rebuilt at combat start from buildStartingDeck).
  { id: 'wv2-k-hewn-greaves-footnotes', slot: 'skill', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'skill',
    name: 'As Hewn-Greaves notes in his footnotes,', phrase: 'As Hewn-Greaves notes in his footnotes,',
    tags: ['rhetorical', 'elaborate'],
    effects: { footnotePrompt: true, exhaust: true },
    desc: 'Skill. Exhaust. Pick a Word card in hand or discard — that copy gains a permanent +1 wit footnote for the rest of combat. Stacks.',
    flavor: 'Citation needed. Citation provided. Citation, you must understand, in the technical sense.' },
  // v2.36: ACTUALLY— the correction. Single-turn re-fire of the last cast
  // at +50% scaling. Cost 1, can be played multiple times in a turn (if you
  // hold multiples) — each play stacks an arguing-back debuff on YOU (+1
  // damage from every enemy attack this turn, per stack). Unplayable if no
  // cast has landed this turn. Non-exhaust so the same copy can recur each
  // turn the player keeps lining up cast → correct.
  { id: 'wv2-k-actually', slot: 'skill', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'skill',
    name: 'Actually—', phrase: 'Actually—',
    tags: ['rhetorical', 'continuing'],
    effects: { refireLastCast: true },
    desc: 'Skill. Re-fire your last cast this turn at ×1.5 damage. Each play this turn: +1 damage from every enemy attack this turn. Needs a cast.',
    flavor: 'Actually being a word that, in wit, recasts the room.' },
  // v2.37: HOLD ON — the reactive interrupt. Arms a one-shot flag that
  // reduces the next enemy attack's first swing by the player's current
  // Long Thread (snapshotted at play time). Makes Long Thread defend
  // itself: the higher the thread, the bigger the interrupt — but
  // spending the thread on defense costs the offensive scaling that
  // threadScaling targets read. Non-exhaust so the same copy can recur
  // each turn.
  { id: 'wv2-k-hold-on', slot: 'skill', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'skill',
    name: 'Hold on, hold on —', phrase: 'Hold on, hold on —',
    tags: ['rhetorical', 'continuing'],
    effects: { holdOnPrep: true },
    desc: 'Skill. Arm: next enemy swing is reduced by your current Long Thread. Snapshotted on play. Clears when used OR at start of your next turn.',
    flavor: 'A pause given the same weight as the speech it interrupts.' },
  // v2.39: TO REVISIT MY OPENING POINT — extends the opening into a later turn.
  // Single-use per combat: on play, openingExtended flips true. The next wit
  // target cast (this turn or a later turn) still receives its `openingBonus`
  // damage even when combatTurn > 1; the flag clears after that cast. The
  // skill itself is non-exhaust so the same physical copy can re-arm in a
  // later combat, but the flag's single-use protects against multi-stacking
  // within one fight.
  { id: 'wv2-k-revisit-opening', slot: 'skill', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'skill',
    name: 'to revisit my opening point,', phrase: 'to revisit my opening point,',
    tags: ['rhetorical', 'hedge'],
    effects: { extendOpening: true },
    desc: 'Skill. Your next wit Effect cast this combat counts as turn 1 (its openingBonus still applies). Single-use per combat.',
    flavor: 'Revisitation being, properly executed, a small civic ceremony.' },
  // v2.40: I'LL LET YOU FINISH — patience-bank skill. Cost 0, non-exhaust. On
  // play, if Patience is installed, bump patienceStacks +1. If Patience is NOT
  // installed, the card is still playable (it cycles deck) but does nothing to
  // the bank — the player should hold it until they install. Pairs with the
  // Patience power: lets the wit-defender deliberately skip a cast and bank
  // a stack without losing the whole turn to inactivity.
  { id: 'wv2-k-let-you-finish', slot: 'skill', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'skill',
    name: "I'll let you finish,", phrase: "I'll let you finish,",
    tags: ['hedge', 'rhetorical'],
    effects: { skipCastBank: true },
    desc: 'Skill. If Patience is installed, +1 patience stack. Cost 0.',
    flavor: 'Generous in the technical sense.' },
  // v3.1: WORD IN EDGEWISE — escalating swing reduction. Each successive
  // swing of the next attack-multi loses +1 more damage. A 4×3 attack
  // deals 3+2+1+0 = 6 total instead of 12. Late swings get fully shut
  // down; single big hits unchanged. Punishes the same enemy archetype
  // (multi-attackers) from the defense side that Novice Retort hits
  // from the offense side.
  { id: 'wv2-k-word-in-edgewise', slot: 'skill', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'skill',
    name: 'Word in Edgewise', phrase: 'Word in Edgewise',
    tags: ['rhetorical', 'cutting'],
    effects: { escalatingSwingReduction: true, exhaust: true },
    desc: 'Skill. Until end of next enemy attack: each successive swing deals 1 more damage less (1st full, 2nd -1, 3rd -2, …). Damage caps at 0. Exhaust.',
    flavor: 'You speak. Between two of theirs.' },
];

// v2.41: SYNERGY CAPSTONE — "is, in summary, the inescapable conclusion." pulls
// together three existing wit primitives into one triple-rider rare target.
// openingBonus reads turn-1 / extended-opening (Opening Statement), threadScaling
// reads consecutive-turn meter (Long Thread), delayedMisstep queues the back-end
// cost (Saying Something Wrong). All three riders are already wired through
// computeSpellDamage + cast pipeline — this card is content-only convergence.
// Paired modifier "as previously stated," self-footnotes on stage: the staged
// instance's `footnotes` bumps +1 the moment it lands in the tray, so its wit
// stat is +1 for the resolving cast. A self-referential rhetorical move that
// also lets the player skip the Hewn-Greaves prompt for this one slot.
const SYNERGY_CAPSTONE_CARDS = [
  { id: 'wv2-t-in-summary', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is, in summary, the inescapable conclusion.', tags: ['rhetorical', 'elaborate', 'continuing'],
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure',
              threadScaling: 4, openingBonus: 5, delayedMisstep: true },
    desc: 'Cast: 8 + Wit×3 comp. +4/Long Thread, +5 on turn 1 (or extended). Queues a Misstep in 2 turns.',
    flavor: 'Summary being a polite word for verdict.' },
  { id: 'wv2-m-as-previously-stated', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'pre', phrase: 'as previously stated,', tags: ['continuing', 'hedge'], stats: { wit: 1 },
    effects: { footnoteSelfOnStage: true },
    modifierEffect: { addsTag: 'continuing' },
    desc: 'Stage: this card gains +1 footnote on itself (wit stat → 2 for this cast).',
    flavor: 'A modifier that, in the spirit of full disclosure, modifies itself.' },
];

const SYNERGY_CAPSTONE_TARGETS = SYNERGY_CAPSTONE_CARDS.filter(c => c.slot === 'target');
const SYNERGY_CAPSTONE_MODIFIERS = SYNERGY_CAPSTONE_CARDS.filter(c => c.slot === 'modifier');

// v2.42: INSULT VULNERABILITIES — every enemy carries an `insultVulnerabilities`
// tag list (e.g. ['dismissive', 'petty', 'sarcastic']) that, until now, no card
// mechanic read. This cycle wires it: pierceVulnerableInsult: N targets gain
// N flat damage per staged-card tag that matches the enemy's list (cap 3
// matches). The pair below provides both the target rider AND a triple-tagged
// subject that's likely to hit multiple insult-vuln tags on common enemies.
// Read the enemy → choose which insults land. Wit's signature move.
const INSULT_VULN_CARDS = [
  // Subject — three tags chosen to overlap with common insultVulnerability
  // entries: 'petty' (Tapestry Walker, Thornlord), 'dismissive' (nearly every
  // insultable enemy), 'observational' (a wit-cluster tag that's NOT in the
  // current vuln pools, included for general utility on non-insult casts).
  { id: 'wv2-s-manner-of-speaking', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your manner of speaking,', tags: ['petty', 'dismissive', 'observational'], stats: { wit: 3 },
    effects: { vulnerable: 1 },
    flavor: 'A subject one returns to with the certainty of an honest critic.' },
  // Target — pierceVulnerableInsult: 4. With the manner-of-speaking subject
  // staged on a vulnerable target (dismissive+petty in the list), the cast
  // adds +8 dmg (2 matches × 4). A third match (modifier tagged matching)
  // caps the bonus at +12.
  { id: 'wv2-t-cannot-bear', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'that being, of course, the very thing you cannot bear to hear.', tags: ['rhetorical', 'continuing', 'elaborate'],
    effect: { scaleBy: 'wit', base: 6, multiplier: 3, damageType: 'composure', pierceVulnerableInsult: 4 },
    desc: 'Cast: 6 + Wit×3 comp. +4 per staged tag matching the enemy\'s insult vulnerabilities (max 3 matches).',
    flavor: 'A flaw named is a flaw amplified.' },
];

const INSULT_VULN_TARGETS = INSULT_VULN_CARDS.filter(c => c.slot === 'target');
const INSULT_VULN_SUBJECTS = INSULT_VULN_CARDS.filter(c => c.slot === 'subject');

// v2.40: PATIENCE — wit's skip-cast-and-defend power. While installed, every
// end-of-turn where the player did NOT cast a spell increments a
// patienceStacks counter. The next cast adds patienceStacks × 2 flat damage
// and clears the counter. Pairs naturally with Long Thread (both reward
// defensive play); counters the eager-cast tempo of Saying-Something-Wrong.
const PATIENCE_POWER = [
  { id: 'wv2-p-patience', slot: 'power', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'power',
    name: 'Patience.', phrase: 'Patience.',
    tags: ['hedge'],
    installPower: { id: 'patience' },
    desc: 'Power. End of any turn you did NOT cast: +1 Patience. Next cast adds Patience × 2 flat damage and clears it.',
    flavor: 'Patience being, in wit, the act of not speaking yet.' },
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
    duration: 3, annotationEffect: { bonusSpellDamage: 4 },
    desc: 'Attach. While attached (3 turns): your spells deal +4 composure damage.',
    flavor: 'The text was already saying it. The italics insist you noticed.' },
  { id: 'wv2-ann-read-aloud', slot: 'annotation', tier: 2, rarity: 'uncommon',
    lane: LANE, cost: 3, type: 'annotation',
    name: 'Read aloud, slowly', phrase: '*[read aloud, slowly]',
    duration: 3, annotationEffect: { damageOnTurnStart: 1, energyOnTurnStart: 1 },
    desc: 'Attach. While attached (3 turns): at start of your turn, deal 1 composure damage AND gain 1 Energy.',
    flavor: 'The act of reading them out loud is, mysteriously, energizing.' },

  // ---- Rare (2) ----
  { id: 'wv2-ann-asterisked-concern', slot: 'annotation', tier: 3, rarity: 'rare',
    lane: LANE, cost: 3, type: 'annotation',
    name: 'Asterisked with concern', phrase: '*[*]',
    duration: 4, annotationEffect: { damageOnEnemyAttack: 3 },
    desc: 'Attach. While attached (4 turns): whenever enemy attacks, they take 3 composure damage.',
    flavor: 'Your concern is, technically, written down. The asterisk is doing the wounding.' },
  // v2.13: scaling annotation — bonus grows with each spell cast.
  { id: 'wv2-ann-thesis-expanded', slot: 'annotation', tier: 3, rarity: 'rare',
    lane: LANE, cost: 3, type: 'annotation',
    name: 'Thesis, expanded as we go', phrase: '*[thesis: expanded]',
    duration: 4, annotationEffect: { bonusSpellDamagePerCast: 2 },
    desc: 'Attach. While attached (4 turns): your spells deal +2 composure damage per spell already cast this combat.',
    flavor: 'The thesis grows. The thesis was already a problem before the growing.' },
  // v3.1: NOVICE RETORT — escalating thorns per swing. 1st swing: 1
  // back, 2nd: 2, 3rd: 3, etc. A 4-swing attack returns 1+2+3+4 = 10
  // composure to the attacker. The escalation makes multi-hit enemies
  // increasingly self-punishing as their combo continues.
  { id: 'wv2-ann-thorned-footnote', slot: 'annotation', tier: 1, rarity: 'common',
    lane: LANE, cost: 1, type: 'annotation',
    name: 'Novice Retort', phrase: '*[novice retort]',
    duration: 3, annotationEffect: { escalatingThorns: 1 },
    desc: 'Attach. While attached (3 turns): the Nth swing of any enemy attack deals N composure damage back to the enemy. A 4×3 attack returns 1+2+3+4 = 10 comp.',
    flavor: 'Each example, helpfully, is sharper than the last.' },
];

// v2.95: STARTER CARDS — wit-flavored kit. One defensive skill + one
// chip-damage gesture so wit can still pressure the enemy on turns when a
// full spell can't form in hand.
const STARTER_CARDS = [
  // Page-Mark — tempo defense + draw. Costs 1, exhausts (one per combat).
  { id: 'wv2-k-page-mark', slot: 'skill', tier: 1, rarity: 'basic', lane: LANE, cost: 1, type: 'skill',
    name: 'Page-Mark', phrase: 'Page-Mark',
    tags: ['academic', 'observational'],
    effects: { block: 3, draw: 1 },
    desc: 'Gain 3 Block. Draw 1.',
    flavor: 'A small triangle. The page knows what it is now.' },
  // Throat-Clear — small gesture, chip + draw. Bypasses tray.
  { id: 'wv2-g-throat-clear', slot: 'gesture', tier: 1, rarity: 'basic', lane: LANE, cost: 1, type: 'gesture',
    name: 'Throat-Clear', phrase: '(clears throat. Audibly.)',
    tags: ['observational', 'ironic'],
    gestureEffect: { icon: '🗣', damage: 3, damageType: 'composure', draw: 1, exhaust: true },
    flavor: 'A polite intervention. They will pause. They will not enjoy it.' },
];

// =============================================================================
// EXPORTS
// =============================================================================

export const WIT_V2 = [...INTROS, ...SUBJECTS, ...TARGETS, ...MODIFIERS, ...NEW_MODIFIERS_V26, ...GESTURES, ...UNIQUE_TARGETS, ...ANNOTATIONS, ...SKILLS, ...PATIENCE_POWER, ...SYNERGY_CAPSTONE_CARDS, ...INSULT_VULN_CARDS, ...STARTER_CARDS];
export const WIT_V2_BY_SLOT = {
  intro: INTROS,
  subject: [...SUBJECTS, ...INSULT_VULN_SUBJECTS],
  target: [...TARGETS, ...UNIQUE_TARGETS, ...SYNERGY_CAPSTONE_TARGETS, ...INSULT_VULN_TARGETS],
  gesture: [...GESTURES, ...STARTER_CARDS.filter(c => c.slot === 'gesture')],
  modifier: [...MODIFIERS, ...NEW_MODIFIERS_V26, ...SYNERGY_CAPSTONE_MODIFIERS],
  annotation: ANNOTATIONS,
  skill: [...SKILLS, ...STARTER_CARDS.filter(c => c.slot === 'skill')],
  power: PATIENCE_POWER,
};
