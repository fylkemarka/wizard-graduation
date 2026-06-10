# Witch Mountain Bridge v2 — Playtest Report

N = **100** runs simulated with a greedy v2 AI.

## Win rate
- **0 wins / 100** = **0.0%**
- Losses by acts-cleared: 0=74 · 1=26 · 2=0 · 3=0

## Lane outcomes
- **wit**: 100 runs · 0 wins (0.0%)
- **handler**: 0 runs · 0 wins (0.0%)
- **jnsq**: 0 runs · 0 wins (0.0%)

## Familiar outcomes (v2.9)
- **fam-raven**: 9 runs · 0 wins (0.0%)
- **fam-snake**: 13 runs · 0 wins (0.0%)
- **fam-owl**: 15 runs · 0 wins (0.0%)
- **fam-rabbit**: 7 runs · 0 wins (0.0%)
- **fam-beetle**: 6 runs · 0 wins (0.0%)
- **fam-hedgehog**: 12 runs · 0 wins (0.0%)
- **fam-crow**: 10 runs · 0 wins (0.0%)
- **fam-cat**: 9 runs · 0 wins (0.0%)
- **fam-toad**: 12 runs · 0 wins (0.0%)
- **fam-mouse**: 7 runs · 0 wins (0.0%)

## Cast distribution
- Total casts: 1808
- Tier 1 (COHERENT): 1439 (79.6%)
- Tier 2 (RESONANT): 366 (20.2%)
- Tier 3 (DEVASTATING): 3 (0.2%)
- Holds (turn ended without cast — tray persists): 2821 (60.9%)

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
- Max single-cast damage: 51 · casts ≥ 40 dmg: 41
- Max casts in one turn: 1
- Peak Block: 23 · peak Words Bank: 23
- Fastest combat win: 2 turns · wins in ≤ 3 turns: 17

## Wit SCHOOLS (1000-run cycle telemetry)
- Full FFT casts: 589 (total FFT damage 7692) · partial-row: 763 · same-school (non-row): 28
- Slow Burn DoT deposited: 7816
- Crescendo bank cash-ins (flat damage): 4114
- Thorns block granted by casts: 2713
- Thorns BODY SLAM: 0 casts · 0 damage
- Slot-tutor skills: 51 plays · 51 cards pulled
- Hold causes: full-tray(deliberate/energy-at-cast) 0 · energy-short 403 · missing-slot 2418 (intro 598 / subject 1480 / target 1074)

## Wit LONG THREAD (v2.34)
- Combats reaching LT ≥ 1: 409 (runs: 100 / 100, 100.0%)
- Avg peak LT per run (across all combats): 9.04
- Avg peak LT per threaded combat: 2.21
- Thread breaks (unblocked hit reset a non-zero meter): 482
- Thread-scaling rider triggers: 0
- Total bonus damage from thread scaling: 0
- "natural conclusion." target casts: 2
- v2.43 thread-preservation skip-casts: 0
- v2.67 chip-cast skips (HUMAN_PLAY_PROFILE-aligned): 2
- v2.90 backfire-smoother fires (3rd consecutive 1 → 2): 0
- v2.92 Passing Thoughts: 68 granted, 61 played
- v2.93 Find the Seam (bypass-effectiveness) fires: 3
- v2.93 Precedent (echo-last-damage) fires: 2
- v2.93 Insult-to-Injury (×N mult) fires: 4
- v2.93 Doubletake (cast resolves twice) fires: 3
- v2.93 Skip-next-attack fires: 3
- v2.93 Mirror Reasoning (reflect debuff) fires: 2
- v2.93 Bracing (draw-3-on-HP-loss) fires: 1

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
- Avg turns / combat: 10.23
- Avg damage / run: 126
- Mean final deck size: 5.9

## Archetype of winning decks

## Top killer enemies
- e2-boss-tapestry (The Tapestry Walker): 30
- e3-vein-devourer (Vein Devourer): 10
- e2-silent-spinner (The Silent Spinner): 9
- e3-glow-mite (Glow Mite Swarm): 6
- e2-pattern-maker (The Pattern-Maker): 6
- e2-spinster-matron (The Spinster Matron): 5
- e2-needlepoint-cross (Needlepoint Cross): 4
- e2-silk-wraith (Silk Wraith): 4
- weave: 3
- e2-gauze-revenant (The Gauze Revenant): 3
- e3-quartz-sentinel (Quartz Sentinel): 3
- e2-patchwork-golem (Patchwork Golem): 3
- e3-boss-anvil (The Anvil-Forged): 3
- e2-spindlewight (Spindlewight): 2
- e3-geode-crab (Geode Crab): 2