# Wizard Graduation — Playtest Report

N = **50** runs simulated with a greedy AI (prioritises high-damage casts, defends when intent threatens KO, picks rare/uncommon rewards).

## Win rate
- **8 wins / 50** = **16.0%**
- Failures by act: act 1: 8 · act 2: 24 · act 3: 7 · act 4: 3

## Boss outcomes
- Act 1: 42W / 6L (87.5%, n=48)
- Act 2: 18W / 8L (69.2%, n=26)
- Act 3: 11W / 4L (73.3%, n=15)
- Act 4: 8W / 3L (72.7%, n=11)

## Combat pacing
- Avg turns / combat (all tiers): **4.34**
  - normal: 3.69
  - elite: 6.22
  - boss: 6.77

## Cast / resonance / fizzle
- Total casts: 5139
- Resonance triggered: 1815 (**35.3%** of casts)
- Spells fizzled (staged but never CAST): 0
- Fizzle rate: 0.0%

## Deck archetypes (lane bucketing)
- **wit**: 11 runs (22.0%) · 0 wins (0.0% win rate)
- **handler**: 17 runs (34.0%) · 0 wins (0.0% win rate)
- **jnsq**: 2 runs (4.0%) · 2 wins (100.0% win rate)
- **physical**: 5 runs (10.0%) · 3 wins (60.0% win rate)
- **wit-physical**: 6 runs (12.0%) · 2 wins (33.3% win rate)
- **jnsq-physical**: 5 runs (10.0%) · 1 win (20.0% win rate)
- **sampler**: 4 runs (8.0%) · 0 wins (0.0% win rate)

## Per-archetype loss diagnostics
- **handler** (n=17, 0W): e3-vein-devourer (6), e3-boss-anvil (3), e2-boss-tapestry (3) | died in a1:5 · a2:9 · a3:3 · a4:0

## Handler — Animal Summoner
- Runs: 15 (0W, 0.0% win rate) · 197 handler combats
- Avg tactic variety / combat: **1.32** distinct tactics
- Avg tactic swaps / combat: 1.55
- Menagerie output / combat: **39.3** composure · 10.6 block
- Summons / combat: 5.18 · Feeds: 1.17 · Short-stays: 2.77 · Combines: 0.06
- Tactic engagement (combats engaged · total uptime turns):
  - shield: 23 combats · 34 turns
  - rabid: 45 combats · 129 turns
  - youth: 61 combats · 242 turns
  - nurture: 111 combats · 532 turns
  - feather: 20 combats · 56 turns

## Material picks (sorted by frequency)
- mat-mithril: 83
- mat-burrgrass: 51
- mat-wraithcloth: 49
- mat-linen: 45
- mat-silver: 37
- mat-tarred-canvas: 23
- mat-brocade: 22
- mat-hemlock: 18
- mat-madrone: 9
- mat-rosewood: 6
- mat-copper: 6
- mat-suede: 4

## Craft quality by slot
- staff: Master 8 (100.0%) · Fine 0 (0.0%) · Rough 0 (0.0%)
- robes: Master 39 (92.9%) · Fine 3 (7.1%) · Rough 0 (0.0%)
- ring: Master 17 (94.4%) · Fine 1 (5.6%) · Rough 0 (0.0%)
- hat: Master 11 (100.0%) · Fine 0 (0.0%) · Rough 0 (0.0%)
- Salvaged-Scrap fallbacks: 0

## Skill levels at run end
- whittling: mean 1.72 (max-cap reached in 11 runs)
- weaving: mean 4.00 (max-cap reached in 8 runs)
- smithing: mean 3.36 (max-cap reached in 0 runs)
- felting: mean 1.68 (max-cap reached in 16 runs)

## Winners
- Final HP %: 85.2% of max (mean)
- Final deck size (mean across all runs): 25.00 cards

## Enemies that killed the player
- e3-vein-devourer: 16
- e3-boss-anvil: 8
- e2-boss-tapestry: 6
- e4-boss-headmasters-hat: 4
- e1-boss-thornlord: 3
- e4-failed-initiate: 2
- e4-mirror-past: 1

## Stalls (5 consecutive 0-damage turns — typically handler vs high-block enemies)
- e2-loom-familiar: 2
