# Witch Mountain Bridge v2 — Playtest Report

N = **1000** runs simulated with a greedy v2 AI.

## Win rate
- **180 wins / 1000** = **18.0%**
- Losses by acts-cleared: 0=169 · 1=512 · 2=139 · 3=0

## Lane outcomes
- **wit**: 1000 runs · 180 wins (18.0%)
- **handler**: 0 runs · 0 wins (0.0%)
- **jnsq**: 0 runs · 0 wins (0.0%)

## Familiar outcomes (v2.9)
- **fam-mouse**: 98 runs · 24 wins (24.5%)
- **fam-hedgehog**: 97 runs · 22 wins (22.7%)
- **fam-owl**: 96 runs · 19 wins (19.8%)
- **fam-cat**: 118 runs · 22 wins (18.6%)
- **fam-beetle**: 112 runs · 20 wins (17.9%)
- **fam-raven**: 98 runs · 17 wins (17.3%)
- **fam-toad**: 96 runs · 16 wins (16.7%)
- **fam-crow**: 97 runs · 14 wins (14.4%)
- **fam-rabbit**: 92 runs · 13 wins (14.1%)
- **fam-snake**: 96 runs · 13 wins (13.5%)

## Cast distribution
- Total casts: 40091
- Tier 1 (COHERENT): 18366 (45.8%)
- Tier 2 (RESONANT): 18549 (46.3%)
- Tier 3 (DEVASTATING): 3176 (7.9%)
- Holds (turn ended without cast — tray persists): 30919 (43.5%)

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
- Max single-cast damage: 136 · casts ≥ 40 dmg: 1435
- Max casts in one turn: 1
- Peak Block: 51 · peak Words Bank: 40
- Fastest combat win: 1 turns · wins in ≤ 3 turns: 757

## Wit SCHOOLS (1000-run cycle telemetry)
- Full FFT casts: 11170 (total FFT damage 165323) · partial-row: 20365 · same-school (non-row): 2544
- Slow Burn DoT deposited: 164356
- Crescendo bank cash-ins (flat damage): 71371
- Thorns block granted by casts: 153838
- Thorns BODY SLAM: 12 casts · 72 damage
- Slot-tutor skills: 665 plays · 665 cards pulled
- Hold causes: full-tray(deliberate/energy-at-cast) 0 · energy-short 8992 · missing-slot 21927 (intro 5924 / subject 8885 / target 10109)

## Wit LONG THREAD (v2.34)
- Combats reaching LT ≥ 1: 9198 (runs: 1000 / 1000, 100.0%)
- Avg peak LT per run (across all combats): 20.52
- Avg peak LT per threaded combat: 2.23
- Thread breaks (unblocked hit reset a non-zero meter): 11591
- Thread-scaling rider triggers: 252
- Total bonus damage from thread scaling: 1564
- "natural conclusion." target casts: 164
- v2.43 thread-preservation skip-casts: 6
- v2.67 chip-cast skips (HUMAN_PLAY_PROFILE-aligned): 22
- v2.90 backfire-smoother fires (3rd consecutive 1 → 2): 0
- v2.92 Passing Thoughts: 1589 granted, 1411 played
- v2.93 Find the Seam (bypass-effectiveness) fires: 73
- v2.93 Precedent (echo-last-damage) fires: 77
- v2.93 Insult-to-Injury (×N mult) fires: 76
- v2.93 Doubletake (cast resolves twice) fires: 47
- v2.93 Skip-next-attack fires: 325
- v2.93 Mirror Reasoning (reflect debuff) fires: 34
- v2.93 Bracing (draw-3-on-HP-loss) fires: 26

## Wit FOOTNOTE (v2.35)
- Footnotes applied: 266 (runs: 266 / 1000, 26.6%)
- Casts contributing footnote bonus: 1094
- Total footnote bonus damage: 2757
- Avg bonus per footnoted cast: 2.52

## Wit ACTUALLY— (v2.36)
- Re-fires resolved: 595 (runs: 185 / 1000, 18.5%)
- Total re-fire damage: 14459
- Avg damage / re-fire: 24.30
- Enemy bonus from arguing-back: 397 (cost side fired)

## Wit HOLD ON — (v2.37)
- Plays: 197 (runs: 111 / 1000, 11.1%)
- Total damage prevented: 332
- Avg prevention / play: 1.69

## Wit SAYING SOMETHING WRONG (v2.38)
- Casts that queued a Misstep: 1177 (runs: 267 / 1000, 26.7%)
- Up-front damage dealt by those casts: 29673
- Tokens delivered to hand: 554
- Discarded (1 Energy paid): 499
- Auto-played (-3 HP eaten): 55 (total damage: 165)
- KOs by Misstep auto-play: 0
- Avg up-front damage / cast: 25.21

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
- "in summary," casts: 443 (runs: 122 / 1000, 12.2%)
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
- Avg turns / combat: 6.95
- Avg damage / run: 397
- Mean final deck size: 23.4

## Archetype of winning decks
- mid-t2t3: 180

## Top killer enemies
- e3-vein-devourer (Vein Devourer): 215
- e3-boss-anvil (The Anvil-Forged): 148
- e1-boss-thornlord (The Thornlord): 126
- e2-boss-tapestry (The Tapestry Walker): 122
- e3-quartz-sentinel (Quartz Sentinel): 115
- e2-silent-spinner (The Silent Spinner): 22
- e3-glow-mite (Glow Mite Swarm): 17
- e2-pattern-maker (The Pattern-Maker): 17
- e-rogue-smelterson (Smelterson, J.C. (alloyed)): 9
- e3-crystal-beetle (Crystal Beetle): 6
- e1-thicket (Living Thicket): 6
- weave: 4
- e1-tutor (Stern Tutor): 4
- e2-warp (Warp): 3
- e3-geode-crab (Geode Crab): 2