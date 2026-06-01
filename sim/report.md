# Wizard Graduation — Playtest Report

N = **50** runs simulated with a greedy AI (prioritises high-damage casts, defends when intent threatens KO, picks rare/uncommon rewards).

## Win rate
- **8 wins / 50** = **16.0%**
- Failures by act: act 1: 17 · act 2: 20 · act 3: 4 · act 4: 1

## Boss outcomes
- Act 1: 33W / 6L (84.6%, n=39)
- Act 2: 13W / 12L (52.0%, n=25)
- Act 3: 9W / 4L (69.2%, n=13)
- Act 4: 8W / 1L (88.9%, n=9)

## Combat pacing
- Avg turns / combat (all tiers): **4.29**
  - normal: 3.65
  - elite: 6.48
  - boss: 6.35

## Cast / resonance / fizzle
- Total casts: 4795
- Resonance triggered: 1774 (**37.0%** of casts)
- Spells fizzled (staged but never CAST): 0
- Fizzle rate: 0.0%

## Deck archetypes (lane bucketing)
- **wit**: 13 runs (26.0%) · 1 win (7.7% win rate)
- **handler**: 19 runs (38.0%) · 0 wins (0.0% win rate)
- **jnsq**: 1 run (2.0%) · 0 wins (0.0% win rate)
- **wit-physical**: 7 runs (14.0%) · 4 wins (57.1% win rate)
- **handler-physical**: 1 run (2.0%) · 1 win (100.0% win rate)
- **jnsq-physical**: 5 runs (10.0%) · 2 wins (40.0% win rate)
- **sampler**: 4 runs (8.0%) · 0 wins (0.0% win rate)

## Per-archetype loss diagnostics
- **handler** (n=19, 0W): e2-boss-tapestry (6), e3-vein-devourer (1), e4-boss-headmasters-hat (1) | died in a1:16 · a2:2 · a3:1 · a4:0

## Handler — Animal Summoner
- Runs: 18 (0W, 0.0% win rate) · 125 handler combats
- Avg tactic variety / combat: **0.99** distinct tactics
- Avg tactic swaps / combat: 1.14
- Menagerie output / combat: **35.1** composure · 10.4 block
- Summons / combat: 4.89 · Feeds: 1.21 · Short-stays: 2.22 · Combines: 0.04
- Tactic engagement (combats engaged · total uptime turns):
  - shield: 11 combats · 18 turns
  - rabid: 28 combats · 68 turns
  - youth: 29 combats · 103 turns
  - nurture: 45 combats · 210 turns
  - feather: 11 combats · 21 turns

## Material picks (sorted by frequency)
- mat-mithril: 51
- mat-wraithcloth: 46
- mat-linen: 45
- mat-burrgrass: 40
- mat-silver: 32
- mat-brocade: 20
- mat-copper: 16
- mat-tarred-canvas: 16
- mat-madrone: 12
- mat-hemlock: 12
- mat-suede: 3
- mat-rosewood: 3

## Craft quality by slot
- staff: Master 8 (100.0%) · Fine 0 (0.0%) · Rough 0 (0.0%)
- robes: Master 27 (81.8%) · Fine 6 (18.2%) · Rough 0 (0.0%)
- ring: Master 12 (92.3%) · Fine 1 (7.7%) · Rough 0 (0.0%)
- hat: Master 9 (100.0%) · Fine 0 (0.0%) · Rough 0 (0.0%)
- Salvaged-Scrap fallbacks: 0

## Skill levels at run end
- whittling: mean 1.38 (max-cap reached in 9 runs)
- weaving: mean 3.64 (max-cap reached in 8 runs)
- smithing: mean 2.64 (max-cap reached in 0 runs)
- felting: mean 1.30 (max-cap reached in 13 runs)

## Winners
- Final HP %: 86.6% of max (mean)
- Final deck size (mean across all runs): 22.28 cards

## Enemies that killed the player
- e3-boss-anvil: 12
- e3-vein-devourer: 8
- e2-boss-tapestry: 6
- e4-boss-headmasters-hat: 4
- e1-boss-thornlord: 1
- e2-silent-spinner: 1

## Stalls (5 consecutive 0-damage turns — typically handler vs high-block enemies)
- e2-silk-wraith: 6
- e2-hollow-weaver: 3
- e2-loom-familiar: 1
