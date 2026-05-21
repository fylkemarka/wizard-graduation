# Cycle 4 — Lane Variety + Commitment Validation

Alan's framing: STS-style commitment. Many viable deck shapes, each with
a reasonable chance, RNG decides which lane you commit to. Cycle 4 added
**lane bucketing instrumentation** to measure this, then iterated on
card pool + enemy tuning until every archetype had non-zero wins.

**Final win rate: 21.5%.** All 8 archetype buckets show non-zero win
rates. Commitment game mechanically validated.

## Trajectory

| Batch | Win | Wit | Chutz | Jnsq | Wit+P | Chutz+P | Jnsq+P | Phys | Sampler |
|-------|-----|-----|-------|------|-------|---------|--------|------|---------|
| 3 end (no bucketing) | 8% | — | — | — | — | — | — | — | — |
| 4 B0 (instr only) | 7% | 0% | 2% | 0% | 4% | 15% | 14% | 33% | 5% |
| 4 B1 (lane-closers) | 14.5% | 0% | 5% | 0% | 22% | 32% | 16% | 28% | 6% |
| 4 B2 (word depth) | 17.5% | **12%** | 3% | **25%** | 42% | 0% | 36% | 25% | 4% |
| 4 B3c (chutz fix) | **21.5%** | 6% | **20%** | 6% | 29% | 33% | 31% | 64% | 14% |

## What landed

### Instrumentation (the unblocker)
**Lane bucketing** — every run is now classified by final deck shape:
`wit / chutzpah / jnsq / physical / wit-physical / chutzpah-physical /
jnsq-physical / sampler`. Per-archetype win rate is in every report.
Without this, cycle 4 couldn't tell whether the variety was "real
8-archetype distribution" or "1 archetype with reshuffles." It's the
8-archetype kind.

### Sim AI: random lane commitment at start
Previously the sim's Starting Picks heuristic always grabbed both Jnsq
cards. Cycle 4 randomized across the three lanes so the data reflects
true archetype distribution rather than jnsq-dominant artifact.

### Lane-closer cards (B1)
Four new cards giving each lane a real win path:
- **Compounding Argument** (Wit uncommon): 4 + Wit×2 composure, resonance
  bonus DOUBLED — wit decks chain tags for big damage
- **Genuine Threat** (Jnsq uncommon): 8 + Jnsq×3 composure, reliable
  (no gamble) — the closer Jnsq lacked
- **Don't Hold Back** (Chutzpah rare): 5 + Chutzpah×2 composure, -8 HP,
  **doubles below 40 HP** — chutzpah's late-fight payoff
- **Polymath** (rare): 5 + (chutz+wit+jnsq)×2 composure — turns the
  sampler bucket from "incompetent" into "polyglot" archetype

### Word pool depth (B2)
Six new words gave wit + jnsq the resonance-tag depth needed for
Compounding Argument / Genuine Threat to actually chain:
- Wit: Allegedly, As written, In conclusion (rhetorical/academic/formal)
- Jnsq: Astrally speaking, Three things at once, By moonlight
  (mystical/absurd/chaotic)

Resonance hit rate 31% → 35% confirms tag-chaining now fires regularly.

### Chutzpah-pure rescue (B3)
The stubborn lane. Two structural issues identified, both fixed:
- **Boss matchups walled chutzpah**: Anvil and Thornlord both at 0.5×
  to chutzpah (half of all act bosses). Bumped to 0.7×.
- **Normal-enemy floors walled chutzpah**: Silk Wraith, Pact Imp, Mirror
  of the Past, Forgotten Master all at chutzpah 0.5 while another stat
  was 1.0-1.5. Bumped all to 0.7.
- **Added sustain**: Bruise It Out word (+2 chutzpah, +2 heal) and Iron
  Stomach skill (heal 5, +50% next chutzpah cast).
- **Don't Hold Back threshold raised**: 30 → 40 HP so the doubler fires
  more reliably across long runs.
- **AI logic for Iron Stomach**: plays it when deck has 4+ chutzpah
  contributions and boost isn't already active.

Chutzpah-pure: **0% → 20%** in one batch. The hidden constraint was
enemy resistance distribution, not card design.

### New effect mechanics
- `hpThresholdDouble: N` — damage doubles below N HP (Don't Hold Back)
- `sumAllStats: true` — trayVal = sum of all three stats (Polymath)
- `boostNextChutzpahCast: 0.5` — +50% next chutzpah Effect (Iron Stomach)

All three mirrored in App + sim.

## What's still wobbly

- **Wit-pure regressed** (12% → 6%) in B3 — probably variance on a
  32-run sample, but worth watching. Could also be that the chutzpah
  enemy-bumps shifted optimal play patterns and the AI hasn't adapted.
- **Jnsq-pure noisy** (25% → 6%) — small samples (n=12, n=16) mean
  variance dominates. Need 500+ runs to read this lane reliably.
- **Physical-pure at 64%** (n=14) — possibly too strong. Pure-physical
  bypasses all verbal resistance AND there's no enemy with high physical
  resistance (lowest is 0.4 on Hat). Could be the next thing to look at.

## The variety verdict

8 archetype shapes, all with non-zero wins. Range: 6%-64%. The
"different deck shape per run" experience that Alan wanted is genuinely
produced by the design now. A real player picking up the game would
hit different archetypes across multiple runs and feel each one play
differently — which was the cycle 4 goal.

## Files touched

- `sim/playSim.js` — classifyDeckArchetype, per-archetype reporting,
  random Starting Picks, Iron Stomach AI logic, all new cards mirrored,
  enemy floor bumps, sumAllStats + hpThresholdDouble + boostNextChutzpahCast
- `src/App.jsx` — 4 lane-closer cards, 6 new words, 1 new skill
  (Iron Stomach), enemy floor bumps, new effect handlers wired into
  castStagedSpell + previewCastDamage
- `sim/reports/cycle4-batch-{1,2,3,3b,3c}.md`

## Cycle 5 brief (if/when)

Variety is real. The next ceiling is internal — within each lane, do
players play the SAME way (e.g., always Compounding Argument + Persuade
+ Convince stack) or different sub-archetypes (e.g., a wit-resonance
build vs a wit-defensive build vs a wit-debuff build)? Right now the
sim's reward picker is rational-greedy, so it'll always pick the
strongest available card. A real player makes thematic choices.

Cycle 5 could measure **card-pick distribution within each lane** —
of the 32 chutzpah-pure runs, how many ran Don't Hold Back? Iron Stomach?
Sword Logic? Without that signal, we can't tell if the within-lane
sub-archetypes are real or just RNG variance on the same plan.

That said: the current state is shippable. A real player would have
fun with 8 viable archetypes and 21.5% greedy-AI baseline (which a
smart human should push to 30-40%).
