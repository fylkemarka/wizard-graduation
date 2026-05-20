# Architecture review — Wizard Graduation (2026-05-20)

Scope: `src/App.jsx` (7449 lines), `sim/playSim.js` (1470 lines), with a focus on
the systems added in the last ~15 commits (visible-map sidequests, insult
prompt, postcards, sway, in-game menu, trace minigame, composure).

The codebase is in good shape for a fast-iterating prototype, but the
single-file pattern is starting to hide real bugs. The two most impactful items
are concrete bugs introduced by recent additions, not refactors.

---

## Ranked by impact / effort

| #  | Item                                                            | Class      | Effort | Impact |
|----|-----------------------------------------------------------------|------------|--------|--------|
| 1  | Staged words vanish on exhaust cast                             | Bug        | XS     | High   |
| 2  | `setSecondsLeft` updater calls `onPick` (impure)                | Bug        | XS     | High   |
| 3  | `setSupplyPicks` updater schedules a setTimeout (impure)        | Bug        | XS     | Med    |
| 4  | `setComposure` updater calls `setStage` on KO (impure)          | Bug        | XS     | Med    |
| 5  | `applyDamageToPlayer` is dead code, missing eq damageReduction  | Bug-shaped | XS     | Med    |
| 6  | Unify the choice-effects dispatcher (heal / maxHp / gainCard / …) | DRY      | S      | High   |
| 7  | Unify in-combat side-effects (`applySideEffects` / power triggers) | DRY     | S      | Med    |
| 8  | Sim card-data drift: 6 effect cards missing from sim            | Drift      | XS     | Med    |
| 9  | Sim doesn't know about `softSpot` / `insultVulnerabilities`     | Drift      | M      | Med    |
| 10 | Render-time `reachableFromCurrent()` / `previewCastDamage()`    | Perf       | XS     | Low    |
| 11 | `effectSources()` allocates on every call (5+ per intent)       | Perf       | XS     | Low    |
| 12 | `spawnRemainingSpur` reads outer `currentAct` / rolls `Math.random` inside `setMap(prev=>…)` | Hygiene | XS | Low |
| 13 | Row-Y formula inlined in 3 places, helper only used in one      | DRY        | XS     | Low    |
| 14 | Sub-screen extractions (natural seams)                          | Arch       | M      | Med    |
| 15 | Promote shared rules to a `rules/` module                       | Arch       | L      | High*  |

\* High eventual benefit, but the drift cost compounds slowly. Do #8/#9 first.

---

## Bugs

### 1. Staged words can vanish into the void when casting an exhaust Effect

**What's wrong.** `castStagedSpell` in `src/App.jsx:4445-4452`:

```jsx
const wordsToDiscard = tray.words.filter(w => !w.effects?.exhaust);
const wordsToExile   = tray.words.filter(w =>  w.effects?.exhaust);
if (eff.exhaust) setExiled(ex => [...ex, ...wordsToExile, card]);
else             { setDiscard(d => [...d, ...wordsToDiscard, card]); if (wordsToExile.length) setExiled(ex => [...ex, ...wordsToExile]); }
```

When the Effect card has `eff.exhaust: true`, the code only routes the
*exhaust-flagged* staged words to the exile pile. The non-exhaust words
(`wordsToDiscard`) are silently dropped — they aren't pushed to discard, exile,
hand, or anywhere else. They disappear from the run for the rest of the
combat (and reappear next combat through the standard pile-rebuild, so it's
not permanent deck damage, but it IS in-combat resource loss).

The Sway branch at `4388-4393` has the identical bug. The sim, by contrast, is
correct (`sim/playSim.js:730-734` walks each word individually regardless of
the Effect's exhaust flag), so sim and app silently diverge on this case.

**Fix.**
```js
const exhaustWords = tray.words.filter(w =>  w.effects?.exhaust);
const discardWords = tray.words.filter(w => !w.effects?.exhaust);
if (exhaustWords.length) setExiled(ex => [...ex, ...exhaustWords]);
if (discardWords.length) setDiscard(d => [...d, ...discardWords]);
if (eff.exhaust) setExiled(ex => [...ex, card]);
else             setDiscard(d => [...d, card]);
```

Apply the same shape to the Sway branch (`4388-4393`). Pull both into a tiny
helper, e.g. `dischargeStagedCards(tray, card, eff)`.

**Cost.** Small. Single function, ~10 lines changed, mirrored in three branches.
**Benefit.** Closes a real card-loss bug that already exists for any
exhaust-flagged Effect, which is most capstones. Matches sim behavior.
**Risk.** Low. The new shape is what the Sim already does and what the comment
on line 4450 ("// already handled in the else branch above") was trying to
guard against.

### 2. `InsultPromptScreen` timer calls `onPick` from inside `setSecondsLeft` updater

**What's wrong.** `src/App.jsx:6785-6800`:

```jsx
useEffect(() => {
  setSecondsLeft(TIMER_SECONDS);
  const interval = setInterval(() => {
    setSecondsLeft(s => {
      if (s <= 0.1) {
        clearInterval(interval);
        onPick(samples[0]);   // <— side-effect inside an updater
        return 0;
      }
      return Math.max(0, s - 0.1);
    });
  }, 100);
  return () => clearInterval(interval);
}, [insultPrompt.phase]);
```

This is exactly the saved-feedback pattern: setState updaters must be pure.
Under React StrictMode the updater is invoked twice; the first invocation
fires `onPick(samples[0])` which calls `pickInsultWord` → `finalizeInsult` →
mutates state and resolves the prompt. The second invocation then fires
`onPick` again on a now-stale `insultPrompt`. The actual outcome in production
is usually fine because StrictMode is dev-only, but this is the kind of thing
the saved memory specifically called out.

**Fix.** Move the side effect out:

```js
setSecondsLeft(s => Math.max(0, s - 0.1));
// then, in a separate effect that watches secondsLeft + phase:
if (secondsLeft <= 0 && !fired.current) { fired.current = true; onPick(samples[0]); }
```

Or simpler: track expiry with a ref and call `onPick` from the interval body,
not from the updater.

**Cost.** Small. Local to one component.
**Benefit.** Eliminates a known footgun class that has bitten before. Also
makes the prompt safer if anyone wires it into a test harness or to
StrictMode.
**Risk.** Low. The timer logic doesn't depend on the updater-return path.

### 3. `pickSupplyCard` schedules `setTimeout` inside `setSupplyPicks(prev => …)`

**What's wrong.** `src/App.jsx:3447-3458`:

```js
setSupplyPicks(prev => {
  const next = [...prev, idx];
  if (next.length >= 2) {
    setTimeout(() => {
      setSupplyChoices([]); setSupplyPicks([]); setStage('familiar-shop');
    }, 300);
  }
  return next;
});
```

Same impure-updater issue: under StrictMode the updater runs twice, queuing
two setTimeouts, two stage transitions. The current app probably never sees
this because StrictMode is off — but the saved-feedback memory is explicit
about avoiding this pattern.

**Fix.**
```js
const next = [...supplyPicks, idx];
setSupplyPicks(next);
if (next.length >= 2) {
  setTimeout(() => { setSupplyChoices([]); setSupplyPicks([]); setStage('familiar-shop'); }, 300);
}
```

**Cost.** Trivial.
**Benefit.** Removes a footgun. Makes the function safe to enable StrictMode
against later.
**Risk.** None — the read of `supplyPicks` is fine in the event handler
closure since `pickSupplyCard` is only callable from a render where
`supplyPicks` is the latest.

### 4. `setComposure` updater calls `setStage('defeat')` via setTimeout

**What's wrong.** `src/App.jsx:4524-4528` inside `finalizeInsult` backfire:

```js
setComposure(c => {
  const newC = Math.max(0, c);
  if (newC <= 0) setTimeout(() => setStage('defeat'), 200);
  return newC;
});
```

Same impure-updater issue. Worse here because immediately AFTER the block,
the code unconditionally calls `setStage('combat')` (line 4532). The
setTimeout(200ms) fires later and overrides to 'defeat', so the player does
end up on defeat — but only because of timing luck. Under StrictMode, you'd
schedule two defeat-setStage calls and one combat-setStage call in the same
batch, which is racy.

Note also that the preceding `setComposure(c => Math.max(0, c - back))` at
line 4517 has already done the damage. The second `setComposure` is just a
KO-check disguised as a state write — replace with a normal `if`:

```js
const projectedComp = Math.max(0, composure - back);
if (projectedComp <= 0) setTimeout(() => setStage('defeat'), 200);
else setStage('combat');
```

**Cost.** Trivial.
**Benefit.** Eliminates the race and removes the redundant setComposure.
**Risk.** Low. `composure` in the closure is the pre-decrement value, so
projecting against `back` matches the actual update.

### 5. `applyDamageToPlayer` is dead code and missing equipment.damageReduction

**What's wrong.** `src/App.jsx:4983-4999` defines `applyDamageToPlayer`, but no
caller exists (only a comment reference at line 3173). It also sums only the
`effectSources()` damageReduction, not the equipment branch — unlike the
correct path in `applyEnemyIntent` (`4924-4925`).

**Fix.** Either:
- Delete `applyDamageToPlayer` entirely, OR
- Wire it into the obvious gaps (event `loseHp`, postcard penalty `setHp(h =>
  Math.max(1, h - 5))`, `finalizeInsult` composure backfire) if those should
  honor relic damage-reduction. **My guess from the surrounding code is they
  should NOT** — events/postcards are narrative damage and bypass armor by
  design — so deletion is the right call. Either way, leaving it as half-baked
  invites a future contributor to wire it in without noticing it skips
  equipment.

**Cost.** Trivial (delete) or small (wire correctly).
**Benefit.** Removes a 17-line trap.
**Risk.** None for deletion.

---

## DRY violations

### 6. Three+ functions hand-roll the same choice-effects dispatcher

**What's wrong.** The effect keys `healFull`, `heal`, `loseHp`, `maxHp` (with
the same odd current-HP clamp formula), `loseRandomCard`, `gainCommonCard`,
`gainUncommonCard`, `gainRareCard`, `grantPostcardPhrase`, `skill: {…}` are
re-dispatched in four places, each with subtly different log formatting and
behavior:

- `applyChoiceEffects` — `src/App.jsx:3710-3752` (sidequest beats)
- `resolveSkillChoice` — `src/App.jsx:3959-4038` (skill nodes)
- `finalizeSkillMinigame` — `src/App.jsx:3663-3705` (skill minigame outcomes)
- `resolveEventChoice` — `src/App.jsx:5123-5194` (events)

The maxHp clamp `setHp(h => Math.max(1, Math.min(h, maxHp + fx.maxHp)))`
appears verbatim in all four. The `loseRandomCard` block (with the
non-starter-preferred picker) appears twice. The `gainCommonCard` / etc.
blocks appear in three places, with `resolveEventChoice` and
`resolveSkillChoice` additionally building a `grantedCards` array to drive a
card-grant modal — but `applyChoiceEffects` doesn't, so sidequest rewards
silently skip the modal. (That may be intentional; flagging because the
divergence is hard to spot in this layout.)

**Fix.** A single `applyEffects(fx, { sourceLabel, suppressModal })` returning
`{ logBits, grantedCards }`. Each caller pushes its own preamble and decides
whether to open the modal. Sketch:

```js
function applyChoiceEffectsCore(fx) {
  const logBits = [];
  const granted = [];
  if (fx.healFull) { setHp(maxHp); logBits.push('+full HP'); }
  if (fx.heal)     { setHp(h => clamp(h + fx.heal, 0, maxHp)); logBits.push(`+${fx.heal} HP`); }
  if (fx.loseHp)   { setHp(h => Math.max(1, h - fx.loseHp));   logBits.push(`-${fx.loseHp} HP`); }
  if (fx.maxHp)    { applyMaxHpDelta(fx.maxHp); logBits.push(`${fx.maxHp > 0 ? '+' : ''}${fx.maxHp} max HP`); }
  if (fx.loseRandomCard)  { /* …shared helper… */ }
  if (fx.gainCommonCard   && (c = pickCardByRarity({ common:   1 }))) { addToDeck(c); granted.push(c); }
  if (fx.gainUncommonCard && (c = pickCardByRarity({ uncommon: 1 }))) { addToDeck(c); granted.push(c); }
  if (fx.gainRareCard     && (c = pickCardByRarity({ rare:     1 }))) { addToDeck(c); granted.push(c); }
  if (fx.skill)            { applySkillDelta(fx.skill, 1.0); /* shared eligibleSkills filter */ }
  if (fx.grantPostcardPhrase) { … }
  return { logBits, granted };
}
```

`finalizeSkillMinigame` becomes a thin wrapper that scales `fx.skill` by the
grade multiplier (`1.0 / 0.5 / 0.25`) before calling the core, and applies
the Rough penalty afterward.

**Cost.** Small-to-medium. ~150 lines collapsed into ~50. Each call site loses
30-50 lines but gains a single wrapper.
**Benefit.** Eliminates four maintenance burdens. The maxHp clamp formula,
the loseRandomCard non-starter-pref logic, the card-grant modal hook, and
the skill-eligibility filter all live in exactly one place. Next time a new
key (`gainRelic`, say) is added, it's one branch in one function.
**Risk.** Medium. Each existing call site has subtle differences in log
formatting that need to be preserved (the leading `📜 ${event.title}` vs
`🛠 ${skill.title}` etc.). Diff carefully and run the sim before/after to
confirm no behavior change.

### 7. Combat side-effects dispatcher is forked across `applySideEffects` and `applyPowerTriggerEffects`

**What's wrong.** `applySideEffects` (`src/App.jsx:4574-4626`) handles
`block / vulnerable / weak / energy / draw / hp / loseHp / selfWeak /
enemyVulnerable / enemyDmgMod / playerDmgMod`. `applyPowerTriggerEffects`
(`4647-4678`) handles `composure / block / vulnerable / weak / energy / draw`.
The overlapping keys re-implement the same arithmetic against
`adjustEnemyDmg` / `adjustPlayerDmg`. `applyEndOfTurnPowerTriggers`
(`4695-4735`) AGAIN does the same dispatch but in working-locals form.

`applySideEffects` and `applyPowerTriggerEffects` will keep drifting (a new
key added to one might not get added to the other; the `composure` key
specifically only exists in the trigger path, which means powers can deal
composure damage but skill cards cannot).

**Fix.** Two options:
- **A.** Standardize on `applySideEffects(fx, { source, logBits })` and route
  power triggers through it. Add a `composure` key that does the same
  effectiveness-mult + block-absorb logic that `applyPowerTriggerEffects`
  currently inlines.
- **B.** Lift the working-locals pattern from `applyEndOfTurnPowerTriggers`
  into a `combatEffectsReducer(state, fx)` and use it for all three. More
  invasive but pairs nicely with #15 (rules engine).

Recommend A for now — it's an afternoon, not a week.

**Cost.** Small. ~50 lines reduction.
**Benefit.** Adding a new combat effect key becomes a one-place change.
Reduces the surface area for sim/app drift on combat effects, since the sim
already has one combined `applySideEffects`.
**Risk.** Medium. End-of-turn power triggers specifically use working locals
to batch all damage before commit (so the enemy KO check is correct). The
fix needs to preserve that property, or KO-detection becomes racy.

---

## Sim / App drift

### 8. Six Effect cards exist in App but not in sim

**What's wrong.** Comparing IDs:
- `e-calmly-explain` — App-only
- `e-cut-them-down` — App-only
- `e-devastate` — App-only
- `e-lavish-praise` — App-only
- `e-loom-over-them` — App-only
- `e-mention-the-moon` — App-only

These are presumably the recently-added Sway / Insult cards. The sim's reward
roller (`pickCardByRarity`) can never offer them, so sim playthroughs
underestimate the strength of the actual card pool.

**Fix.** Copy the card definitions (without `phrase` / `flavor` / `desc`) into
`sim/playSim.js`'s `CARDS` array. Make sure any new effect keys (`sway`,
`insult`, `swayTarget`, `tactic`, `tacticTags`, `playerComposureCost`,
`landDamage`, `backfireDamage`) get dispatched in `simCombat` / `castSpell`,
or fall back to a no-op if the sim hasn't implemented the mechanic yet.

**Cost.** Small. Mostly mechanical.
**Benefit.** Sim re-syncs with the current pool. Without this, sim win-rate
numbers in the report are a guesstimate, not a measurement.
**Risk.** Low. If the sim AI doesn't know how to use Insult/Sway cards, it
will just skip them (or play them sub-optimally) — same as it does for many
existing rare cards.

### 9. Sim doesn't model `softSpot` or `insultVulnerabilities`

**What's wrong.** `softSpot` and `insultVulnerabilities` are referenced 43
times in App.jsx (combat math, hint copy, UI) and ZERO times in
`sim/playSim.js`. Sway/Insult mechanics are invisible to the sim. Any
balancing the sim suggests (enemy HP, damage curves, win rate) is built on a
combat model that's missing two of the four active card archetypes.

**Fix.** Either:
- **A. (cheap)** Tag enemies in sim with placeholder defaults and add minimal
  sway/insult resolution that uses the same probabilities the app does. The
  AI doesn't need to be smart about choosing them — just resolve them when
  drawn.
- **B. (right)** Wait until #15 (shared rules module) and let sim consume it.

Until one of these happens, treat sim win-rate numbers with skepticism for
any deck that wants to lean on Sway/Insult.

**Cost.** Medium. Adding `softSpot` + `insultVulnerabilities` to ~15 enemy
defs in sim, plus a stub combat path. ~150 lines.
**Benefit.** Sim becomes trustworthy again for the new mechanics.
**Risk.** Low. Worst case sim AI doesn't use them well and stats look the
same as before; best case sim catches a balance issue.

---

## Performance / hygiene

### 10. Render-time recomputation in App + MapScreen

**What's wrong.**
- `reachableFromCurrent()` at `src/App.jsx:5401` runs on every App render. It
  walks `map.nodes` (via `pickNode` only — but the render-time call walks
  `map.edges`). Cheap, but it returns a fresh array, so the `reachable` prop
  changes identity on every render, defeating `React.memo` on `MapScreen` if
  it's ever added.
- `previewCastDamage()` at `src/App.jsx:5427` is called inline in the combat
  render. It re-walks all `effectSources()` and `tray.tags`. Cheap, but it
  also allocates arrays.

**Fix.** Wrap both in `useMemo` with the relevant deps (`map`, `currentNodeId`
for reachable; `tray`, `enemy`, `effectCount`, `equipment`, `relics`,
`familiar` for cast preview). The cast preview deps list is long but stable.

**Cost.** Trivial.
**Benefit.** Minor today, real once you start memoizing screen components.
**Risk.** Forgetting a dep is the usual pitfall — pass through `eslint-plugin
-react-hooks` if it isn't already on.

### 11. `effectSources()` allocates on every call

**What's wrong.** `src/App.jsx:3220-3224` rebuilds a fresh array of
`{ effect, sourceName }` on every call. It's invoked 9+ times per turn in
hot paths (start-of-combat, every enemy intent, every cast, every end-of-turn
trigger). It's small (≤6 entries), but it allocates and runs `.map` each
time.

**Fix.** Memoize on `[relics, familiar, familiarName]`:
```js
const sources = useMemo(() => {
  const arr = relics.map(r => ({ effect: r.effect, sourceName: r.name }));
  if (familiar?.bonus) arr.push({ effect: familiar.bonus, sourceName: familiarName || familiar.species });
  return arr;
}, [relics, familiar, familiarName]);
```

**Cost.** Trivial.
**Benefit.** Negligible perf, modest cleanliness.
**Risk.** None.

### 12. `spawnRemainingSpur` rolls `Math.random()` and reads outer scope inside `setMap(prev => …)`

**What's wrong.** `src/App.jsx:3914`:

```js
const rejoin = candidates[Math.floor(Math.random() * candidates.length)];
```

— inside `setMap(prev => …)`. Under StrictMode the updater runs twice;
without an idempotency guard, the *committed* rejoin will be the second-roll
value, but the first-roll value still got logged via the closure. The
top-of-function guard (`if (prev.nodes.some(n => n.id === sq-${tpl.id}-1)) return prev;`)
catches the second commit cleanly, so this is largely a no-op today, but the
pattern is risky and the saved-feedback memory called it out.

Same function reads outer `currentAct?.rows` inside the updater. That's
stable per render, so OK, but worth keeping in mind.

**Fix.** Compute the rejoin pick OUTSIDE the updater:
```js
function spawnRemainingSpur(tpl) {
  if (!tpl || tpl.nodes.length <= 1) return;
  if (map?.nodes.some(n => n.id === `sq-${tpl.id}-1`)) return;
  const totalRows = currentAct?.rows || 15;
  // … all the work that uses Math.random and reads outer state …
  const newNodes = […]; const newEdges = {…};
  setMap(prev => prev ? { ...prev, nodes: [...prev.nodes, ...newNodes], edges: { ...prev.edges, ...newEdges } } : prev);
}
```

**Cost.** Trivial.
**Benefit.** Pure updater. Easier to reason about.
**Risk.** None.

### 13. Row-Y formula inlined where the helper isn't reachable

**What's wrong.** `rowY(r, totalRows)` is defined inside `generateActMap`
(`src/App.jsx:2951`), called there 3 times, and *re-inlined* as `(totalRows
- 1) - r` in `seedSidequestSpurs` (`2992`) and `spawnRemainingSpur` (`3894`).
The first inline already cost a bug (the original rowY scope error). The
second one is fine but identical math.

**Fix.** Hoist `rowY` (and `spacedX`) to module-level helpers. Three lines.

**Cost.** Trivial.
**Benefit.** Prevents the next "I'll just inline this" mistake from drifting.
**Risk.** None.

---

## Architecture

### 14. Sub-screen components are a natural extraction seam

**What's wrong.** Beyond the bug count, the App.jsx file is 7449 lines, of
which ~2100 lines (5442-7449) are presentation-only sub-screens:
`MenuScreen`, `MapScreen`, `CombatScreen`, `EventScreen`, `RewardScreen`,
`SidequestNodeScreen`, `PostcardModal`, `InsultPromptScreen`,
`TraceWhittlingMinigame`, `CraftingScreen`, `RestScreen`,
`UpgradeCardScreen`, `ActClearedScreen`, `GraduationScreen`, etc.

These components take props and return JSX. They don't touch the App's local
state. Moving each one (or each *group*) to a sibling file is mechanical —
no refactor of game logic, just `import` rewiring.

The single-file ethos came from CLAUDE.md's "data, helpers, game logic, and
UI in one place" guideline. At 7449 lines, scrolling between the boss combat
function (`applyEnemyIntent` ~4912) and the boss combat UI (`CombatScreen`
~5949) is real friction. Splitting the *screens* off keeps all data + game
logic together while pulling out 2k lines of JSX.

**Fix.** Create `src/screens/` with:
- `screens/MenuScreen.jsx` + `TutorialOverlay` + `TutorialCompleteScreen`
- `screens/SupplyShopScreen.jsx` + `FamiliarShopScreen` + `FamiliarNameScreen` + `StartingPicksScreen`
- `screens/MapScreen.jsx` + `nodeColor` + `nodeGlyph` + `nodeLabel` + `nodeTooltip` + `Legend`
- `screens/CombatScreen.jsx` (big one)
- `screens/EventScreen.jsx` + `RewardScreen` + `CardGrantScreen` + `RestScreen` + `UpgradeCardScreen` + `UpgradeConfirmModal` + `UpgradePreviewCard`
- `screens/CraftingScreen.jsx` (3 sub-phases)
- `screens/SidequestNodeScreen.jsx` + `SidequestOfferScreen` + `PostcardModal`
- `screens/MaterialChooseScreen.jsx` + `SkillEventScreen`
- `screens/InsultPromptScreen.jsx` + `TraceWhittlingMinigame`
- `screens/ActClearedScreen.jsx` + `GraduationScreen` + `EndScreen`

Each file imports the lookup constants it needs (`SLOT_LABEL`, `CRAFT_LABEL`,
`SLOT_EMOJI`, etc.) from a new `src/data/labels.js` or similar.

App.jsx drops from ~7450 lines to ~5350 lines. Each screen file is 50-450
lines.

**Cost.** Medium. Mostly cut-paste; the risk is missing an import or breaking
a closed-over helper. Do it in one sitting with the dev server open and
click through every stage. A clean Vite build is NOT sufficient (per saved
feedback) — actually click each screen.

**Benefit.** Discoverability: where do you go to change combat UI? `CombatScreen.jsx`,
obvious. Right now you scroll. Adding new screens (e.g. a sidequest journal,
a postcard archive) becomes a new file instead of growing the monolith.

**Risk.** Medium. Each screen has closures back into App that need to be
turned into props. Most already are; the ones that aren't (`nodeLabel` inside
`pickNode`'s log message?) are easy to spot.

### 15. The shared-rules module question (defer for now)

**What's wrong.** Sim and App both define CARDS (lines 46-500 in App, 22-163
in sim), ENEMIES (735-971 in App, 175-355 in sim), ACTS, MATERIAL_TEMPLATES,
QUALITY_MULT, and the combat resolution math. Already we have 6 cards
missing from sim (#8) and zero coverage of softSpot/insult in sim (#9). Every
new mechanic ships twice. Every balance change risks divergence.

**Fix.** Create `src/rules/` (importable from both):
- `cards.js` — the pure data of `CARDS`, plus `CARDS_BY_ID`, `pickCardByRarity`.
- `enemies.js` — `ENEMIES`, `ENEMIES_BY_ID`, `rollIntent`, `pickActEnemyId`.
- `combat.js` — pure `castSpell({ tray, effectCard, enemy, modifiers }) → { dmg, riders, … }`. No React. Sim consumes directly; App wraps state mutations around it.
- `crafting.js` — `buildCraftedEquipment`, `salvageMaterial`, `QUALITY_MULT`.
- `materials.js` — `MATERIAL_TEMPLATES`.
- `events.js` / `sidequests.js` / `relics.js` — same shape.

The sim continues to drive AI/simulation; both sides import the rule
primitives.

**Cost.** Large. This is the biggest item in the document. Expect 2-3 days of
focused work, plus a sim re-baselining pass to confirm numbers.

**Benefit.** Huge over the next 6 months of iteration. Every "did I update
both?" anxiety goes away. The next mechanic (postcards, sidequest events,
crafting variant) is implemented once.

**Recommendation.** **Defer until after #6 (DRY choice-effects).** Reason: the
choice-effects dispatcher is in App-state territory (setHp, setMaxHp, etc.)
and cleanly separating "rules" from "react state mutations" is easier once
that one effect path is consolidated. Doing #15 first means designing two
abstractions at once; doing #6 first means #15's combat module just has a
single dispatcher shape to mirror.

---

## Recommended sequence

1. **One-sitting bug fixes first**: #1 (staged-word loss), #2 (insult timer),
   #3 (supply picks), #4 (composure KO), #5 (delete `applyDamageToPlayer`).
   Total: maybe 90 minutes. These are the highest signal-to-noise wins.
2. **Hygiene**: #11 (memo effectSources), #12 (spawnRemainingSpur purity), #13
   (hoist rowY). Another 30 minutes.
3. **Sim re-sync**: #8 (copy the 6 missing cards). 30 minutes.
4. **DRY pass**: #6 (unify choice-effects). Half a day. Run sim afterward to
   confirm no regression.
5. **DRY combat**: #7 (unify side-effects dispatcher). Pair with the next
   feature touch — the change is mechanical but each effect key needs
   per-key checking.
6. **Sub-screen split**: #14. Half-day. Defer if no actual pain.
7. **Sim/App rules module**: #15. Defer until #6/#7 land; revisit after the
   next 2-3 features ship to measure the actual drift cost.

#9 (sim softSpot) is a judgment call: do it now if you trust sim balance
numbers for decisions; defer if sim is more a smoke test than a balance
tool.

---

## Things I considered and rejected

- **TypeScript migration.** Not now. The data shapes are evolving fast (Sway
  and Insult landed in the last few commits, each introducing new keys);
  freezing them in types is premature. Revisit after #15.
- **A formal state machine for `stage`.** The stage transitions are tangled
  but the count of stages is small enough that a literal `if (stage === …)`
  block is fine. Don't pull in xstate for ~15 stages.
- **`useReducer` for player state.** Tempting given the 30+ useState hooks,
  but the per-field setters compose well with the existing code, and a
  reducer would force a big rewrite of every effect dispatcher. Revisit
  alongside #15.
- **Sim AI rework to handle Sway/Insult.** Out of scope for an architecture
  pass. Item #9 already flags the drift; the AI's gameplay quality on the new
  cards is a balance question, not architecture.
- **Splitting CARDS / ENEMIES / SIDEQUESTS into their own files within
  App.jsx's import graph.** Reasonable but premature without #15. Doing it
  before #14 just adds files without reducing the size of the function
  bodies, which is where the actual reading-burden is.
