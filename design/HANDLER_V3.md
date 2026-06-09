# Handler v3 — the team you form, retain, and buff

Greenlit 2026-06-08. The handler-fun rework. See memory
`project_wg_handler_v3_feeding_lures`. The menagerie stops being a conveyor of
disposable summons and becomes a TEAM you draft, deploy, maintain, buff, and
spend on your terms.

## Locked decisions (Alan)

- **Feed action = species-feed.** One feed button costs **1 energy** and feeds
  **every on-board copy of a chosen species** (resets their feed timer). Rewards
  monoculture/spam; a diverse team pays per-species. Replaces feedKey feed-CARDS
  entirely (the wizard has a baked-in "feeding spell").
- **Missed feed = hard deadline.** Same "needs food" warning turn as today, but
  if that turn is **missed**, the animal **leaves next turn no matter what** —
  feeding it afterward does NOT save it.
- **Lures single-use** — summoning removes the lure from the deck; it returns to
  **hand** when the animal leaves (death / sacrifice / unfed-departure / expiry).
- **Animals persist** while fed — no timer expiry once the feed model is in.
- **No animal HP** — combat stays attack/block/absorb/reflect. Enemies target
  animals; defensive keepers INTERCEPT (absorb), removing the animal only if the
  hit breaks through.
- **Exit bonus fires on sacrifice** — sacrifice is how you deliberately cash an
  animal's (now bigger, build-around) exit bonus; the lure returns to redeploy.
- **Powerhouse philosophy:** a buffed powerhouse animal is a valid win-con, but
  you WORK for it (energy/feed/cards/turns) and it can FAIL (enemies snipe it).
- **Roles not tiers:** every animal best-in-game at one job (e.g. a mouse hits
  soft but has a spammable exit). Lure pools narrow 3→2; narrowing tools survive.
- **Lure ceiling:** cap distinct lure TYPES in the deck (not total) — commit to a
  team; multiples of one type allowed.

## Build slices (each lands coherently; mirror every mechanic in the sim)

### Slice 1a — single-use lures ✅ DONE (2026-06-08, committed + pushed)
Live + sim, 55 e2e green incl. single-use-lures.spec.js proving the return
invariant. sourceLures ride each animal; returned at every departure
(exit/short-stay/maul/sacrifice×2/Make-It-Count/eaten-prey/betray) + carried
through chain/roll/swoop/combine + combat-end sweep. Original design below.

### Slice 1a — single-use lures (FIRST: safe, fork-independent foundation)
Lure leaves the deck on summon; returns to hand on the animal's departure. Works
with the CURRENT duration model (departure-returns-the-lure → never stranded),
so it ships before feeding. The plumbing it establishes (track each animal's
source lure; return on every departure) is the prerequisite for everything else.

Implementation (App.jsx end-of-turn tick is the hot zone):
- Stamp `slot.sourceLureId` (string) when a lure transforms into an animal
  (normal tick transform + `eatItClickSlot` instant path). Do NOT recycle the
  lure card to discard anymore — remove it (single-use).
- `returnLure(slot)` helper → if `slot.sourceLureId`, mint a fresh copy of that
  lure card (uid()) into a return-to-hand buffer. Identical card ids, so minting
  by id is fine (no need to thread the exact object).
- Call `returnLure` at EVERY departure (lost-lure = unwinnable-state bug):
  natural exit, short-stay (unfed), maul-tear, sacrifice (both
  `sacrificeAnimalFromSlot` + `sacrificeAnimalForBlock`), hawk/owl eats-adjacent,
  betray-steal.
- Carry `sourceLureId` THROUGH transforms that keep the animal alive:
  predator-chain (salmon→bear), predator-roll, in-place upgrades.
- COMBINE (3 lures → 1 animal): collect the 3 source ids into
  `slot.sourceLureIds[]` on the combined slot; return ALL on its departure.
  Adjacent-spawned copies (rabbit) have NO source lure → return nothing.
- Flush the return-to-hand buffer into the new hand at the refill block (same
  spot whisper draws fold in).
- Mirror in `sim/playSimV2.js` handler tick; e2e: summon → lure leaves hand/deck;
  animal departs → lure back in hand.

### Slice 1b — feeding-as-button + persist  ✅ DONE (2026-06-08)
Live + sim. Species-feed button (1E resets the timer = persist); keepers persist
with no feeding; missed-feed is a hard deadline; drag-feed slots removed. Fixed a
pure-updater energy-deduction bug. e2e feed-persist.

Replace feedKey feed-cards with the species-feed button (1E, resets the species'
feed timer). Reinterpret the feed timer: instead of counting down to exit, it
counts down to "needs food"; feeding resets it; a missed needs-food turn commits
the animal to leave next turn (unfeedable). Animals with no feed need = keepers
(Ox) stay low-maintenance. Single-use lures now shine (lure gone for a long time).

### Slice 2 — buff/economy layer  ✅ PARTIAL DONE (training powers, 2026-06-08)
Sergeant-at-Arms (+1 atk/turn to the strongest animal) + Quartermaster's Regimen
(+1 block/turn, prefers a keeper) — merged. The Trough (feed-banking) still TODO
(depends on the now-landed feeding model). e2e training-powers.

Training-engine POWERS (+1 atk or +1 block/turn to one animal each turn). The
Trough (feed-banking reservoir — rename the existing troughFeed card). Escalating
-cost training already shipped (Whet the Claws / Thicken the Hide).

### Slice 3 — exit-on-sacrifice  ✅ DONE (2026-06-08)
Sacrifice now also fires the animal's onExit bonus (ADDITIVE on top of Block/
Memorial — tunable; Alan may later UNIFY). Sacrifice pill previews the payoff.
Merged. e2e exit-on-sacrifice.

Sacrifice fires the animal's exit bonus (unify with the current Block/ Memorial
payoff, don't pile a 3rd reward). License to make exit bonuses big. Watch the
farm loop (cheap animal + strong exit + returning lure) — gate strong exits
behind slow/expensive-to-redeploy animals.

### Slice 4 — enemies target animals + interception (no HP)  🔄 IN PROGRESS (agent)
Keeper-taunt model (a keeper intercepts maul; survives if Block absorbs, else it's
the one removed). Building. TODO after merge: name the SPECIFIC maul victim in the
intent bar (Alan: 'your strongest' is unclear when block vs attack differ).

Enemy target-selection AI; a targeted hit is absorbed by the animal's Block/
thorns first, removes it only if it breaks through. Keeper = the answer.
Guardrail: PRESSURE not ERASE — always an affordable line to keep some board.

### Slice 5 — roles-not-tiers rebalance  ✅ FIRST PASS DONE (2026-06-08)
Every feedable animal a distinct job (mouse=cycler/fodder w/ bumped exit, buck=
burst, rabbit=swarm, goose=hitter, raven=armor-strip, scrubjay=disruptor). Pools
3→2 (Tender Greens={mouse,buck}, Birdseed={goose,raven}); dropped rabbit/scrubjay
→ new single-species lures (A Clover Patch / A Shiny Bauble). 60 e2e green.

OPEN ITEMS after slice 5:
- **Lure ceiling** (cap distinct lure TYPES) — deferred, not built.
- **Acquired Taste went inert** — narrowing needs a 3+ species pool; both are now
  2, so it no-ops+exhausts. Pull/repurpose, or revive when a 3+ pool is added.
- **Farm loop watch** — mouse exit + exit-on-sacrifice + lure-return; intended
  Sacrifice archetype, gated by tempo. Tune mouse exit if degenerate.
- **Keeper intercepts EVERY maul** unconditionally (slice 4) — dial to first-per-
  turn / sometimes if desired.
- **Tune the whole world** now that all slices are in (Alan: 'both feet in, then tune').

Original scope below.

### Slice 5 — animal role rebalance (ongoing)
Every animal a distinct job; narrow pools 3→2; lure ceiling; maybe a starting
animal-school (a lean, not a lock — ties to the character-select opening).
