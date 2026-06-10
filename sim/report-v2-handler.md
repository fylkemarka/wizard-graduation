# Witch Mountain Bridge v2 — Playtest Report

N = **1000** runs simulated with a greedy v2 AI.

## Win rate
- **90 wins / 1000** = **9.0%**
- Losses by acts-cleared: 0=346 · 1=294 · 2=270 · 3=0

## Lane outcomes
- **wit**: 0 runs · 0 wins (0.0%)
- **handler**: 1000 runs · 90 wins (9.0%)
- **jnsq**: 0 runs · 0 wins (0.0%)

## Familiar outcomes (v2.9)
- **fam-owl**: 91 runs · 17 wins (18.7%)
- **fam-toad**: 99 runs · 13 wins (13.1%)
- **fam-cat**: 100 runs · 11 wins (11.0%)
- **fam-beetle**: 103 runs · 9 wins (8.7%)
- **fam-rabbit**: 94 runs · 8 wins (8.5%)
- **fam-snake**: 99 runs · 8 wins (8.1%)
- **fam-raven**: 99 runs · 8 wins (8.1%)
- **fam-mouse**: 101 runs · 7 wins (6.9%)
- **fam-hedgehog**: 114 runs · 6 wins (5.3%)
- **fam-crow**: 100 runs · 3 wins (3.0%)

## Cast distribution
- Total casts: 0
- Tier 1 (COHERENT): 0 (0.0%)
- Tier 2 (RESONANT): 0 (0.0%)
- Tier 3 (DEVASTATING): 0 (0.0%)
- Holds (turn ended without cast — tray persists): 0 (NaN%)

## Handler ANIMAL SUMMONER (consolidated 2026-06-01)
- Handler runs: 1000 · 90 wins (9.0%)
- Combats fought: 9769
- Summons: 35549 · feeds: 59633 · short-stays (unfed left early): 15773 · combines: 0
- Combine payoff: burst 0 (avg 0/combine) · lifetime attacks 0 (avg 0/combine) · combine = 0.0% of all menagerie composure
- Menagerie composure dealt: 669450 · block generated: 227294
- Avg summons/combat: 3.64 · avg feeds/combat: 6.10
- Tactic changes: 1157 · avg distinct tactics/combat: 0.11
- Special-lure animals: summons 3046 · porcupine thorns dealt 4391 · sloth enemy-turns skipped 366
- Activated abilities (Mime/Pigeon/Kangaroo): 487 activations
- A Firm Hand ward fizzles (disruption absorbed): 1170
- Fond Farewell composure regained: 1346
- Tactic engagement: shield 0 · rabid 549 · youth 190 · nurture 224 · feather 194

## NEW CARDS (2026-06-08 — block + synergy archetypes)
Draft rate among handler runs, total PLAYS this batch (drafted-but-low-plays = dead in hand), and avg acts-cleared with vs without (survivorship-confounded — relative reads only).
- **c-hunker-down**: drafted 167 (16.7%) · played 1174× · 40 wins · avg acts 1.91 with / 0.94 without
- **c-dig-in**: drafted 127 (12.7%) · played 694× · 35 wins · avg acts 1.84 with / 1.00 without
- **c-firm-hand**: drafted 790 (79.0%) · played 4009× · 90 wins · avg acts 1.34 with / 0.20 without
- **c-memorial**: drafted 177 (17.7%) · played 312× · 32 wins · avg acts 1.81 with / 0.95 without
- **c-fond-farewell**: drafted 808 (80.8%) · played 579× · 89 wins · avg acts 1.31 with / 0.24 without
- **c-pedigree**: drafted 67 (6.7%) · played 6× · 11 wins · avg acts 1.79 with / 1.05 without
- **c-best-in-show**: drafted 145 (14.5%) · played 11× · 23 wins · avg acts 1.68 with / 1.01 without
- **c-well-drilled**: drafted 142 (14.2%) · played 311× · 27 wins · avg acts 1.76 with / 1.00 without
- **c-rally-the-pack**: drafted 72 (7.2%) · played 56× · 17 wins · avg acts 2.01 with / 1.03 without
- **c-drillmaster**: drafted 69 (6.9%) · played 441× · 9 wins · avg acts 1.81 with / 1.05 without
- Memorial AoE procs (every exit/sacrifice while installed): 728

## NEW ENEMY MECHANICS — fire counts (this batch)
- heal 390 · charge 286 · summon 461 · cutShort 93 · undermineTactic 10 · doubleMaul 1 · freeze 343 · silence 705 · turnAgainst 741 · betray 98 · maul 760

## ANOMALIES (red-team tripwires)
Outliers are exploit candidates — investigate anything that jumps batch-over-batch.
- Max single-cast damage: 0 · casts ≥ 40 dmg: 0
- Max casts in one turn: 0
- Peak Block: 0 · peak Words Bank: 0
- Fastest combat win: 2 turns · wins in ≤ 3 turns: 296

## Wit SCHOOLS (1000-run cycle telemetry)
- Full FFT casts: 0 (total FFT damage 0) · partial-row: 0 · same-school (non-row): 0
- Slow Burn DoT deposited: 0
- Crescendo bank cash-ins (flat damage): 0
- Thorns block granted by casts: 0
- Thorns BODY SLAM: 0 casts · 0 damage
- Slot-tutor skills: 0 plays · 0 cards pulled
- Hold causes: full-tray(deliberate/energy-at-cast) 0 · energy-short 0 · missing-slot 0 (intro 0 / subject 0 / target 0)

## Wit LONG THREAD (v2.34)
- Combats reaching LT ≥ 1: 0 (runs: 0 / 1000, 0.0%)
- Avg peak LT per run (across all combats): 0.00
- Avg peak LT per threaded combat: 0.00
- Thread breaks (unblocked hit reset a non-zero meter): 0
- Thread-scaling rider triggers: 0
- Total bonus damage from thread scaling: 0
- "natural conclusion." target casts: 0
- v2.43 thread-preservation skip-casts: 0
- v2.67 chip-cast skips (HUMAN_PLAY_PROFILE-aligned): 0
- v2.90 backfire-smoother fires (3rd consecutive 1 → 2): 0
- v2.92 Passing Thoughts: 1575 granted, 0 played
- v2.93 Find the Seam (bypass-effectiveness) fires: 0
- v2.93 Precedent (echo-last-damage) fires: 0
- v2.93 Insult-to-Injury (×N mult) fires: 0
- v2.93 Doubletake (cast resolves twice) fires: 0
- v2.93 Skip-next-attack fires: 0
- v2.93 Mirror Reasoning (reflect debuff) fires: 0
- v2.93 Bracing (draw-3-on-HP-loss) fires: 0

## Wit FOOTNOTE (v2.35)
- Footnotes applied: 0 (runs: 0 / 1000, 0.0%)
- Casts contributing footnote bonus: 0
- Total footnote bonus damage: 0
- Avg bonus per footnoted cast: 0.00

## Wit ACTUALLY— (v2.36)
- Re-fires resolved: 0 (runs: 0 / 1000, 0.0%)
- Total re-fire damage: 0
- Avg damage / re-fire: 0.00
- Enemy bonus from arguing-back: 0 (cost side fired)

## Wit HOLD ON — (v2.37)
- Plays: 0 (runs: 0 / 1000, 0.0%)
- Total damage prevented: 0
- Avg prevention / play: 0.00

## Wit SAYING SOMETHING WRONG (v2.38)
- Casts that queued a Misstep: 0 (runs: 0 / 1000, 0.0%)
- Up-front damage dealt by those casts: 0
- Tokens delivered to hand: 0
- Discarded (1 Energy paid): 0
- Auto-played (-3 HP eaten): 0 (total damage: 0)
- KOs by Misstep auto-play: 0
- Avg up-front damage / cast: 0.00

## Wit OPENING STATEMENT (v2.39)
- Bonus triggers: 0 (runs: 0 / 1000, 0.0%)
- Total bonus damage: 0
- Avg bonus / trigger: 0.00
- Revisit-opening skill plays: 0

## Wit PATIENCE (v2.40)
- Installs: 0 (runs: 0 / 1000, 0.0%)
- Peak stacks — max: 0, mean: 0.00
- Total damage from patience-spend: 0
- Casts that consumed bank: 0
- "I'll let you finish," skill plays: 0
- Avg damage / spend: 0.00

## Wit SYNERGY CAPSTONE (v2.41)
- "in summary," casts: 0 (runs: 0 / 1000, 0.0%)
- Total capstone damage: 0
- Avg damage per cast: 0.00

## Wit INSULT VULNERABILITIES (v2.42)
- Casts that hit the rider: 0 (runs: 0 / 1000, 0.0%)
- Total matched tags (capped 3/cast): 0
- Total bonus damage: 0
- Avg bonus per cast: 0.00

## Jnsq TANGENT (v2.44)
- "That reminds me," skill plays: 0 (runs: 0 / 1000, 0.0%)
- Detours that cast a target: 0
- Detours that staged a word/modifier: 0
- Detours that fizzled (target hit incomplete tray): 0
- Outcome ratio: cast / staged / fizzle: 0 / 0 / 0

## Jnsq APOLOGY (v2.45)
- "I shouldn't have said that —" plays: 0 (runs: 0 / 1000, 0.0%)
- Total HP healed: 0
- Total tray cards discarded by reset: 0
- Avg tray cards / cast: 0.00

## Jnsq WON'T SHUT UP (v2.46)
- Rider armed (soup target cast): 0 (runs: 0 / 1000, 0.0%)
- Dodges (kept going — follow-up jnsq played): 0 (0%)
- Damage fires (-3 HP each): 0 (0%)
- Total HP lost to commitment: 0

## Jnsq DRUNKEN CONFIDENCE (v2.47)
- Installs (per-combat): 0 (runs: 0 / 1000, 0.0%)
- Uninstalls (sober second thought): 0
- Casts that received the +50%: 0
- Total bonus damage from +50% on casts: 0
- Total +2 incoming penalty taken: 0
- Net trade: 0 (positive = paying off)

## Jnsq AWKWARD PAUSE (v2.48)
- "...go on, I'm listening." plays: 0 (runs: 0 / 1000, 0.0%)
- Doubled casts (bank cashed in): 0
- Total extra damage from doubling: 0
- Avg extra damage / doubled cast: 0.0
- Cash-in ratio (doubled casts / pauses): 0%

## Jnsq BABBLING (v2.49)
- Installs (per-combat): 0 (runs: 0 / 1000, 0.0%)
- 2nd casts fired: 0
- Total damage delivered by 2nd casts: 0
- Avg damage / 2nd cast: 0.0
- 2nd-cast rate per install: 0.00

## Jnsq GETTING-AWAY-FROM-ME (v2.50)
- Rare casts: 0 (runs: 0 / 1000, 0.0%)
- Doubled fires (cast #2 under Babbling): 0 (0% of casts)

## Jnsq SYNERGY CAPSTONE — "universe sideways" (v2.51)
- Capstone casts: 0 (runs: 0 / 1000, 0.0%)
- Total capstone damage: 0
- Avg damage / capstone cast: 0.00
- Tangent-on-cast fires: 0

## Jnsq DRUNKEN STAGGER (v2.52)
- "sorry, I lost my balance" plays: 0 (runs: 0 / 1000, 0.0%)
- Swings missed (50% dodge fired): 0
- Total damage avoided: 0
- Avg damage avoided / play: 0.0
- Dodge rate (misses / plays): 0%

## Combat pacing
- Avg turns / combat: 7.85
- Avg damage / run: 696
- Mean final deck size: 19.2

## Archetype of winning decks
- mid-t2t3: 90

## Top killer enemies
- e2-boss-tapestry (The Tapestry Walker): 262
- e1-boss-thornlord (The Thornlord): 219
- e3-boss-anvil (The Anvil-Forged): 171
- e3-vein-devourer (Vein Devourer): 77
- e3-quartz-sentinel (Quartz Sentinel): 35
- e2-silent-spinner (The Silent Spinner): 33
- e2-spinster-matron (The Spinster Matron): 26
- e1-tutor (Stern Tutor): 20
- e2-pattern-maker (The Pattern-Maker): 17
- e1-thicket (Living Thicket): 17
- e-rogue-smelterson (Smelterson, J.C. (alloyed)): 6
- e-rogue-ashweather (Doctor Phin Ashweather (recently inanimate)): 6
- e1-acolyte (Lost Acolyte): 3
- e3-geode-crab (Geode Crab): 3
- e2-warp (Warp): 3