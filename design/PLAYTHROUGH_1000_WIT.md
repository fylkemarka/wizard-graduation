# 1000-Round Wit Wizard Playthrough — Design Report

10 cycles × 100 sims each, with two agent consultations (board-game-creator + board-game-nerd-tester) between sim cycles. Goal: surface what's fun, what's broken, and what makes the three Wit schools (Slow Burn / Thorns / Crescendo) feel like distinct strategies.

## Headline finding

**The hold is free, so holding wins.** With a 6-card hand and 3-slot FFT structure (intro+subject+target sharing a `setId`), the AI/player can stage cards every turn without committing to a cast. The 76% hold rate that opened the playthrough was the AI correctly waiting for matched rows that the deck math couldn't deliver organically. The two agents converged independently on this diagnosis.

## What changed across the 10 cycles

| Cycle | Change | Wins | Holds | T3% | Full FFT |
|---|---|---|---|---|---|
| 1 | Baseline | 2-3% | 76% | 0.3% | 689 |
| 2 | School-consistency 0.5 → 0.2 + new-school 1.3 bonus | 4% | 74% | 0.3% | — |
| 3 | Route Thorns cast damage to player block; score block as defensive value | 3% | 73% | — | — |
| 4 | Wire missing Thorns riders in sim (selfPoise/HpRegen/Thorns/Schedule/stripBlock) + reflect aura tick | 2% | — | — | — |
| 5 | Pull Thorns AI bonus back (was over-staging defense) | 1% | 77% | 0.3% | — |
| 6 | School cohesion 0.2 → 0.35 | 1% | 77% | 0.7% | 615 |
| 7 | Distraction Tax (discard on hold) — **REVERTED** | 1% | 77% | 0.2% | — |
| 8 | **Partial-Row Tutor** (2-of-3 match → pull missing card) | 3% | 72% | 0.2% | 758 |
| 9 | Tutor wired into App.jsx for live play | (build only) | — | — | — |
| 10 | School cohesion 0.35 → 0.4, removed new-school bonus | **3%** | **70%** | **1.3%** | **771** |

Total improvement cycle-1 → cycle-10:
- Wins: 2-3% → 3% (bouncing, but more act-2 clears: 8 → 19)
- Holds: 76% → 70%
- T3 casts: 0.3% → 1.3% (4×)
- Full FFTs: 689 → 771 (+12%)
- Slow Burn damage: 75/run → 87/run (+16%)

## What the agents said

**board-game-creator's #1 recommendation:** *Tutor on partial rows.* "When you play 2-of-3 cards of the same setId, draw the missing third from deck or discard for free this turn. Converts the structural draw-luck problem into a strategy puzzle (which row do I commit to?), kills the hold-and-stall loop, makes T3 casts actually achievable. Thematically perfect for Wit: 'the sentence finishes itself.'"

**board-game-nerd-tester's diagnosis:** *"The hold is free, so holding wins."* "The single most important addition: the tray decays or punishes you. Composure bleed if you don't cast. Enemy ramp on hold. Tray slot lock. Combine tray slot lock + composure bleed: converts 'shop for the row' into 'build a sentence under fire.' Pratchett verbal sparring is fast and committed, not curated."

Both agents converged on the same root cause from opposite angles — one focused on supply (give them the missing card), the other on cost (make holding hurt).

## What the sim says about each school

**Slow Burn — the genuine distinct identity.** ~87 DoT damage/run, the only school dealing reliable damage through the sim. The stacking schedule (cast adds wave to existing DoT) actually rewards staying in combat the way the design intends. Voice (Hawkeye's slow tear-down) reads through the canonical text.

**Thorns — identity-confused.** Most riders (thorns-2/3/6) require enemy attack to deal reflect — that's reactive offense, not defense. Thorns-1 and thorns-5 are the only true "defender" lines. The sim now correctly wires all riders, but the AI rarely picks Thorns because the offensive payout is delayed/conditional. **Recommend:** decide if Thorns is defender or counter-puncher, then make every row reinforce that one identity.

**Crescendo — "Slow Burn but worse pacing."** Build-then-Climax means casts 1-2 do 0/half damage. In a 6-8 turn combat, two zero-damage casts is a hard sell. T3 casts are now 1.3% (was <0.3%), so the climax rarely fires. The agent comparison was Watcher's Calm/Wrath stance from STS — visible state, immediate impact. Crescendo's wordsBank is silent. **Recommend:** make the bank visible AND threatening (e.g., bankDoublePerTurn rider is the only Crescendo card that advertises tempo).

## What I shipped to App.jsx

1. **Sim mirror fixes:**
   - `damageType: 'block'` casts route to `state.block` (Thorns school no longer silent)
   - Missing Thorns riders wired: `selfPoisePerTurn`, `selfHpRegenPerTurn`, `selfThornsPerTurn`, `selfThornsSchedule`, `stripEnemyBlockPerTurn`
   - Reflect aura ticks on player-turn-start against attack-shaped enemy intents
   - Telemetry: `thornsCastBlockGranted`, `thornsReflectDamage`, `thornsHpRegen`, `thornsBlockStripped`

2. **Partial-Row Tutor (App.jsx + sim):**
   - When staging completes a 2-of-3 `setId` match, search deck → discard for the missing third slot of the same `setId`. Pull it free into hand.
   - Once per turn. Wit lane only.
   - Refs: `tutorFiredThisTurnRef` set on stage, cleared on new-turn-draw + endTurn.
   - Log line: `📜 the sentence finishes itself — <card> pulled to hand.`

3. **AI tuning:**
   - School cohesion 0.4 (down from 0.5 baseline, up from cycle-2's 0.2 over-correction)
   - Thorns target scoring weighted on HP urgency, attack-projection, and same-tray Slow Burn presence

## Recommended next session for Alan

1. **Live-test the tutor.** Does "the sentence finishes itself" feel like a strategic moment or a free pity-handout? If it feels too generous, gate it on energy spend (1 energy to claim) or limit to once per combat.

2. **Re-decide Thorns' identity.** Pick one of:
   - Pure defender (block + HP regen, no reflect)
   - Counter-puncher (reflect-only, no shields)
   - Currently it's both, which makes it neither.

3. **Consider tray slot lock.** The nerd-tester's "once placed, stays till you cast" is the more aggressive design lever that would punish indecision and reward planning. Worth A/B testing against the tutor.

4. **Crescendo legibility.** The wordsBank needs to *do something visible* every turn it's not consumed — like enemy ramp, or auto-damage, or visible aura growth.

5. **Win rate ceiling.** Greedy AI bottoms at 3% which is fine for a sim baseline. The structural fixes (tutor, Thorns wiring) lifted Slow Burn damage, holds, and T3 casts measurably. A real player should win 30-50% with the same systems.
