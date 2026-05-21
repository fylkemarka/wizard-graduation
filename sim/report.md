# Wizard Graduation — Playtest Report

N = **1000** runs simulated with a greedy AI (prioritises high-damage casts, defends when intent threatens KO, picks rare/uncommon rewards).

## Win rate
- **211 wins / 1000** = **21.1%**
- Failures by act: act 1: 74 · act 2: 551 · act 3: 94 · act 4: 70

## Boss outcomes
- Act 1: 926W / 73L (92.7%, n=999)
- Act 2: 375W / 218L (63.2%, n=593)
- Act 3: 281W / 74L (79.2%, n=355)
- Act 4: 211W / 70L (75.1%, n=281)

## Combat pacing
- Avg turns / combat (all tiers): **3.81**
  - normal: 3.17
  - elite: 5.73
  - boss: 6.04

## Cast / resonance / fizzle
- Total casts: 137594
- Resonance triggered: 51618 (**37.5%** of casts)
- Spells fizzled (staged but never CAST): 0
- Fizzle rate: 0.0%

## Deck archetypes (lane bucketing)
- **wit**: 171 runs (17.1%) · 25 wins (14.6% win rate)
- **chutzpah**: 217 runs (21.7%) · 17 wins (7.8% win rate)
- **jnsq**: 61 runs (6.1%) · 7 wins (11.5% win rate)
- **physical**: 59 runs (5.9%) · 30 wins (50.8% win rate)
- **wit-physical**: 109 runs (10.9%) · 54 wins (49.5% win rate)
- **chutzpah-physical**: 53 runs (5.3%) · 11 wins (20.8% win rate)
- **jnsq-physical**: 113 runs (11.3%) · 44 wins (38.9% win rate)
- **sampler**: 217 runs (21.7%) · 23 wins (10.6% win rate)

## Per-archetype loss diagnostics
- **wit** (n=171, 25W): e3-vein-devourer (75), e3-boss-anvil (39), e2-boss-tapestry (13) | died in a1:13 · a2:116 · a3:10 · a4:7
- **chutzpah** (n=217, 17W): e3-vein-devourer (81), e3-boss-anvil (75), e1-boss-thornlord (21) | died in a1:4 · a2:162 · a3:13 · a4:21
- **jnsq** (n=61, 7W): e3-vein-devourer (27), e2-boss-tapestry (12), e3-boss-anvil (10) | died in a1:12 · a2:37 · a3:5 · a4:0
- **physical** (n=59, 30W): e4-boss-headmasters-hat (9), e3-vein-devourer (7), e3-boss-anvil (5) | died in a1:1 · a2:12 · a3:13 · a4:3
- **wit-physical** (n=109, 54W): e3-boss-anvil (18), e3-vein-devourer (14), e1-boss-thornlord (12) | died in a1:1 · a2:33 · a3:9 · a4:12
- **chutzpah-physical** (n=53, 11W): e1-boss-thornlord (16), e3-boss-anvil (13), e4-boss-headmasters-hat (5) | died in a1:2 · a2:18 · a3:6 · a4:16
- **jnsq-physical** (n=113, 44W): e4-boss-headmasters-hat (22), e3-boss-anvil (18), e3-vein-devourer (9) | died in a1:9 · a2:27 · a3:28 · a4:5
- **sampler** (n=217, 23W): e3-vein-devourer (100), e3-boss-anvil (40), e2-boss-tapestry (32) | died in a1:32 · a2:146 · a3:10 · a4:6

## Material picks (sorted by frequency)
- mat-mithril: 1666
- mat-burrgrass: 1005
- mat-linen: 1000
- mat-wraithcloth: 995
- mat-silver: 830
- mat-hemlock: 516
- mat-brocade: 515
- mat-tarred-canvas: 467
- mat-copper: 277
- mat-madrone: 237
- mat-suede: 127
- mat-rosewood: 90

## Craft quality by slot
- staff: Master 209 (99.1%) · Fine 2 (0.9%) · Rough 0 (0.0%)
- robes: Master 820 (88.6%) · Fine 106 (11.4%) · Rough 0 (0.0%)
- ring: Master 337 (89.9%) · Fine 38 (10.1%) · Rough 0 (0.0%)
- hat: Master 277 (98.6%) · Fine 4 (1.4%) · Rough 0 (0.0%)
- Salvaged-Scrap fallbacks: 0

## Skill levels at run end
- whittling: mean 2.05 (max-cap reached in 281 runs)
- weaving: mean 4.21 (max-cap reached in 211 runs)
- smithing: mean 3.70 (max-cap reached in 0 runs)
- felting: mean 1.85 (max-cap reached in 369 runs)

## Winners
- Final HP %: 87.2% of max (mean)
- Final deck size (mean across all runs): 26.03 cards

## Enemies that killed the player
- e3-vein-devourer: 318
- e3-boss-anvil: 218
- e4-boss-headmasters-hat: 74
- e2-boss-tapestry: 73
- e1-boss-thornlord: 70
- e3-quartz-sentinel: 13
- e4-forgotten-master: 11
- e4-failed-initiate: 4
- e4-test-wraith: 3
- e4-apprentice-shade: 2
- e3-geode-crab: 2
- e2-pattern-maker: 1
