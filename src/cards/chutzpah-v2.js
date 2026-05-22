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
    gestureEffect: { icon: '💥', damage: 10, damageType: 'composure', trayMultiplier: 1, rider: { vulnerable: 1 }, exhaust: true },
    flavor: 'The table was a witness. The table is now also a victim.' },
  // v2.6: Pontification — high-cost monologue, NOT exhausted.
  { id: 'cv2-g-pontificate', slot: 'gesture', tier: 2, rarity: 'uncommon', lane: LANE, cost: 3, type: 'gesture',
    phrase: 'GET A LOAD OF THIS:', tags: ['swaggering', 'direct'],
    gestureEffect: { icon: '📣', damage: 20, damageType: 'composure', trayMultiplier: 2, exhaust: false },
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
];

// v2.5: UNIQUE TARGET — scales when player has taken HP damage this combat.
// Chutzpah's "I bleed, you pay" identity, mechanized.
const UNIQUE_TARGETS = [
  { id: 'cv2-t-make-me-say-it', slot: 'target', tier: 2, rarity: 'uncommon', lane: LANE, cost: 2, type: 'effect',
    phrase: "doesn't get to make me say it twice.", tags: ['threatening', 'direct'],
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 2, damageType: 'composure', missingHpBonus: 0.5 },
    flavor: 'The first time was a courtesy. The second would be a confession.' },
];

export const CHUTZPAH_V2 = [...INTROS, ...SUBJECTS, ...TARGETS, ...MODIFIERS, ...NEW_MODIFIERS_V26, ...GESTURES, ...UNIQUE_TARGETS];
export const CHUTZPAH_V2_BY_SLOT = {
  intro: INTROS, subject: SUBJECTS, target: [...TARGETS, ...UNIQUE_TARGETS], modifier: [...MODIFIERS, ...NEW_MODIFIERS_V26], gesture: GESTURES,
};
