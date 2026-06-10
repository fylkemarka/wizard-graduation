# Witch Mountain Bridge v2 — Playtest Report

N = **1000** runs simulated with a greedy v2 AI.

## Win rate
- **464 wins / 1000** = **46.4%**
- Losses by acts-cleared: 0=186 · 1=156 · 2=194 · 3=0

## Lane outcomes
- **wit**: 0 runs · 0 wins (0.0%)
- **handler**: 1000 runs · 464 wins (46.4%)
- **jnsq**: 0 runs · 0 wins (0.0%)

## Familiar outcomes (v2.9)
- **fam-owl**: 114 runs · 67 wins (58.8%)
- **fam-cat**: 102 runs · 56 wins (54.9%)
- **fam-toad**: 96 runs · 52 wins (54.2%)
- **fam-mouse**: 97 runs · 48 wins (49.5%)
- **fam-beetle**: 93 runs · 46 wins (49.5%)
- **fam-snake**: 99 runs · 47 wins (47.5%)
- **fam-rabbit**: 106 runs · 45 wins (42.5%)
- **fam-raven**: 103 runs · 38 wins (36.9%)
- **fam-hedgehog**: 96 runs · 35 wins (36.5%)
- **fam-crow**: 94 runs · 30 wins (31.9%)

## Cast distribution
- Total casts: 0
- Tier 1 (COHERENT): 0 (0.0%)
- Tier 2 (RESONANT): 0 (0.0%)
- Tier 3 (DEVASTATING): 0 (0.0%)
- Holds (turn ended without cast — tray persists): 0 (NaN%)

## Handler ANIMAL SUMMONER (consolidated 2026-06-01)
- Handler runs: 1000 · 464 wins (46.4%)
- Combats fought: 12086
- Summons: 46114 · feeds: 76272 · short-stays (unfed left early): 19870 · combines: 0
- Combine payoff: burst 0 (avg 0/combine) · lifetime attacks 0 (avg 0/combine) · combine = 0.0% of all menagerie composure
- Menagerie composure dealt: 877013 · block generated: 295031
- Avg summons/combat: 3.82 · avg feeds/combat: 6.31
- Tactic changes: 1926 · avg distinct tactics/combat: 0.15
- Special-lure animals: summons 4864 · porcupine thorns dealt 7698 · sloth enemy-turns skipped 546
- Activated abilities (Mime/Pigeon/Kangaroo): 827 activations
- A Firm Hand ward fizzles (disruption absorbed): 1245
- Fond Farewell composure regained: 1410
- Tactic engagement: shield 0 · rabid 888 · youth 285 · nurture 382 · feather 371

## NEW CARDS (2026-06-08 — block + synergy archetypes)
Draft rate among handler runs, total PLAYS this batch (drafted-but-low-plays = dead in hand), and avg acts-cleared with vs without (survivorship-confounded — relative reads only).
- **c-hunker-down**: drafted 242 (24.2%) · played 1555× · 169 wins · avg acts 2.51 with / 1.75 without
- **c-dig-in**: drafted 202 (20.2%) · played 1113× · 145 wins · avg acts 2.56 with / 1.78 without
- **c-firm-hand**: drafted 879 (87.9%) · played 5230× · 457 wins · avg acts 2.15 with / 0.36 without
- **c-memorial**: drafted 263 (26.3%) · played 614× · 155 wins · avg acts 2.44 with / 1.75 without
- **c-fond-farewell**: drafted 876 (87.6%) · played 703× · 450 wins · avg acts 2.13 with / 0.56 without
- **c-pedigree**: drafted 134 (13.4%) · played 24× · 93 wins · avg acts 2.58 with / 1.84 without
- **c-best-in-show**: drafted 212 (21.2%) · played 15× · 152 wins · avg acts 2.56 with / 1.77 without
- **c-well-drilled**: drafted 242 (24.2%) · played 527× · 170 wins · avg acts 2.56 with / 1.74 without
- **c-rally-the-pack**: drafted 114 (11.4%) · played 94× · 80 wins · avg acts 2.65 with / 1.84 without
- **c-drillmaster**: drafted 118 (11.8%) · played 613× · 85 wins · avg acts 2.64 with / 1.84 without
- Memorial AoE procs (every exit/sacrifice while installed): 1522

## NEW ENEMY MECHANICS — fire counts (this batch)
- heal 416 · charge 310 · summon 506 · cutShort 101 · undermineTactic 5 · doubleMaul 3 · freeze 285 · silence 688 · turnAgainst 884 · betray 104 · maul 1148

## ANOMALIES (red-team tripwires)
Outliers are exploit candidates — investigate anything that jumps batch-over-batch.
- Max single-cast damage: 0 · casts ≥ 40 dmg: 0
- Max casts in one turn: 0
- Peak Block: 0 · peak Words Bank: 0
- Fastest combat win: 2 turns · wins in ≤ 3 turns: 305

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
- v2.92 Passing Thoughts: 1921 granted, 0 played
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
- Avg turns / combat: 8.36
- Avg damage / run: 920
- Mean final deck size: 21.9

## Archetype of winning decks
- mid-t2t3: 464

## Top killer enemies
- e1-boss-thornlord (The Thornlord): 141
- e2-boss-tapestry (The Tapestry Walker): 111
- e3-boss-anvil (The Anvil-Forged): 63
- e3-vein-devourer (Vein Devourer): 58
- e2-silent-spinner (The Silent Spinner): 27
- e3-quartz-sentinel (Quartz Sentinel): 24
- e2-spinster-matron (The Spinster Matron): 23
- e1-tutor (Stern Tutor): 20
- e2-pattern-maker (The Pattern-Maker): 17
- e1-thicket (Living Thicket): 14
- e-rogue-ashweather (Doctor Phin Ashweather (recently inanimate)): 12
- e3-crystal-beetle (Crystal Beetle): 5
- e2-hollow-weaver (Hollow Weaver): 3
- e3-geode-crab (Geode Crab): 3
- e1-imp (Pact Imp): 3