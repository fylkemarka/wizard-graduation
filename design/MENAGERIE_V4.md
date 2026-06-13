# Menagerie v4 — animals-as-cards (Alan, 2026-06-13)

A full replacement of the handler combat loop. Goal: give the handler the
**legible per-turn agency** the wit lane has — *you* build a volley and *you*
fire it, instead of oiling an engine that attacks by itself.

## Core loop
- **Animals are cards.** Playing an animal card stages it on the board (an open
  slot) immediately. No lures, no arrival delay, no predator chains.
- **CAST** (new button): every staged animal resolves — deals its `attack`
  (composure), grants its `block`, runs its `onCast` ability. Then unfed animals
  **leave**; fed animals **stay** (and their fed flag clears, so they must be
  re-fed to persist again). CAST is repeatable in a turn (energy is the limiter:
  you pay to play more animals, then fire again).
- **End Turn = an implicit CAST**, then the enemy acts. So the default rhythm is
  "play animals → end turn fires them."
- **Feed** (the existing 1-energy species action): mark a staged animal to
  survive the next cast. The only way to carry an animal across casts/turns —
  the setup lever for combos and for big animals you want to fire twice.
- Animals are **single-use** by default: a damage/defense card that happens to
  sit on the board for a beat (so combos can read it) before it fires and goes.

## Resolutions of the open questions
- **Does CAST clear?** Yes — CAST resolves AND clears unfed animals (feeding is
  the documented exception, point 3). Repeatable per turn.
- **Board size:** the existing 3 slots (the old tray). A volley is up to 3
  animals unless something says otherwise. Keeps positioning/adjacency meaningful.
- **Damage pool:** composure (the handler's win condition), as today.
- **Defense:** animal `block` is the handler's defense verb now — you stage a
  defensive animal and CAST converts it to Block. Clean replacement for the
  old (deleted) Shield stance.

## Combos
Animals carry `tags` (bird / land / predator / small / defensive). A combo
**only fires if you've drafted+installed its COMBO CARD** (a power). Once
installed, every CAST that meets the combo's board condition adds the payoff.
This is the wit-style legibility: draft a combo + the animals that feed it, and
your deck has a visible plan. Starter has none — combos are earned.

## Starter deck (best guess — to be tuned)
Cheap, balanced, teaches "stage → cast", with one feed and a draw engine:
- 2× **Field Mouse** (0E, 2 comp, draw 1) — the cheap cycler/tempo
- 2× **Rabid Scrubjay** (1E, 4 comp) — bread-and-butter offense
- 1× **Young Buck** (1E, 5 comp) — a bigger hitter
- 2× **Porcupine** (1E, 5 block + 2 thorns) — the defensive animal
- 1× **Sheepdog** (1E, 4 block, herds +2) — defense that buffs the volley
- 1× **Goose** (1E, 3 comp + Weak 1) — utility/control
- (+ the shared `c-defend-handler` stays as a non-animal block card? NO — block
  is animals now. Starter is all animals + maybe 1 generic.) 

## What's deleted / parked from v3
Lures, arrival timers, predator chains, salmon gamble, tactics (shield/rabid/
youth/nurture/feather), the training/sacrifice/monoculture engines, exit
bonuses, maul-targets-animals (animals fire same-turn, rarely linger). These
were engine-maintenance verbs — the opposite of what v4 is for. Cards kept in
data but off the v4 pools; revisit individually if a mechanic earns its way back.

## Sim
The sim's handler engine models v3 and will be WRONG for v4 — it needs its own
rewrite (next chunk) before the tuning loop can resume on the handler. Guarded
so `node sim` doesn't crash in the meantime. Wit lane unaffected.
