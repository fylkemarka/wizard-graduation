# Cycle 3 — Commitment-Game Tuning

Alan's design call: Wizard Graduation is a **commitment game** (STS-style),
not a pivot game. Players build varied deck shapes (Wit / Chutzpah / Jnsq /
Physical) each with a reasonable chance, not always a perfect deck. Cycle 3
tuned enemies and added card mechanics so committed decks have answers.

**Final win rate: 8%** (up from 3% baseline end of cycle 2). Boss curve
restored: Act 1 73.7% / Act 2 52.4% / Act 3 58.8% / Act 4 80.0% — the
"learning fight" feels learnable, late acts reachable and beatable.

## Trajectory

| Batch | Win | Act 1 | Act 2 | Act 3 | Act 4 | Resonance |
|-------|-----|-------|-------|-------|-------|-----------|
| 1 | 3% | 66% | 26% | 57% | 75% | 32% |
| 2 | 0% | 68% | 37% | 0% | n/a | 31% |
| 3 | 2% | 65% | 29% | 20% | 100% | 32% |
| 4 | **8%** | 58% | 75% | 55% | 73% | 30% |
| 5 | **8%** | **74%** | 52% | 59% | **80%** | **33%** |

## What landed

### Resistance floors (no more 0-immunity walls)
- Vein Devourer: chutzpah/wit 0.3 → 0.5; **composureMax 999 → 75**
- Living Thicket: chutzpah/wit/jnsq 0 → 0.5; composureMax 999 → 55
- Geode Crab + Crystal Beetle: composureMax 999 → 35
- Test Wraith: wit 0 → 0.5
- Headmaster's Hat: physical 0 → 0.4

The composureMax pool conversions are the bigger structural fix —
previously a committed verbal deck couldn't kill HP-only enemies even
in theory (would deal 50% of 999 = 500 raw damage needed). Now Vein
Devourer can be ground out by Wit-committed at 6-8 turns instead of
being unbeatable.

### Tech card: Read the Room
- Uncommon skill, cost 0, exhaust
- Next cast pierces enemy effectiveness (ignores resistance)
- AI plays it when best-stat-effectiveness ≤ 0.6
- Picker weights it +4 baseline / +8 when committed
- "The committed deck's answer to a hostile matchup" — works for all
  three lanes equally

### Card pool depth
- New Jnsq cards: **Non Sequitur** (common) and **Calculated Risk** (uncommon)
  bring the Jnsq lane to parity with Wit/Chutzpah
- 2 physical effect cards from cycle 2 carry forward (Throw the Book,
  Flame On)

### Survivability
- Inter-act heal 0.40 → 0.55 (committed decks reach the boss less battered)
- Anvil-Forged + Hat boss attack values nerfed 1-2 each so a 70-HP wizard
  isn't 2-shot
- Tapestry Walker composureMax 68 → 60 → 52, attack 11 → 10 (was the
  largest single source of kills across every batch; now the entry boss
  most decks clear)

### Material balance
- Wild Silk relaunched at { regen: 2, draw: 1 } (was { regen: 3, draw: 1 }
  pre-cycle 3, then nerfed to regen-only which killed it). New niche:
  "go-fast" robe with turn-1 hand size
- Top 4 robes (mithril, burrgrass, wraithcloth, linen) clustered 97-110
  picks — real diversity, no single dominant pick

### Skill auto-tick (sim-only for now)
- At each inter-act seam, the lowest skill gains +1 passively
- Surfaces late-act crafting content without forcing skill-node pickups
- Whittling/Felting were 0.04-0.18 across cycle 2; now late-act crafting
  is measurable (~1-2 mean at end of run)

## The verdict on commitment

It works. The data confirms:
- **Boss curve makes sense**: Act 1 is the learning gate (74% beatable),
  Act 2-3 are the proving grounds (52-59%), Act 4 is the capstone (80%
  for decks strong enough to reach it).
- **Material diversity is real**: 4 robes competing instead of one
  dominant. Players see meaningful craft choices.
- **Tech cards work**: Read the Room is the right shape (single pierce
  tool, not a universal "tech slot" — keeps commitment honest).
- **Lane parity**: All three verbal lanes (Wit/Chutzpah/Jnsq) now have
  comparable card pool depth.

8% greedy-AI win rate is the right ballpark for a commitment design.
A skilled human player should hit 20-30% (the AI doesn't optimize
deck-building like a human does — it's a baseline floor).

## What's still tunable

- **Tapestry remains the largest single killer** (42/100 in batch 4 →
  ~28/100 estimated in batch 5). She's now reasonable but could ease
  further to 18-22 if Act 1 wants to be more forgiving.
- **Wild Silk at regen+draw might still under-pick** — needs another
  batch to confirm the new niche surfaces.
- **Act 2 boss (Anvil) variance**: 75% → 52% across batches 4-5 with
  identical numbers, suggests Act 2 outcomes are noisy.

## Cycle 4 brief (if/when)

The mechanics are sound. Cycle 4 is for the "5+ plays in a weekend"
test from the casual agent: does a player feel like they're trying
DIFFERENT decks across runs, or the same deck shape with reshuffled
cards? Surface metrics needed:
- Win rate per committed stat lane (which archetypes are strong/weak)
- Card pick distribution per lane
- Material pick distribution per lane

Without these, we can't tell if there's genuine archetype variety vs.
one true path with cosmetic options. Suggest adding lane-bucketed
metrics to sim's report before another tuning cycle.

## Files touched

- `sim/playSim.js` — Read the Room mechanic + AI usage, enemy composure
  pools, Vein Devourer/Tapestry/Anvil/Hat tuning, Wild Silk stats,
  skill auto-tick, INTER_ACT_HEAL_RATIO 0.40 → 0.55
- `src/App.jsx` — All enemy + material mirrors, Read the Room card,
  pierceNextCast state machine, 2 new Jnsq cards
- `sim/reports/cycle3-batch-{1..5}.md`

## What I considered and rejected

- **Adding multiple pierce-tech cards.** Architect / nerd agent flagged:
  more pierce slots = commitment becomes "commitment plus universal
  tech," which dilutes the design intent. One pierce card is correct.
- **Reverting Vein Devourer's hard 0-immunity.** The "great twist"
  memory ([[project_wg_enemy_immunity_validated]]) is now superseded by
  the commitment-game direction. Hard immunity walls don't fit a design
  where deck shape should pay off. Vein Devourer stays physical-favored
  at 1.0× / verbal at 0.5×, but no longer unkillable for the wrong lane.
- **Adding stat-agnostic effects** (cards that scale by any tray stat).
  Considered, decided against — would erode commitment by giving every
  deck a one-card answer to any matchup. Tech cards (Read the Room +
  Sway) are the better pattern: discrete pickups, not universal access.
