# Human Play Profile — derived from telemetry 2026-05-24

Source: `wg-telemetry-2026-05-24T14-56-41-319Z.json` (Alan playing wit).
17 combats, 484 events, 237 card plays, 42 casts.

## Key signatures the sim AI should match

### Turn-end state
| Metric | Mean | Distribution |
|---|---|---|
| Energy left | 0.72 | 0:46% · 1:22% · 2:14% · 3:7% |
| Hand size | 2.75 | mostly 2-3 cards held in hand |
| Tray staged | 1.02 | 0:21% · 1:59% · 2:16% · 3:4% |
| HP | 58.77 / 70 | defensive play preserves HP |
| Composure | 22.80 / 30 | not letting it drop much |

**Takeaway:** humans often end-turn with energy unspent, hand cards held, AND one card already staged in the tray for next turn. They do NOT max-spend every turn. The sim's greedy "play everything until energy=0" is wrong.

### Cast cadence
- **2.47 casts per combat** (NOT every turn)
- Mean enemy composure at cast: 29.1 (significant pool remaining — casts are not just finishers)
- Humans skip-cast when they don't have a strong tray

### Card play composition (per combat avg)
| Category | Plays | Notes |
|---|---|---|
| Familiar active (f-bristle) | 1.5/combat | Used aggressively |
| c-defend | 0.9/combat | Played whenever drawn |
| c-compose | 0.8/combat | Played whenever drawn |
| c-amplify | 0.8/combat | Strategic choice ~once per combat |
| c-channel | 0.25/combat | Occasional draw fuel |
| Words / Targets | ~10/combat | Tray construction |

### Reward pick preferences
| Type | Picks | Share |
|---|---|---|
| Effect (target) | 4 | 33% |
| Skill | 3 | 25% |
| Word | 2 | 17% |
| Gesture / Annotation / Power | 1 each | 8% each |

By rarity: common 7 · uncommon 4 · rare 1. Humans pick rares when available but commons dominate the offer pool.

**Takeaway:** humans skew toward TARGETS in picks. Sim AI's draft weights should reflect this — slight bias to slot:'target' picks.

## AI heuristic deltas suggested

1. **Don't always cast** — sim should hold the tray on chip-cast turns (predicted damage < ~30% of remaining composure AND another turn of defense is survivable). Target ~2.5 casts/combat.
2. **End turn with energy** — sim should sometimes leave 1 energy unspent when no high-value play exists. The "always burn to 0" pattern hurts efficiency under the slower drift system (v2.65).
3. **Pre-stage for next turn** — at turn end, if you've already cast this turn AND have an intro+subject in hand, stage one of them. This lets next turn start with a partial tray (matching the 59% "1-staged" turn-end rate).
4. **Defense-first when low** — at HP < 50% or composure < 50%, prioritize Defend / Compose / familiar block plays before casting.
5. **Reward-pick bias toward targets** — at draft time, +20% weight to targets relative to words; mild bias toward uncommon/rare; respect lane.

## Open questions for next telemetry sweep

- Does the player use Annotations correctly? Wit's signature slot — only 1 picked in 12 rewards, suggesting the value isn't obvious in-game.
- Gestures: only 1 pick. Are gestures undervalued or did the v2.63 in-hand-mechanic UI fix only just deploy?
- Powers: only 1 pick (Inadvisable Acceleration). Sample size small.
- Multi-lane decks: this player committed fully to wit. Are cross-lane offers ever taken?

Next telemetry capture should be longer (single full run) to get stable per-act/per-tier breakdowns.

## Observations — 2026-05-24T15:00 (snapshot 2)

Single act-2 combat (Glow-Mite Swarm) on the wit wizard. 44 events, 22 card plays, 4 casts, won at HP 67/70 + composure 35/30.

**New signals:**
- **4 casts in a single normal-enemy combat** (vs the 2.47 avg from snapshot 1). The earlier mean was probably pulled down by harder fights / elites / boss attrition; a clean normal-enemy combat lets the wit player cast 3-4 times. The sim's `skipChipCast` heuristic may now be slightly over-aggressive — humans cast more freely against easy targets.
- **Starter-card repeat pattern**: 4 casts used the same wit Frankly + your-conclusion / your-reasoning + what-i-expected formula. The player did NOT branch into picked-up cards (no rewards taken — first reward was skipped). Reward pool isn't pulling them off the starter formula in early combats.
- **Wit vs resistant lane**: Glow-Mite has `wit: 0.7` (resistant). Player still won comfortably. Wit-on-resistant-enemy is viable through volume, not penetration.
- **Reward skip event recorded** — first time a `pick.skip` event has shown up. Track skip rate vs pick rate in future data to gauge reward-pool desirability.

**Updated AI implications:**
- The `skipChipCast` threshold (25% pool damage) may need a softer gate for early-combat turns. Humans cast freely against easy targets when they have a full tray and full energy — the skip is for tight defensive turns, not blanket caution.
- Sim AI should be more willing to repeat the same successful spell chain rather than always seeking variety. Real players settle into a formula.

**Open follow-ups:**
- Reward skip vs pick ratio across full runs — what's the threshold where players say "nothing better than what I have"?
- Does v2.68 act-scaled weights change Act 2 pick rate?

## Observations — 2026-05-24T18:10 (snapshot 3, wit run through act 1 elite)

Single substantial wit-scholar run. 189 events, 4 combats (incl. 1 tutorial + 3 real), 115 card plays, 23 casts, 2 picks (both uncommon — no skips). Won the elite at HP 17/70.

**Cast cadence — clarified:**
- 23 casts / 32 turn-ends = **0.72 casts/turn** (~28% skip-cast rate)
- Per-combat raw 5.75 was misleading; per-turn is the stable signal
- The sim's v2.67 chip-cast skip at 25% pool threshold should hit ~25% skip rate — closer aligned than the previous "always cast" baseline

**Long Thread engagement (real):**
- 2 wit.thread events fired: LT=2 (+6 dmg) on normal, LT=5 (+15 dmg) on elite
- Player DEFENDED the thread through an entire act-1 elite fight, hitting LT=5
- Sim's current chipCastSkips firing ~140/100 wit runs — but threadPreservationSkips still at 0 because the thread can't grow without a target. Worth a follow-up cycle.

**Pick favoritism:**
- 10 of 23 casts (44%) used a single picked-up reward target: `wv2-t-not-survive-scrutiny`
- Player picked it once, then committed it to ~half their casts
- 17 unique intro+subject+target combos across 23 casts — varied WORDS, committed TARGETS
- Sim AI should mirror: once a strong target is drafted, prefer it heavily over starter targets (~50% favoritism in the picked target)

**Turn-end refinements:**
| Metric | Snapshot 1 | Snapshot 2 | Snapshot 3 |
|---|---|---|---|
| Mean energy left | 0.72 | n/a | 0.47 |
| Mean tray staged | 1.02 | 1.02 | 0.97 |
| Mean HP | 58.77 | 70 | 47.88 |
| Mean composure | 22.80 | 35 | 20.78 |

The "1 staged at turn-end" pattern is now triple-confirmed across three snapshots.

**Reward pick signal:**
- 2 picks both UNCOMMON — no commons, no skips this session
- Lined up with v2.68 act-scaled weights deploy: Act 1 normal-combat offers had uncommons available, player took them
- Sample size still tiny (12 picks total across all snapshots) — track over more sessions

**Updated AI implications:**
- Implement a "favorite target" memory: once the deck contains a non-starter target with mechanics, the AI should prefer it ~50% of cast picks (was: equal weight)
- Skill plays: f-bristle (familiar active) 10× in this snapshot — same heavy use as snapshot 1. Defensive skills (c-defend, c-compose) still played every other turn.

## Observations — 2026-05-25T02:03 (snapshot 4 — FIRST LOSS DATA)

Wit player died to The Tapestry Walker (act 1 boss). 187 events, 6 combats (5 won + boss lost), 17 casts, 5 picks (all uncommon), 2 forgets, 1 rest pick. Died HP 0 / composure 20 at turn 7 of the boss fight.

**Boss-fight cast cadence — slower than normals:**
- 4 casts across 7 turns = **0.57 casts/turn** (vs 0.72 in snapshot 3, vs 0.40-0.50 in snapshot 1)
- Each cast did ~25 composure damage (Tapestry comp went 81 → 56 → 31). Tapestry comp max is 85; player needed 4-5 casts but ran out of HP first.
- The CASTS were fine, the DEFENSE was missing. Pre-cast HP: 65 / 65 / 47 / 37 / 21 / 5 / dead. Boss attacks landed for 10-16 HP per turn — no Defend/Compose plays visible in the combat log.

**The player got Weak'd:**
- Multiple boss-fight turns showed `playerDmgMult` at 0.80-0.95 (Weak applied via boss attack riders).
- Player didn't have a cleanse card in their deck. Wit has no equivalent to chutzpah's "Sorry — what?" absorb.

**Reward picks — all 5 were uncommon, no skips:**
1. drunk-parrot target (became the workhorse — used 4× in the boss fight)
2. The Significant Pause Power (+1 Energy/turn)
3. Hewn-Greaves footnote skill
4. Word card uncommon
5. Margin Notes annotation (the only non-uncommon pick — common)

Post-v2.68 act-scaling validated: 4 of 5 picks were uncommon, 0 commons, 0 rares. The new weights pushed the player into uncommons exactly as intended.

**Telemetry validation (v2.84):**
- `playerDmgMult` and `enemyDmgMult` ARE now captured in turn_end events. First snapshot with this data.
- Sample: T2 end had `pdm=0.85 edm=1` (player at -15% spell potency from a Weak).
- The v2.83 label fix means the chip would have read "⛧ Your spells -15% (Weak on you)" — disambiguates which side is affected.

**The Tapestry Walker is unwinnable for an unprepared wit player.** Comp max 85, attacks 10-16/turn, applies Weak. Wit deck without a strong target rider, without picked defensive uncommons, with the pre-staging cost (v2.82) bleeding 1-2 comp/turn, ran out of HP at turn 7. The first-act boss is doing its job AS A WALL but wit currently has no honest answer until uncommons drop.

**AI implications for next sim cycle:**
- Boss-fight defense priority — current AI's defender pass triggers on "block < expected hit" but doesn't escalate against multi-attack bosses. Add a boss-tier bias: against bosses, threshold for defensive plays should drop (defend even when block is comfortable).
- Long Thread was at 0 the whole fight because every turn took unblocked damage. The threadPreservation heuristic skipped chip casts but the player still couldn't keep the thread intact. Defense-first priority needs to be lane-aware AND tier-aware (wit + boss = even more block weight).

**Open follow-ups:**
- Is wit's defense kit too thin for the act-1 boss? Buff Compose (currently +5 Poise) or add a defensive uncommon?
- Track loss rate at first-act boss across all 3 lanes — wit-specific or universal?
- Pre-staging cost may have cost 5-10 composure across the boss fight. Worth measuring impact specifically — could be the right number, could be too punishing.
