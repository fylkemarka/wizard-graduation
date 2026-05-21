# Wizard Graduation — Playtest Report

N = **1000** runs simulated with a greedy AI (prioritises high-damage casts, defends when intent threatens KO, picks rare/uncommon rewards).

## Win rate
- **225 wins / 1000** = **22.5%**
- Failures by act: act 1: 97 · act 2: 547 · act 3: 77 · act 4: 54

## Boss outcomes
- Act 1: 903W / 95L (90.5%, n=998)
- Act 2: 356W / 209L (63.0%, n=565)
- Act 3: 279W / 61L (82.1%, n=340)
- Act 4: 225W / 54L (80.6%, n=279)

## Combat pacing
- Avg turns / combat (all tiers): **3.81**
  - normal: 3.16
  - elite: 5.80
  - boss: 6.09

## Cast / resonance / fizzle
- Total casts: 134001
- Resonance triggered: 49840 (**37.2%** of casts)
- Spells fizzled (staged but never CAST): 0
- Fizzle rate: 0.0%

## Deck archetypes (lane bucketing)
- **wit**: 121 runs (12.1%) · 15 wins (12.4% win rate)
- **chutzpah**: 223 runs (22.3%) · 33 wins (14.8% win rate)
- **jnsq**: 75 runs (7.5%) · 4 wins (5.3% win rate)
- **physical**: 57 runs (5.7%) · 25 wins (43.9% win rate)
- **wit-physical**: 99 runs (9.9%) · 40 wins (40.4% win rate)
- **chutzpah-physical**: 72 runs (7.2%) · 18 wins (25.0% win rate)
- **jnsq-physical**: 125 runs (12.5%) · 54 wins (43.2% win rate)
- **sampler**: 228 runs (22.8%) · 36 wins (15.8% win rate)

## Per-archetype loss diagnostics
- **wit** (n=121, 15W): e3-vein-devourer (58), e3-boss-anvil (30), e2-boss-tapestry (12) | died in a1:12 · a2:89 · a3:2 · a4:3
- **chutzpah** (n=223, 33W): e3-vein-devourer (95), e3-boss-anvil (74), e1-boss-thornlord (11) | died in a1:6 · a2:169 · a3:4 · a4:11
- **jnsq** (n=75, 4W): e3-vein-devourer (31), e2-boss-tapestry (25), e3-boss-anvil (10) | died in a1:25 · a2:41 · a3:5 · a4:0
- **physical** (n=57, 25W): e3-boss-anvil (9), e3-vein-devourer (7), e4-boss-headmasters-hat (6) | died in a1:2 · a2:16 · a3:9 · a4:5
- **wit-physical** (n=99, 40W): e3-vein-devourer (27), e3-boss-anvil (14), e2-boss-tapestry (7) | died in a1:7 · a2:41 · a3:5 · a4:6
- **chutzpah-physical** (n=72, 18W): e1-boss-thornlord (18), e3-boss-anvil (14), e3-vein-devourer (13) | died in a1:1 · a2:27 · a3:8 · a4:18
- **jnsq-physical** (n=125, 54W): e4-boss-headmasters-hat (21), e3-boss-anvil (17), e3-vein-devourer (10) | died in a1:11 · a2:28 · a3:26 · a4:6
- **sampler** (n=228, 36W): e3-vein-devourer (89), e3-boss-anvil (41), e2-boss-tapestry (33) | died in a1:33 · a2:136 · a3:18 · a4:5

## Material picks (sorted by frequency)
- mat-mithril: 1644
- mat-burrgrass: 1038
- mat-linen: 991
- mat-wraithcloth: 971
- mat-silver: 783
- mat-hemlock: 509
- mat-tarred-canvas: 479
- mat-brocade: 458
- mat-copper: 281
- mat-madrone: 244
- mat-suede: 105
- mat-rosewood: 84

## Craft quality by slot
- staff: Master 222 (98.7%) · Fine 3 (1.3%) · Rough 0 (0.0%)
- robes: Master 805 (89.1%) · Fine 98 (10.9%) · Rough 0 (0.0%)
- ring: Master 316 (88.8%) · Fine 40 (11.2%) · Rough 0 (0.0%)
- hat: Master 274 (98.2%) · Fine 5 (1.8%) · Rough 0 (0.0%)
- Salvaged-Scrap fallbacks: 0

## Skill levels at run end
- whittling: mean 2.02 (max-cap reached in 279 runs)
- weaving: mean 4.22 (max-cap reached in 225 runs)
- smithing: mean 3.61 (max-cap reached in 0 runs)
- felting: mean 1.75 (max-cap reached in 346 runs)

## Winners
- Final HP %: 86.4% of max (mean)
- Final deck size (mean across all runs): 25.67 cards

## Enemies that killed the player
- e3-vein-devourer: 330
- e3-boss-anvil: 209
- e2-boss-tapestry: 95
- e4-boss-headmasters-hat: 61
- e1-boss-thornlord: 54
- e3-quartz-sentinel: 6
- e4-forgotten-master: 6
- e4-mirror-past: 4
- e4-failed-initiate: 3
- e4-apprentice-shade: 3
- e2-pattern-maker: 2
- e3-crystal-beetle: 2
