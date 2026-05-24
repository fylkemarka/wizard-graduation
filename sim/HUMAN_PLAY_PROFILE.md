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
