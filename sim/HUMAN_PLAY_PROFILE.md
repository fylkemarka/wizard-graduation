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

## Observations — 2026-05-25T02:17 (snapshot 5 — FIRST JNSQ RUN)

Jnsq player (The Fool) running through Act 1. 65 events, 3 combats (Bursar practice + Silk Wraith + Pattern-Maker elite, all won), 7 casts, 33 card plays, 1 reward pick, 5 dice rolls. Picked Sturdy Frame boon at the supply shop.

**Roll opt-in rate: 71% (5/7 casts).** Real jnsq players gamble aggressively. The sim AI currently rolls always at HP ≥ 15 — closer to 100%. Tuning the sim down to ~70% would match better.

**RNG ouch:** 5 rolls returned 3, 1, 1, 1, 1. Four BACKFIREs in a row. 1/6^4 = 0.077% per starting position, ~0.4% across 5 rolls — extreme bad luck but mathematically possible. The rollChaosDie function is correct (Math.random uniform, no negative diceShift in scope). Flagging for future watch:
- If subsequent snapshots show similar streaks, investigate whether Math.random has a systemic bias in this app context.
- Even if RNG is honest, the **emotional impact** of 4 BACKFIREs feels devastating. Worth considering a "no-3-backfires-in-a-row" smoother — reroll the 4th consecutive 1 automatically.

**Cast cadence on normal/elite:**
- Bursar (T1+T2): 2 casts in 2 turns = 1.0/turn (practice match, generous)
- Silk Wraith (T1, T2, T4): 3 casts in 4 turns = 0.75/turn
- Pattern-Maker (T1, T2+): 2+ casts in 2+ turns = ~1.0/turn

Jnsq player casts MORE often than wit (snapshot 3: 0.72/turn). Probably because jnsq subjects are still cost-0 (unlike wit subjects which became cost-1 in v2.59). Worth considering whether jnsq needs the same v2.59 treatment — but the lane is already at 0% sim win rate without it, so any further nerf risks crushing it. Hold and watch.

**Defense play frequency:**
- c-defend played 3 times across the 3 combats (1/combat avg) — same as wit pattern.
- Familiar active (f-scurry) played 2 times.

**Reward pick:** 1 pick, uncommon target (`jv2-t-third-tuesday`). No skips. v2.68 act-scaling continues to push uncommons.

**v2.84 telemetry validation:** all turn_end events have `pdm` and `edm` fields populated. Sample: T2 Silk Wraith had `edm=1.15` (player vulnerable — boss attack rider). Drift back to 1.05 by T3 (matches 0.10/turn). The v2.83 labels would have rendered "🩸 You're Vulnerable +15% (incoming)" / "🩸 You're Vulnerable +5% (incoming)" across those turns.

**AI implications:**
- Sim AI roll opt-in rate could drop from ~100% (HP ≥ 15) to ~70% to match human reluctance on tight HP / small-spell turns.
- v2.89 chaos-roll flash should help this player notice future rolls — track whether next-session rolls show better-informed decision-making.

**Open follow-ups:**
- Roll streak watch — if BACKFIRE chains continue, redesign with a smoother.
- Jnsq subject cost (currently 0) vs wit's (1): does jnsq deserve the same nerf for parity? Probably not given win rate, but track casts/turn.

## Observations — 2026-05-25T03:43 (snapshot 6 — FIRST CHUTZPAH FULL-ACT WIN)

Chutzpah-bruiser (The Bruiser) + Snake familiar (f-coil) + Sturdy Frame boon. **Won all of Act 1 including the e2-boss-tapestry boss.** 191 events, 9 combats, 20 turn_ends, 20 casts, 97 card plays, 8 picks (no skips), 2 rests (both heal), 1 stake. Alan's words: *"fun, found myself worrying about hp way more, needing the heals."*

**Cast cadence — chutzpah outpaces every other lane:**
| Snapshot | Lane | casts/turn |
|---|---|---|
| 3 | wit | 0.72 |
| 5 | jnsq | 0.75 |
| **6** | **chutzpah** | **1.00** |

Probably because chutzpah subjects are still cost-0 (wit's became cost-1 in v2.59). Don't nerf chutzpah without sim cycles first — pace is what makes the lane feel aggressive.

**Turn-end state (n=20):**
| Metric | Snap 1 (wit) | Snap 3 (wit) | Snap 5 (jnsq) | **Snap 6 (chutzpah)** |
|---|---|---|---|---|
| Mean energy left | 0.72 | 0.47 | n/a | **0.90** |
| Mean hand | 2.75 | n/a | n/a | **2.30** |
| Mean tray staged | 1.02 | 0.97 | n/a | **0.85** |
| Mean HP | 58.77/70 | 47.88/70 | high | **55.70/~78** |
| Mean composure | 22.80/30 | 20.78/30 | high | **32.65/35** |
| Mean playerDmgMult | n/a | n/a | n/a | **1.49** |
| Mean enemyDmgMult | n/a | n/a | n/a | **0.91** |

**Read on the chutzpah-specific deltas:**
- **Highest energy-left mean (0.90)** — chutzpah players keep a 1-energy reserve more often than wit/jnsq. Could be for emergency Defend, or just because cv2 subject/intro costs leave odd leftover energy after a 3-energy turn.
- **Lowest tray-staged mean (0.85)** — chutzpah does NOT pre-stage as often. Sensible: pre-staging is a wit signature (the long thread / footnote tray-building loop). Chutzpah cards trigger on cast and there's no thread to protect.
- **playerDmgMult averaged 1.49 across every turn** — Coil applies Vulnerable on cast, so nearly every fight had an enemy debuffed. Bonus stacks naturally with f-coil's signature.
- **enemyDmgMult averaged 0.91** — enemies kept somewhat Weak'd. Suggests the player IS managing both stat-debuffs actively.

**ALL IN (stake) is criminally underused:**
- 1 stake event in 20 casts = **5%**. Despite Alan's note about HP pressure.
- Stake spent 8 HP for +8 damage on a single Silk Wraith fight; never tried again.
- Either UX issue (stake nudge UI not surfacing the value clearly) OR mechanic-feel issue (Alan would rather pick c-mend than spend HP for damage). The chutzpah identity hook is being ignored by the chutzpah player.
- **Worth a design pass:** ALL IN should feel like the WHOLE POINT of being chutzpah. Right now it's a hidden button. Consider: stake-trigger animations, tooltip prominence, OR a card that REQUIRES stake to play (already exists for some — verify and surface).

**Favorite-target pattern confirmed across all 3 lanes:**
- 4/20 casts (20%) used picked-up `cv2-t-bleeds-for-it`. Plus `f-coil` (the familiar — always available) at 5/20 (25%).
- Sim's "favorite target" memory heuristic from snapshot 3 should keep applying.

**Reward picks (8 picks, ZERO skips):**
- 1 gesture (cv2-g-slams-table — played 7× as the highest-volume new card!)
- 3 targets (bleeds-for-it, wont-fly, bare-knuckles)
- 1 intro (bring-it-on — played 6×)
- 1 subject (skin-game — played 1×, low-engagement)
- 1 power (c-amplify — played 6×)
- 1 healing skill (c-mend — played 2×, drove the HP recovery Alan mentioned)

Pattern: chutzpah player picked **two heavy-volume cards (gesture + intro)** that got integrated into nearly every combat, plus **one healing tool** (c-mend) that addressed the HP pressure. The "always-pick, never-skip" pattern holds: v2.68 act-scaled offers are good enough that skipping isn't appealing.

**Healing observations (Alan's "needing the heals" comment):**
- Rest heals ARE working — 30% maxHp per `resolveRestChoice('heal')` at `src/App.jsx:7719`. The telemetry's `hp` field is logged BEFORE setHp fires, so the rest event payload shows pre-heal state, not post-heal.
- Actual rest 1: HP 32 pre → 55 post (+23 = 30% of 78 maxHp). Carried 55 HP into linenfast.
- Actual rest 2: HP 47 pre → 70 post. Carried 70 HP into the boss; ended boss at 41 = took 29 dmg over 4 turns.
- c-mend (picked card, played 2×) is doing additional in-combat healing on top of rests. The lean-on-healing pattern is real.

**Boss fight (e2-boss-tapestry):**
- 4 turns, 22 card plays, 4 casts, won at HP 41/comp 27.
- Much cleaner than snapshot 4's wit-vs-tapestry loss. Chutzpah's combo (intros that arm/scale + Coil's vulnerable + bleeds-for-it predator) shreds the tapestry.
- Lane-vs-boss comment: wit's snapshot-4 loss vs chutzpah's snapshot-6 clean win against the SAME boss. Either chutzpah is stronger here or the wit kit needs sharpening.

**AI implications for chutzpah sim AI:**
- Bump casts/turn target to ~1.0 (was ~0.65 generic). Chutzpah is the aggressive lane.
- Lower pre-staging weight at turn-end (~0.85 vs wit's 1.0). Don't carry a tray over as often.
- Add a stake-aware heuristic: when boss tier OR predicted-finisher-kills-enemy AND HP > 30%, propose stake. Default to NO stake (matches Alan's 5%) unless those conditions trigger.
- Favorite-target memory ports cleanly from wit; pick up a picked target and use it 25-50% of casts.

**Open follow-ups:**
- **ALL IN underuse (5% of casts)**: design pass on stake UX — make it feel like the chutzpah identity move, not a hidden nudge button. Consider: stake nudge button persistently surfaced on every chutzpah-cast turn, animation on stake-spend, OR a tooltip that calls out the EV of staking N HP for predicted +damage.
- **Lane balance vs same boss**: wit lost to tapestry at snap 4 (HP 0), chutzpah won easily at snap 6 (HP 41). Track this — if chutzpah keeps winning act-1 boss at 90%+ and wit at 30%-, balance gap is real.
- **Rest event payload bug**: `logEvent(TE.REST_CHOICE, { hp, ... })` at App.jsx:7714 captures hp BEFORE setHp fires. Either log post-heal hp explicitly, or document that the field is "hp at click time."

## Observations — 2026-05-27 (snapshot 7 — SIM-DERIVED, v3.3 post-A+B+C)

**⚠️ Caveat — this is SIM data, not human telemetry.** Alan asked to capture snapshot 7 from a playthrough before he plays. Sim ran 50 wit runs through the full v3.3 system (post-damage-nerf, post-Slow-Burn/Thorns/Crescendo refactor, post-school-sampler rewards + row-aware chips + skill-tree Compendium). Sim AI cadence diverges from human cadence by ~3×, so win-rate and cast frequencies are NOT predictive of human outcomes. The FFT-engagement numbers are still informative as a mechanical-engagement floor.

**Outcomes (50 runs):**
- Wins: 0 (0.0%) — sim AI cannot complete a run post-damage-nerf
- Losses: 30 · Stalls: 20
- By acts cleared: 0=25 · 1=18 · 2=7 · 3=0
- Half the run sample dies in Act 1, half makes it into Act 2; none touch the final boss

**Cast cadence — confirms the 3× gap is now wider:**
| Metric | Sim (snap 7) | Human (snap 3 wit) |
|---|---|---|
| Casts/turn | 0.22 | 0.72 |
| Holds (turn ended w/o cast) | 77.8% | ~28% |
| Casts/combat | 1.47 | 5.75 (or 0.72 × 8 turns) |
| Turns/combat | 6.70 | ~8 |
| Tier dist | T1=87.8% T2=12.2% T3=0% | (snap 3 had similar T1 dominance) |

**Read:** The damage nerf (wit stats −1, target base −2, enemy comp +25%) widened the cadence gap, not narrowed it. Sim AI's chip-cast skip heuristic (v3.0 cycle 2) sees the smaller damage numbers and decides "not worth casting" more often — chip skips fire 2× per 50 runs but holds-without-cast are 1,732. Real cause: AI isn't ASSEMBLING three-card trays often enough, not that it's choosing to skip. The v3.3 damage curve makes the sim's hoarding pattern more catastrophic, not the heuristic.

**FFT engagement — the system fires reliably:**
- Full FFT casts: **141 / 493 = 28.6%** of all casts
- Partial FFT casts: **218 / 493 = 44.2%**
- ANY FFT layer: **72.8%** of casts hit some bonus
- Tier-only sub-bonus: 0% (every same-tier cast also happened to share a setId, hitting partial/full instead)

This is the strongest signal: when the AI does cast, it FFT's 73% of the time. The school-sampler rewards (A) + row-aware chips (B) successfully push the deck toward row coherence. The Bouclé starter seed primes Slow Burn so most early FFTs are slowburn-4 fires.

**School-specific damage:**
- Slow Burn DoT damage: **2,128 total = 42.6/run** — meaningful chip damage layer firing every combat
- Slow Burn DORMANT damage: **0 total** — sim never lands a Festering Wound burst. Either it doesn't draft slowburn-8, or combats end (loss) before the 3-turn delay completes. Worth confirming via per-row pick logging.
- Thorns reflect damage: **6 total = 0.1/run** — effectively zero. Sim AI either doesn't draft Thorns rows OR doesn't trigger reflects often because losses come fast. May also be the chip-skip heuristic skipping the cast that arms thorns charges before enemies hit.
- Thorns Weak applied: **0** — the per-reflect debuff never activated.

**Long Thread:**
- Mean peak LT/run: **2.68** — comparable to human snap 3 (peak LT=5 in elite). The thread mechanic is engaged but doesn't push to the boss-fight payoff range.

**Familiars (all 0 wins):**
- Rabbit, Snake, Crow most-rolled (7 each) — no win signal. Damage nerf is too tight for any familiar to break the lose-pattern in sim.

**Top killers:**
- e2-silk-wraith (7) — Act 1 elite, regen post-phase-shift, wit-resistant. Confirms it's still the act-1 wall it was in snap 4.
- e2-boss-tapestry (7) — Act 1 boss, applies Weak. Snap 4 also lost here.
- e3-vein-devourer (6) — Act 2 elite, the runs that made it past Act 1 die here. New kill in v3.3 sim — sample didn't reach this enemy before.
- e2-hollow-weaver (6), e1-thicket (5) — chip kills.

**v3.3-specific signals:**
- School-sampler reward rate untracked (need explicit `combat.reward_offer.sampler: true` flag — TODO add to logEvent). Confirm with future telemetry whether the 35% sampler roll fires as designed.
- Row-aware chip surfacing is UI-only — no telemetry signal possible. Need human read.
- Skill-tree Compendium engagement — no telemetry. Need to track Compendium opens vs reward-screen opens in future logEvent.

**AI implications for next sim cycle:**
- Sim cadence gap is now THE limiting factor. Either:
  (a) Loosen the chip-cast skip threshold further (cast more aggressively, fewer holds)
  (b) Address the underlying "AI hoards because intro+subject+target rarely all in hand" — likely a draw/deck-cycle issue with the v3.3 reduced-damage curve making early-game casts feel unappealing
  (c) Acknowledge the sim is a regression-catcher, not a predictor — and lean on human telemetry for player-felt signals
- The Festering Wound 0-fire data point suggests the dormant payload needs a CHEAPER alternative (currently sim never lives long enough to trigger). Real humans should land it occasionally; track in next human snapshot.

**Open follow-ups:**
- Real human snapshot 7 capture from Alan's next play session — that's the actual signal.
- Add `combat.reward_offer.sampler` telemetry flag to track school-sampler fire rate.
- Add `compendium.open` / `deckview.open` events to measure UI engagement.
- Investigate sim's cadence collapse separately — it's now blocking the sim's usefulness as a balance proxy.

## Observations — 2026-05-27 19:11 (snapshot 8 — REAL human, v3.4 wit)

**First real-play snapshot since v3.3 (school refactor) + v3.4 (DoT redesign).**
Telemetry: `wg-telemetry-2026-05-27T19-11-25-474Z.json`. Alan playing wit.
5 combats, 29 turn-ends, 11 casts, 4 picks, 7 wit.fft.cast events,
1 wit.fft.partial event.

**Cadence:**
- Casts/combat: **2.2** (vs sim 1.47 in snap 7)
- Turns/combat: **5.8**
- Casts/turn: **0.38** (vs sim 0.22 in snap 7)
- Hold rate: ~62% (vs sim 78%)

Still below human-baseline 0.72/turn from snap 3 — likely because v3.4 DoT
deposit was triggering on every Slow Burn cast, so Alan didn't NEED to cast
often to win. He was overpowered → fewer casts needed.

**FFT engagement:**
- 7 full FFT + 1 partial = **8/11 casts = 72.7%** trigger FFT layer
- Strong commitment to Slow Burn rows (3 of 4 picks were slowburn-*)

**Reward picks (4 total):**
- wv2-t-fabric-stops-asking  → slowburn-4 target  (consolidating starter row)
- wv2-s-linen-october        → slowburn-2 subject (new slowburn row entry)
- wv2-t-not-what-one-wears-after → slowburn-8 target (new slowburn row entry)
- wv2-t-essence-public-service → crescendo-4 target (single off-school)

**Draft behavior signal:** Alan committed heavily to Slow Burn (3 of 4
picks). Sim AI should mirror this — once a school is seeded (via starter),
heavily favor rows in the same school for ongoing drafts. The current sim's
"favorite-target bias" is row-agnostic; it should add a SCHOOL-level
weight too.

**Design pivot triggered by this snapshot:** Alan's feedback —
"DoT damage is currently too easy to get stacked up… Should the cards
just do plain wit damage until a full spell is aligned and THAT triggers
the DoT? We're losing the flavor of the mechanic if any combination of
cards still triggers DoT if the effect is DoT."

Acted on (v3.4.4):
- Slow Burn target casts NO LONGER deposit DoT. They deal normal damage
  (base + WIT × mult × tierMult, same formula as Thorns/Crescendo).
- DoT mechanics gated to FULL FFT match only — only the row rider
  triggers DoT manipulation.
- Tier sub-bonus + half-formed bonuses on Slow Burn changed from
  setDotMinDamage/turns and addDotDamage/turns to non-DoT keys
  (longThreadPerm + composure). Removes the "any-combination triggers
  DoT" leak.
- Slow Burn target base/multiplier rebalanced to be SLIGHTLY weaker
  than Thorns/Crescendo (base 3, mult 2 vs 5-6, mult 3). The school's
  premium is on full-FFT commitment, not raw card damage.

**AI-heuristic deltas (queued — not yet implemented this pass):**
1. Sim AI should favor school-consistent reward picks (~75% of picks
   on lane=wit should be the school the starter seeded).
2. Slow Burn rows should be evaluated for the FFT VALUE (the rider's
   DoT payoff), not the per-cast value. AI's chip-skip should treat
   "this cast is half of an FFT chain" as high-value.
3. Cast cadence should land closer to 0.72/turn (snap 3 baseline)
   now that v3.4.4 reduces per-cast damage; will measure next session.

**Open follow-ups:**
- Snapshot 9 to validate v3.4.4 design pivot — does the "FFT-only DoT"
  feel like commitment rewarded, or like flavor lost?
- Implement school-consistent draft bias in sim.
- Tune FFT-chain awareness into sim's tray-staging heuristic.

## Observations — 2026-05-27 20:11 (snapshot 9 — REAL human, v3.4.4 wit)

**Validates v3.4.4 (DoT-only-on-full-FFT pivot) PLUS exposes next damage
gap.** Telemetry: `wg-telemetry-2026-05-27T20-11-28-565Z.json`.
4 combats, 16 turn-ends, 10 casts, 3 picks. Alan said:
  1. "DoT feels much better. It's fun and I can feel the progression
     aspect of it growing at a good pace."
  2. "Using any Thorns or Crescendo effects turns wit back into an
     immediate one-shot cannon."

**Cadence:**
- Casts/combat: **2.5** (snapshot 8 was 2.2)
- Turns/combat: **4.0** ← dropped sharply, suggests fast kills from
  Thorns/Crescendo burst
- Casts/turn: **0.625**

The DROP in turns/combat (5.8 → 4.0) IS the burst problem he's
flagging. Slow Burn alone was producing ~5-6 turn combats with DoT
ramping up; mixing in Thorns/Crescendo cast = one-shot kills again.

**Picks (3 total — drafted AWAY from starter Slow Burn this run):**
- crescendo-4 target → Thorns/Crescendo splash
- thorns-6 subject
- crescendo-4 subject (second copy)

**Identified damage source:** Thorns/Crescendo TARGETS sit at base 5-6,
mult 3 (vs Slow Burn's base 3 mult 2 post-v3.4.4). A mid-game cast
with stats=5 lands ~28 burst damage on a T2 Thorns/Crescendo cast —
sufficient to one-shot mid-tier enemies.

**Acted on (v3.4.5):**
- Brought all 10 Thorns/Crescendo set-tagged targets to MATCH Slow Burn
  cast power: T2 → base 3 mult 2, T3 → base 5 mult 2.
- School effects (reflect arming, bank consume) UNCHANGED — they still
  fire only on full FFT match, same gating as Slow Burn DoT.
- All wit targets now equally weak on baseline cast. School commitment
  (full FFT) is the path to school payoffs across the board.

**AI-heuristic deltas (still queued):**
1. School-consistent draft bias.
2. FFT-chain awareness in chip-skip.
3. New: account for the lower wit baseline cast damage in sim's preview
   logic — currently sim's "favorite target" bias may overweight the
   wit target draft choice now that baseline cast is intentionally weak.

**Open follow-ups:**
- Snapshot 10 to confirm Thorns/Crescendo cast no longer one-shots.
- Validate that FFT casts still feel rewarding (reflect armings,
  bank consumes) now that baseline is weaker.

## Observations — 2026-05-28 01:40 (snapshot 10 — REAL human, v3.4.6 wit)

**Telemetry:** `wg-telemetry-2026-05-28T01-40-50-181Z.json`.
7 combats, 34 turn-ends, 21 casts, 6 picks, 7-0 record (all act-1 enemies
including Spinner + Pattern-Maker + Hollow Weaver + Loom Familiar).

**Cadence (continued improvement):**
- Casts/combat: **3.0** (snap 9 = 2.5)
- Turns/combat: **4.86** (snap 9 = 4.0 — kills slowed slightly with v3.4.5 cast nerf)
- Casts/turn: **0.62** (snap 9 = 0.625; snap 3 wit baseline 0.72)
- Card plays/combat: **19.9** (high card cycling)

**FFT engagement: 100%** — 15 full FFT + 6 partial = 21/21 casts triggered
some bonus layer. The dropping of untagged spell pieces from rewards
(v3.3 reward filter) IS converging the player on row-only casts.

**Per-row data — 13 of 15 wit.fft.cast events were slowburn-4 (Lingering
Point)** — Alan locked into the starter row and ran it as his primary
spell. Damages-after-rider were modest (6-8 per cast), consistent with
the v3.4.5 cast power tuning.

**Picks (6 total):**
- wv2-t-fabric-stops-asking  → slowburn-4 target (consolidating row, **SAMPLER**)
- c-cutting-remark           → colorless one-shot (utility)
- wv2-i-frankly              → slowburn-4 intro (duplicate-row reinforcement)
- c-amplify                  → modifier skill (utility)
- wv2-t-8-has-been-and-gone  → slowburn-5 target (new slowburn row)
- wv2-t-essence-public-service → crescendo-4 target (off-school splash, **SAMPLER**)

Pattern: 4 wit cards (3 slowburn, 1 crescendo) + 2 utility = 67% school
commitment + 33% utility. School-sampler fired twice (3 total samplers
offered, 2 picked — high conversion when sampler matches school).

**Validation of v3.4.4-v3.4.6 pivots:**
- "DoT only on full FFT" feels right (snap 9 confirmed by Alan; snap 10
  data shows consistent slowburn FFT firing without one-shot bursts).
- "Thorns/Crescendo cast power matches Slow Burn" landed without breaking
  the schools' identity (15 FFT casts dealt 6-8 dmg each → enemy comp
  draining at ~11-15/turn including DoT ticks).
- "3× c-defend → 1× c-defend starter" landed without survivability
  collapse — Alan still won 7-0 with the slimmer defense base.

**AI-heuristic deltas (queued — STILL pending implementation):**
1. **School-consistent draft bias** — Alan's pick pattern: 4/4 wit picks
   were Slow Burn or Crescendo (no Thorns at all this run). Sim's
   reward-pick weighting should add a school-affinity bonus for cards
   matching schools already represented in the deck.
2. **FFT-chain awareness in chip-skip** — Alan cast every turn he could
   even when damage was small. Sim's chip-skip threshold should drop
   from 15% pool to ~5-8% AND should never fire when the cast would
   trigger an FFT layer.
3. **Cast cadence target** — sim is at ~0.22/turn vs Alan's 0.62. The
   tray-assembly heuristic should be more aggressive — stage partial
   trays + cast incomplete-but-FFT-tagged combos.

**Open follow-ups:**
- Implement the three AI heuristic deltas above (queued from snaps 8-10).
- Snapshot 11 to validate AI convergence after heuristic tune.
- New ask (this session): wit character pick → choose one starter row
  from the 15 available, at T1 power level. Implementation in v3.4.7.

## Observations — 2026-05-28 (snapshot 11 — SIM AI delta tune, v3.4.8)

**This is a SIM-side calibration entry, not a human-play telemetry
session.** Three AI deltas queued from snaps 8-10 implemented + measured.

**Implemented deltas:**

(1) **School-consistent draft bias** (`awardReward` in playSimV2.js).
    Wit-only: reward-bucket pick now weights cards by tierId-affinity to
    the deck's existing school commitment. Weight multiplier:
      schoolMult = 1 + (cardsOwnedInSchool × 0.5)
    A 4-card school produces 3× weight bonus for cards from that school.
    Untagged cards keep base weight.

(2) **FFT-chain awareness in chip-skip** (the chip-skip block before
    target staging in playSimV2.js). Two changes:
      - Threshold tightened 15% → 7% of remaining pool.
      - NEW: chip-skip suppressed when the prospective cast (intro+
        subject+target in hand) would trigger an FFT layer (full row /
        partial row / tier match). Those casts have school-rider value
        beyond raw composure damage.

(3) **FFT-chain staging bias** (pickBestForSlot + pickBestForSlotRageAware).
    When the tray already has cards with a setId, strongly prefer the
    next-slot card that completes the row (+20 to effectiveStat). Tier
    match gets a smaller bias (+4-5). Lets the AI build toward an FFT
    layer across turns instead of staging whichever card scores highest
    by tier/stat alone.

**Measured impact (100 sim wit runs):**

| Metric | Pre-deltas (snap 7) | Post-deltas (snap 11) | Alan target (snap 10) |
|---|---|---|---|
| Win rate | 0% | 1% | won-7-of-7 |
| Casts/turn | 0.17 | 0.21 | 0.62 |
| Hold rate | 83.1% | 78.6% | ~38% |
| Full FFT % of casts | 38.1% | 39.7% | 71.4% |
| Partial FFT % | 53.5% | 44.6% | 28.6% |
| ANY FFT-layer hit | 91.7% | 84.3% | 100% |
| Turns/combat | 9.4 | 11.3 | 4.9 |

**Read:** Deltas are working but movement is incremental. School-bias
working (full FFT % up). Chain-staging working (less partial, more full).
Chip-skip → 0 fires, as intended.

The remaining cadence gap (0.21 vs 0.62) is NOT chip-skip — that's
already off. It's structural: sim AI's tray-assembly is bottlenecked
on hand-draw probabilities. With the 8-card starter and a 5-card hand,
the probability that all 3 spell slots arrive in the same turn is ~26%.
Even with multi-turn tray persistence, the deck cycles slowly under the
sim's defense-first play order.

**What WOULD close the gap (queued for next AI cycle):**
- Reduce defense play threshold (sim plays defense more eagerly than
  Alan's data shows).
- Prioritize spell staging over passive utility plays (Amplify, Channel
  fire before staging in sim — humans typically stage first).
- Drop the `defenseTight` requirement on chip-skip entirely (it's
  currently gated and basically dormant).
- Bigger restructure: re-prioritize the per-turn play loop to STAGE
  before PLAY-UTILITY.

**Status:** Sim is closer to "play like Alan" but still hoarding. The
convergence loop is operational (telemetry-in → heuristic deltas →
snapshot record → measure). Cadence-gap pattern needs deeper structural
fix in the next cycle.

## Observations — 2026-05-27 (snapshot 12 — SIM AI play-loop reorder, v3.4.9)

**Another SIM-side calibration entry.** Implements the structural reorder
queued at end of snap 11: stage BEFORE play-utility, with an emergency
defense bypass.

**Implemented delta:**

**Play-loop reorder** (`playSimV2.js` per-turn `passCount` loop). Before
the change, each pass ran defense → utility → staging. Defense and
utility plays ate the energy budget before tray cards could stage, so
even when intro/subject/target were all in hand, the AI would burn
energy on `c-defend` and never assemble the cast.

  New order per pass:
    1. **Emergency defense** (only when HP < 30% AND incoming swing
       would put us in KO range). Cheap defend or two if affordable.
    2. **STAGE** intro → subject → target → modifier(s). Same selectors
       as before; only the position in the pass loop moved.
    3. Defense / utility / chip-skip / cast (unchanged).

  Helpers `applyStageEffects` and `bumpTunnelOnStage` hoisted to top of
  the play-turn function so the staging block doesn't have to
  re-declare them on every pass.

**Measured impact (100 sim wit runs):**

| Metric | Snap 11 (v3.4.8) | Snap 12 (v3.4.9) | Alan target (snap 10) |
|---|---|---|---|
| Win rate | 1% | 1% | won-7-of-7 |
| Casts/turn | 0.21 | **0.29** | 0.62 |
| Hold rate | 78.6% | **71.0%** | ~38% |
| Casts/combat | — | 2.32 | — |
| Full FFT % of casts | 39.7% | 36.0% | 71.4% |
| Partial FFT % | 44.6% | 45.2% | 28.6% |
| ANY FFT-layer hit | 84.3% | 81.2% | 100% |
| Turns/combat | 11.3 | 8.09 | 4.9 |
| Stalls | — | 58 | — |
| Mean peak Long Thread | — | 6.58 | — |

**Read:** Reorder closed about a third of the remaining cadence gap.
**Casts/turn up 38% (0.21 → 0.29)**, holds down 7.6pts, turns/combat
shortened by 3.2. The sim is staging tray cards earlier and casting more
often. Stalls still high (58/100) — losses converted to faster combats,
but the AI isn't dealing enough damage per cast to actually clear act 2
boss encounters (loom-familiar, silk-wraith, hollow-weaver, boss-tapestry
account for 54 of 99 deaths).

Full FFT % dipped slightly (39.7 → 36.0) — sim is now casting incomplete
trays as soon as a target is available, which trades school-rider hits
for raw frequency. That actually mirrors Alan better (he casts even with
no FFT match when the chip damage matters). Partial FFT % rose
correspondingly.

**Gap remaining: 0.29 vs 0.62 = 47% of Alan's cadence still missing.**

**What WOULD close more of the gap (queued for next cycle):**
- **Reduce defense play threshold.** Current emergency-defense bypass
  fires below 30% HP, but the v3.4.6 defense block (lines ~1820+) still
  defends reflexively against any incoming swing > current block. Tune
  it to defend only when (incoming - block) > X% maxHp.
- **Drop the dormant `defenseTight` gate on chip-skip.** Currently
  basically off; should be removed entirely so chip-skips never fire.
- **Multi-stage in a single pass.** Pass loop stages one card per pass;
  if energy + hand permit, stage intro+subject in the same pass to
  reach target-eligible state in one iteration.

**Status:** Convergence loop is working. Three deltas (snap 11) + one
structural reorder (snap 12) lifted cadence from 0.17 → 0.29 over two
cycles. Halfway to Alan's 0.62. Next cycle's defense-threshold tune
should close another chunk; the stalls signal the AI needs to spend
more energy on offense in general.
