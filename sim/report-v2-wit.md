# Witch Mountain Bridge v2 — Playtest Report

N = **1000** runs simulated with a greedy v2 AI.

## Win rate
- **420 wins / 1000** = **42.0%**
- Losses by acts-cleared: 0=96 · 1=335 · 2=149 · 3=0

## Lane outcomes
- **wit**: 1000 runs · 420 wins (42.0%)
- **handler**: 0 runs · 0 wins (0.0%)
- **jnsq**: 0 runs · 0 wins (0.0%)

## Familiar outcomes (v2.9)
- **fam-beetle**: 114 runs · 66 wins (57.9%)
- **fam-owl**: 94 runs · 53 wins (56.4%)
- **fam-mouse**: 99 runs · 49 wins (49.5%)
- **fam-toad**: 81 runs · 40 wins (49.4%)
- **fam-crow**: 118 runs · 46 wins (39.0%)
- **fam-cat**: 97 runs · 36 wins (37.1%)
- **fam-snake**: 114 runs · 41 wins (36.0%)
- **fam-hedgehog**: 99 runs · 35 wins (35.4%)
- **fam-rabbit**: 88 runs · 28 wins (31.8%)
- **fam-raven**: 96 runs · 26 wins (27.1%)

## Cast distribution
- Total casts: 40516
- Tier 1 (COHERENT): 16974 (41.9%)
- Tier 2 (RESONANT): 16192 (40.0%)
- Tier 3 (DEVASTATING): 7350 (18.1%)
- Holds (turn ended without cast — tray persists): 31053 (43.4%)

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
- Max single-cast damage: 164 · casts ≥ 40 dmg: 4786
- Max casts in one turn: 1
- Peak Block: 61 · peak Words Bank: 40
- Fastest combat win: 1 turns · wins in ≤ 3 turns: 2070

## Wit SCHOOLS (1000-run cycle telemetry)
- Full FFT casts: 10128 (total FFT damage 178266) · partial-row: 20173 · same-school (non-row): 3113
- Slow Burn DoT deposited: 0
- Crescendo bank cash-ins (flat damage): 61008
- Thorns block granted by casts: 216481
- Thorns BODY SLAM: 13 casts · 64 damage
- Slot-tutor skills: 772 plays · 772 cards pulled
- Hold causes: full-tray(deliberate/energy-at-cast) 0 · energy-short 9579 · missing-slot 21474 (intro 5757 / subject 8704 / target 9724)

## Wit LONG THREAD (v2.34)
- Combats reaching LT ≥ 1: 9658 (runs: 1000 / 1000, 100.0%)
- Avg peak LT per run (across all combats): 20.28
- Avg peak LT per threaded combat: 2.10
- Thread breaks (unblocked hit reset a non-zero meter): 10582
- Thread-scaling rider triggers: 538
- Total bonus damage from thread scaling: 3074
- "natural conclusion." target casts: 229
- v2.43 thread-preservation skip-casts: 14
- v2.67 chip-cast skips (HUMAN_PLAY_PROFILE-aligned): 0
- v2.90 backfire-smoother fires (3rd consecutive 1 → 2): 0
- v2.92 Passing Thoughts: 1928 granted, 1692 played
- v2.93 Find the Seam (bypass-effectiveness) fires: 103
- v2.93 Precedent (echo-last-damage) fires: 68
- v2.93 Insult-to-Injury (×N mult) fires: 86
- v2.93 Doubletake (cast resolves twice) fires: 64
- v2.93 Skip-next-attack fires: 289
- v2.93 Mirror Reasoning (reflect debuff) fires: 29
- v2.93 Bracing (draw-3-on-HP-loss) fires: 31

## Wit FOOTNOTE (v2.35)
- Footnotes applied: 324 (runs: 323 / 1000, 32.3%)
- Casts contributing footnote bonus: 1198
- Total footnote bonus damage: 4658
- Avg bonus per footnoted cast: 3.89

## Wit ACTUALLY— (v2.36)
- Re-fires resolved: 630 (runs: 230 / 1000, 23.0%)
- Total re-fire damage: 28016
- Avg damage / re-fire: 44.47
- Enemy bonus from arguing-back: 280 (cost side fired)

## Wit HOLD ON — (v2.37)
- Plays: 231 (runs: 142 / 1000, 14.2%)
- Total damage prevented: 350
- Avg prevention / play: 1.52

## Wit SAYING SOMETHING WRONG (v2.38)
- Casts that queued a Misstep: 2244 (runs: 444 / 1000, 44.4%)
- Up-front damage dealt by those casts: 110457
- Tokens delivered to hand: 820
- Discarded (1 Energy paid): 740
- Auto-played (-3 HP eaten): 77 (total damage: 231)
- KOs by Misstep auto-play: 0
- Avg up-front damage / cast: 49.22

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
- "in summary," casts: 1377 (runs: 297 / 1000, 29.7%)
- Total capstone damage: 64043
- Avg damage per cast: 46.51

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
- Avg turns / combat: 6.00
- Avg damage / run: 864
- Mean final deck size: 29.0

## Archetype of winning decks
- mid-t2t3: 379
- honed-t3: 41

## Top killer enemies
- e3-boss-anvil (The Anvil-Forged): 144
- e3-vein-devourer (Vein Devourer): 132
- e1-boss-thornlord (The Thornlord): 115
- e3-quartz-sentinel (Quartz Sentinel): 56
- e2-boss-tapestry (The Tapestry Walker): 49
- e2-silent-spinner (The Silent Spinner): 27
- e1-tutor (Stern Tutor): 15
- e2-pattern-maker (The Pattern-Maker): 12
- e1-thicket (Living Thicket): 11
- e-rogue-ashweather (Doctor Phin Ashweather (recently inanimate)): 5
- weave: 3
- e3-glow-mite (Glow Mite Swarm): 3
- e2-loom-familiar (Loom Familiar): 2
- e1-shrine-rat (Shrine Rat Pack): 2
- e2-warp (Warp): 1