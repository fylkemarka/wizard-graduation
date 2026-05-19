# 500-Playthrough Deep Iteration — Summary

Five batches of 100 sim runs each. Each batch was followed by a
board-game-nerd agent review (Opus model) covering mechanical
balance + visceral game-feel. This document is the consolidated
takeaway; per-batch raw data is in `sim/reports/batch-N.md`.

## The arc

| Cycle | Win | Avg turns | Resonance | Anvil | Hat | Notable change |
|-------|-----|-----------|-----------|-------|-----|----------------|
| 1 | 0% | 6.23 | 26.8% | n/a | n/a | baseline after act reorder broke difficulty curve |
| 2 | 0% | 4.44 | 25.1% | 1.4% | n/a | act 1 normals + Tapestry nerfed; Anvil became new wall |
| 3 | 2% | 4.43 | 24.5% | 39.8% | 18.2% | Anvil/Hat nerfed; first wins; act 4 reached |
| 4 | 10% | 4.20 | 25.0% | 53.7% | 32.3% | smarter material picker + visceral hit-shake + floaters |
| 5 | **20%** | 3.91 | 26.4% | **72.8%** | **50.0%** | Anvil+Hat tuned to target band; 3 archetype cards shipped |

## Major changes landed across the arc

### Structural / mechanical
- **Slot order reordered** (mid-arc, from prior session): robes → ring → hat → staff. Staff is now the run's capstone item.
- **Enemy `act` fields shuffled** to keep themed enemies on themed paths after the reorder.
- **Material picker rewritten** from sum-of-stats to slot-aware scoring (sim). Cold Iron dominance broken; Mithril / Wild Silk / Wraithcloth / Brocade now the top picks.
- **Inter-act heal** 0.25 → 0.40 (players limp into next act with more HP).
- **Tapestry** (act 1 boss): composure 80 → 65, attack 9 → 8, multi 4×4 → 3×4, block 15 → 10.
- **Anvil-Forged** (act 2 boss): composure 100 → 64, HP 100 → 70, attack 13 → 10, multi 5×4 → 4×3, block 18 → 8.
- **Headmaster's Hat** (act 3 boss): composure 130 → 78, attack 16 → 12, multi 5×5 → 4×4, block 20 → 10.
- **Act 2 normals**: Geode Crab + Crystal Beetle take partial composure damage (0.3-0.5x). HP/attack softened.
- **Act 2 elites**: Quartz Sentinel, Vein Devourer significantly nerfed.
- **Starter deck**: swapped one Defend for Sword Logic (gives starter chutzpah-physical option).
- **Burrgrass** defense 4 → 3 (was 77% of robe picks).

### New content
- **Three archetype-committing cards** shipped:
  - `e-go-for-the-throat` (Chutzpah uncommon): 8 + Chutzpah×3 composure, lose 3 HP. Uses new `loseHpOnPlay` key.
  - `w-corner-them` (Chutzpah common word): +3 Chutzpah, lose 2 HP. Uses `loseHp` side-effect.
  - `e-cantrip-roulette` (Jnsq uncommon): 6 + Jnsq×2 composure, 70% applies 2 Vuln, 30% gain 1 Weak. Uses new `chance: {prob, success, failure}` key.
- New effect keys: `loseHpOnPlay`, `loseHp` (side-effect), `chance`, `selfWeak`, `enemyVulnerable` (chance-payload).

### Visceral game-feel
- **Enemy hit-shake animation** on damage dealt (240ms CSS keyframe).
- **Damage number floaters** that pop off the enemy panel — iris-purple for composure, ember-red for physical. Auto-clean after 900ms.

## Boss outcomes — cycle 5 (final)

| Boss | Win rate | Verdict |
|------|----------|---------|
| Act 1 (Tapestry Walker) | 91.8% | Slightly easy — could bump composure 65 → 70 for a more meaningful intro |
| Act 2 (Anvil-Forged) | 72.8% | **In target band.** Don't touch. |
| Act 3 (Headmaster's Hat) | 50% | Still the gate. Demands a wit deck the AI can't build. |
| Act 4 (Thornlord) | 95.2% | **Capstone walkover.** Should require bumping when act 3 is consistently surviving. |

## What the data CAN'T tell us yet — open questions for real-eyes playtest

1. **Does the spell-tray feel like a building action or a deck-shuffling chore?** Sim shows 17,728 casts and 0 fizzles — either staging is automatically obvious (good) or AI is too greedy to test the edge case (bad).
2. **Do players READ the effectiveness badges?** The Hat at `physical: 0, jnsq: 0.5, wit: 1.5` demands a specific deck. Tutorial-fresh players might lose without understanding why.
3. **Does Pratchett-tone undercut the threat?** Cantrip Roulette, Go For The Throat, "The Headmaster's Hat" — does absurdity raise stakes or laugh-kill tension?
4. **Resonance at 26% — felt mechanic or noise?** No visual callout when resonance fires. Players might be paying complexity tax for an invisible feature.
5. **Master-tier crafting at 80-90% — is reaching Master rewarding or expected?** "Master" isn't a flex when 90% of robes are Master. STS's rare relics are RARE.

## The single most impactful next change (per board-game-nerd cycle 5)

**Make the AI reward picker archetype-aware.** Currently it ranks (type, rarity, dupe-count, physical-shortage) — but a Chutzpah Effect and a Wit Effect at uncommon rarity score identically. The picker has no idea what stat the deck is committed to.

Until this lands, every archetype card shipped is invisible to the sim — the framework can't be measured. Estimated effort: ~4 hours of work; would unlock the next several sessions of design measurement.

Implementation sketch in `sim/playSim.js` `aiPickReward` (lines 1132-1172): compute `dominantStat = argmax(sum of word.stats)` across the player's full card pool, then bias picks toward effects/words feeding that stat. Add penalty for off-stat picks once `dominance > 0.5`.

## Recommended cycle-6+ priorities (rank-ordered, per board-game-nerd)

1. **AI archetype-aware picker** (prerequisite — blocks meaningful measurement of any future archetype work).
2. **Hat resistances revisited** — the act 3 gate at 50% kills players who couldn't build a wit deck. Either telegraph it earlier in act 3, or widen susceptibility slightly.
3. **Whittling stuck at mean 0.84** — likely a data bug (Weaving=4.0, Smithing=3.6, Blocking=2.1, Whittling=0.84). Skill-node distribution per act needs an audit.
4. **Acts 1 & 4 are off-band** — 91.8% and 95.2% respectively. Bump Thornlord meaningfully so graduation feels earned.
5. **Archetype-synergy cards** — Go For The Throat doesn't talk to Corner Them. Each archetype needs a card that pays off the *other* cards in its lane.

## Visceral next move

Skip enemy-defeat flash (cosmetic, low-frequency). Ship **player-side hit feedback** instead — HP-bar flash on damage > 8, screen-shake intensity scaling with damage-as-fraction-of-current-HP. Makes the Chutzpah "lose HP for damage" lane FELT instead of read.
