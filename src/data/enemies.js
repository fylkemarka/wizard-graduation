// Enemy roster + behaviors. Extracted from App.jsx 2026-06-01 so the
// gameplay sim (sim/playSimV2.js) imports the SAME source of truth and
// cannot drift on enemy stats/behaviors. Edit enemies HERE only.

export const ENEMIES = [
  // ===== ACT 3 — The Staff Path (the deep forest, final act) =====
  // v3.6 (2026-06-10, telemetry): Act-3 (the FINAL act) was the easiest in the
  // run — normals dealt ~0 and no enemy here pressured the handler's
  // summon-tank-block loop. These were pre-handler designs. This pass bumps the
  // damage floor AND ports the Act-1 handler-hostile vocabulary (maul) onto the
  // forest so the menagerie loop finally costs something late.
  { id: 'e1-acolyte', act: 3, name: 'Lost Acolyte', composureMax: 25, hpMax: 18, tier: 'normal',
    behaviors: [
      { kind: 'attack', value: 8, weight: 3, telegraph: '⚔ 8' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
      { kind: 'attack', value: 5, weight: 2, telegraph: '⚔ 5 (faltering)' },
    ] },
  { id: 'e1-imp', act: 3, name: 'Pact Imp', composureMax: 23, hpMax: 999, tier: 'normal',
    // v2.4: handler 0.7 → 1.0 (less hostile to handler in act 1).
    behaviors: [
      { kind: 'attack', value: 6, weight: 3, telegraph: '⚔ 6 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '⛧ Weak 1' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🩸 Vuln 1' },
    ] },
  { id: 'e1-shrine-rat', act: 3, name: 'Shrine Rat Pack', composureMax: 20, hpMax: 12, tier: 'normal',
    // Cycle 4 batch 4: physical 2.0 → 1.5. Pure-physical was at 64%
    // partly because Shrine Rat and Thicket were freebies for it.
    behaviors: [
      { kind: 'attack-multi', value: 3, count: 3, weight: 3, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 4, weight: 1, telegraph: '🛡 4' },
      { kind: 'attack', value: 7, weight: 2, telegraph: '⚔ 7 (lunging)' },
      // The swarm drags a beast off into the dark. Block it or lose it.
      { kind: 'attack', maul: true, value: 5, weight: 1, telegraph: '🦷 5 — the pack drags one off (unblocked → lose your strongest animal)' },
    ] },
  // v2.17: rogue wizard — was about to claim his staff. Got too close
  // to the work. The staff turned him to wood. He is, the records will
  // show, both. The bureaucracy is unclear on the matter.
  { id: 'e-rogue-ashweather', act: 3, name: 'Doctor Phin Ashweather (recently inanimate)',
    composureMax: 45, hpMax: 32, tier: 'normal',
    // failure mode: mystical mishap (transformation). Handler 0.6 —
    // you cannot bully a piece of wood. Wit 1.4 — the absurdity is the
    // wound. Physical 1.0 — he is also wood, axe him.
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 (the staff turns)' },
      { kind: 'block',  value: 9, weight: 1, telegraph: '🛡 9 (knots tighten)' },
      { kind: 'attack-multi', value: 4, count: 2, weight: 2, telegraph: '⚔ 4×2 (the staff insists)' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (you remember when he was a person)' },
    ] },
  { id: 'e1-tutor', act: 3, name: 'Stern Tutor', composureMax: 40, hpMax: 999, tier: 'elite',
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (cutting remark)' },
      // "No familiars in the examination hall." Expels your strongest beast.
      { kind: 'attack', maul: true, value: 6, weight: 1, telegraph: '🦷 6 — sends one from the room (unblocked → lose your strongest animal)' },
    ] },
  { id: 'e1-thicket', act: 3, name: 'Living Thicket', composureMax: 69, hpMax: 38, tier: 'elite',
    // Cycle 4 batch 4: physical 1.5 → 1.0. The "physical-only" theme stays
    // (verbal at 0.5) but no longer hands pure-physical a 1.5× freebie.
    // v3.6 (2026-06-10): was the WEAKEST elite in the game (maxAtk 6). Bumped,
    // and the bramble now ensnares beasts — maul is the natural read for it.
    behaviors: [
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'block',  value: 9, weight: 2, telegraph: '🛡 9' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🌀 Vuln' },
      // Vines close around the nearest animal and pull it into the bramble.
      { kind: 'attack', maul: true, value: 7, weight: 2, telegraph: '🦷 7 — vines drag a beast into the bramble (unblocked → lose your strongest animal)' },
    ] },
  { id: 'e1-boss-thornlord', act: 3, name: 'The Thornlord', composureMax: 119, hpMax: 115, tier: 'boss',
    // v2.16: was killing 182/500 handler runs. First pass 0.7→0.85
    // overcorrected (handler jumped to 41%). Settled at 0.75: still
    // a handler-hostile boss, just not a trap.
    insultVulnerabilities: ['petty', 'dismissive', 'sarcastic'], // Apex; cuts most when made small.
    behaviors: [
      { kind: 'attack', value: 15, weight: 2, telegraph: '⚔ 15' },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, telegraph: '⚔ 5×4 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'block',  value: 16, weight: 1, telegraph: '🛡 16' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 (bramble-whisper)' },
      // v3.6: the apex of the forest claims your beasts outright.
      { kind: 'attack', maul: true, value: 10, weight: 1, telegraph: '🦷 10 — the thorns take one of yours (unblocked → lose your strongest animal)' },
    ] },

  // ===== ACT 1 — The Thread Path (the countryside) =====
  { id: 'e2-hollow-weaver', act: 1, name: 'Hollow Weaver', composureMax: 38, hpMax: 999, tier: 'normal', diff: 2,
    // Duo encounter (Alan, 2026-06-06): the Weaver arrives with a Bobbin
    // Imp in tow. Companion fights alongside it — see App.jsx companion
    // system. Killing the Weaver wins the fight (the imp unravels);
    // killing the imp first just makes the fight safer.
    duoPartnerId: 'e2-bobbin-imp',
    // v2.96 / 2026-06-02: signature mechanic = Weave debt. Each "weave" intent
    // stacks +N on the player. The debt fires at the end of your NEXT turn as
    // composure damage UNLESS you dealt damage to the Weaver that turn — then
    // it clears harmlessly. Lane-agnostic: wit clears it with a cast, the
    // Handler with an animal attack. Forces "keep hurting it every turn."
    // Standard attacks alternate with weave so you must defend AND press.
    // v3.4.82 (2026-06-02, "extremely easy" telemetry): composure 28→38 and
    // base swings up. Combats were ending in 3-4 turns before pressure landed.
    behaviors: [
      { kind: 'weave', value: 3, weight: 3, telegraph: '🪡 Weave +3 — banked 🎭 lands at the end of your next turn' },
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (half-thought)' },
    ] },
  // Companion-tier: never appears alone — paired via duoPartnerId on a
  // main enemy. Excluded from normal/elite node pools by its tier. Kinds
  // are deliberately simple (attack / block / bolster); the companion
  // resolver in App.jsx only speaks this small dialect.
  { id: 'e2-bobbin-imp', act: 1, name: 'Bobbin Imp', composureMax: 14, hpMax: 999, tier: 'companion',
    flavor: 'A spool that learned ambition. It has regretted nothing yet, though it is young.',
    behaviors: [
      { kind: 'attack', value: 3, weight: 3, telegraph: '⚔ 3 — needle jab' },
      { kind: 'attack', value: 2, pool: 'composure', weight: 2, telegraph: '🎭 2 — officious squeak' },
      { kind: 'bolster', value: 4, weight: 2, telegraph: '🧵 re-threads its master (+4 Block to partner)' },
      { kind: 'block', value: 3, weight: 1, telegraph: '🛡 3' },
    ] },
  // Garth Maul (Alan, 2026-06-08): summoner-only normal. EVERY attack is a
  // maul, escalating and alternating pool — 4 ❤, 4 🎭, 5 ❤, 5 🎭, 6 ❤, …
  // climbing forever until you drain his composure. The escalatingMaul flag
  // makes rollIntent generate the sequence (it ignores `behaviors`, which is
  // kept only as a representative entry for avgAttack/report). summonerOnly
  // gates him to the handler. Race his 40 composure down before the mauls
  // outscale your shields, or feed him a body each turn to keep the rest.
  { id: 'e2-garth-maul', act: 1, name: 'Garth Maul', composureMax: 40, hpMax: 999, tier: 'normal', diff: 2,
    summonerOnly: true, escalatingMaul: true,
    flavor: 'He took the staff trial sideways and came back all teeth. Asks only that you hold still.',
    behaviors: [
      { kind: 'attack', maul: true, value: 4, weight: 1, telegraph: '🦷 4 ❤ maul (escalates each turn)' },
    ] },
  { id: 'e2-silk-wraith', act: 1, name: 'Silk Wraith', composureMax: 36, hpMax: 999, tier: 'normal', diff: 3,
    behaviors: [
      // v2.9.2: silk-thread cuts now hit harder + composure-pool option.
      // v3.4.82: composure 25→36, whisper 6→8 (combats too short).
      { kind: 'attack-multi', value: 4, count: 3, weight: 3, telegraph: '⚔ 4×3' },
      { kind: 'attack', value: 8, pool: 'composure', weight: 2, telegraph: '🎭 8 (silken whisper)' },
      { kind: 'block',  value: 6, weight: 1, telegraph: '🛡 6' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🩸 Vuln 1' },
      // Maul (Alan, 2026-06-02): silk-snare. Block it ALL or it drags your
      // strongest animal off into the web.
      // v3.4.69 (1000-run cycle 1): weight 2→1. A maul on a NORMAL act-1
      // enemy at ~22%/turn was a board-wipe coinflip that hard-counters the
      // handler's whole accumulation loop. ~14% keeps the threat, not the tax.
      { kind: 'attack', maul: true, value: 7, weight: 1, telegraph: '🦷 7 — silk-snare (unblocked → lose your strongest animal)' },
    ] },
  { id: 'e2-loom-familiar', act: 1, name: 'Loom Familiar', composureMax: 40, hpMax: 999, tier: 'normal', diff: 2,
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
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8' },
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6 + ⛧ Weak 1 (thread-tangle)', riders: { weak: 1 } },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 (lonely-thread)' },
    ] },
  // v2.17: ROGUE WIZARDS — first wave. Failed-graduate wizards still
  // working at their craft, refusing to come back. Names follow the
  // Pratchett-tone with parenthetical bureaucratic annotations.
  { id: 'e-rogue-linenfast', act: 1, name: 'Bartholomew Linenfast (still adjusting the hem)',
    composureMax: 38, hpMax: 999, tier: 'normal', diff: 1,
    // failure mode: refusal. 50 years on the same hem. Wit can't
    // out-argue him (heard every version); jnsq breaks his focus.
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 + ⛧ Weak 1 (stitch, weakly)', riders: { weak: 1 } },
      { kind: 'attack', value: 9, pool: 'composure', weight: 2, telegraph: '🎭 9 (murmuring about the hem)' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7 (measures, again)' },
      { kind: 'attack-multi', value: 3, count: 2, weight: 1, telegraph: '⚔ 3×2 (stitch, unstitch)' },
    ] },
  { id: 'e2-pattern-maker', act: 1, name: 'The Pattern-Maker', composureMax: 64, hpMax: 999, tier: 'elite', diff: 2,
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
      // Freeze (Alan, 2026-06-08): pins your strongest animal into the pattern
      // — it can't attack for 2 turns. Work around it or wait it out.
      { kind: 'freeze', value: 2, weight: 1, telegraph: 'pins your strongest animal into the pattern (frozen 2 turns)' },
    ] },
  { id: 'e2-silent-spinner', act: 1, name: 'The Silent Spinner', composureMax: 64, hpMax: 999, tier: 'elite', diff: 3,
    // v3.4.82: composure 50→64; base swing 8→10, whisper 6→8; self-block
    // weight 2→1 so it spends more turns pressuring than warding.
    behaviors: [
      { kind: 'block',  value: 10, weight: 1, telegraph: '🛡 10 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 10,  weight: 2, telegraph: '⚔ 10 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack', value: 8, pool: 'composure', weight: 2, telegraph: '🎭 8 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      // Silence (Alan, 2026-06-08): the Silent Spinner imposes its vow on the
      // woods — no new summons for 2 turns. Thematically perfect.
      { kind: 'silence', value: 2, weight: 1, telegraph: 'imposes its silence (no new summons, 2 turns)' },
      // v2.9 burst — telegraphed big swing to HP. "Loud silence" is a
      // breaking-of-the-vow moment.
      { kind: 'attack', value: 14, weight: 1, telegraph: '⚔ 14 (LOUD SILENCE)' },
    ] },
  { id: 'e2-boss-tapestry', act: 1, name: 'The Tapestry Walker', composureMax: 82, hpMax: 999, tier: 'boss',
    insultVulnerabilities: ['dismissive', 'petty', 'sarcastic'], // Vain — hates being trivialized.
    // v3.4.82: composure 63→82 (boss fell in 5 turns at full HP); base swing
    // 10→11, loom-song 7→9. Bursts/maul untouched.
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11 + ⛧ Weak 1', riders: { weak: 1 } },
      // v3.4.69 (1000-run cycle 1): burst value 4→3 (post-scale ceiling
      // 5×4=20 → 4×4=16) so a single Block + Step Back can answer the multi
      // instead of eating 15+ raw. The Walker's spike was its true killer.
      { kind: 'attack-multi', value: 3, count: 4, weight: 2, telegraph: '⚔ 3×4' },
      { kind: 'attack', value: 9, pool: 'composure', weight: 1, telegraph: '🎭 9 (loom-song)' },
      { kind: 'block',  value: 10, weight: 1, telegraph: '🛡 10' },
      // Turn Against (Alan, 2026-06-08): the Walker re-weaves your menagerie's
      // will — next turn they strike YOUR composure unless you spend them first.
      { kind: 'turnAgainst', weight: 1, telegraph: 're-weaves your menagerie — next turn they strike YOU' },
      // Maul (Alan, 2026-06-02): the Walker weaves your strongest beast into
      // the tapestry. Block it all or lose it. Boss-tier stakes.
      // v3.4.69 (1000-run cycle 1): weight 2→1 (~25%→~14%). Losing a 2-3-turn
      // menagerie investment every ~4 turns deleted handler runs outright
      // (365/500 sim deaths here). Still a boss-tier swing, no longer a coinflip.
      { kind: 'attack', maul: true, value: 10, weight: 1, telegraph: '🦷 10 — woven under (unblocked → your strongest animal goes into the pattern)' },
    ] },

  // ───── ACT 1 EXPANSION (Alan, 2026-06-08) — difficulty-tiered roster so the
  // early fights are gentle and the pressure scales toward the boss. `diff`
  // 1=early / 2=mid / 3=late; pickActEnemyId biases by map progress. New kinds:
  // heal (self-regen → forces burst), charge (telegraphed big hit next turn →
  // forces hard defense/disrupt), summon (mid-combat companion). See
  // design/ACT1_ENEMIES.md.

  // ── diff 1 — gentle openers ──
  { id: 'e2-lint-sprite', act: 1, name: 'Lint Sprite', composureMax: 22, hpMax: 999, tier: 'normal', diff: 1,
    flavor: 'Technically alive. Mostly lint. Deeply offended by tidiness.',
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5 (a peeved tumble)' },
      { kind: 'attack', value: 4, pool: 'composure', weight: 2, telegraph: '🎭 4 (a reproachful drift)' },
      { kind: 'block',  value: 4, weight: 1, telegraph: '🛡 4 (puffs up)' },
    ] },
  // Real HP (16) — the early enemy that teaches "physical effects work here."
  { id: 'e2-button-drone', act: 1, name: 'Button Drone', composureMax: 18, hpMax: 16, tier: 'normal', diff: 1,
    flavor: 'Sorts buttons by virtue. Has opinions about yours.',
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5 (sorting jab)' },
      { kind: 'attack-multi', value: 2, count: 2, weight: 2, telegraph: '⚔ 2×2 (click, clack)' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5 (closes a clasp)' },
    ] },
  { id: 'e2-unraveller', act: 1, name: 'The Unraveller', composureMax: 24, hpMax: 999, tier: 'normal', diff: 1,
    flavor: 'Finds the loose thread in everything. Including you. Especially you.',
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5 + ⛧ Weak 1 (tugs a thread)', riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '⛧ Weak 1 (points out the flaw)' },
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6 (a firm pull)' },
      // v3 slice 4 (Alan, 2026-06-08): a modest animal-targeting maul. It finds
      // the loose thread on your menagerie too. Low weight + low value: pressure
      // not erase — a single brace turns it aside.
      { kind: 'attack', maul: true, value: 4, weight: 1, telegraph: '🦷 4 — finds the loose thread on your pet (unblocked → lose your strongest animal)' },
      { kind: 'block',  value: 4, weight: 1, telegraph: '🛡 4 (winds the slack)' },
    ] },

  // ── diff 2 — mid ──
  // First HEAL user — re-stitches itself; out-pace the regen or it grinds on.
  { id: 'e2-patchwork-golem', act: 1, name: 'Patchwork Golem', composureMax: 34, hpMax: 999, tier: 'normal', diff: 2,
    flavor: "Made of everyone's abandoned mending. Optimistic about its chances.",
    behaviors: [
      { kind: 'attack', value: 8, weight: 3, telegraph: '⚔ 8 (a heavy seam)' },
      { kind: 'heal',   value: 6, weight: 2, telegraph: '🧵 re-stitches +6 Composure' },
      { kind: 'attack-multi', value: 3, count: 2, weight: 2, telegraph: '⚔ 3×2 (loose flailing)' },
      { kind: 'block',  value: 6, weight: 1, telegraph: '🛡 6 (tucks a flap)' },
    ] },
  // Needlepoint Twins — DUO. Cross does the X; Stitch shields it and chips you.
  { id: 'e2-needlepoint-cross', act: 1, name: 'Needlepoint Cross', composureMax: 30, hpMax: 999, tier: 'normal', diff: 2,
    duoPartnerId: 'e2-stitch',
    flavor: 'Insists on the X. Will not be talked out of the X.',
    behaviors: [
      { kind: 'attack', value: 7, weight: 3, telegraph: '⚔ 7 (a decisive cross)' },
      { kind: 'attack-multi', value: 3, count: 2, weight: 2, telegraph: '⚔ 3×2 (over, under)' },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1, telegraph: '🎭 5 (counts your mistakes)' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
    ] },
  { id: 'e2-stitch', act: 1, name: 'Stitch', composureMax: 14, hpMax: 999, tier: 'companion',
    flavor: 'Does the quiet half. Resents it quietly.',
    behaviors: [
      { kind: 'bolster', value: 4, weight: 3, telegraph: '🧵 shores up Cross (+4 Block)' },
      { kind: 'attack',  value: 3, weight: 2, telegraph: '⚔ 3 — a quick prick' },
      { kind: 'block',   value: 3, weight: 1, telegraph: '🛡 3' },
    ] },
  { id: 'e2-moth-choir', act: 1, name: 'The Moth Choir', composureMax: 30, hpMax: 999, tier: 'normal', diff: 2,
    flavor: 'Several moths agreeing loudly. The agreement is the threat.',
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3, telegraph: '⚔ 2×3 (a flutter of consensus)' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 2, telegraph: '🎭 6 (a hymn about your coat)' },
      { kind: 'weak',   value: 1, weight: 1, telegraph: '⛧ Weak 1 (dusts your resolve)' },
      // v3 slice 4 (Alan, 2026-06-08): the choir, in unanimous accord, carries
      // off the smallest member of your menagerie. Modest value + low weight —
      // a single brace turns it aside (pressure not erase).
      { kind: 'attack', maul: true, value: 5, weight: 1, telegraph: '🦷 5 — the choir agrees to carry one off (unblocked → lose your strongest animal)' },
      { kind: 'block',  value: 4, weight: 1, telegraph: '🛡 4 (closes ranks)' },
    ] },
  // First CHARGE user — winds up a strike that lands NEXT turn. Defend or disrupt.
  { id: 'e2-spindlewight', act: 1, name: 'Spindlewight', composureMax: 32, hpMax: 999, tier: 'normal', diff: 2,
    flavor: 'It is winding up. It has been winding up for some time. It would like you to appreciate the wind-up.',
    behaviors: [
      { kind: 'charge', value: 14, weight: 2, telegraph: '🌀 winds up — 14 lands next turn' },
      { kind: 'attack', value: 7, weight: 2, telegraph: '⚔ 7 (a spinning lash)' },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1, telegraph: '🎭 5 (a dizzy murmur)' },
      { kind: 'block',  value: 6, weight: 1, telegraph: '🛡 6 (spins in place)' },
    ] },

  // ── diff 3 — pre-boss pressure ──
  // SUMMONER (elite) — calls Thread Wisps into the fight; close it before the
  // adds compound. Re-summons after a Wisp is drained (slot frees).
  { id: 'e2-spinster-matron', act: 1, name: 'The Spinster Matron', composureMax: 50, hpMax: 999, tier: 'elite', diff: 2,
    flavor: 'Runs a tight household of one. Always has room for one more. You begin to suspect you are the one more.',
    behaviors: [
      { kind: 'summon', companionId: 'e2-thread-wisp', weight: 2, telegraph: 'calls in a Thread Wisp' },
      // Tactic Undermine (Alan, 2026-06-08): dispels the Handler's active Pack
      // Tactic stance — punishes leaning on one stance, no-op for other lanes.
      { kind: 'undermineTactic', weight: 1, telegraph: 'unpicks your stance' },
      // Betrayal (Alan, 2026-06-08): "always room for one more" — recruits your
      // strongest animal as a Turncoat that hits your composure. Drain it down.
      { kind: 'betray', weight: 1, telegraph: 'recruits your strongest animal into the household' },
      { kind: 'attack', value: 8, weight: 2, telegraph: '⚔ 8 (a sharp summons)' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (a withering remark)' },
      { kind: 'attack-multi', value: 3, count: 2, weight: 1, telegraph: '⚔ 3×2 (busy hands)' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7 (folds her arms)' },
    ] },
  { id: 'e2-thread-wisp', act: 1, name: 'Thread Wisp', composureMax: 12, hpMax: 999, tier: 'companion',
    flavor: 'A loose end with somewhere to be. Briefly, urgently loyal.',
    behaviors: [
      { kind: 'attack',  value: 3, weight: 3, telegraph: '⚔ 3 — a snapping end' },
      { kind: 'bolster', value: 3, weight: 2, telegraph: '🧵 re-threads the Matron (+3 Block)' },
      { kind: 'attack',  value: 2, pool: 'composure', weight: 1, telegraph: '🎭 2 — a thin whine' },
    ] },
  // Warp & Weft — DUO, the heavy pre-boss gauntlet. Warp banks Weave debt and
  // hits hard; Weft shields/bolsters it.
  { id: 'e2-warp', act: 1, name: 'Warp', composureMax: 40, hpMax: 999, tier: 'normal', diff: 3,
    duoPartnerId: 'e2-weft',
    flavor: 'Holds the tension. All of it. Including the tension in the room.',
    behaviors: [
      { kind: 'weave',  value: 3, weight: 2, telegraph: '🪡 Weave +3 — banked 🎭 lands at the end of your next turn' },
      { kind: 'attack', value: 10, weight: 2, telegraph: '⚔ 10 + ⛧ Weak 1 (drawn taut)', riders: { weak: 1 } },
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9 (a snapping warp)' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 (the loom complains)' },
      // Double Maul (Alan, 2026-06-08): unblocked → loses your TWO strongest
      // animals. A board-breaking pre-boss threat; block it all.
      { kind: 'attack', maul: true, maulCount: 2, value: 6, weight: 1, telegraph: '🦷🦷 6 — double snap (unblocked → lose your TWO strongest animals)' },
    ] },
  { id: 'e2-weft', act: 1, name: 'Weft', composureMax: 16, hpMax: 999, tier: 'companion',
    flavor: 'Goes back and forth so Warp does not have to. Tired of the metaphor.',
    behaviors: [
      { kind: 'bolster', value: 5, weight: 3, telegraph: '🧵 reinforces Warp (+5 Block)' },
      { kind: 'attack',  value: 4, weight: 2, telegraph: '⚔ 4 — a crossing strike' },
      { kind: 'block',   value: 4, weight: 1, telegraph: '🛡 4' },
    ] },
  // Gauze Revenant — the proper hard LATE normal that replaces Silk Wraith as a
  // first fight. Heals as it presses, plus a maul. Burst it before it grinds.
  { id: 'e2-gauze-revenant', act: 1, name: 'The Gauze Revenant', composureMax: 36, hpMax: 999, tier: 'normal', diff: 3,
    flavor: "What's left when the shroud outlives the wearer. Still cold. Still fussy about its drape.",
    behaviors: [
      { kind: 'attack', value: 9, weight: 3, telegraph: '⚔ 9 (a cold wrapping)' },
      { kind: 'heal',   value: 5, weight: 2, telegraph: '🧵 draws the shroud tight +5 Composure' },
      // Cut Short (Alan, 2026-06-08): snips a remaining turn off every animal —
      // hastens their departure, forces re-summoning.
      { kind: 'cutShort', value: 1, weight: 1, telegraph: 'hastens your menagerie (−1 turn each)' },
      { kind: 'attack-multi', value: 4, count: 2, weight: 2, telegraph: '⚔ 4×2 (trailing gauze)' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (a grave hush)' },
      { kind: 'attack', maul: true, value: 7, weight: 1, telegraph: '🦷 7 — winding-sheet (unblocked → lose your strongest animal)' },
    ] },

  // ===== ACT 2 — The Forge Path (the mines and caves) =====
  { id: 'e3-geode-crab', act: 2, name: 'Geode Crab', composureMax: 40, hpMax: 12, tier: 'normal',
    // v2.4: sharpened from flat-low to handler-favored. Geodes hate
    // being loomed over; jnsq just makes them weirder.
    behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 8,  weight: 1, telegraph: '🛡 8' },
      { kind: 'attack', value: 7, weight: 1, telegraph: '⚔ 7 (claw-snap)' },
    ] },
  { id: 'e3-glow-mite', act: 2, name: 'Glow Mite Swarm', composureMax: 36, hpMax: 14, tier: 'normal',
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 4, weight: 2, telegraph: '⚔ 2×4 + ⛧ Weak 1', riders: { weak: 1 } },
      { kind: 'attack-multi', value: 2, count: 4, weight: 1, telegraph: '⚔ 2×4' },
      { kind: 'weak',   value: 1, weight: 1, telegraph: '⛧ Weak 1' },
    ] },
  { id: 'e3-crystal-beetle', act: 2, name: 'Crystal Beetle', composureMax: 40, hpMax: 12, tier: 'normal',
    // v2.4: sharpened to wit-favored (its prismatic surfaces refract logic).
    behaviors: [
      { kind: 'attack', value: 6, weight: 3, telegraph: '⚔ 6' },
      { kind: 'attack', value: 8, weight: 1, telegraph: '⚔ 8' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5 (carapace)' },
    ] },
  // v2.17: rogue wizard — handler-punisher. Tried to forge a ring of
  // three metals; the ring forged him. The metal absorbs direct threat.
  { id: 'e-rogue-smelterson', act: 2, name: 'Smelterson, J.C. (alloyed)',
    composureMax: 44, hpMax: 14, tier: 'normal',
    // failure mode: transformation. Handler resist 0.6 — you can't
    // bully someone whose identity is partly an iron ring. Jnsq 1.3
    // because absurdity disrupts the alloy. Physical 1.0 — he is, after
    // all, also metal.
    behaviors: [
      { kind: 'attack', value: 7, weight: 2, telegraph: '⚔ 7 (alloyed strike)' },
      { kind: 'block',  value: 7, weight: 2, telegraph: '🛡 7 + ⛧ Weak 1 (the ring sets)', riders: { weak: 1 } },
      { kind: 'attack', value: 9, weight: 1, telegraph: '⚔ 9 (the ring tells him to)' },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1, telegraph: '🎭 5 (the alloy hums)' },
    ] },
  { id: 'e3-quartz-sentinel', act: 2, name: 'Quartz Sentinel', composureMax: 56, hpMax: 22, tier: 'elite',
    // v2.4: sharpened to wit-favored. Constructs answer to logic.
    behaviors: [
      { kind: 'attack', value: 10, weight: 2, telegraph: '⚔ 10 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'block',  value: 12, weight: 2, telegraph: '🛡 12 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'attack', value: 8, pool: 'composure', weight: 2, telegraph: '🎭 8 (axiom-strike)' },
      // v2.9 burst — single-pool HP hammer.
      { kind: 'attack', value: 16, weight: 1, telegraph: '⚔ 16 (RULING)' },
      // v3.6: a crystalline pincer closes on the nearest beast.
      { kind: 'attack', maul: true, value: 8, weight: 1, telegraph: '🦷 8 — facets close on a beast (unblocked → lose your strongest animal)' },
    ] },
  { id: 'e3-vein-devourer', act: 2, name: 'Vein Devourer', composureMax: 72, hpMax: 28, tier: 'elite',
    // v2.4: handler-favored. The Devourer responds to direct threat
    // (Walter punches it, it backs off); evades wit and jnsq.
    insultVulnerabilities: [], // Mindless. Cannot be insulted. ALL insults backfire on it.
    behaviors: [
      { kind: 'attack', value: 13, weight: 2, telegraph: '⚔ 13 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 5, count: 3, weight: 1, telegraph: '⚔ 5×3' },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1, telegraph: '🎭 7 + ⛧ Weak 1', riders: { weak: 1 } },
      // v3.6: it is, after all, a Devourer — it eats your beasts too.
      { kind: 'attack', maul: true, value: 9, weight: 2, telegraph: '🦷 9 — DEVOURS a beast (unblocked → lose your strongest animal)' },
      // v2.9 burst — the Devourer's "DEVOUR" is a 1-shot KO risk.
      // v3.5 (1000-run iter-2): DEVOUR 18→16 (post-scalar 23→20). The 23 was
      // a genuine outlier — bigger than any Act-3 boss single hit, on an Act-2
      // ELITE — and single spikes dodge Animal Midnight's per-swing cut, so
      // the player-tool buff couldn't answer it. Conditional enemy nerf,
      // triggered because the Animal Midnight −5 underdelivered against it.
      { kind: 'attack', value: 16, weight: 1, telegraph: '⚔ 16 (DEVOUR)' },
    ] },
  { id: 'e3-boss-anvil', act: 2, name: 'The Anvil-Forged', composureMax: 88, hpMax: 50, tier: 'boss',
    // v2.4: Anvil flipped from handler-resist to handler-favored. It's
    // a forging boss — it understands direct demands. Jnsq is now the
    // softer side (0.7); wit stays neutral.
    insultVulnerabilities: ['dismissive', 'petty', 'absurd'], // Rule-bound; absurdity unmoors them.
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11 + 🩸 Vuln 1', riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1, telegraph: '⚔ 4×4' },
      { kind: 'block',  value: 12, weight: 1, telegraph: '🛡 12' },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1, telegraph: '🎭 6 (hammer-rhythm)' },
      // v3.6: a beast caught on the anvil and forged into the work.
      { kind: 'attack', maul: true, value: 9, weight: 1, telegraph: '🦷 9 — pins a beast to the anvil (unblocked → lose your strongest animal)' },
    ] },

  // ===== TUTORIAL =====
  // Low-stakes practice partner. All-baseline effectiveness so the
  // player sees clean numbers. Light incoming damage so they learn
  // Block without ever being in danger.
  // ===== SIDEQUEST ENEMIES — gated by sidequest combat nodes =====
  { id: 'sq-critical-apparition', act: 0, name: 'Prof. Augustus Hewn-Greaves (deceased, 1893)', composureMax: 75, hpMax: 999, tier: 'elite',
    insultVulnerabilities: ['dismissive', 'absurd'], // Pedant; absurdity destabilizes him most.
    behaviors: [
      { kind: 'attack', value: 8, pool: 'composure', weight: 2, telegraph: '🎭 8 (citing 1894 paper)', riders: { vulnerable: 1 } },
      { kind: 'attack', value: 6, pool: 'composure', weight: 2, telegraph: '🎭 6 (clearing throat audibly)' },
      { kind: 'weak', value: 1, weight: 2, telegraph: '⛧ Weak 1 (sighs at your argument)' },
      { kind: 'block', value: 12, weight: 1, telegraph: '🛡 12 (citing himself)' },
    ] },

  { id: 'tutorial-bursar', act: 0, name: 'The Bursar (Practice Match)', composureMax: 30, hpMax: 999, tier: 'normal',
    behaviors: [
      { kind: 'attack', value: 3, weight: 2, telegraph: '⚔ 3 (gentle)' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
    ] },
];
export const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));
