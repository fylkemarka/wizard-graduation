# Wizard Graduation — Playtest Report

N = **200** runs simulated with a greedy AI (prioritises high-damage casts, defends when intent threatens KO, picks rare/uncommon rewards).

## Win rate
- **39 wins / 200** = **19.5%**
- Failures by act: act 1: 61 · act 2: 78 · act 3: 13 · act 4: 9

## Boss outcomes
- Act 1: 139W / 38L (78.5%, n=177)
- Act 2: 61W / 30L (67.0%, n=91)
- Act 3: 48W / 11L (81.4%, n=59)
- Act 4: 39W / 9L (81.3%, n=48)

## Combat pacing
- Avg turns / combat (all tiers): **4.18**
  - normal: 3.56
  - elite: 6.08
  - boss: 6.38

## Cast / resonance / fizzle
- Total casts: 19930
- Resonance triggered: 7460 (**37.4%** of casts)
- Spells fizzled (staged but never CAST): 0
- Fizzle rate: 0.0%

## Deck archetypes (lane bucketing)
- **wit**: 34 runs (17.0%) · 9 wins (26.5% win rate)
- **handler**: 11 runs (5.5%) · 2 wins (18.2% win rate)
- **jnsq**: 8 runs (4.0%) · 0 wins (0.0% win rate)
- **physical**: 8 runs (4.0%) · 3 wins (37.5% win rate)
- **wit-physical**: 18 runs (9.0%) · 6 wins (33.3% win rate)
- **handler-physical**: 2 runs (1.0%) · 1 win (50.0% win rate)
- **jnsq-physical**: 27 runs (13.5%) · 14 wins (51.9% win rate)
- **sampler**: 92 runs (46.0%) · 4 wins (4.3% win rate)

## Per-archetype loss diagnostics
- **wit** (n=34, 9W): e3-vein-devourer (14), e3-boss-anvil (6), e1-boss-thornlord (3) | died in a1:1 · a2:20 · a3:1 · a4:3
- **wit-physical** (n=18, 6W): e3-boss-anvil (4), e1-boss-thornlord (3), e4-boss-headmasters-hat (3) | died in a1:1 · a2:5 · a3:3 · a4:3
- **jnsq-physical** (n=27, 14W): e4-boss-headmasters-hat (5), e2-boss-tapestry (4), e3-boss-anvil (3) | died in a1:4 · a2:4 · a3:5 · a4:0
- **sampler** (n=92, 4W): e2-boss-tapestry (25), e3-vein-devourer (23), e3-boss-anvil (8) | died in a1:51 · a2:33 · a3:3 · a4:1

## Handler — Animal Summoner
- Runs: 60 (0W, 0.0% win rate) · 519 handler combats
- Avg tactic variety / combat: **1.63** distinct tactics
- Avg tactic swaps / combat: 2.31
- Menagerie output / combat: **32.9** composure · 17.5 block
- Summons / combat: 4.77 · Feeds: 1.33 · Short-stays: 1.74 · Combines: 0.13
- Tactic engagement (combats engaged · total uptime turns):
  - shield: 227 combats · 545 turns
  - rabid: 129 combats · 292 turns
  - youth: 194 combats · 717 turns
  - nurture: 227 combats · 906 turns
  - feather: 69 combats · 122 turns

## Material picks (sorted by frequency)
- mat-mithril: 244
- mat-burrgrass: 200
- mat-wraithcloth: 187
- mat-linen: 180
- mat-silver: 134
- mat-hemlock: 85
- mat-tarred-canvas: 81
- mat-brocade: 79
- mat-madrone: 49
- mat-copper: 34
- mat-suede: 21
- mat-rosewood: 10

## Craft quality by slot
- staff: Master 39 (100.0%) · Fine 0 (0.0%) · Rough 0 (0.0%)
- robes: Master 124 (89.2%) · Fine 15 (10.8%) · Rough 0 (0.0%)
- ring: Master 54 (88.5%) · Fine 7 (11.5%) · Rough 0 (0.0%)
- hat: Master 47 (97.9%) · Fine 1 (2.1%) · Rough 0 (0.0%)
- Salvaged-Scrap fallbacks: 0

## Skill levels at run end
- whittling: mean 1.66 (max-cap reached in 48 runs)
- weaving: mean 3.96 (max-cap reached in 39 runs)
- smithing: mean 2.75 (max-cap reached in 0 runs)
- felting: mean 1.51 (max-cap reached in 60 runs)

## Winners
- Final HP %: 88.0% of max (mean)
- Final deck size (mean across all runs): 23.52 cards

## Enemies that killed the player
- e3-vein-devourer: 46
- e2-boss-tapestry: 35
- e3-boss-anvil: 30
- e4-boss-headmasters-hat: 11
- e1-boss-thornlord: 9
- e4-test-wraith: 1
- e4-failed-initiate: 1
