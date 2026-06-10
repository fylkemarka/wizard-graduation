# Witch Mountain Bridge v2 — Playtest Report

N = **1000** runs simulated with a greedy v2 AI.

## Win rate
- **422 wins / 1000** = **42.2%**
- Losses by acts-cleared: 0=96 · 1=339 · 2=143 · 3=0

## Lane outcomes
- **wit**: 1000 runs · 422 wins (42.2%)
- **handler**: 0 runs · 0 wins (0.0%)
- **jnsq**: 0 runs · 0 wins (0.0%)

## Familiar outcomes (v2.9)
- **fam-beetle**: 113 runs · 66 wins (58.4%)
- **fam-cat**: 104 runs · 55 wins (52.9%)
- **fam-owl**: 93 runs · 48 wins (51.6%)
- **fam-hedgehog**: 93 runs · 41 wins (44.1%)
- **fam-mouse**: 96 runs · 42 wins (43.8%)
- **fam-toad**: 89 runs · 38 wins (42.7%)
- **fam-snake**: 103 runs · 41 wins (39.8%)
- **fam-crow**: 107 runs · 35 wins (32.7%)
- **fam-rabbit**: 105 runs · 33 wins (31.4%)
- **fam-raven**: 97 runs · 23 wins (23.7%)

## Cast distribution
- Total casts: 39709
- Tier 1 (COHERENT): 16643 (41.9%)
- Tier 2 (RESONANT): 15577 (39.2%)
- Tier 3 (DEVASTATING): 7489 (18.9%)
- Holds (turn ended without cast — tray persists): 30240 (43.2%)

## Handler ANIMAL SUMMONER (consolidated 2026-06-01)
- Handler runs: 0 · 0 wins (0.0%)
- Combats fought: 0
- Summons: 0 · feeds: 0 · short-stays (unfed left early): 0 · combines: 0
- Combine payoff: burst 0 (avg 0/combine) · lifetime attacks 0 (avg 0/combine) · combine = 0% of all menagerie composure
- Menagerie composure dealt: 0 · block generated: 0
- Avg summons/combat: 0.00 · avg feeds/combat: 0.00
- Tactic changes: 0 · avg distinct tactics/combat: 0.00
- Special-lure animals: summons 0 · porcupine thorns dealt 0 · sloth enemy-turns skipped 0
- Activated abilities (Mime/Pigeon/Kangaroo): 0 activations
- A Firm Hand ward fizzles (disruption absorbed): 0
- Fond Farewell composure regained: 0
- Tactic engagement: shield 0 · rabid 0 · youth 0 · nurture 0 · feather 0

## NEW CARDS (2026-06-08 — block + synergy archetypes)
Draft rate among handler runs, total PLAYS this batch (drafted-but-low-plays = dead in hand), and avg acts-cleared with vs without (survivorship-confounded — relative reads only).
- **c-hunker-down**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- **c-dig-in**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- **c-firm-hand**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- **c-memorial**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- **c-fond-farewell**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- **c-pedigree**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- **c-best-in-show**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- **c-well-drilled**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- **c-rally-the-pack**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- **c-drillmaster**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.00 without
- Memorial AoE procs (every exit/sacrifice while installed): 0

## NEW ENEMY MECHANICS — fire counts (this batch)
- heal 0 · charge 0 · summon 0 · cutShort 0 · undermineTactic 0 · doubleMaul 0 · freeze 0 · silence 0 · turnAgainst 0 · betray 0 · maul 0

## ANOMALIES (red-team tripwires)
Outliers are exploit candidates — investigate anything that jumps batch-over-batch.
- Max single-cast damage: 172 · casts ≥ 40 dmg: 4996
- Max casts in one turn: 1
- Peak Block: 78 · peak Words Bank: 40
- Fastest combat win: 1 turns · wins in ≤ 3 turns: 2101

## Wit SCHOOLS (1000-run cycle telemetry)
- Full FFT casts: 9911 (total FFT damage 179705) · partial-row: 19700 · same-school (non-row): 2997
- Slow Burn DoT deposited: 0
- Crescendo bank cash-ins (flat damage): 61923
- Thorns block granted by casts: 190020
- Thorns BODY SLAM: 22 casts · 111 damage
- Slot-tutor skills: 752 plays · 752 cards pulled
- Hold causes: full-tray(deliberate/energy-at-cast) 0 · energy-short 9390 · missing-slot 20850 (intro 5422 / subject 8429 / target 9630)

## Wit LONG THREAD (v2.34)
- Combats reaching LT ≥ 1: 9523 (runs: 1000 / 1000, 100.0%)
- Avg peak LT per run (across all combats): 19.52
- Avg peak LT per threaded combat: 2.05
- Thread breaks (unblocked hit reset a non-zero meter): 10489
- Thread-scaling rider triggers: 586
- Total bonus damage from thread scaling: 3598
- "natural conclusion." target casts: 182
- v2.43 thread-preservation skip-casts: 8
- v2.67 chip-cast skips (HUMAN_PLAY_PROFILE-aligned): 0
- v2.90 backfire-smoother fires (3rd consecutive 1 → 2): 0
- v2.92 Passing Thoughts: 1947 granted, 1749 played
- v2.93 Find the Seam (bypass-effectiveness) fires: 76
- v2.93 Precedent (echo-last-damage) fires: 83
- v2.93 Insult-to-Injury (×N mult) fires: 80
- v2.93 Doubletake (cast resolves twice) fires: 79
- v2.93 Skip-next-attack fires: 268
- v2.93 Mirror Reasoning (reflect debuff) fires: 38
- v2.93 Bracing (draw-3-on-HP-loss) fires: 22

## Wit FOOTNOTE (v2.35)
- Footnotes applied: 308 (runs: 308 / 1000, 30.8%)
- Casts contributing footnote bonus: 1070
- Total footnote bonus damage: 4215
- Avg bonus per footnoted cast: 3.94

## Wit ACTUALLY— (v2.36)
- Re-fires resolved: 669 (runs: 218 / 1000, 21.8%)
- Total re-fire damage: 29975
- Avg damage / re-fire: 44.81
- Enemy bonus from arguing-back: 289 (cost side fired)

## Wit HOLD ON — (v2.37)
- Plays: 253 (runs: 144 / 1000, 14.4%)
- Total damage prevented: 373
- Avg prevention / play: 1.47

## Wit SAYING SOMETHING WRONG (v2.38)
- Casts that queued a Misstep: 2388 (runs: 478 / 1000, 47.8%)
- Up-front damage dealt by those casts: 115299
- Tokens delivered to hand: 860
- Discarded (1 Energy paid): 772
- Auto-played (-3 HP eaten): 83 (total damage: 249)
- KOs by Misstep auto-play: 0
- Avg up-front damage / cast: 48.28

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
- "in summary," casts: 1609 (runs: 321 / 1000, 32.1%)
- Total capstone damage: 73593
- Avg damage per cast: 45.74

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
- Avg turns / combat: 5.90
- Avg damage / run: 862
- Mean final deck size: 29.1

## Archetype of winning decks
- mid-t2t3: 384
- honed-t3: 38

## Top killer enemies
- e3-vein-devourer (Vein Devourer): 152
- e3-boss-anvil (The Anvil-Forged): 137
- e1-boss-thornlord (The Thornlord): 116
- e2-boss-tapestry (The Tapestry Walker): 49
- e3-quartz-sentinel (Quartz Sentinel): 46
- e2-silent-spinner (The Silent Spinner): 23
- e2-pattern-maker (The Pattern-Maker): 16
- e1-tutor (Stern Tutor): 14
- e1-thicket (Living Thicket): 6
- e-rogue-ashweather (Doctor Phin Ashweather (recently inanimate)): 3
- e2-warp (Warp): 2
- e3-glow-mite (Glow Mite Swarm): 2
- e3-crystal-beetle (Crystal Beetle): 2
- e1-shrine-rat (Shrine Rat Pack): 2
- e2-spinster-matron (The Spinster Matron): 2