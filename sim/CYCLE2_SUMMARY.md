# Cycle 2 — 500-Playthrough Revision Summary

Five batches of 100 sim runs each, focused on **card strategy + deck building**.
Each batch followed by analysis from board-game-nerd-tester (hardcore) and
board-game-tester (casual). Final state: 3% greedy-AI win rate, up from
1% baseline. Real improvements in material diversity and Act 1/4 reachability;
Act 2 remains the structural wall.

## Trajectory

| Batch | Win | Act 1 boss | Act 2 boss | Resonance | Notes |
|-------|-----|-----------|-----------|-----------|-------|
| 1 (baseline) | 1% | 46% | 11% | 25% | Sim STARTER_DECK still the old 11-card fat one — measurement was censored |
| 2 | 1% | 62% | 29% | 30% | Sim aligned to App's slim 7-card + 2 Jnsq picks; Sway/Insult modeled |
| 3 | 1% | 54% | 26% | 29% | Vein Devourer softened (0 → 0.3); 2 new physical cards; lane-commit threshold lowered |
| 4 | 2% | 65% | 32% | 30% | Tapestry composureMax 68 → 60; tighter AI defense (block + 1) |
| 5a | 0% | 62% | 23% | 31% | Wild Silk nerf + tank-fight defense pivot — REGRESSION |
| 5b | **3%** | 58% | **38%** | 32% | Reverted defense pivot, kept Wild Silk nerf → best of cycle |

## What landed

### Sim alignment (the unblocker)
- **STARTER_DECK matched to App's slim 7-card** (was 11-card with sword-logic + spark, which made the reward picker actively avoid physical). This alone is responsible for most of the visible movement in batch 2.
- **Starting Picks simulated** — sim AI grabs the 2 Jnsq cards from the pool (greedy heuristic: open the branch lane the starter doesn't cover).
- **Sway/Insult modeled as approximations** (sway = 50% × +0.5 effectiveness; insult = 60% × 0.7 land damage). Previously sim treated them as no-ops, so the picker saw them as dead candidates.

### Card pool
- Added **Throw the Book** (Wit-physical, common) and **Flame On** (Jnsq-physical, common) so verbal decks have viable physical pickups before Act 2.

### Reward picker (`aiPickReward`)
- **Lane commitment heuristic**: once the deck has ≥3 stat-weight in a dominant stat with ≥1.5× margin over runners-up, bias picks +6 toward that stat's synergy (-3 penalty for off-stat effects). Threshold tuned down from (≥4, ≥2×) which almost never triggered before Act 2.
- **Sway escape valve**: +8 score when `physicalInDeck === 0` (Sway is the verbal-only crack at immunity).
- **Inter-act physical injection**: if the player would enter Act 2 with no physical cards, one is forced into discard. Sim-only for now; real mechanic deferred to design.

### Enemy tuning
- **Vein Devourer**: chutzpah/wit 0 → 0.3 (was a hard wall; now a chip-grind threat the player can survive without a physical answer)
- **Tapestry Walker**: composureMax 68 → 60, attack 11 → 10 (was 46-53% kill rate across batches; now 38-42%)

### Material balance
- **Wild Silk**: dropped `draw: 1` rider (was 167-199 picks/100 across every batch; in batch 5b, 0 picks while burrgrass / mithril / linen / wraithcloth all clustered around 95-115). **First real robe diversity** in cycle 1 + 2.

### Reverted
- **Tank-fight defense pivot** (batch 5a): when player had no physical and enemy was verbal-resistant, AI would all-defend for turns ≥4. Net result: traded quick deaths for stall-timeout losses. Same defeat, slower. Reverted in 5b; turn-by-turn defense (block + 1 threshold) stays.

## The two persistent problems

### 1. Act 2 wall (the real structural issue)
Act 2 enemies (Geode Crab, Crystal Beetle, Vein Devourer + Anvil) lean physical-favored: ≥1.2× to physical, ≤0.6× to all verbal. A wit-committed deck that beats Tapestry has *no answers* for Vein Devourer. The lane commitment heuristic is working — the AI commits — but the lane it commits to becomes structurally wrong one act later.

**Both agents agreed:** this is the cycle 3 question. Is Wizard Graduation a **pivot game** (Inscryption / Hand of Fate ascension: rebuild your deck at act seams) or a **commitment game** (STS / Monster Train: lock an archetype and ride it)? Right now it's neither — it requires pivot without providing tools.

### 2. The "weave your archetype" experience requires diversity beyond materials
Cycle 2 broke wild-silk dominance, which surfaces the next problem: even with 4 viable robes, weaving is still the only skill that maxes out (4.00 mean across every batch). Whittling and Felting are vestigial because 97% of runs die before Act 3/4 with the current AI. Until win rate clears 10%+, the late acts' content is structurally unmeasurable.

## Cycle 3 brief (proposed)

**Title:** *Acts as Identity Pivots — making the 4-school structure mechanically meaningful.*

**Decide first:**
- **Pivot path:** add an end-of-act forced-rebuild step (trash 3, draft 3 from a cross-stat pool). Robe acquired after Act 1 retroactively pushes a stat. This is the Inscryption / Hand of Fate move.
- **Commitment path:** soften enemy 0.5 floors to 0.7 across the board; add stat-agnostic physical effects (any deck can run); make Sway a baseline starter card.

**Rank by priority:**
1. Whichever path Alan picks — implement structurally before tuning anything else.
2. Add metrics to sim: material-pick distribution per dominant-stat-lane; win rate conditional on stat commitment; acts-cleared per lane. Without these we're tuning blind on which lanes are viable.
3. Card-pool depth audit on Jnsq specifically — it's the "branch out" lane in the slim starter design but only has 3 effects (Bewilder, Misdirect, Bamboozle, plus the new Flame On). Compare to Wit which has Persuade/Convince/Refute/Devastating-Truth + Throw-the-Book.

**Expected ceiling without structural change:** win rate stays in the 3-6% range. The Act 2 wall is the cap.

## Files touched

- `sim/playSim.js` — STARTER_DECK, STARTING_PICKS_POOL, CARDS (Sway/Insult sim modeling + 2 physical cards), aiPickReward (lane commitment + Sway weighting), Vein Devourer + Tapestry tuning, defense threshold, inter-act physical injection, Wild Silk nerf
- `src/App.jsx` — Vein Devourer + Tapestry mirror, 2 new physical cards (Throw the Book, Flame On), Wild Silk nerf
- `sim/reports/cycle2-batch-{1..5,5b}.md` — per-batch reports

## Things I considered and rejected this cycle

- **Insult sim simulation depth.** Modeled at 60% × 0.7 — coarser than the App's real word-pick alignment math. Closer simulation would require porting INSULT_NOUNS/VERBS/ADJECTIVES + softSpot logic; deferred to cycle 3 if Insult turns out to be balance-load-bearing.
- **Reworking `aiTurn` to use a "deck thesis" composer instead of a greedy card-by-card loop.** Tempting but would invalidate every prior sim number — wait until after cycle 3's structural decision.
- **More agent rounds per batch.** Two passes (batch 1 + final) was the right cadence — three rounds didn't surface new findings.
