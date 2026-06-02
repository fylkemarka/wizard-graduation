// Enemy roster + behaviors. Extracted from App.jsx 2026-06-01 so the
// gameplay sim (sim/playSimV2.js) imports the SAME source of truth and
// cannot drift on enemy stats/behaviors. Edit enemies HERE only.

export const ENEMIES = [
  // ===== ACT 3 — The Staff Path (the deep forest, final act) =====
  { id: 'e1-acolyte', act: 3, name: 'Lost Acolyte', composureMax: 25, hpMax: 18, tier: 'normal',
    softSpot: 'logic', // Wants someone to explain what they're doing here.
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
      { kind: 'attack', value: 3, weight: 2, telegraph: '⚔ 3 (faltering)' },
    ] },
  { id: 'e1-imp', act: 3, name: 'Pact Imp', composureMax: 23, hpMax: 999, tier: 'normal',
    // v2.4: handler 0.7 → 1.0 (less hostile to handler in act 1).
    softSpot: 'threat', // Bullies fold the moment you don't.
    behaviors: [
      { kind: 'attack', value: 4, weight: 3, telegraph: '⚔ 4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '⛧ Weak 1' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🩸 Vuln 1' },
    ] },
  { id: 'e1-shrine-rat', act: 3, name: 'Shrine Rat Pack', composureMax: 20, hpMax: 12, tier: 'normal',
    // Cycle 4 batch 4: physical 2.0 → 1.5. Pure-physical was at 64%
    // partly because Shrine Rat and Thicket were freebies for it.
    softSpot: 'threat', // Bigger predator energy = scatter.
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3, telegraph: '⚔ 2×3' },
      { kind: 'block',  value: 4, weight: 1, telegraph: '🛡 4' },
      { kind: 'attack', value: 5, weight: 2, telegraph: '⚔ 5 (lunging)' },
    ] },
  // v2.17: rogue wizard — was about to claim his staff. Got too close
  // to the work. The staff turned him to wood. He is, the records will
  // show, both. The bureaucracy is unclear on the matter.
  { id: 'e-rogue-ashweather', act: 3, name: 'Doctor Phin Ashweather (recently inanimate)',
    composureMax: 45, hpMax: 32, tier: 'normal',
    // failure mode: mystical mishap (transformation). Handler 0.6 —
    // you cannot bully a piece of wood. Wit 1.4 — the absurdity is the
    // wound. Physical 1.0 — he is also wood, axe him.
    softSpot: 'logic', // Point out that he is a staff. He is, technically, aware.
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 (the staff turns)' },
      { kind: 'block',  value: 9, weight: 1, telegraph: '🛡 9 (knots tighten)' },
      { kind: 'attack-multi', value: 4, count: 2, weight: 2, telegraph: '⚔ 4×2 (the staff insists)' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (you remember when he was a person)' },
    ] },
  { id: 'e1-tutor', act: 3, name: 'Stern Tutor', composureMax: 40, hpMax: 999, tier: 'elite',
    softSpot: 'logic', // Will argue the methodology over the outcome.
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (cutting remark)' },
    ] },
  { id: 'e1-thicket', act: 3, name: 'Living Thicket', composureMax: 69, hpMax: 38, tier: 'elite',
    // Cycle 4 batch 4: physical 1.5 → 1.0. The "physical-only" theme stays
    // (verbal at 0.5) but no longer hands pure-physical a 1.5× freebie.
    softSpot: 'confusion', // It is mostly bramble. It has thoughts about that.
    behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'block',  value: 9, weight: 2, telegraph: '🛡 9' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🌀 Vuln' },
    ] },
  { id: 'e1-boss-thornlord', act: 3, name: 'The Thornlord', composureMax: 119, hpMax: 115, tier: 'boss',
    // v2.16: was killing 182/500 handler runs. First pass 0.7→0.85
    // overcorrected (handler jumped to 41%). Settled at 0.75: still
    // a handler-hostile boss, just not a trap.
    softSpot: 'flattery', // Apex predator; flatter the apex.
    insultVulnerabilities: ['petty', 'dismissive', 'sarcastic'], // Apex; cuts most when made small.
    behaviors: [
      { kind: 'attack', value: 15, weight: 2, telegraph: '⚔ 15' },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, telegraph: '⚔ 5×4 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'block',  value: 16, weight: 1, telegraph: '🛡 16' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 (bramble-whisper)' },
    ] },

  // ===== ACT 1 — The Thread Path (the countryside) =====
  { id: 'e2-hollow-weaver', act: 1, name: 'Hollow Weaver', composureMax: 28, hpMax: 999, tier: 'normal',
    softSpot: 'logic', // Half-finished thoughts; finish them and it folds.
    // v2.96: signature mechanic = Weave debt. Each "weave" intent stacks
    // +N on the player; ending a turn without casting fires ALL stacks as
    // composure damage and clears. Forces "cast something every turn" —
    // chip-cast skipping gets punished hard. Standard attacks alternate
    // with weave intents so the player must defend AND keep the pressure on.
    behaviors: [
      { kind: 'weave', value: 2, weight: 3, telegraph: '🪡 Weave +2 (fires as 🎭 if you don\'t cast)' },
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 7, weight: 2, telegraph: '⚔ 7' },
      { kind: 'attack', value: 4, pool: 'composure', weight: 1, telegraph: '🎭 4 (half-thought)' },
    ] },
  { id: 'e2-silk-wraith', act: 1, name: 'Silk Wraith', composureMax: 25, hpMax: 999, tier: 'normal',
    softSpot: 'confusion', // Already half-there. Push it further.
    behaviors: [
      // v2.9.2: silk-thread cuts now hit harder + composure-pool option.
      { kind: 'attack-multi', value: 4, count: 3, weight: 3, telegraph: '⚔ 4×3' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 2, telegraph: '🎭 6 (silken whisper)' },
      { kind: 'block',  value: 6, weight: 1, telegraph: '🛡 6' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🩸 Vuln 1' },
      // Maul (Alan, 2026-06-02): silk-snare. Block it ALL or it drags your
      // strongest animal off into the web. ~22% of rolls.
      { kind: 'attack', maul: true, value: 7, weight: 2, telegraph: '🦷 7 — silk-snare (unblocked → lose your strongest animal)' },
    ] },
  { id: 'e2-loom-familiar', act: 1, name: 'Loom Familiar', composureMax: 30, hpMax: 999, tier: 'normal',
    softSpot: 'flattery', // Misses its weaver. Speak as if it still mattered.
    // v2.96: signature mechanic = Hand pressure. The Loom Familiar reaches
    // into your hand and pulls a card it "needs to weave with." Forces
    // hand-management: do you play your key spell pieces this turn or
    // risk losing them? Lower base attack values to compensate — the
    // card-loss IS the pressure.
    behaviors: [
      // v3.1.2: weight 3 → 2. 37.5% discard rate was locking wit players
      // out of casts (they only carry 1 of each intro/subject/target;
      // losing one to a random pull means no cast that cycle until
      // reshuffle). Now ~25% per turn, paired with the smarter target
      // filter (prefers utility cards over spell pieces).
      { kind: 'discard-hand', value: 1, weight: 2, telegraph: '🗑 takes 1 from your hand' },
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'attack', value: 4, weight: 2, telegraph: '⚔ 4 + ⛧ Weak 1 (thread-tangle)', riders: { weak: 1 } },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1, telegraph: '🎭 5 (lonely-thread)' },
    ] },
  // v2.17: ROGUE WIZARDS — first wave. Failed-graduate wizards still
  // working at their craft, refusing to come back. Names follow the
  // Pratchett-tone with parenthetical bureaucratic annotations.
  { id: 'e-rogue-linenfast', act: 1, name: 'Bartholomew Linenfast (still adjusting the hem)',
    composureMax: 28, hpMax: 999, tier: 'normal',
    // failure mode: refusal. 50 years on the same hem. Wit can't
    // out-argue him (heard every version); jnsq breaks his focus.
    softSpot: 'confusion',
    behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6 + ⛧ Weak 1 (stitch, weakly)', riders: { weak: 1 } },
      { kind: 'attack', value: 7, pool: 'composure', weight: 2, telegraph: '🎭 7 (murmuring about the hem)' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7 (measures, again)' },
      { kind: 'attack-multi', value: 3, count: 2, weight: 1, telegraph: '⚔ 3×2 (stitch, unstitch)' },
    ] },
  { id: 'e2-pattern-maker', act: 1, name: 'The Pattern-Maker', composureMax: 50, hpMax: 999, tier: 'elite',
    softSpot: 'confusion', // Patterns hate exceptions.
    behaviors: [
      // v3.4.53 (Alan: "Pattern-Maker hits too hard, BARELY beat it"). With
      // the global 1.25× scalar, base 15 → 19 HP burst and 4×3 → 5×3 = 15
      // HP attack-multi were spiking past the basic Defend ceiling.
      // Bursts dialed down: 15 → 12 (scales to 15), 4×3 → 3×3 (scales to
      // 4×3 = 12). 11 + Vuln untouched (14 with vuln is still real).
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 2, telegraph: '🎭 7 (pattern-wrong)' },
      // v3.4.80 (Alan: "Pattern Maker hits way too hard on composure").
      // 13 → 9 (post-scalar 11). Still the highest single-hit composure
      // attack in the game; next-highest enemy is 8 (post-scalar 10). The
      // pre-fix 13 scaled to 16 — over half the baseline 30 composure pool
      // in one telegraph, which read as one-shot territory.
      { kind: 'attack', value: 9, pool: 'composure', weight: 1, telegraph: '🎭 9 (PATTERN COMPLETE)' },
      // HP-side burst — the pattern lashes out physically.
      { kind: 'attack', value: 12, weight: 1, telegraph: '⚔ 12 (BROKEN-PATTERN STRIKE)' },
    ] },
  { id: 'e2-silent-spinner', act: 1, name: 'The Silent Spinner', composureMax: 50, hpMax: 999, tier: 'elite',
    softSpot: 'threat', // The vow of silence has limits.
    behaviors: [
      { kind: 'block',  value: 10, weight: 2, telegraph: '🛡 10 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 8,  weight: 2, telegraph: '⚔ 8 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 6, pool: 'composure', weight: 2, telegraph: '🎭 6 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      // v2.9 burst — telegraphed big swing to HP. "Loud silence" is a
      // breaking-of-the-vow moment.
      { kind: 'attack', value: 14, weight: 1, telegraph: '⚔ 14 (LOUD SILENCE)' },
    ] },
  { id: 'e2-boss-tapestry', act: 1, name: 'The Tapestry Walker', composureMax: 69, hpMax: 999, tier: 'boss',
    softSpot: 'flattery', // Vain creator. Praise the work to crack the maker.
    insultVulnerabilities: ['dismissive', 'petty', 'sarcastic'], // Vain — hates being trivialized.
    behaviors: [
      { kind: 'attack', value: 10, weight: 2, telegraph: '⚔ 10 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, telegraph: '⚔ 4×4' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 (loom-song)' },
      { kind: 'block',  value: 10, weight: 1, telegraph: '🛡 10' },
      // Maul (Alan, 2026-06-02): the Walker weaves your strongest beast into
      // the tapestry. Block it all or lose it. Boss-tier stakes, ~25% of rolls.
      { kind: 'attack', maul: true, value: 10, weight: 2, telegraph: '🦷 10 — woven under (unblocked → your strongest animal goes into the pattern)' },
    ] },

  // ===== ACT 2 — The Forge Path (the mines and caves) =====
  { id: 'e3-geode-crab', act: 2, name: 'Geode Crab', composureMax: 28, hpMax: 12, tier: 'normal',
    // v2.4: sharpened from flat-low to handler-favored. Geodes hate
    // being loomed over; jnsq just makes them weirder.
    softSpot: 'threat', // Hard shell, soft instinct. Loom over it.
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 8,  weight: 1, telegraph: '🛡 8' },
      { kind: 'attack', value: 7, weight: 1, telegraph: '⚔ 7 (claw-snap)' },
    ] },
  { id: 'e3-glow-mite', act: 2, name: 'Glow Mite Swarm', composureMax: 23, hpMax: 14, tier: 'normal',
    softSpot: 'confusion', // A swarm of small minds is easily scattered.
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 4, weight: 2, telegraph: '⚔ 2×4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack-multi', value: 2, count: 4, weight: 1, telegraph: '⚔ 2×4' },
      { kind: 'weak',   value: 1, weight: 1, telegraph: '⛧ Weak 1' },
    ] },
  { id: 'e3-crystal-beetle', act: 2, name: 'Crystal Beetle', composureMax: 28, hpMax: 12, tier: 'normal',
    // v2.4: sharpened to wit-favored (its prismatic surfaces refract logic).
    softSpot: 'threat', // Slow, certain, intimidatable.
    behaviors: [
      { kind: 'attack', value: 6, weight: 3, telegraph: '⚔ 6' },
      { kind: 'attack', value: 8, weight: 1, telegraph: '⚔ 8' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5 (carapace)' },
    ] },
  // v2.17: rogue wizard — handler-punisher. Tried to forge a ring of
  // three metals; the ring forged him. The metal absorbs direct threat.
  { id: 'e-rogue-smelterson', act: 2, name: 'Smelterson, J.C. (alloyed)',
    composureMax: 33, hpMax: 14, tier: 'normal',
    // failure mode: transformation. Handler resist 0.6 — you can't
    // bully someone whose identity is partly an iron ring. Jnsq 1.3
    // because absurdity disrupts the alloy. Physical 1.0 — he is, after
    // all, also metal.
    softSpot: 'confusion',
    behaviors: [
      { kind: 'attack', value: 7, weight: 2, telegraph: '⚔ 7 (alloyed strike)' },
      { kind: 'block',  value: 7, weight: 2, telegraph: '🛡 7 + ⛧ Weak 1 (the ring sets)', riders: { weak: 1 } },
      { kind: 'attack', value: 9, weight: 1, telegraph: '⚔ 9 (the ring tells him to)' },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1, telegraph: '🎭 5 (the alloy hums)' },
    ] },
  { id: 'e3-quartz-sentinel', act: 2, name: 'Quartz Sentinel', composureMax: 35, hpMax: 22, tier: 'elite',
    // v2.4: sharpened to wit-favored. Constructs answer to logic.
    softSpot: 'logic', // Constructs respond to the logic they were built with.
    behaviors: [
      { kind: 'attack', value: 10, weight: 2, telegraph: '⚔ 10 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'block',  value: 12, weight: 2, telegraph: '🛡 12 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'attack', value: 8, pool: 'composure', weight: 2, telegraph: '🎭 8 (axiom-strike)' },
      // v2.9 burst — single-pool HP hammer.
      { kind: 'attack', value: 16, weight: 1, telegraph: '⚔ 16 (RULING)' },
    ] },
  { id: 'e3-vein-devourer', act: 2, name: 'Vein Devourer', composureMax: 57, hpMax: 28, tier: 'elite',
    // v2.4: handler-favored. The Devourer responds to direct threat
    // (Walter punches it, it backs off); evades wit and jnsq.
    softSpot: 'confusion', // Doesn't think. Only confusion can confuse it.
    insultVulnerabilities: [], // Mindless. Cannot be insulted. ALL insults backfire on it.
    behaviors: [
      { kind: 'attack', value: 13, weight: 2, telegraph: '⚔ 13 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 5, count: 3, weight: 1, telegraph: '⚔ 5×3' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 + ⛧ Weak 1', riders: { weak: 1 } },
      // v2.9 burst — the Devourer's "DEVOUR" is a 1-shot KO risk.
      { kind: 'attack', value: 18, weight: 1, telegraph: '⚔ 18 (DEVOUR)' },
    ] },
  { id: 'e3-boss-anvil', act: 2, name: 'The Anvil-Forged', composureMax: 63, hpMax: 50, tier: 'boss',
    // v2.4: Anvil flipped from handler-resist to handler-favored. It's
    // a forging boss — it understands direct demands. Jnsq is now the
    // softer side (0.7); wit stays neutral.
    softSpot: 'logic', // Rule-bound smithcraft; argue the specification.
    insultVulnerabilities: ['dismissive', 'petty', 'absurd'], // Rule-bound; absurdity unmoors them.
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1, telegraph: '⚔ 4×4' },
      { kind: 'block',  value: 12, weight: 1, telegraph: '🛡 12' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (hammer-rhythm)' },
    ] },

  // ===== TUTORIAL =====
  // Low-stakes practice partner. All-baseline effectiveness so the
  // player sees clean numbers. Light incoming damage so they learn
  // Block without ever being in danger.
  // ===== SIDEQUEST ENEMIES — gated by sidequest combat nodes =====
  { id: 'sq-critical-apparition', act: 0, name: 'Prof. Augustus Hewn-Greaves (deceased, 1893)', composureMax: 75, hpMax: 999, tier: 'elite',
    softSpot: 'logic',
    insultVulnerabilities: ['dismissive', 'absurd'], // Pedant; absurdity destabilizes him most.
    behaviors: [
      { kind: 'attack', value: 8, pool: 'composure', weight: 2, telegraph: '🎭 8 (citing 1894 paper)', riders: { vulnerable: 1 } },
      { kind: 'attack', value: 6, pool: 'composure', weight: 2, telegraph: '🎭 6 (clearing throat audibly)' },
      { kind: 'weak', value: 1, weight: 2, telegraph: '⛧ Weak 1 (sighs at your argument)' },
      { kind: 'block', value: 12, weight: 1, telegraph: '🛡 12 (citing himself)' },
    ] },

  { id: 'tutorial-bursar', act: 0, name: 'The Bursar (Practice Match)', composureMax: 30, hpMax: 999, tier: 'normal',
    softSpot: 'logic',
    behaviors: [
      { kind: 'attack', value: 3, weight: 2, telegraph: '⚔ 3 (gentle)' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
    ] },
];
export const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));
