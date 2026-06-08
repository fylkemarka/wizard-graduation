# Witch Mountain Bridge v2 — Playtest Report

N = **1000** runs simulated with a greedy v2 AI.

## Win rate
- **34 wins / 1000** = **3.4%**
- Losses by acts-cleared: 0=588 · 1=248 · 2=130 · 3=0

## Lane outcomes
- **wit**: 0 runs · 0 wins (0.0%)
- **handler**: 1000 runs · 34 wins (3.4%)
- **jnsq**: 0 runs · 0 wins (0.0%)

## Familiar outcomes (v2.9)
- **fam-toad**: 99 runs · 7 wins (7.1%)
- **fam-owl**: 102 runs · 6 wins (5.9%)
- **fam-mouse**: 94 runs · 5 wins (5.3%)
- **fam-cat**: 92 runs · 3 wins (3.3%)
- **fam-snake**: 94 runs · 3 wins (3.2%)
- **fam-beetle**: 100 runs · 3 wins (3.0%)
- **fam-crow**: 99 runs · 2 wins (2.0%)
- **fam-hedgehog**: 105 runs · 2 wins (1.9%)
- **fam-raven**: 111 runs · 2 wins (1.8%)
- **fam-rabbit**: 104 runs · 1 wins (1.0%)

## Cast distribution
- Total casts: 0
- Tier 1 (COHERENT): 0 (0.0%)
- Tier 2 (RESONANT): 0 (0.0%)
- Tier 3 (DEVASTATING): 0 (0.0%)
- Holds (turn ended without cast — tray persists): 0 (NaN%)

## Handler ANIMAL SUMMONER (consolidated 2026-06-01)
- Handler runs: 1000 · 34 wins (3.4%)
- Combats fought: 7354
- Summons: 59394 · feeds: 33482 · short-stays (unfed left early): 8851 · combines: 1276
- Combine payoff: burst 18084 (avg 14.2/combine) · lifetime attacks 24732 (avg 19.4/combine) · combine = 9.4% of all menagerie composure
- Menagerie composure dealt: 454003 · block generated: 172167
- Avg summons/combat: 8.08 · avg feeds/combat: 4.55
- Tactic changes: 4662 · avg distinct tactics/combat: 0.47
- Special-lure animals: summons 7182 · porcupine thorns dealt 9856 · sloth enemy-turns skipped 939
- Activated abilities (Mime/Pigeon/Kangaroo): 1830 activations
- Tactic engagement: shield 1850 · rabid 446 · youth 774 · nurture 907 · feather 685

## NEW CARDS (2026-06-08 — block + synergy archetypes)
Draft rate among handler runs, total PLAYS this batch (drafted-but-low-plays = dead in hand), and avg acts-cleared with vs without (survivorship-confounded — relative reads only).
- **c-hunker-down**: drafted 137 (13.7%) · played 1979× · 14 wins · avg acts 1.28 with / 0.50 without
- **c-dig-in**: drafted 108 (10.8%) · played 1684× · 14 wins · avg acts 1.31 with / 0.53 without
- **c-memorial**: drafted 111 (11.1%) · played 604× · 16 wins · avg acts 1.60 with / 0.49 without
- **c-strays**: drafted 63 (6.3%) · played 131× · 5 wins · avg acts 1.38 with / 0.56 without
- **c-pedigree**: drafted 44 (4.4%) · played 88× · 4 wins · avg acts 1.43 with / 0.57 without
- **c-best-in-show**: drafted 108 (10.8%) · played 403× · 6 wins · avg acts 1.19 with / 0.54 without
- **c-well-drilled**: drafted 108 (10.8%) · played 412× · 14 wins · avg acts 1.33 with / 0.52 without
- **c-rally-the-pack**: drafted 43 (4.3%) · played 459× · 8 wins · avg acts 1.44 with / 0.57 without
- **c-drillmaster**: drafted 101 (10.1%) · played 498× · 14 wins · avg acts 1.50 with / 0.51 without
- Memorial AoE procs (every exit/sacrifice while installed): 3192

## NEW ENEMY MECHANICS — fire counts (this batch)
- heal 558 · charge 340 · summon 393 · cutShort 165 · undermineTactic 26 · doubleMaul 11 · freeze 523 · silence 1771 · turnAgainst 1768 · betray 185 · maul 523

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
- v2.92 Passing Thoughts: 1185 granted, 0 played
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
- Avg turns / combat: 10.63
- Avg damage / run: 525
- Mean final deck size: 13.5

## Archetype of winning decks
- mid-t2t3: 34

## Top killer enemies
- e2-boss-tapestry (The Tapestry Walker): 333
- e2-silent-spinner (The Silent Spinner): 125
- e3-boss-anvil (The Anvil-Forged): 121
- e1-boss-thornlord (The Thornlord): 118
- e3-vein-devourer (Vein Devourer): 97
- e2-pattern-maker (The Pattern-Maker): 46
- e2-spinster-matron (The Spinster Matron): 33
- e-rogue-linenfast (Bartholomew Linenfast (still adjusting the hem)): 26
- e3-quartz-sentinel (Quartz Sentinel): 22
- e2-silk-wraith (Silk Wraith): 11
- e2-warp (Warp): 6
- e1-thicket (Living Thicket): 5
- e3-glow-mite (Glow Mite Swarm): 5
- e2-hollow-weaver (Hollow Weaver): 4
- e2-loom-familiar (Loom Familiar): 3