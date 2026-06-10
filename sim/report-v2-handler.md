# Witch Mountain Bridge v2 — Playtest Report

N = **100** runs simulated with a greedy v2 AI.

## Win rate
- **0 wins / 100** = **0.0%**
- Losses by acts-cleared: 0=78 · 1=19 · 2=3 · 3=0

## Lane outcomes
- **wit**: 0 runs · 0 wins (0.0%)
- **handler**: 100 runs · 0 wins (0.0%)
- **jnsq**: 0 runs · 0 wins (0.0%)

## Familiar outcomes (v2.9)
- **fam-beetle**: 16 runs · 0 wins (0.0%)
- **fam-mouse**: 10 runs · 0 wins (0.0%)
- **fam-cat**: 16 runs · 0 wins (0.0%)
- **fam-owl**: 8 runs · 0 wins (0.0%)
- **fam-hedgehog**: 11 runs · 0 wins (0.0%)
- **fam-raven**: 6 runs · 0 wins (0.0%)
- **fam-toad**: 11 runs · 0 wins (0.0%)
- **fam-crow**: 4 runs · 0 wins (0.0%)
- **fam-rabbit**: 10 runs · 0 wins (0.0%)
- **fam-snake**: 8 runs · 0 wins (0.0%)

## Cast distribution
- Total casts: 0
- Tier 1 (COHERENT): 0 (0.0%)
- Tier 2 (RESONANT): 0 (0.0%)
- Tier 3 (DEVASTATING): 0 (0.0%)
- Holds (turn ended without cast — tray persists): 0 (NaN%)

## Handler ANIMAL SUMMONER (consolidated 2026-06-01)
- Handler runs: 100 · 0 wins (0.0%)
- Combats fought: 545
- Summons: 1903 · feeds: 4327 · short-stays (unfed left early): 271 · combines: 0
- Combine payoff: burst 0 (avg 0/combine) · lifetime attacks 0 (avg 0/combine) · combine = 0.0% of all menagerie composure
- Menagerie composure dealt: 33397 · block generated: 22409
- Avg summons/combat: 3.49 · avg feeds/combat: 7.94
- Tactic changes: 162 · avg distinct tactics/combat: 0.26
- Special-lure animals: summons 113 · porcupine thorns dealt 87 · sloth enemy-turns skipped 25
- Activated abilities (Mime/Pigeon/Kangaroo): 25 activations
- A Firm Hand ward fizzles (disruption absorbed): 103
- Fond Farewell composure regained: 66
- Tactic engagement: shield 108 · rabid 4 · youth 26 · nurture 15 · feather 9

## NEW CARDS (2026-06-08 — block + synergy archetypes)
Draft rate among handler runs, total PLAYS this batch (drafted-but-low-plays = dead in hand), and avg acts-cleared with vs without (survivorship-confounded — relative reads only).
- **c-hunker-down**: drafted 5 (5.0%) · played 24× · 0 wins · avg acts 0.60 with / 0.23 without
- **c-dig-in**: drafted 6 (6.0%) · played 33× · 0 wins · avg acts 0.67 with / 0.22 without
- **c-firm-hand**: drafted 57 (57.0%) · played 111× · 0 wins · avg acts 0.42 with / 0.02 without
- **c-memorial**: drafted 4 (4.0%) · played 12× · 0 wins · avg acts 0.75 with / 0.23 without
- **c-fond-farewell**: drafted 55 (55.0%) · played 193× · 0 wins · avg acts 0.38 with / 0.09 without
- **c-pedigree**: drafted 1 (1.0%) · played 0× · 0 wins · avg acts 1.00 with / 0.24 without
- **c-best-in-show**: drafted 6 (6.0%) · played 14× · 0 wins · avg acts 0.67 with / 0.22 without
- **c-well-drilled**: drafted 3 (3.0%) · played 3× · 0 wins · avg acts 0.33 with / 0.25 without
- **c-rally-the-pack**: drafted 2 (2.0%) · played 0× · 0 wins · avg acts 0.50 with / 0.24 without
- **c-drillmaster**: drafted 0 (0.0%) · played 0× · 0 wins · avg acts 0.00 with / 0.25 without
- Memorial AoE procs (every exit/sacrifice while installed): 19

## NEW ENEMY MECHANICS — fire counts (this batch)
- heal 35 · charge 50 · summon 35 · cutShort 12 · undermineTactic 1 · doubleMaul 1 · freeze 25 · silence 68 · turnAgainst 52 · betray 8 · maul 36

## ANOMALIES (red-team tripwires)
Outliers are exploit candidates — investigate anything that jumps batch-over-batch.
- Max single-cast damage: 0 · casts ≥ 40 dmg: 0
- Max casts in one turn: 0
- Peak Block: 0 · peak Words Bank: 0
- Fastest combat win: 3 turns · wins in ≤ 3 turns: 3

## Wit SCHOOLS (1000-run cycle telemetry)
- Full FFT casts: 0 (total FFT damage 0) · partial-row: 0 · same-school (non-row): 0
- Slow Burn DoT deposited: 0
- Crescendo bank cash-ins (flat damage): 0
- Thorns block granted by casts: 0
- Thorns BODY SLAM: 0 casts · 0 damage
- Slot-tutor skills: 0 plays · 0 cards pulled
- Hold causes: full-tray(deliberate/energy-at-cast) 0 · energy-short 0 · missing-slot 0 (intro 0 / subject 0 / target 0)

## Wit LONG THREAD (v2.34)
- Combats reaching LT ≥ 1: 0 (runs: 0 / 100, 0.0%)
- Avg peak LT per run (across all combats): 0.00
- Avg peak LT per threaded combat: 0.00
- Thread breaks (unblocked hit reset a non-zero meter): 0
- Thread-scaling rider triggers: 0
- Total bonus damage from thread scaling: 0
- "natural conclusion." target casts: 0
- v2.43 thread-preservation skip-casts: 0
- v2.67 chip-cast skips (HUMAN_PLAY_PROFILE-aligned): 0
- v2.90 backfire-smoother fires (3rd consecutive 1 → 2): 0
- v2.92 Passing Thoughts: 81 granted, 0 played
- v2.93 Find the Seam (bypass-effectiveness) fires: 0
- v2.93 Precedent (echo-last-damage) fires: 0
- v2.93 Insult-to-Injury (×N mult) fires: 0
- v2.93 Doubletake (cast resolves twice) fires: 0
- v2.93 Skip-next-attack fires: 0
- v2.93 Mirror Reasoning (reflect debuff) fires: 0
- v2.93 Bracing (draw-3-on-HP-loss) fires: 0

## Wit FOOTNOTE (v2.35)
- Footnotes applied: 0 (runs: 0 / 100, 0.0%)
- Casts contributing footnote bonus: 0
- Total footnote bonus damage: 0
- Avg bonus per footnoted cast: 0.00

## Wit ACTUALLY— (v2.36)
- Re-fires resolved: 0 (runs: 0 / 100, 0.0%)
- Total re-fire damage: 0
- Avg damage / re-fire: 0.00
- Enemy bonus from arguing-back: 0 (cost side fired)

## Wit HOLD ON — (v2.37)
- Plays: 0 (runs: 0 / 100, 0.0%)
- Total damage prevented: 0
- Avg prevention / play: 0.00

## Wit SAYING SOMETHING WRONG (v2.38)
- Casts that queued a Misstep: 0 (runs: 0 / 100, 0.0%)
- Up-front damage dealt by those casts: 0
- Tokens delivered to hand: 0
- Discarded (1 Energy paid): 0
- Auto-played (-3 HP eaten): 0 (total damage: 0)
- KOs by Misstep auto-play: 0
- Avg up-front damage / cast: 0.00

## Wit OPENING STATEMENT (v2.39)
- Bonus triggers: 0 (runs: 0 / 100, 0.0%)
- Total bonus damage: 0
- Avg bonus / trigger: 0.00
- Revisit-opening skill plays: 0

## Wit PATIENCE (v2.40)
- Installs: 0 (runs: 0 / 100, 0.0%)
- Peak stacks — max: 0, mean: 0.00
- Total damage from patience-spend: 0
- Casts that consumed bank: 0
- "I'll let you finish," skill plays: 0
- Avg damage / spend: 0.00

## Wit SYNERGY CAPSTONE (v2.41)
- "in summary," casts: 0 (runs: 0 / 100, 0.0%)
- Total capstone damage: 0
- Avg damage per cast: 0.00

## Wit INSULT VULNERABILITIES (v2.42)
- Casts that hit the rider: 0 (runs: 0 / 100, 0.0%)
- Total matched tags (capped 3/cast): 0
- Total bonus damage: 0
- Avg bonus per cast: 0.00

## Jnsq TANGENT (v2.44)
- "That reminds me," skill plays: 0 (runs: 0 / 100, 0.0%)
- Detours that cast a target: 0
- Detours that staged a word/modifier: 0
- Detours that fizzled (target hit incomplete tray): 0
- Outcome ratio: cast / staged / fizzle: 0 / 0 / 0

## Jnsq APOLOGY (v2.45)
- "I shouldn't have said that —" plays: 0 (runs: 0 / 100, 0.0%)
- Total HP healed: 0
- Total tray cards discarded by reset: 0
- Avg tray cards / cast: 0.00

## Jnsq WON'T SHUT UP (v2.46)
- Rider armed (soup target cast): 0 (runs: 0 / 100, 0.0%)
- Dodges (kept going — follow-up jnsq played): 0 (0%)
- Damage fires (-3 HP each): 0 (0%)
- Total HP lost to commitment: 0

## Jnsq DRUNKEN CONFIDENCE (v2.47)
- Installs (per-combat): 0 (runs: 0 / 100, 0.0%)
- Uninstalls (sober second thought): 0
- Casts that received the +50%: 0
- Total bonus damage from +50% on casts: 0
- Total +2 incoming penalty taken: 0
- Net trade: 0 (positive = paying off)

## Jnsq AWKWARD PAUSE (v2.48)
- "...go on, I'm listening." plays: 0 (runs: 0 / 100, 0.0%)
- Doubled casts (bank cashed in): 0
- Total extra damage from doubling: 0
- Avg extra damage / doubled cast: 0.0
- Cash-in ratio (doubled casts / pauses): 0%

## Jnsq BABBLING (v2.49)
- Installs (per-combat): 0 (runs: 0 / 100, 0.0%)
- 2nd casts fired: 0
- Total damage delivered by 2nd casts: 0
- Avg damage / 2nd cast: 0.0
- 2nd-cast rate per install: 0.00

## Jnsq GETTING-AWAY-FROM-ME (v2.50)
- Rare casts: 0 (runs: 0 / 100, 0.0%)
- Doubled fires (cast #2 under Babbling): 0 (0% of casts)

## Jnsq SYNERGY CAPSTONE — "universe sideways" (v2.51)
- Capstone casts: 0 (runs: 0 / 100, 0.0%)
- Total capstone damage: 0
- Avg damage / capstone cast: 0.00
- Tangent-on-cast fires: 0

## Jnsq DRUNKEN STAGGER (v2.52)
- "sorry, I lost my balance" plays: 0 (runs: 0 / 100, 0.0%)
- Swings missed (50% dodge fired): 0
- Total damage avoided: 0
- Avg damage avoided / play: 0.0
- Dodge rate (misses / plays): 0%

## Combat pacing
- Avg turns / combat: 8.20
- Avg damage / run: 339
- Mean final deck size: 13.0

## Archetype of winning decks

## Top killer enemies
- e2-boss-tapestry (The Tapestry Walker): 37
- e2-silent-spinner (The Silent Spinner): 17
- e2-pattern-maker (The Pattern-Maker): 8
- e3-quartz-sentinel (Quartz Sentinel): 8
- e3-vein-devourer (Vein Devourer): 7
- e-rogue-linenfast (Bartholomew Linenfast (still adjusting the hem)): 6
- e3-boss-anvil (The Anvil-Forged): 4
- e2-spinster-matron (The Spinster Matron): 4
- e1-boss-thornlord (The Thornlord): 3
- e2-warp (Warp): 2
- e2-silk-wraith (Silk Wraith): 1
- e2-moth-choir (The Moth Choir): 1
- e2-loom-familiar (Loom Familiar): 1
- e2-gauze-revenant (The Gauze Revenant): 1