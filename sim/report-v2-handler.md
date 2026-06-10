# Witch Mountain Bridge v2 — Playtest Report

N = **1000** runs simulated with a greedy v2 AI.

## Win rate
- **422 wins / 1000** = **42.2%**
- Losses by acts-cleared: 0=190 · 1=172 · 2=216 · 3=0

## Lane outcomes
- **wit**: 0 runs · 0 wins (0.0%)
- **handler**: 1000 runs · 422 wins (42.2%)
- **jnsq**: 0 runs · 0 wins (0.0%)

## Familiar outcomes (v2.9)
- **fam-beetle**: 117 runs · 60 wins (51.3%)
- **fam-cat**: 104 runs · 50 wins (48.1%)
- **fam-snake**: 96 runs · 44 wins (45.8%)
- **fam-crow**: 101 runs · 44 wins (43.6%)
- **fam-toad**: 104 runs · 44 wins (42.3%)
- **fam-owl**: 100 runs · 40 wins (40.0%)
- **fam-mouse**: 107 runs · 41 wins (38.3%)
- **fam-rabbit**: 92 runs · 35 wins (38.0%)
- **fam-hedgehog**: 88 runs · 33 wins (37.5%)
- **fam-raven**: 91 runs · 31 wins (34.1%)

## Cast distribution
- Total casts: 0
- Tier 1 (COHERENT): 0 (0.0%)
- Tier 2 (RESONANT): 0 (0.0%)
- Tier 3 (DEVASTATING): 0 (0.0%)
- Holds (turn ended without cast — tray persists): 0 (NaN%)

## Handler ANIMAL SUMMONER (consolidated 2026-06-01)
- Handler runs: 1000 · 422 wins (42.2%)
- Combats fought: 11903
- Summons: 46381 · feeds: 80753 · short-stays (unfed left early): 19865 · combines: 0
- Combine payoff: burst 0 (avg 0/combine) · lifetime attacks 0 (avg 0/combine) · combine = 0.0% of all menagerie composure
- Menagerie composure dealt: 914645 · block generated: 303979
- Avg summons/combat: 3.90 · avg feeds/combat: 6.78
- Tactic changes: 1859 · avg distinct tactics/combat: 0.15
- Special-lure animals: summons 5055 · porcupine thorns dealt 7578 · sloth enemy-turns skipped 876
- Activated abilities (Mime/Pigeon/Kangaroo): 840 activations
- A Firm Hand ward fizzles (disruption absorbed): 1177
- Fond Farewell composure regained: 1678
- Tactic engagement: shield 0 · rabid 827 · youth 291 · nurture 333 · feather 408

## NEW CARDS (2026-06-08 — block + synergy archetypes)
Draft rate among handler runs, total PLAYS this batch (drafted-but-low-plays = dead in hand), and avg acts-cleared with vs without (survivorship-confounded — relative reads only).
- **c-hunker-down**: drafted 253 (25.3%) · played 1787× · 173 wins · avg acts 2.53 with / 1.65 without
- **c-dig-in**: drafted 186 (18.6%) · played 1264× · 139 wins · avg acts 2.67 with / 1.69 without
- **c-firm-hand**: drafted 887 (88.7%) · played 5080× · 418 wins · avg acts 2.08 with / 0.24 without
- **c-memorial**: drafted 253 (25.3%) · played 526× · 158 wins · avg acts 2.45 with / 1.67 without
- **c-fond-farewell**: drafted 905 (90.5%) · played 722× · 421 wins · avg acts 2.05 with / 0.20 without
- **c-pedigree**: drafted 135 (13.5%) · played 15× · 95 wins · avg acts 2.64 with / 1.75 without
- **c-best-in-show**: drafted 235 (23.5%) · played 17× · 133 wins · avg acts 2.37 with / 1.72 without
- **c-well-drilled**: drafted 227 (22.7%) · played 669× · 143 wins · avg acts 2.50 with / 1.69 without
- **c-rally-the-pack**: drafted 112 (11.2%) · played 94× · 68 wins · avg acts 2.49 with / 1.79 without
- **c-drillmaster**: drafted 102 (10.2%) · played 764× · 70 wins · avg acts 2.61 with / 1.79 without
- Memorial AoE procs (every exit/sacrifice while installed): 1370

## NEW ENEMY MECHANICS — fire counts (this batch)
- heal 437 · charge 310 · summon 482 · cutShort 77 · undermineTactic 4 · doubleMaul 1 · freeze 309 · silence 709 · turnAgainst 912 · betray 103 · maul 1117

## ANOMALIES (red-team tripwires)
Outliers are exploit candidates — investigate anything that jumps batch-over-batch.
- Max single-cast damage: 0 · casts ≥ 40 dmg: 0
- Max casts in one turn: 0
- Peak Block: 0 · peak Words Bank: 0
- Fastest combat win: 2 turns · wins in ≤ 3 turns: 245

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
- v2.92 Passing Thoughts: 1888 granted, 0 played
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
- Avg turns / combat: 8.65
- Avg damage / run: 959
- Mean final deck size: 21.6

## Archetype of winning decks
- mid-t2t3: 422

## Top killer enemies
- e1-boss-thornlord (The Thornlord): 134
- e2-boss-tapestry (The Tapestry Walker): 119
- e3-vein-devourer (Vein Devourer): 69
- e3-boss-anvil (The Anvil-Forged): 57
- e3-quartz-sentinel (Quartz Sentinel): 33
- e2-silent-spinner (The Silent Spinner): 27
- e1-tutor (Stern Tutor): 26
- e1-thicket (Living Thicket): 23
- e2-pattern-maker (The Pattern-Maker): 19
- e2-spinster-matron (The Spinster Matron): 18
- e-rogue-ashweather (Doctor Phin Ashweather (recently inanimate)): 14
- e1-shrine-rat (Shrine Rat Pack): 8
- e-rogue-smelterson (Smelterson, J.C. (alloyed)): 6
- e1-imp (Pact Imp): 6
- e1-acolyte (Lost Acolyte): 5