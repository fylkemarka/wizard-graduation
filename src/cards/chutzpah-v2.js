// Chutzpah lane v2 — The Bruiser's deck. 75 cards.
//
// Voice: Jack Burton / Walter Sobchak. Short, declarative, swaggering.
// Tags: demanding, threatening, dismissive, swaggering, direct.

const LANE = 'chutzpah';

// =============================================================================
// INTROS (25)
// =============================================================================

const INTROS = [
  // ---- Basic (5) ----
  { id: 'cv2-i-look', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Look,', tags: ['direct', 'demanding'], stats: { chutzpah: 2 },
    flavor: 'Two letters. One verb. Full sentence.' },
  { id: 'cv2-i-listen-pal', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Listen pal,', tags: ['demanding', 'direct'], stats: { chutzpah: 2 },
    effects: { weak: 1 },
    flavor: 'Pal is doing a lot of work here.' },
  { id: 'cv2-i-hey-now', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Hey now,', tags: ['demanding', 'dismissive'], stats: { chutzpah: 2 },
    flavor: 'Now being the operative word.' },
  { id: 'cv2-i-buddy', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Buddy,', tags: ['dismissive', 'direct'], stats: { chutzpah: 2 },
    effects: { vulnerable: 1 },
    flavor: 'The friendliest insult in the language.' },
  { id: 'cv2-i-okay', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'Okay,', tags: ['direct', 'dismissive'], stats: { chutzpah: 2 },
    flavor: 'Not okay. Not at all. But also: okay.' },
  // v2.4: HP-cost intro (Chutzpah HP-for-tempo identity, Ironclad-style).
  { id: 'cv2-i-be-blunt', slot: 'intro', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: "Look — I'll be blunt:", tags: ['direct', 'threatening'], stats: { chutzpah: 3 },
    effects: { loseHp: 1 },
    flavor: 'Bluntness is, today, the only currency I have.' },

  // ---- Common (12) ----
  { id: 'cv2-i-listen-carefully', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Listen carefully now,', tags: ['demanding', 'threatening'], stats: { chutzpah: 2 },
    effects: { weak: 1 },
    flavor: 'The careful is for them, not you.' },
  { id: 'cv2-i-lemme-explain', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Lemme explain something,', tags: ['swaggering', 'direct'], stats: { chutzpah: 2 },
    flavor: 'Explanation being a form of physical contact.' },
  { id: 'cv2-i-once', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "I'm gonna tell you once,", tags: ['threatening', 'demanding'], stats: { chutzpah: 2 },
    flavor: 'Once being, in this dialect, a sacred number.' },
  { id: 'cv2-i-heres-the-thing', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "Here's the thing —", tags: ['direct', 'swaggering'], stats: { chutzpah: 2 },
    flavor: 'The em-dash is the threat.' },
  { id: 'cv2-i-get-this-through', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Get this through your head:', tags: ['demanding', 'threatening'], stats: { chutzpah: 2 },
    flavor: 'Through being a verb of force.' },
  { id: 'cv2-i-bottom-line', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Bottom line,', tags: ['direct', 'dismissive'], stats: { chutzpah: 2 },
    effects: { draw: 1 },
    flavor: 'Lines have bottoms. Conversations end at them.' },
  { id: 'cv2-i-end-of-story', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'End of story,', tags: ['dismissive', 'swaggering'], stats: { chutzpah: 2 },
    flavor: 'The story has been short. It ends shorter.' },
  { id: 'cv2-i-straight-up', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Straight up,', tags: ['direct', 'swaggering'], stats: { chutzpah: 2 },
    flavor: "No qualifier necessary. There's the qualifier." },
  { id: 'cv2-i-cut-the-crap', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Cut the crap,', tags: ['dismissive', 'demanding'], stats: { chutzpah: 2 },
    flavor: 'Crap-cutting being, in some dojos, a martial art.' },
  { id: 'cv2-i-real-talk', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Real talk:', tags: ['direct', 'swaggering'], stats: { chutzpah: 2 },
    flavor: 'Talk has, until now, been other things.' },
  { id: 'cv2-i-be-clear', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Let me be clear:', tags: ['direct', 'demanding'], stats: { chutzpah: 2 },
    flavor: 'Clarity, in this case, being a verb performed at volume.' },
  { id: 'cv2-i-period', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Period:', tags: ['dismissive', 'threatening'], stats: { chutzpah: 2 },
    flavor: 'The shortest sentence in chutzpah ends in a colon.' },
  // v2.4: HP-cost common intro.
  { id: 'cv2-i-skin-game', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Skin in the game,', tags: ['threatening', 'swaggering'], stats: { chutzpah: 3 },
    effects: { loseHp: 2 },
    flavor: "The skin in question is yours. Both yours, really. That's the bargain." },
  // v2.24: TUNNEL VISION pump intro — Cycle 1 of the chutzpah meter arc.
  // Heavier chutzpah stat than a basic intro AND +2 to the rage meter.
  { id: 'cv2-i-foaming', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'Foaming at the mouth,', tags: ['threatening', 'swaggering'], stats: { chutzpah: 3 },
    effects: { tunnelVision: 2 },
    desc: 'Stage: +2 Tunnel Vision.',
    flavor: 'The chemical analysis is inconclusive. The vibe is not.' },

  // ---- Uncommon (6) ----
  { id: 'cv2-i-now-you-listen', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Now you listen to me, friend,', tags: ['demanding', 'threatening'], stats: { chutzpah: 3 },
    flavor: 'Friend is hostile when stretched to three syllables.' },
  { id: 'cv2-i-only-going-to-say', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "I'm only going to say this once:", tags: ['threatening', 'swaggering'], stats: { chutzpah: 3 },
    flavor: 'Once is generous. Once is restraint.' },
  { id: 'cv2-i-hold-up', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Hold up, hold up, hold up —', tags: ['demanding', 'swaggering'], stats: { chutzpah: 3 },
    flavor: 'The triple is for emphasis. Also for time, which you do not have.' },
  { id: 'cv2-i-wanna-know', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'You wanna know what I think?', tags: ['swaggering', 'direct'], stats: { chutzpah: 3 },
    flavor: 'Answer: no. Are they about to find out anyway: yes.' },
  { id: 'cv2-i-bring-it-on', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Bring it on, but understand —', tags: ['threatening', 'swaggering'], stats: { chutzpah: 3 },
    flavor: 'The understanding is doing more work than the bringing.' },
  { id: 'cv2-i-look-in-my-eyes', slot: 'intro', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'Look in my eyes and tell me:', tags: ['demanding', 'direct'], stats: { chutzpah: 3 },
    flavor: 'Eye contact has a load-bearing function.' },

  // ---- Rare (2) ----
  { id: 'cv2-i-dont-say-lightly', slot: 'intro', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: "Now I don't say this lightly, and I won't say it twice:", tags: ['threatening', 'direct', 'swaggering'], stats: { chutzpah: 4 },
    flavor: 'Lightly being a word for other people. Twice, also.' },
  { id: 'cv2-i-comes-a-time', slot: 'intro', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'There comes a time, see, and that time is right now:', tags: ['demanding', 'swaggering', 'threatening'], stats: { chutzpah: 4 },
    flavor: 'The time has come. The time has been coming. You are the time.' },
  // v2.11: ALL IN synergy — stake bonus uses this card's higher multiplier.
  { id: 'cv2-i-no-half-measures', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'No half measures —', tags: ['threatening', 'direct'], stats: { chutzpah: 2 },
    stakeMultiplier: 1.25,
    desc: 'Staked HP gives +1.25 dmg/HP when this intro is in the spell.',
    flavor: 'A measure can be half. A statement, less so.' },
];

// =============================================================================
// SUBJECTS (25)
// =============================================================================

const SUBJECTS = [
  // ---- Basic (5) ----
  { id: 'cv2-s-this-nonsense', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'this nonsense', tags: ['dismissive'], stats: { chutzpah: 2 },
    flavor: 'Diagnosis: nonsense. Prognosis: about to be over.' },
  { id: 'cv2-s-your-attitude', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'your attitude', tags: ['dismissive', 'direct'], stats: { chutzpah: 2 },
    effects: { vulnerable: 1 },
    flavor: 'Attitude being a thing that can, in fact, be confiscated.' },
  { id: 'cv2-s-this-whole-thing', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'this whole thing', tags: ['dismissive'], stats: { chutzpah: 2 },
    flavor: 'Whole being a measurement of the problem.' },
  { id: 'cv2-s-all-of-it', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'all of it', tags: ['dismissive', 'demanding'], stats: { chutzpah: 2 },
    flavor: 'All. Of. It. Three short words. Three short verdicts.' },
  { id: 'cv2-s-your-face', slot: 'subject', tier: 1, rarity: 'basic', lane: LANE, cost: 0, type: 'word',
    phrase: 'your face', tags: ['direct', 'dismissive'], stats: { chutzpah: 2 },
    flavor: 'The face has been doing things. Things are noted.' },

  // ---- Common (12) ----
  { id: 'cv2-s-your-big-talk', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your big talk', tags: ['dismissive', 'threatening'], stats: { chutzpah: 2 },
    flavor: 'Big being, here, a comparative measure with nothing to compare it to.' },
  { id: 'cv2-s-charade', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'this whole charade', tags: ['dismissive', 'swaggering'], stats: { chutzpah: 2 },
    flavor: 'Charade is the technical term. Other words are available.' },
  { id: 'cv2-s-entire-premise', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'the entire premise', tags: ['dismissive', 'direct'], stats: { chutzpah: 2 },
    flavor: 'Premises being something the bouncer escorts you out of.' },
  { id: 'cv2-s-little-routine', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your little routine', tags: ['dismissive'], stats: { chutzpah: 2 },
    flavor: 'Little is the unkindest of adjectives.' },
  { id: 'cv2-s-every-word', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'every word coming out of your mouth', tags: ['dismissive', 'direct'], stats: { chutzpah: 2 },
    flavor: 'Every. Word. The math is exhaustive.' },
  { id: 'cv2-s-your-problem', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your problem', tags: ['direct', 'demanding'], stats: { chutzpah: 2 },
    flavor: 'Problem ownership is, in this dialect, an aggressive return of property.' },
  { id: 'cv2-s-song-and-dance', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'this whole song and dance', tags: ['dismissive', 'swaggering'], stats: { chutzpah: 2 },
    flavor: 'Two art forms collapse into one verdict.' },
  { id: 'cv2-s-half-baked-plan', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your half-baked plan', tags: ['dismissive', 'threatening'], stats: { chutzpah: 2 },
    flavor: 'Half being the part that came out of the oven.' },
  { id: 'cv2-s-sorry-excuse', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your sorry excuse for an argument', tags: ['dismissive', 'threatening'], stats: { chutzpah: 2 },
    flavor: 'Sorry, in this register, is the only sincere word.' },
  { id: 'cv2-s-handling-yourself', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "the way you're handling yourself", tags: ['direct', 'threatening'], stats: { chutzpah: 2 },
    flavor: 'Handling being a verb of escalating concern.' },
  { id: 'cv2-s-last-five-minutes', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: "everything you've said in the last five minutes", tags: ['dismissive', 'direct'], stats: { chutzpah: 2 },
    flavor: 'Five minutes being a charitable estimate.' },
  { id: 'cv2-s-your-tone', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'your tone with me', tags: ['demanding', 'threatening'], stats: { chutzpah: 2 },
    flavor: 'Tone, having been with you, is now between us.' },
  // v2.7: NOVEL — Bleed (damage-over-time). On stage, applies DOT to the
  // enemy: 3 composure dmg per turn for 3 turns. Persistent damage source
  // that pressures grindy bosses.
  { id: 'cv2-s-your-every-breath', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your every breath from now on', tags: ['threatening', 'demanding'], stats: { chutzpah: 3 },
    effects: { applyDot: { damage: 3, turns: 3 } },
    flavor: "Now on, in this case, being unspecified. But long." },
  // v2.7: NOVEL — Energy Refund. On stage, refunds +2 energy. Tempo subject
  // that lets you push deeper into a turn after staging.
  { id: 'cv2-s-yourself-mostly', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'yourself, mostly', tags: ['dismissive', 'direct'], stats: { chutzpah: 3 },
    effects: { refundEnergy: 2 },
    flavor: 'A self is a budget. We balance the books.' },

  // ---- Uncommon (6) ----
  { id: 'cv2-s-audacity', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the audacity of bringing that here', tags: ['dismissive', 'threatening'], stats: { chutzpah: 3 },
    flavor: 'Audacity being its own category of crime.' },
  { id: 'cv2-s-keep-showing-up', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the way you keep showing up', tags: ['dismissive', 'threatening', 'direct'], stats: { chutzpah: 3 },
    flavor: "The keep is the part we'll be discussing." },
  { id: 'cv2-s-basic-respect', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'your continued lack of basic respect', tags: ['demanding', 'dismissive'], stats: { chutzpah: 3 },
    flavor: 'Continued being the part that signals: this is a pattern now.' },
  { id: 'cv2-s-entire-universe', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "the entire universe you've built around this", tags: ['dismissive', 'swaggering'], stats: { chutzpah: 3 },
    flavor: 'Universes being, in this case, structurally unsound.' },
  { id: 'cv2-s-special-grade', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: "the special grade of nonsense you've prepared", tags: ['dismissive', 'threatening'], stats: { chutzpah: 3 },
    flavor: 'Special grade implying considerable effort. The effort is noted.' },
  { id: 'cv2-s-standing-pretending', slot: 'subject', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'word',
    phrase: 'the way you stand there pretending', tags: ['dismissive', 'direct'], stats: { chutzpah: 3 },
    flavor: 'The standing is the indictment. The pretending is the closing argument.' },

  // ---- Rare (2) ----
  { id: 'cv2-s-unforced-errors', slot: 'subject', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: "the long, long list of unforced errors you've called a career", tags: ['dismissive', 'threatening', 'direct'], stats: { chutzpah: 4 },
    flavor: 'Long, long being two of the most damning words in commercial English.' },
  { id: 'cv2-s-brought-you-here', slot: 'subject', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'word',
    phrase: 'everything that brought you to this exact moment, here, in front of me', tags: ['threatening', 'direct', 'swaggering'], stats: { chutzpah: 4 },
    flavor: 'Brought being a verb of unwanted gravity.' },
];

// =============================================================================
// TARGETS (15)
// =============================================================================

const TARGETS = [
  // ---- Common (5) ----
  { id: 'cv2-t-stops-now', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'stops right now.', tags: ['demanding', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 5, multiplier: 3, damageType: 'composure', rider: { weak: 1 } },
    flavor: 'Now being a word that, in chutzpah, carries actual force.' },
  { id: 'cv2-t-is-over', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'is over.', tags: ['demanding', 'dismissive'],
    effect: { scaleBy: 'chutzpah', base: 7, multiplier: 3, damageType: 'composure' },
    flavor: 'Two words, one verdict.' },
  { id: 'cv2-t-wont-fly', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: "won't fly here.", tags: ['dismissive', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 6, multiplier: 3, damageType: 'composure' },
    flavor: 'Flying having been previously discussed and ruled out.' },
  { id: 'cv2-t-cost-you', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'is gonna cost you.', tags: ['threatening'],
    effect: { scaleBy: 'chutzpah', base: 7, multiplier: 3, damageType: 'composure' },
    flavor: 'Gonna is the threat. Cost is the receipt.' },
  { id: 'cv2-t-ends-today', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'ends today.', tags: ['swaggering', 'demanding'],
    effect: { scaleBy: 'chutzpah', base: 5, multiplier: 3, damageType: 'composure', drawAfterCast: 1 },
    flavor: 'Today being the new deadline.' },

  // ---- Uncommon (6) ----
  { id: 'cv2-t-find-weather', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is about to find some weather.', tags: ['threatening', 'swaggering'],
    effect: { scaleBy: 'chutzpah', base: 7, multiplier: 3, damageType: 'composure', rider: { weak: 1 } },
    flavor: 'Weather being a forthcoming meteorological fact.' },
  { id: 'cv2-t-bit-off', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'just bit off more than it can chew.', tags: ['threatening', 'dismissive'],
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 3, damageType: 'composure' },
    flavor: 'The chewing was always optional. The biting is now mandatory.' },
  { id: 'cv2-t-find-out', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is gonna find out exactly how this works.', tags: ['threatening', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 2, damageType: 'composure', rider: { vulnerable: 1 } },
    flavor: 'Find out being a phrase with established consequences.' },
  { id: 'cv2-t-wrong-building', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is the wrong building, friend.', tags: ['dismissive', 'threatening'],
    effect: { scaleBy: 'chutzpah', base: 9, multiplier: 2, damageType: 'composure' },
    flavor: 'Friend, in chutzpah, is a contranym.' },
  { id: 'cv2-t-worst-day', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'has chosen the worst day of its short life.', tags: ['swaggering', 'threatening'],
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 3, damageType: 'composure' },
    flavor: 'Choice having been a hypothetical for some time.' },
  { id: 'cv2-t-consequences', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is gonna learn what consequences look like.', tags: ['threatening', 'demanding'],
    effect: { scaleBy: 'chutzpah', base: 9, multiplier: 2, damageType: 'composure', rider: { weak: 2 } },
    flavor: 'Look like being a polite way to say feel like.' },
  // v2.4: HP-cost target with damage payoff. Bleeds for impact.
  { id: 'cv2-t-bleeds-for-it', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'bleeds for what it believes in.', tags: ['threatening', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 11, multiplier: 3, damageType: 'composure', drawAfterCast: 1, loseHpOnCast: 3 },
    flavor: 'The blood is rhetorical. The conviction is not.' },

  // ---- Rare (4) ----
  { id: 'cv2-t-over-my-head', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is officially over my head.', tags: ['dismissive', 'swaggering'],
    effect: { scaleBy: 'chutzpah', base: 10, multiplier: 3, damageType: 'composure', rider: { weak: 2 } },
    flavor: 'Said with the gravity of a man with an extra inch of headroom.' },
  { id: 'cv2-t-ted-talk', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is gonna be a TED talk in three weeks, the unhinged kind.', tags: ['dismissive', 'threatening'],
    effect: { scaleBy: 'chutzpah', base: 12, multiplier: 3, damageType: 'composure', tier3Double: true },
    flavor: 'Three weeks being the standard processing time for unhinged.' },
  { id: 'cv2-t-stops-here-ends-here', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'stops here, ends here, and gets buried here.', tags: ['demanding', 'threatening', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 11, multiplier: 3, damageType: 'composure', rider: { vulnerable: 1 } },
    flavor: "The triple is for those who didn't hear the first time." },
  { id: 'cv2-t-actually-feel', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 3, type: 'effect',
    phrase: "is fixin' to get acquainted with how I actually feel.", tags: ['threatening', 'direct', 'swaggering'],
    effect: { scaleBy: 'chutzpah', base: 14, multiplier: 3, damageType: 'composure',
             requiresTier3: { failureDamageMult: 0.5, exhaustOnFail: true } },
    flavor: 'Acquainted being a verb with substantial sequelae.' },
  // v2.11: ALL IN targets — double the stake bonus, or refund half on hit.
  { id: 'cv2-t-double-or-nothing', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: 'or nothing, frankly.', tags: ['demanding'],
    effect: { scaleBy: 'chutzpah', base: 5, multiplier: 3, damageType: 'composure',
              stakeMultiplier: 1.25 },
    desc: 'Cast: 5 + Chutzpah comp. Staked HP gives +1.25 dmg/HP.',
    flavor: 'There is no nothing. There is only what they make of you.' },
  { id: 'cv2-t-and-i-mean-it', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'and I mean it.', tags: ['threatening', 'swaggering'],
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 3, damageType: 'composure',
              stakeRefundHalf: true },
    desc: 'Cast: 8 + Chutzpah comp. If staked: heal half the stake on hit.',
    flavor: 'Means it. Has the receipts. The receipts are large.' },
  { id: 'cv2-t-big-mistake', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: 'is a big mistake. Huge.', tags: ['threatening', 'swaggering'],
    effect: { scaleBy: 'chutzpah', base: 18, multiplier: 3, damageType: 'composure',
              requiresStake: 8 },
    desc: 'REQUIRES 8+ HP staked. 18 + Chutzpah comp.',
    flavor: 'Sometimes you have to say it loud. This is one of those.' },
];

// =============================================================================
// MODIFIERS (10)
// =============================================================================

const MODIFIERS = [
  // ---- Common (4) ----
  { id: 'cv2-m-swear-to-god', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'modifier',
    modifierKind: 'pre', phrase: 'I swear to god,', tags: ['swaggering'], stats: { chutzpah: 1 },
    modifierEffect: { addsTag: 'swaggering' },
    flavor: 'The god is invoked rhetorically. Often.' },
  { id: 'cv2-m-and-i-mean-it', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'post', phrase: '— and I mean it.', tags: ['demanding'],
    modifierEffect: { addsTag: 'demanding', rider: { weak: 1 } },
    flavor: 'Mean being a verb in continuous tense.' },
  { id: 'cv2-m-no-kidding', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'pre', phrase: 'No kidding,', tags: ['direct'],
    modifierEffect: { addsTag: 'direct', drawAfterCast: 1 },
    flavor: 'Kidding having been ruled out from the opening.' },
  { id: 'cv2-m-not-even-a-little', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'post', phrase: '— not even a little.', tags: ['dismissive'],
    modifierEffect: { addsTag: 'dismissive', conditionalMult: { tier2Plus: 1.5 } },
    flavor: 'A little, in this measure, is the smallest unit of forgiveness.' },

  // ---- Uncommon (4) ----
  { id: 'cv2-m-slams-hand', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'pre', phrase: '(slams hand on table,)', tags: ['direct'],
    modifierEffect: { addsTag: 'direct', rider: { vulnerable: 1 } },
    flavor: 'Table is, structurally, fine. Was.' },
  { id: 'cv2-m-promise', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: "— and that's a promise.", tags: ['threatening'],
    modifierEffect: { addsTag: 'threatening', damageMult: 1.5 },
    flavor: 'Promises being, in this currency, redeemable on arrival.' },
  { id: 'cv2-m-very-calmly', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'pre', phrase: '(very calmly,)', tags: ['threatening'],
    modifierEffect: { addsTag: 'threatening', rider: { vulnerable: 1 }, stripEnemyBlock: 1 },
    flavor: 'The calm IS the threat. Witnesses report goosebumps.' },
  { id: 'cv2-m-louder', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: "— and I'll say it again louder.", tags: ['swaggering'],
    modifierEffect: { perSharedTag: 3 },
    flavor: 'Volume being, in chutzpah, a multiplier on truth.' },

  // ---- Rare (2) ----
  { id: 'cv2-m-mark-my-words', slot: 'modifier', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: "— mark my words, write 'em down,", tags: ['threatening'],
    modifierEffect: { tier3Payoff: { damageMult: 2.0, rider: { weak: 2 } } },
    flavor: 'The writing-down is for the courts.' },
  { id: 'cv2-m-doesnt-blink', slot: 'modifier', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'pre', phrase: "(eye contact, doesn't blink,)", tags: ['threatening', 'demanding'],
    modifierEffect: { addsTag: 'threatening', stripEnemyBlock: 2, damageMult: 1.5 },
    flavor: 'Blinking having been ruled out at the door.' },
  // Defensive modifier — block on cast.
  { id: 'cv2-m-plant-feet', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'pre', phrase: '(plants feet,)', tags: ['direct', 'threatening'],
    modifierEffect: { addsTag: 'direct', rider: { block: 4 } },
    flavor: 'The plant is decisive. The feet, sturdy.' },
  // v2.4: HP-cost modifier — pay HP for a big damage multiplier.
  { id: 'cv2-m-rolls-up-sleeves', slot: 'modifier', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'pre', phrase: '(rolls up sleeves,)', tags: ['direct', 'threatening'],
    modifierEffect: { damageMult: 1.5, loseHpOnCast: 2 },
    flavor: 'The sleeves were already up. The roll is for the audience.' },
];

// v2.5/2.6: SHOUTS (chutzpah's gesture variant), PONTIFICATIONS, QUIPS.
const GESTURES = [
  { id: 'cv2-g-slams-table', slot: 'gesture', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'gesture',
    phrase: '(SLAMS THE TABLE,)', tags: ['threatening', 'direct'],
    gestureEffect: { icon: '💥', damage: 6, damageType: 'composure', trayMultiplier: 1, rider: { vulnerable: 1 }, exhaust: true },
    flavor: 'The table was a witness. The table is now also a victim.' },
  // v2.6: Pontification — high-cost monologue, NOT exhausted.
  { id: 'cv2-g-pontificate', slot: 'gesture', tier: 2, rarity: 'uncommon', lane: LANE, cost: 3, type: 'gesture',
    phrase: 'GET A LOAD OF THIS:', tags: ['swaggering', 'direct'],
    gestureEffect: { icon: '📣', damage: 12, damageType: 'composure', trayMultiplier: 2, exhaust: false },
    flavor: 'A load is exactly what they are about to get.' },
  // v2.6: Quip — strip-block style threat.
  { id: 'cv2-g-quip-eyebrow', slot: 'gesture', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'gesture',
    phrase: '(quip, with raised eyebrow,)', tags: ['dismissive', 'swaggering'],
    gestureEffect: { icon: '😏', damage: 4, damageType: 'composure', stripEnemyBlock: 6, exhaust: false },
    flavor: 'The eyebrow is the threat. The quip is the apology for the eyebrow.' },
];

// v2.6: Modifiers for the new chutzpah lane.
const NEW_MODIFIERS_V26 = [
  { id: 'cv2-m-say-again', slot: 'modifier', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'modifier',
    modifierKind: 'post', phrase: '— AND I WILL SAY IT AGAIN,', tags: ['threatening', 'direct'],
    modifierEffect: { damageMult: 2.0 },
    flavor: 'Repetition: the soul of persuasion.' },
  // v2.11: ALL IN synergy — doubles the stake bonus on the spell.
  { id: 'cv2-m-not-even-half-kidding', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'post', phrase: '— and I am not even half kidding.',
    tags: ['threatening', 'direct'], stats: { chutzpah: 1 },
    modifierEffect: { stakeAutoDouble: true },
    desc: 'Doubles any staked-HP bonus damage on this cast.',
    flavor: 'Not the other half. The first half.' },
];

// v2.5: UNIQUE TARGET — scales when player has taken HP damage this combat.
// Chutzpah's "I bleed, you pay" identity, mechanized.
const UNIQUE_TARGETS = [
  { id: 'cv2-t-make-me-say-it', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: "doesn't get to make me say it twice.", tags: ['threatening', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 2, damageType: 'composure', missingHpBonus: 0.5 },
    flavor: 'The first time was a courtesy. The second would be a confession.' },
  // v2.24: RAGE payoff target. Big base + multiplier, but ONLY castable
  // while Tunnel Vision is at 5+ (RAGE turn). Off-rage cast = half damage +
  // exile (the punishment for swinging without the heat behind it).
  { id: 'cv2-t-bare-knuckles', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'Bare knuckles.', tags: ['threatening', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 12, multiplier: 4, damageType: 'composure', requiresRage: true },
    desc: 'REQUIRES RAGE. 12 + Chutzpah×4 comp. Off-rage: half damage, exiled.',
    flavor: 'The discussion has moved past words.' },
  // v2.25: DOUBLING DOWN cards — chutzpah's consequence-stack mechanic.
  // Each `doubleDown: true` cast banks a "Backed Into A Corner" token. If
  // the enemy is still alive at end of turn, you take 2 HP per token.
  // Strategic gate: cast only when you're sure of the kill, or eat the bill.
  { id: 'cv2-t-blinks-first', slot: 'target', tier: 1, rarity: 'common', lane: LANE, cost: 1, type: 'effect',
    phrase: "or we'll see who blinks first.", tags: ['threatening', 'demanding'],
    effect: { scaleBy: 'chutzpah', base: 6, multiplier: 3, damageType: 'composure', doubleDown: true },
    desc: 'Cast: 6 + Chutzpah×3 comp. DOUBLE DOWN: +1 corner token. If enemy survives the turn, -2 HP.',
    flavor: 'Blinking, in this dialect, is a verb with sequelae.' },
  { id: 'cv2-t-last-word', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: "and that's the LAST word on it.", tags: ['demanding', 'direct', 'threatening'],
    effect: { scaleBy: 'chutzpah', base: 10, multiplier: 4, damageType: 'composure', doubleDown: true, rider: { weak: 1 } },
    desc: 'Cast: 10 + Chutzpah×4 comp · Weak 1. DOUBLE DOWN: +1 corner token. If enemy survives the turn, -2 HP.',
    flavor: 'Last words being a category that tends to multiply, in chutzpah.' },
  // v2.26: STORMING OUT — chutzpah's commit-and-flee finisher. Cast burns
  // every remaining energy point as +5 damage each, then ends the turn
  // immediately (no draw, no block, no end-of-turn anything). Enemy's next
  // intent is HIDDEN — the player doesn't get to peek. Strategic gate:
  // close the kill in one swing or eat blind next turn.
  { id: 'cv2-t-last-problem', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 1, type: 'effect',
    phrase: 'is officially my last problem.', tags: ['dismissive', 'threatening', 'swaggering'],
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 3, damageType: 'composure',
              stormOut: true, bonusPerEnergy: 5 },
    desc: 'STORM OUT. Cast: 8 + Chutzpah×3 + 5/Energy. Burns all energy, ends turn, enemy intent hidden.',
    flavor: "After this one, I'm leaving. Briefly. You won't see me go." },
];

// v2.29: SAYING IT LOUDER — repetition scaling. Each chutzpah word card
// (intro/subject/modifier) with the 'demanding' tag played this turn bumps
// `loudCount`. "I SAID." target reads loudCount and scales damage by ×3
// per louder say. "I said," is the cheap intro that exists purely to be
// re-said — it doesn't bump on its own use beyond carrying the tag, but
// stacking multiple demanding-tagged words is the combo path.
const SAYING_IT_LOUDER_CARDS = [
  { id: 'cv2-i-i-said', slot: 'intro', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'I said,', tags: ['demanding', 'direct'], stats: { chutzpah: 2 },
    desc: '+1 loud (demanding) this turn.',
    flavor: 'The comma is a load-bearing wall.' },
  { id: 'cv2-t-i-said-loud', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'I SAID.', tags: ['demanding', 'threatening'],
    effect: { scaleBy: 'chutzpah', base: 6, multiplier: 3, damageType: 'composure',
              loudScaling: true, rider: { weak: 1 } },
    desc: 'Cast: 6 + Chutzpah×3 comp · Weak 1. +3 dmg per demanding chutzpah word played this turn.',
    flavor: 'Bold all-caps is, technically, three louds.' },
];

// v2.33: NOT LISTENING — refactored from a Power to a one-shot SKILL.
// Previous (v2.32) implementation was a cost-1 Power that absorbed the first
// Weak/Vuln per combat AND granted +1 Block per chutzpah cast. The on-cast
// Block rider overlapped Stubborn Block's defensive-Power niche, and at 5%
// engagement the Power slot was wasted. Refactored: the absorb-the-next-debuff
// effect is now a 0-cost common SKILL — instant, single-use, fires the first
// time an enemy attempts Weak OR Vuln after you play it. The on-cast Block
// rider is GONE — that piece belonged to Stubborn Block. Pairs with
// "Couldn't quite catch that," (the cleanse modifier) which strips already-
// landed stacks; "Sorry — what?" the skill stops the FIRST one from sticking.
const NOT_LISTENING_SKILL_ABSORB = [
  { id: 'cv2-k-sorry-what', slot: 'skill', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'skill',
    name: 'Sorry — what?', phrase: 'Sorry — what?',
    tags: ['dismissive', 'swaggering'],
    effects: { absorbNextDebuff: 1 },
    desc: 'Skill. The next time an enemy attempts to apply Weak OR Vulnerable to you, ignore it.',
    flavor: 'Said with the genuine concentration of someone who actually did not hear.' },
];

const NOT_LISTENING_SKILL = [
  { id: 'cv2-k-couldnt-catch-that', slot: 'skill', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'skill',
    name: "Couldn't quite catch that,", phrase: "Couldn't quite catch that,",
    tags: ['dismissive', 'direct'],
    stats: { chutzpah: 1 },
    effects: { removeWeak: 1, removeVulnerable: 1 },
    desc: 'Remove 1 stack of Weak AND 1 stack of Vulnerable from you.',
    flavor: 'Volume problem? Comprehension problem? Both, probably.' },
];

// v2.27: HIT ME AGAIN — chutzpah's reactive power. Cost 1, installs on the
// field for the duration of combat. Every enemy attack that LANDS (blocked
// or not) adds +1 to a `hitMeAgainCharges` counter. At the START of every
// subsequent enemy attack — including each swing of an attack-multi — the
// enemy first eats `charges` self-damage to their composure pool (or HP if
// the composure pool is the immortal sentinel). Charges DO NOT reset; they
// snowball. First swing of the combat is free for the enemy; each swing
// after that costs them more than the last. Lane-defining offensive-defense
// — you don't dodge, you bill.
const HIT_ME_AGAIN_POWER = [
  { id: 'cv2-p-hit-me-again', slot: 'power', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'power',
    name: 'Hit me again.', phrase: 'Hit me again.',
    tags: ['swaggering', 'threatening', 'demanding'],
    installPower: { id: 'hit-me-again' },
    desc: 'Power. Each enemy hit on you arms +1 recoil. Next enemy swing (including each in a multi) takes that much self-damage BEFORE it lands. Recoil never resets.',
    flavor: 'Keep hitting me. Watch what it costs you.' },
];

// v2.33: STUBBORN BLOCK + FRANKLY NO removed — they were wit-flavored cards
// (accumulate Block, refuse-to-move defense) on a lane whose identity is
// "I do not retreat, I bill them for the privilege." Hit Me Again is
// chutzpah's true defensive identity (absorb hits and bill the enemy for
// each one). Removed to sharpen the lane.

// v2.29: split SAYING_IT_LOUDER_CARDS by slot for the by-slot export.
const SAYING_IT_LOUDER_INTROS = SAYING_IT_LOUDER_CARDS.filter(c => c.slot === 'intro');
const SAYING_IT_LOUDER_TARGETS = SAYING_IT_LOUDER_CARDS.filter(c => c.slot === 'target');

// v2.30: SMELL WEAKNESS — predator rider. A subject that applies Vulnerable
// on stage (setting up the predator condition AND pumping chutzpah stat), and
// an uncommon target whose `predator: 6` rider adds +6 flat damage when the
// enemy is currently debuffed (Vulnerable OR Weak). The combo: stage the
// subject first to apply Vuln, then cast with the predator target for the
// +6. Pairs naturally with any other Vuln/Weak applier already in the lane.
const SMELL_WEAKNESS_CARDS = [
  { id: 'cv2-s-blood-in-water', slot: 'subject', tier: 1, rarity: 'common', lane: LANE, cost: 0, type: 'word',
    phrase: 'smells like blood in the water,', tags: ['threatening', 'dismissive'], stats: { chutzpah: 2 },
    effects: { vulnerable: 1 },
    desc: 'Stage: apply Vulnerable 1.',
    flavor: 'You weren\'t supposed to bleed where they could smell.' },
  { id: 'cv2-t-comes-apart', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: 'comes apart in your hands.', tags: ['threatening', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 7, multiplier: 3, damageType: 'composure', predator: 6 },
    desc: 'Cast: 7 + Chutzpah×3 comp. PREDATOR: +6 dmg if the enemy is Vulnerable or Weak.',
    flavor: 'In retrospect, the warning signs were everywhere.' },
];

const SMELL_WEAKNESS_SUBJECTS = SMELL_WEAKNESS_CARDS.filter(c => c.slot === 'subject');
const SMELL_WEAKNESS_TARGETS  = SMELL_WEAKNESS_CARDS.filter(c => c.slot === 'target');

// v2.31: SYNERGY CAPSTONE — "AND I'M NOT DONE." pulls together three existing
// chutzpah primitives into one triple-rider rare. doubleDown banks a corner
// token (Doubling Down's tax — if this doesn't kill, you bleed); loudScaling
// reads the demanding-tag count built up that turn (Saying it Louder); and
// predator adds +4 flat when the enemy is debuffed (Smell Weakness). All three
// riders are already wired through computeSpellDamage and the cast pipeline —
// this card is content-only convergence. Paired modifier "I've barely warmed
// up," (tier-2 uncommon, demanding-tagged) lets a player stack a 3rd
// demanding-tagged word per turn (intro+subject was the cap; modifier is the
// extra slot), AND pumps tunnel vision toward RAGE on stage.
const SYNERGY_CAPSTONE_CARDS = [
  { id: 'cv2-t-and-im-not-done', slot: 'target', tier: 3, rarity: 'rare', lane: LANE, cost: 2, type: 'effect',
    phrase: "AND I'M NOT DONE.", tags: ['demanding', 'threatening', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 10, multiplier: 3, damageType: 'composure',
              doubleDown: true, loudScaling: true, predator: 4 },
    desc: 'Cast: 10 + Chutzpah×3 comp. DOUBLE DOWN (+corner token), LOUDER (+3/demanding), PREDATOR (+4 if debuffed).',
    flavor: "The proof is that I'm still talking. Quod erat demonstrandum." },
  { id: 'cv2-m-barely-warmed-up', slot: 'modifier', tier: 2, rarity: 'uncommon', lane: LANE, cost: 1, type: 'modifier',
    modifierKind: 'pre', phrase: "I've barely warmed up,",
    tags: ['demanding', 'swaggering'], stats: { chutzpah: 1 },
    effects: { tunnelVision: 1 },
    modifierEffect: { addsTag: 'demanding' },
    desc: 'Stage: +1 Tunnel Vision. Carries demanding tag (feeds louder).',
    flavor: 'Warmth being, in chutzpah, a one-way function.' },
];

const SYNERGY_CAPSTONE_TARGETS  = SYNERGY_CAPSTONE_CARDS.filter(c => c.slot === 'target');
const SYNERGY_CAPSTONE_MODIFIERS = SYNERGY_CAPSTONE_CARDS.filter(c => c.slot === 'modifier');

export const CHUTZPAH_V2 = [...INTROS, ...SUBJECTS, ...TARGETS, ...MODIFIERS, ...NEW_MODIFIERS_V26, ...GESTURES, ...UNIQUE_TARGETS, ...HIT_ME_AGAIN_POWER, ...SAYING_IT_LOUDER_CARDS, ...SMELL_WEAKNESS_CARDS, ...SYNERGY_CAPSTONE_CARDS, ...NOT_LISTENING_SKILL_ABSORB, ...NOT_LISTENING_SKILL];
export const CHUTZPAH_V2_BY_SLOT = {
  intro: [...INTROS, ...SAYING_IT_LOUDER_INTROS],
  subject: [...SUBJECTS, ...SMELL_WEAKNESS_SUBJECTS],
  target: [...TARGETS, ...UNIQUE_TARGETS, ...SAYING_IT_LOUDER_TARGETS, ...SMELL_WEAKNESS_TARGETS, ...SYNERGY_CAPSTONE_TARGETS],
  modifier: [...MODIFIERS, ...NEW_MODIFIERS_V26, ...SYNERGY_CAPSTONE_MODIFIERS],
  gesture: GESTURES,
  power: [...HIT_ME_AGAIN_POWER],
  skill: [...NOT_LISTENING_SKILL_ABSORB, ...NOT_LISTENING_SKILL],
};
