# Wizard Graduation — Playtest Report

N = **50** runs simulated with a greedy AI (prioritises high-damage casts, defends when intent threatens KO, picks rare/uncommon rewards).

## Win rate
- **7 wins / 50** = **14.0%**
- Failures by act: act 1: 13 · act 2: 25 · act 3: 3 · act 4: 2

## Boss outcomes
- Act 1: 37W / 8L (82.2%, n=45)
- Act 2: 12W / 10L (54.5%, n=22)
- Act 3: 9W / 1L (90.0%, n=10)
- Act 4: 7W / 2L (77.8%, n=9)

## Combat pacing
- Avg turns / combat (all tiers): **4.55**
  - normal: 3.93
  - elite: 6.60
  - boss: 6.71

## Cast / resonance / fizzle
- Total casts: 4406
- Resonance triggered: 1474 (**33.5%** of casts)
- Spells fizzled (staged but never CAST): 0
- Fizzle rate: 0.0%

## Deck archetypes (lane bucketing)
- **wit**: 2 runs (4.0%) · 0 wins (0.0% win rate)
- **handler**: 25 runs (50.0%) · 1 win (4.0% win rate)
- **jnsq**: 2 runs (4.0%) · 0 wins (0.0% win rate)
- **physical**: 2 runs (4.0%) · 1 win (50.0% win rate)
- **wit-physical**: 6 runs (12.0%) · 3 wins (50.0% win rate)
- **handler-physical**: 1 run (2.0%) · 0 wins (0.0% win rate)
- **jnsq-physical**: 5 runs (10.0%) · 2 wins (40.0% win rate)
- **sampler**: 7 runs (14.0%) · 0 wins (0.0% win rate)

## Per-archetype loss diagnostics
- **handler** (n=25, 1W): e3-vein-devourer (4), e3-boss-anvil (4), e2-boss-tapestry (4) | died in a1:11 · a2:9 · a3:2 · a4:2

## Handler — Animal Summoner
- Runs: 21 (0W, 0.0% win rate) · 251 handler combats
- Avg tactic variety / combat: **1.23** distinct tactics
- Avg tactic swaps / combat: 1.37
- Menagerie output / combat: **36.5** composure · 9.3 block
- Summons / combat: 4.95 · Feeds: 1.12 · Short-stays: 2.38 · Combines: 0.10
- Tactic engagement (combats engaged · total uptime turns):
  - shield: 28 combats · 49 turns
  - rabid: 51 combats · 126 turns
  - youth: 71 combats · 274 turns
  - nurture: 131 combats · 584 turns
  - feather: 28 combats · 61 turns

## Material picks (sorted by frequency)
- mat-mithril: 67
- mat-linen: 51
- mat-burrgrass: 49
- mat-wraithcloth: 40
- mat-silver: 35
- mat-hemlock: 19
- mat-brocade: 16
- mat-tarred-canvas: 15
- mat-copper: 9
- mat-madrone: 6
- mat-suede: 5
- mat-rosewood: 2

## Craft quality by slot
- staff: Master 7 (100.0%) · Fine 0 (0.0%) · Rough 0 (0.0%)
- robes: Master 35 (94.6%) · Fine 2 (5.4%) · Rough 0 (0.0%)
- ring: Master 12 (100.0%) · Fine 0 (0.0%) · Rough 0 (0.0%)
- hat: Master 8 (88.9%) · Fine 1 (11.1%) · Rough 0 (0.0%)
- Salvaged-Scrap fallbacks: 0

## Skill levels at run end
- whittling: mean 1.46 (max-cap reached in 9 runs)
- weaving: mean 3.82 (max-cap reached in 7 runs)
- smithing: mean 2.96 (max-cap reached in 0 runs)
- felting: mean 1.20 (max-cap reached in 12 runs)

## Winners
- Final HP %: 87.6% of max (mean)
- Final deck size (mean across all runs): 23.16 cards

## Enemies that killed the player
- e3-vein-devourer: 14
- e3-boss-anvil: 10
- e2-boss-tapestry: 6
- e1-boss-thornlord: 2
- e4-boss-headmasters-hat: 1
- e4-apprentice-shade: 1
- e4-forgotten-master: 1

## Stalls (5 consecutive 0-damage turns — typically handler vs high-block enemies)
- e2-boss-tapestry: 2
- e2-loom-familiar: 2
- e2-hollow-weaver: 2
- e2-silk-wraith: 1
- e3-quartz-sentinel: 1
