# Architecture review — Witch Mountain Bridge (2026-05-24)

Scope:
- `src/App.jsx` — 11,591 lines
- `sim/playSimV2.js` — 4,068 lines
- `src/cards/{wit,chutzpah,jnsq}-v2.js` (1,880 lines combined) + `src/cards/shared.js` (428)
- `src/telemetry.js`, `src/TelemetryUI.jsx`

This pass treats the cast formula + card pools as **already shared** via `src/cards/shared.js` and the lane files (sim imports them at top of `sim/playSimV2.js:14-17`). That was the highest-leverage move and it already happened. The drift surface that's left is everything *around* `computeSpellDamage` — flag dispatch, enemy-side resolution, telemetry sprinkles, intent/behavior data, and the cast-resolver pipeline that wraps the shared formula.

The single most expensive structural pattern right now is **the v2.93 fan-out**: 11 new state hooks, 11 new flag setters in `applySideEffects`, 11 new consumers across `castV2SentenceSpell` / `applyEnemyIntent` / `endTurn`, and an 11-row enterFight reset block — for what is, semantically, a uniform "consume-on-trigger" effect queue. Every new Passing Thought card costs you a state hook + a setter line + a reset line + a consumer. That's the most legible candidate for collapse.

The second-most-expensive is that `applySideEffects` now hosts ~50 distinct `fx.*` keys in a 446-line `if`-ladder, and the sim's equivalent is a parallel `if`-ladder. **The keys themselves are shared** (both refer to the same card-data shapes), but the *dispatchers* are two copies of the same switch. This is where the next Passing Thought / lane mechanic will land twice.

---

## Top-line summary

| Healthy | Concerning |
|---|---|
| Card pools + `computeSpellDamage` cleanly shared between App and sim | App ≥ 11k lines; one function (`castV2SentenceSpell`) is 571 lines |
| Per-lane card files already extracted | 11 new v2.93 state hooks could be 1 queue + 1 dispatcher |
| `CardFullBody` exists as a canonical renderer | Only 2 of ~5 card-rendering sites use it; the rest drifted |
| Telemetry is a side-effect-free import (no React coupling) | Two parallel `if (fx.X)` ladders for ~50 keys (App + sim) |
| `shared.js` is genuinely shared (sim line 17 imports it) | `applyEnemyIntent` and `applySideEffects` have grown to 290 / 446 lines |

---

## Ranked items (highest ROI first)

### 1. Collapse 11 v2.93 flags into a single `pendingTriggers` table
**What's duplicated/inefficient.** Each Passing Thought mechanic costs you four code sites today:
- A `useState` hook (`src/App.jsx:3326-3336`, 11 lines, 11 hooks)
- A setter line in `applySideEffects` (`src/App.jsx:6257-6265`)
- A consumer at the right hook (`castV2SentenceSpell:5447-5499`, `applyEnemyIntent:7192-7400`, `endTurn:6951-6962`)
- An enterFight reset (`enterFight:4538-4548`)
- A parallel four-site addition in the sim (`sim/playSimV2.js:565-574`, `1416-1424`, `1804-1924`, `2550-2558`, `2639-2655`)

Almost every Passing Thought has the same shape: *arm a flag → consume on a named hook → optionally read a value*. A first-class table makes the shape explicit:
```js
// state: pendingTriggers = { [triggerName]: { id, payload } | null }
// e.g. pendingTriggers.beforeCast: { id: 'precedent', payload: { bonus: lastCastDmg } }
// e.g. pendingTriggers.onEnemyAttack: { id: 'glancing-blow' }
```
And one consumer per trigger site:
```js
const trig = consumePendingTrigger('beforeCast');  // returns + clears
if (trig?.id === 'precedent')          dmg += trig.payload.bonus;
if (trig?.id === 'insult-to-injury')   dmg = Math.round(dmg * 1.5);
```

**Cost.** ~150 line diff. Touches App + sim symmetrically. Need to migrate Bracing (which is *not* a one-shot but a turn-spanning capture/test — that one stays as `hpAtTurnStart`) and `reflectNextDebuff` (which has `n: number` semantics for stacking, so the payload carries `count` instead of being a bool). Risk: a missed consumer site means a flag never fires. **Medium** — bracket with sim runs of jnsq/chutzpah/wit before and after.

**Benefit.** Adding the 21st Passing Thought becomes: 1 card entry + 1 case in the trigger consumer. App and sim move in lockstep because the same trigger-keys are imported from a shared `passing-thought-triggers.js`. Removes 11 hooks (out of 120 in App). Makes the v2.93 card list one-line-each-readable.

**Recommendation.** **Do now.** This is the only item where the dispatch shape itself has gotten so consistent across 11 instances that an abstraction has actually paid for itself empirically.

---

### 2. Extract a single `effectsDispatch.js` module shared by App + sim
**What's duplicated/inefficient.** `applySideEffects` (`src/App.jsx:6010-6455`, 446 lines) and the equivalent inline branch in the sim's `runCombat` (`sim/playSimV2.js:~1330-1440`) dispatch the same ~50 `fx.*` keys. The two `if`-ladders are line-by-line parallel for half the keys (block, vulnerable, weak, energy, draw, hp, composure, compDmg, physDmg, stripBlock, discardRandom, discardHand, returnDiscardToHand, blockFromComposure, compDmgFromEnemyMissing, plus all 11 v2.93 flag setters).

Every new key today requires editing both files. Item #8 in the prior `ARCHITECTURE_REVIEW.md` (from 2026-05-20, since extended by Sway/Insult/Passing Thoughts) flagged "6 effect cards missing from sim" — that gap has grown.

**The MVP shared module.**
```js
// src/rules/effectsDispatch.js — pure, no React, no setters
// returns: { mutations: [{ kind: 'hp', delta: +3 }, ...], logBits: [...] }
export function dispatchEffects(fx, ctx) {
  const muts = [];
  if (fx.block) muts.push({ kind: 'block', delta: fx.block });
  if (fx.vulnerable) muts.push({ kind: 'playerDmgMult', delta: +0.25 * fx.vulnerable });
  // ... ~50 keys
  return { mutations: muts, logBits: [...] };
}
```
App wraps it: `const { mutations } = dispatchEffects(fx, ctx); mutations.forEach(applyMutationToReactState)`. Sim wraps it: `mutations.forEach(applyMutationToSimState)`. The state-update layer is what's React-specific; the *decoding* is shared.

**Cost.** ~400 line diff total. Mostly mechanical extraction but the App side has 50+ `setX(prev => …)` callbacks that need to be lifted out and re-attached. Sim side is straightforward `state.X = ...` mutations. Risk: a misnamed mutation kind silently drops a key. **Medium-high.**

**Benefit.** Halves the per-key drift cost. Lets the sim discover key gaps statically (call dispatchEffects with a card's `effects` and see if any unknown keys arrive). For comparison: if this had been in place before v2.93, the 11 new flags would have been ~30 lines instead of ~60 + the parallel sim block.

**Recommendation.** **Defer until #1 lands**, then revisit. Doing #1 first means this module's surface area shrinks from ~50 keys to ~38 (the 11 PT flags become 1 `pendingTrigger` key, the trigger logic stays per-engine since it depends on engine state semantics).

---

### 3. Replace 5 divergent card renderers with `CardFullBody`
**What's duplicated/inefficient.** The canonical `CardFullBody` (`src/App.jsx:11136-11263`, 128 lines) was added in v2.86 specifically to centralize this. It's only used in 2 sites today:
- `ForgetTwoModal` (`11324`)
- `ForgetCardScreen` (`11352`)

The other ~5 sites still hand-roll their own renderer:
- Hand cards in `CombatScreen` (`src/App.jsx:9234-9376`, ~140 lines) — the original
- `RewardScreen` (`src/App.jsx:9974-10060`, ~85 lines) — missing several effect descriptions (no `tier3Double`, `requiresTier3`, `loseHpOnCast`, `modifier` kind)
- `CardGrantScreen` (`src/App.jsx:10079-10110`, ~50 lines) — missing target/effect rendering entirely (just shows stats)
- `UpgradePreviewCard` (`src/App.jsx:11403-11469`) — uses `card.type === 'word'` checks instead of `card.slot ===` checks like the others
- `CraftingScreen` material picker (`src/App.jsx:10741+`) — separate visual schema (materials, not cards), so excluded

Concrete consequence: when v2.93 added `compDmgFromEnemyMissing` and `blockFromComposure`, the hand renderer never got branches for them (search for them in 9234-9376 — nothing). They render as blank space on the relevant cards. The RewardScreen and CardGrantScreen are worse — they were missing target rendering before v2.93 and still are.

**Cost.** Refactor `CardFullBody` to take `{ card, mode: 'hand' | 'reward' | 'grant' | 'preview' }` so the in-hand interactions (cost-pill recoloring on amplify, hand-side `tint`, footnote-eligible state) stay encapsulated. ~200 line net reduction. Each callsite drops from 50-140 lines to ~3.

**Benefit.** New effect keys render correctly in all 5 places automatically. The "where does this card display weirdly?" bug becomes 0 instead of 5 places to check. **High** for current-cycle work (v2.93+ Passing Thoughts have ~7 keys that aren't rendered in 3+ places today).

**Risk.** Medium. The hand renderer has 4-5 mode-specific behaviors (footnote eligibility, amplify cost coloring, escalated-cost tooltip, disabled state) — those have to ride through the mode prop or stay on the call site. Don't try to absorb all of them; keep mode-specific decoration outside the body.

**Recommendation.** **Do now.** Lower-risk than #1, immediate quality win, and pays back next time a card mechanic ships.

---

### 4. Extract sub-screens to `src/screens/` — App.jsx down to ~7k lines
**What's duplicated/inefficient.** `src/App.jsx` is 11,591 lines, 4,000+ of which are presentation:
- `MenuScreen` (7982-8008), `TutorialOverlay` (8009-8128), `TutorialCompleteScreen` (8129-8327)
- `CharacterSelectScreen` (8328-8390), `WizardTutorialModal` (8391-8435)
- `SupplyShopScreen` / `FamiliarShopScreen` / `FamiliarNameScreen` (8436-8579)
- `MapScreen` + helpers (8580-8849), 270 lines
- `CombatScreen` (8850-9636), **787 lines** — the largest single screen
- `V2SpellTray` (9637-9973), 337 lines
- `RewardScreen` / `CardGrantScreen` / `EventScreen` / `MaterialChooseScreen` / `SkillEventScreen` / `SidequestOfferScreen` / `SidequestNodeScreen` (9974-10290)
- `PostcardModal` / `InsultPromptScreen` / `TraceWhittlingMinigame` (10291-10704)
- `CraftingScreen` + 3 sub-phases (10705-10866)
- `equipmentEffectSummary` / `relicEffectSummary` / `RelicEffectBreakdown` / `EquipmentEffectBreakdown` (10868-11019)
- `RestScreen` / `UpgradeCardScreen` / `CardFullBody` / `ChaosRollFlash` / `ForgetTwoModal` / `ForgetCardScreen` / `UpgradeConfirmModal` / `UpgradePreviewCard` (11020-11473)
- `summarizeEffects` / `ActClearedScreen` / `GraduationScreen` / `EndScreen` (11474-end)

The same recommendation was already in the previous review (#14, deferred). At 11k lines it's now harder to defer — when you want to change `applyEnemyIntent` at line 7184 and `CombatScreen` at line 8850, you scroll ~1700 lines.

**Cost.** Mostly cut-paste. Each screen takes props, returns JSX; closures back into App are already mostly via props. The big one is `CombatScreen` (787 lines, ~25 props already). Risk: missing an import or a `useState` closure. ~half-day if all done in one sitting with the dev server up.

**Benefit.** App.jsx drops from 11.6k → ~7k. Each screen becomes a 50-800 line file you can read in one view. New screen = new file (e.g. a future practice-summary screen, a relic codex). Doesn't reduce *behavior* complexity but does reduce *navigation* cost dramatically.

**Risk.** Medium. The known footgun is React onClick passing the event as `arg[0]` (per saved feedback) — keep using `() => fn(...)` wrappers when moving handlers across files.

**Recommendation.** **Do soon.** The data-vs-UI split is genuinely large enough now that this is no longer premature.

---

### 5. Hoist enemy + behavior data to `src/rules/enemies.js`
**What's duplicated/inefficient.** Sim has a stripped-down `ENEMIES` array (`sim/playSimV2.js:30-55`, 24 lines, stats only, no `behaviors`). App has the full `ENEMIES` array (`src/App.jsx:592-858`, 267 lines, with `behaviors: [{ kind, value, weight, telegraph, count? }, ...]`).

Drift surface: enemy stats (composureMax / hpMax / atk / effectiveness / insultVulnerabilities) appear in both. When `pierceVulnerableInsult` shipped, the App side got insultVulnerabilities on every enemy and the sim got them later (current sim has them, but the lag was real).

Sim deliberately collapses intents to "one flat atk roll per turn + stochastic Weak/Vuln" (`playSimV2.js:2616-2658`). That's a *legitimate* simplification — modeling 5 weighted behaviors per turn is not what a greedy AI needs. So the sim doesn't need behaviors, but it does need enemy *stats* in lockstep with the App.

**The shared module.** Split:
```js
// src/rules/enemies.js — pure stat data, both sides import
export const ENEMY_STATS = [
  { id: 'e1-acolyte', act: 3, name: 'Lost Acolyte', composureMax: 20, hpMax: 18, tier: 'normal',
    atk: 4, effectiveness: {...}, insultVulnerabilities: ['dismissive', 'cutting'] },
  // ...
];
```
App.jsx keeps the `behaviors` array as a separate map keyed by enemy id (so adding a behavior doesn't force a sim change). Sim only reads `ENEMY_STATS`.

**Cost.** ~250 line diff (mostly hoist). Need to split App's monolithic enemy objects into stats + behaviors.

**Benefit.** Enemy stat tuning lands in one place. Sim never lags on stat changes. New enemies become 1 stats-entry + 1 behaviors-entry.

**Recommendation.** **Defer** until you next tune enemy stats in bulk. Right now it's not biting often — the previous review's note ("six Effect cards missing from sim") is the more common drift class, not enemy stats.

---

### 6. Repeated cast-pipeline plumbing in `castV2SentenceSpell`
**What's duplicated/inefficient.** `castV2SentenceSpell` (`src/App.jsx:5137-5707`, **571 lines**) is the longest function in the codebase. It does:
1. Roll chaos die (8 lines)
2. Build ctx, call computeSpellDamage (10 lines)
3. Pause-doubled telemetry re-roll (12 lines)
4. Surface 6 named bonuses for log/telemetry (loud/predator/thread/footnote/opening/insult) — each is a `if (X > 0) { pushLog(...); logEvent(...); }` block, ~10 lines each = 60 lines
5. Read-the-Room pierce + effectiveness routing (12 lines)
6. Drunken Confidence ×1.5 (18 lines)
7. Chaos roll dmg multiplier (10 lines)
8. Annotation bonus + Cash In (15 lines)
9. RAGE-required half-damage (4 lines)
10. Storm Out energy-burn (8 lines)
11. Patience bank cash-in (14 lines)
12. 6 v2.93 cast modifiers (40 lines) — **item #1 collapses this**
13. 2nd-cast 0.6× scalar (12 lines)
14. Apply damage (4 lines)
15. Doubletake re-apply (8 lines)
16. Stake refund (8 lines)
17. Cash-in annotation exile + auto-attach stub (20 lines)
18. Chaos roll side effects (33 lines)
19. Damage log line (10 lines)
20. Apply riders (4 lines)
21. Apply sideEffects (drawCount, selfComposureCost, selfHpCost) (16 lines)
22. DoubleDown bank (5 lines)
23. Delayed Misstep queue (11 lines)
24. Actually— snapshot (15 lines)
25. Won't Shut Up arm (10 lines)
26. Tangent-on-cast (15 lines)
27. Synergy capstone telemetry (8 lines)
28. Discharge cards + tray clear (7 lines)
29. Storm Out endTurn (8 lines)

The sim's equivalent (`sim/playSimV2.js:1740-1990`) re-implements the same pipeline. Drift surface: any of steps 4-27 can land in one without the other.

The natural seam is **step 4 (bonus surfacing) and steps 22-27 (post-cast riders)** — both are sequences of `if (target.effect?.X) { ... }` checks. Those could become two arrays of `{ matcher, action }` pairs that App and sim both iterate. The middle (steps 6, 8, 11, 13, 16) reads global state and is harder to lift.

**Cost.** A "shared post-cast riders" extraction is probably 200 lines. Not as obvious a win as #1 because the per-rider logic is varied (telemetry shape differs, state mutations differ).

**Benefit.** Medium. Adding the next "on-cast" rider becomes a one-entry change in both engines. But the 6 existing bonus-surfacers (loud/predator/thread/footnote/opening/insult) are *already shipped* — the marginal cost of the next one is just two `if` blocks.

**Recommendation.** **Defer.** The function is ugly to read but not actively painful to extend. If you ship 5+ more on-cast bonuses, revisit. The 2nd-cast 0.6× scalar plumbing (steps 13 + how it composes with step 6) is the only specifically-brittle part — that one *is* worth a 30-line extraction (see #10).

---

### 7. Three side-effect dispatchers (`applySideEffects` / `applyPowerTriggerEffects` / `applyEndOfTurnPowerTriggers`)
**What's duplicated/inefficient.** Carried forward from prior review item #7. Status: not fixed, has gotten worse.
- `applySideEffects` (`src/App.jsx:6010-6455`) now ~50 keys
- `applyPowerTriggerEffects` (`src/App.jsx:6544-6580`) handles a subset (composure/block/vulnerable/weak/energy/draw)
- `applyEndOfTurnPowerTriggers` (`src/App.jsx:6592-6640`) — same dispatch in "working locals" form

A power that grants `compDmg` (added in v2.92) won't actually do anything from a power-trigger hook because `applyPowerTriggerEffects` doesn't know about `compDmg`. Easy to silently miss.

**Cost.** ~80 line consolidation. Add a `mode: 'immediate' | 'powerTrigger' | 'eoT'` flag to `applySideEffects` and have the other two delegate.

**Benefit.** New effect keys auto-propagate to power triggers. Currently you have to remember to add to two dispatchers.

**Recommendation.** **Do alongside #2** (the shared effects dispatcher) — they're the same refactor at different scales. Don't do this in isolation; if you can stomach #2, this is free.

---

### 8. Hand-renderer effects-check is missing 7+ keys
**What's duplicated/inefficient.** `src/App.jsx:9281-9290` (hand card) and `src/App.jsx:11176-11185` (CardFullBody) both filter card.effects with hard-coded `if` checks:
```jsx
{card.effects && (card.effects.weak || card.effects.vulnerable || card.effects.block ||
  card.effects.draw || card.effects.loseHp || card.effects.hp) && (
  // 6 specific renderers
)}
```
Cards with `effects.energy`, `effects.composure`, `effects.compDmg`, `effects.physDmg`, `effects.discardRandom`, `effects.returnDiscardToHand`, `effects.poise`, `effects.removeWeak`, `effects.absorbNextDebuff`, or any of the 11 v2.93 flags will render with **nothing** in this block. The Passing Thoughts mostly have a `desc` that says what they do — but the *visual chip pattern* is missing.

**Cost.** Tiny. Convert to a data-driven render:
```js
const VISIBLE_EFFECTS = [
  { key: 'weak',       label: '⛧ Weak ' },
  { key: 'composure',  label: '🎭 Comp ', tone: 'iris' },
  // ... ~15 entries
];
```

**Benefit.** Every keyed effect on every card is visible. New v2.93 flags don't need any render-side change.

**Recommendation.** **Do alongside #3** (the CardFullBody unification) — same surface area.

---

### 9. Sim mirror tax on telemetry sprinkles
**What's duplicated/inefficient.** Sim has 143 `telemetry.X = (telemetry.X || 0) + 1` lines. App has 69 `logEvent(...)` calls. They're not the same shape (sim telemetry is summary aggregates; App is event stream). But every new mechanic ships a sim-side telemetry counter AND an App-side `logEvent(...)`. They diverge in naming: sim has `passingThoughtMirrorReasoningFires`, App has `'jnsq.about-that-time'` events — neither knows about the other.

**Cost.** Not a refactor candidate by itself. The two telemetry shapes serve different purposes (sim aggregates batches of 100 runs; App captures a single human session for ChatGPT-fed analysis). Folding them is wrong.

**Benefit.** N/A — they're correctly separate.

**Recommendation.** **Skip.** Flagged so a future contributor doesn't try to merge them.

---

### 10. Vestigial / brittle: 2nd-cast 0.6× scalar plumbing
**What's duplicated/inefficient.** v2.91 dropped Babbling-gating and made the 0.6× universal — but the scalar still happens at TWO layers in `castV2SentenceSpell`:
- Once via `doubleOnSecondCast` rider (which doubles BEFORE the 0.6×, net 1.2×) — `shared.js:189`
- Once flatly applied at `App.jsx:5473-5483` (post-modifier multipliers, post-flag bonuses)

The interaction is non-trivial: a `doubleOnSecondCast` card with a flag-bonus from #1 will compose differently than one without. There is no test, and the sim mirror at `sim/playSimV2.js:1883` applies the scalar at a different position relative to telemetry capture.

Also: `babbling`-the-power was retired in v2.91 (per CLAUDE.md), but `BabblingTelemetry` and `babblingInstalls` still exist (`App.jsx:4797-4799`) as a vestigial state-of-the-world. Either re-purpose or delete; right now it's a dead pointer.

**Cost.** Tiny. Extract `apply2ndCastScalar(dmg, castsThisTurn) → { dmg, delta }` so both App and sim invoke it identically. Delete `BabblingTelemetry` writes.

**Benefit.** One less footgun next time someone adds a "Xth cast" mechanic. Vestigial dead code goes.

**Recommendation.** **Do soon** — 30-minute cleanup, paid for by the next time someone reaches for that scalar.

---

### 11. `useState` count (120 hooks in App component) signals state fragmentation
**What's duplicated/inefficient.** The App component declares 120 useState hooks (per `awk` count over lines 3091-3582 of `App.jsx`). 11 of those are v2.93's collapsible-to-1-queue flags (item #1). Many others come in tight groups that represent ONE conceptual thing:
- `holdOnArmed` + `holdOnValue` — one armed-trigger with a payload
- `staggerActive` + `staggerInstalled` (telemetry-flag) — one power
- `lastCastSnapshot` + `arguingBackThisTurn` — Actually— state
- `patienceInstalled` + `patienceStacks` — one power's installed-state + counter
- `wontShutUpArmed` + `wontShutUpTelemetry` — one armed flag + counter
- `drunkenTelemetry` + per-cast computed `drunkenInstalled` (read from `powers.some(...)`) — telemetry-only state

A `useReducer` over a single `combatState` object would compress these. **But.** That's a 1k+ line refactor with no test net. Don't do it for tidiness; the per-field setters are working fine.

**Cost.** N/A — recommending no action.

**Benefit.** N/A.

**Recommendation.** **Skip for now.** Revisit if combat state mutation becomes a debugging burden. Item #1 already removes the worst 11 hooks.

---

### 12. Behavior data lives in App, but sim hand-rolls a synthesis
**What's duplicated/inefficient.** Per `applyEnemyIntent` (`App.jsx:7184-7473`), an enemy has behaviors with `{ kind: 'attack' | 'attack-multi' | 'block' | 'vulnerable' | 'weak', value, weight, telegraph, riders }`. The sim collapses to a per-turn synthesized attack + stochastic Weak/Vuln roll (`sim/playSimV2.js:2616-2658`). This is intentional, and noted in code: "the sim's per-turn drift already pulls multipliers back toward 1.0".

But: the sim's `rate calibration` (`weakChance = 0.06 * dbTier`) was set against an older intent distribution. When behaviors change in App, the sim's calibration drifts.

**Cost.** N/A — the right intervention is documentation, not extraction. Add a `// SIM CALIBRATION: kept in sync with intent distribution N enemy attacks vs. M weak/vuln per 100 turns` comment in both files.

**Recommendation.** **Skip — document only.** A one-line note at `sim/playSimV2.js:2624` pointing to the App's behavior table will catch the next person.

---

### 13. Material/skill/equipment data is App-only
**What's duplicated/inefficient.** `MATERIAL_TEMPLATES`, `EQUIPMENT`, `ACTS`-with-`craft`, `QUALITY_MULT` all live in App. Sim has its own (smaller) lookup. Crafting in sim is a black box (`sim/playSimV2.js` doesn't model the crafting minigame at all).

**Cost.** Low — extract to `src/rules/equipment.js` and import from both. Some shapes will need normalizing.

**Benefit.** Low. Crafting is post-boss and the sim doesn't gate on it. Drift risk is real but the surface is small (4 acts × 3 slots × 3 tiers = 36 equipment entries, not changing often).

**Recommendation.** **Skip until you next touch equipment.** Bundle the extraction with the next equipment work.

---

### 14. `playCard` slot-dispatch has 5 near-identical "stage in tray" branches
**What's duplicated/inefficient.** `playCard` (`App.jsx:4747-4993`) has 5 branches for slot-types (intro/subject, modifier, target, annotation, gesture, plus back-compat word/effect). Intro/subject/modifier all share the same shape: replace if present (return cost), put in tray slot, applySideEffects on card.effects, remove from hand, tunnel-vision bump, log. The differences:
- intro/subject: single-slot (replace previous)
- modifier: array (cap at 2, no replace)
- target: requires intro+subject, single-slot (replace previous)

The shared shape is *almost* there. A `stageInTray(card, slotKind)` helper could fold all three.

**Cost.** Small. ~50 line reduction.

**Benefit.** Medium. Next time a slot adds behavior (e.g. tier-3 wildcard validation, footnote-on-stage variants), one place to change. Modifier has a special `footnoteSelfOnStage` branch that lives only there — preserve.

**Recommendation.** **Defer** — readable enough today, not actively painful. Would pair well with #4 (when CombatScreen moves to its own file, `playCard` is one of the natural App-resident handlers to tidy).

---

### 15. `applySideEffects` mixes "set a flag" with "do a side effect"
**What's duplicated/inefficient.** Inside `applySideEffects`, three semantic shapes are interleaved:
- **Immediate state writes**: `fx.block → setBlock(b => b + fx.block)`
- **Trigger arms**: `fx.enemySkipNextAttack → setEnemySkipNextAttack(true)` (consumed elsewhere)
- **Async side effects**: `fx.refireLastCast → calls computeSpellDamage, mutates HP, logs` — 30 lines of cast re-fire logic embedded in a "side effects" dispatcher

The `refireLastCast` branch (lines 6110-6140) really belongs in `castV2SentenceSpell` (or a `refireSpellSnapshot(snap)` helper). Right now it's hidden inside the dispatch ladder where you'd never look for it. Same for `uninstallPower` (lines 6074-6094) which has a `setTimeout` log defer that's footgun-shaped.

**Cost.** Small. Extract `refireSpellSnapshot` and `uninstallPower` to named functions; the dispatch branch becomes a 1-line call.

**Benefit.** Reader can scan `applySideEffects` and see "this is a dispatch, the work is elsewhere". Adding the next cast-re-fire-style effect doesn't bloat the dispatcher.

**Recommendation.** **Do as light cleanup** — 30 minutes, no risk, immediate readability win.

---

### 16. v2.93 sim parity check (status: largely complete)
**What's duplicated/inefficient.** Tested by grep — sim does implement all 11 v2.93 flags. Two are noted as "no-op in sim" intentionally:
- D-2 Glancing Blow (HP→Comp swap) — sim doesn't distinguish HP and Comp at the per-hit level
- D-3 Settle the Score (reflect-as-comp) — same reason
- D-4 Bracing — sim doesn't model start-of-turn vs end-of-turn HP delta

These are documented in code (`sim/playSimV2.js:1412-1424`). So the sim *can* run a Passing-Thoughts-heavy deck but underestimates 3 of the 11 PT mechanics. Worth noting if you make balance decisions from sim numbers.

**Cost.** Significant — would require teaching the sim to model HP/Comp damage separately per hit (currently composite). ~150 lines.

**Benefit.** Medium — only matters if Passing Thoughts deck becomes a real human strategy and balance numbers diverge.

**Recommendation.** **Defer.** Note in sim/SUMMARY.md that these 3 PT mechanics are unmodeled.

---

## Recommended sequence

1. **30-min cleanup pass**: #10 (2nd-cast scalar extract + Babbling vestige delete), #15 (refireSpellSnapshot + uninstallPower extract). Low-risk, immediate win.
2. **Half-day**: #3 + #8 (CardFullBody unification + data-driven effects chips). Removes the worst quality bug (silent missing renders on new effects). Touch all card-render call sites at once.
3. **Half-day**: #1 (collapse v2.93 flags into pendingTriggers). Touches App + sim symmetrically. Sim-validate before and after.
4. **Half-day**: #4 (extract sub-screens). The file size is now hurting daily; this pays back the first time you grep for combat UI.
5. **Pair-with-feature**: #2 + #7 (shared effectsDispatch module + power-trigger unification). This is the largest change — defer until the surface stabilizes a few more PT cycles, OR do it bundled with the next set of new effect keys.
6. **Defer**: #5 (enemy stat module), #13 (equipment), #16 (full sim PT parity). Bundle with the next feature touch on each.
7. **Skip**: #9 (telemetry merge), #11 (useReducer), #12 (sim calibration extraction — document only), #14 (playCard slot-stage merge — readable enough).

Total effort if you do items 1-4: about 1.5-2 days. Net savings: ~600 lines, removes 11 useState hooks, fixes silent-render bug on new effects, lets future v2.94+ Passing Thoughts ship in one place instead of four.

---

## Things I considered and rejected

- **Move `castV2SentenceSpell` to `src/rules/`** — too entangled with React state (setHp, setBlock, setExiled, setDiscard, applyDamageToEnemyComposure, applyDamageToEnemyHp, applyPowerTriggers, advanceTutorialStep). A 571-line function isn't great but lifting half of it would create a half-shared, half-not-shared boundary that's harder to reason about than today's "App and sim each have their own". Item #1 + #2 carve out the safely-shareable bits (the trigger queue + the effect dispatch) without trying to lift the whole pipeline.
- **TypeScript migration** — same answer as prior review. Card shape (`effects: { ... }`) is still adding keys monthly via Passing Thoughts. Freezing types now is premature.
- **`useReducer` for combat state** — see #11.
- **Replace `applyEnemyIntent`'s 290-line attack-resolution with a damage pipeline** — the sequence (skip → swap → reduction → block-route → hit-me-again recoil → stagger dodge → annotation reflect) is genuinely linear and the alternative (a chain of `Transform` objects) would be more code, not less. The interleaved logging is the real reading-cost; a `pipeline.run(initial, [transforms...])` shape would actually obscure the order.
- **~~Merge sim/playSim.js and sim/playSimV2.js~~ — DONE 2026-06-01.** Consolidated
  into a single `sim/playSimV2.js`: ported the enemy intent/behavior engine and
  the full handler Animal Summoner engine onto the V2 base, extracted enemies +
  animals into `src/data/{enemies,animals}.js` (imported by both App.jsx and the
  sim so they can't drift), and deleted the old inline-data `sim/playSim.js`.
  `humanPolicy.js` is standalone and was kept.
- **`humanPolicy.js` (299 lines) as a future shared AI input** — interesting design space but currently sim-only and doesn't drive App behavior. Not a structural concern.
