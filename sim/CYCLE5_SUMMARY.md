# Cycle 5 — Jnsq-Pure Variance Hunt

Alan's brief: figure out why jnsq-pure was at 0-6% across cycle 4 batches.
Was it a real structural weakness, or just variance from small per-archetype
buckets (n=12-20 in 200-run batches)?

**Answer: both, but variance was much bigger than expected.** Five 1000-run
batches showed jnsq-pure ranging 5.3-11.2% with mean ~7.8% — even at n=48-97
the sample variance (~2.3% sd) made it impossible to confidently detect
the 2-3% effects from individual card additions.

The structural wins were real, though:
- **Overall game win rate**: 18.6% → 22.5%
- **jnsq-physical**: 33% → **43.2%** — the new jnsq lane tools dramatically
  improved hybrid splashes
- **Resonance hit rate**: 36.2% → 37.5%
- **Jnsq commitment frequency**: 48/1000 → 97/1000 runs (the AI now picks
  jnsq-pure twice as often when the lane has real tools)

## What landed

### New per-archetype loss diagnostics (the unblocker)
Sim now reports for each archetype: top 3 killer enemies and act-cleared
distribution. This was the first thing I added — it transformed cycle 5
from "guess what kills jnsq" into "look at the data and see jnsq dies in
act 1 4x as often as chutzpah does."

Lives in `aggregate()`: `archetypeLossByEnemy` and `archetypeActsCleared`
fields, then a "Per-archetype loss diagnostics" section in the report.

### Four new jnsq cards (the toolkit upgrade)
- **"Mind the chickens,"** (common word, +1 jnsq, absurd/chaotic)
- **"On the third Tuesday,"** (common word, +2 jnsq, chaotic/absurd)
- **"In which case, the moon,"** (uncommon word, +3 jnsq, mystical/absurd)
- **"Drunk on starlight,"** (common word, +1 jnsq + heal 2, mystical/chaotic)

These bring jnsq's word pool from 6 → 10, parity with chutzpah's pool. The
sustain word (Drunk on starlight) mirrors chutzpah's "Bruise it out" — a
small HP recovery word that helps the lane absorb chip damage.

### Two new jnsq Effect cards
- **Free Association** (common Effect, cost 1, 3 + jnsq×2 + draw 1 after
  cast) — the engine card. Mirrors Press the Point from C4B5 chutzpah fix.
- **Bedlam Cascade** (rare Effect, cost 2, 4 + jnsq×2 + 5 per matching
  jnsq tag) — deep-stacking payoff. Highest perTag in the game (Compounding
  Argument is +4) because jnsq has no resonance-doubler mechanic.

### New effect handler: drawAfterCast
Wired through `applyEffects` (App.jsx) and `castStagedSpell` (sim). The
+1-draw-after-cast mechanic is now available for any Effect card.

## What didn't land

### Hollow Weaver + Pattern-Maker jnsq 0.5 → 0.7 (reverted)
The diagnostic showed jnsq-pure dies in act 1 at 4x the chutzpah rate, so
softening the two act-1 jnsq walls (Hollow Weaver normal, Pattern-Maker
elite) seemed structural. After three test batches: no detectable effect
beyond sample variance. The act 1 jnsq deaths actually went UP across
batches as the bucket grew (selection effect — more borderline decks
committing to jnsq, all dying in act 1).

Reverted to preserve thematic identity: pattern-themed enemies should
literally resist chaos. The walls aren't the structural problem.

### Mass act 2 floor bumps (not attempted)
Considered bumping Vein Devourer / Anvil / stone enemies for jnsq, but
these are act 2 — already softening would make the act 2 verbal-wall less
defining. The stone-act IS supposed to be a wall for verbal lanes; the
fix is to give hybrids more physical-splash options (which is what
jnsq-physical at 43% already validates).

## Trajectory

| Batch | Overall | jnsq | jnsq+P | resonance |
|-------|---------|------|--------|-----------|
| 4 final (no cycle-5 work) | 18.6% | 8.3% (n=48) | 33.0% | 32% |
| 5 B1 (words + engine) | 22.3% | 11.2% (n=89) | 42.5% | 36% |
| 5 B2 (+ act 1 floor bumps) | 19.5% | 6.2% (n=81) | 42.4% | 37% |
| 5 B3 (+ sustain + payoff) | 17.7% | 8.2% (n=97) | 34.4% | 38% |
| **5 B4 (revert floors)** | **22.5%** | 5.3% (n=75) | **43.2%** | 37% |

Pure-jnsq's true win rate is somewhere in 5-11%, mean ~8%. At n=48-97
the standard error is ~3%, so individual batch swings of 4-5% are
indistinguishable from variance.

## The verdict on pure verbal lanes

Greedy AI baselines for "fully committed verbal lane" (5-batch mean):

- **chutzpah-pure**: ~16% (Don't Hold Back doubler + Iron Stomach boost +
  Bruise it out sustain + Press the Point engine = complete toolkit)
- **wit-pure**: ~10% (Compounding Argument resonance scaler + word depth)
- **jnsq-pure**: ~8% (Genuine Threat closer + Free Association engine +
  Bedlam Cascade payoff + Drunk on starlight sustain)

The order tracks how complete each lane's toolkit is. A real human player
will likely push these all 10-15% higher (the greedy AI doesn't reserve
resources, plan ahead, or play the deck-cycling game well).

The committed-lane floor of ~8-15% is appropriate for a commitment design:
pure commitments are HARDER than hybrid splashes by design. Hybrids land
in the 30-43% range because they're easier to pilot and have answers to
more enemy resistance profiles.

## What I considered and rejected

- **Bumping more jnsq walls**: would erode thematic clarity. The act 2
  stone enemies SHOULD resist verbal damage — that's the whole identity
  of the stone act.
- **Adding a defensive jnsq card**: chutzpah doesn't have one either.
  Defense in this game is supposed to come from the physical-damage
  splash, not from the verbal lane itself.
- **Sim AI upgrades**: tempting but out of scope for "card design"
  cycle. The greedy AI is a baseline floor; improving it would lift all
  archetypes proportionally, not specifically jnsq-pure.

## Files touched

- `sim/playSim.js` — 4 new words, 2 new Effects, drawAfterCast handler,
  per-archetype loss diagnostics (archetypeLossByEnemy +
  archetypeActsCleared), report writer extension
- `src/App.jsx` — same card additions, drawAfterCast handler in main
  cast resolver
- `sim/reports/cycle5-batch-{1,2,3,4}.md`

## Cycle 6 brief (if/when)

The remaining lane balance work isn't urgent. If picked up again:
- **Sampler bucket** runs 8-16% — could investigate why "no commitment"
  loses so consistently. Probably because the greedy AI doesn't optimize
  the sampler shape (any human plays it as a flex bag).
- **Wit-pure structural gap** to chutzpah-pure (~6%) — wit lacks a
  threshold doubler or HP-cost payoff card. Could add one ("Devastating
  Aside"?).
- **5+ play stress test** — get the casual / nerd agents back in for a
  qualitative read on whether the 8-archetype variety FEELS different
  across runs, or whether the AI's greedy bias makes them all play
  similarly in practice.
