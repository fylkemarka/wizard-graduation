# Wizard Graduation — Design Context

Single-player STS-inspired roguelike deckbuilder, pivoted from the multi-player
co-op prototype **Arcane Workshop** (`~/Projects/arcane-workshop/`). Alan is
the designer; you (Claude Code) are the implementer.

## 1. Pitch

> Apprentice wizard sets out from the school on a path of trials. To
> graduate, they must return with their **staff**, **robes**, **gem**, and
> **ring(s)** — each won from its own trial-path that escalates as it goes
> deeper. Lower-tier versions of each piece are claimable earlier; the
> master tier comes from defeating the act's boss-trial. Cards are earned,
> not bought.

## 2. Origin

This project is a **pivot** from Arcane Workshop after a long playtest
arc revealed:

- The tile-board generation, co-op multi-player, and instability dial were
  fun but stretched thin against the deckbuilder-vs-boss core
- Slay the Spire's path-and-choices map + intent telegraph + card-reward
  draft loop are tighter and more decision-rich
- Single-player keeps balance tractable while the design hardens

Mechanics being **carried over** from Arcane Workshop:
- Staff / robe / gem / ring crafting as the equipment-progression spine
- Cinzel/Cormorant + parchment palette
- Some card identities (Strike, Spark, Defend lineage)

Mechanics **dropped** vs Arcane Workshop:
- Tile-based board (replaced with STS branching DAG)
- Multi-player (single only)
- Familiar system (no companion for MVP)
- Wizard schools (deferred — one Apprentice for MVP1; schools come back later
  as distinct STS-style playable classes)
- Instability dial / surge deck (gone — STS-style intent telegraph instead)
- Hat slot (out — equipment is staff / robes / gem / ring(s) only)

## 3. Current implementation state (MVP1)

### Working
- **Single-file App** (`src/App.jsx`) like Arcane Workshop's pattern
- **Combat loop** — Energy, Block, HP, Hand, Deck, Discard, Exiled. 5-card
  hand at start of turn, 3 energy, block resets at end of turn (per STS)
- **Card play** — `playCard(handIdx)` dispatches `effects` payload through a
  small set of keys: `attack` / `block` / `draw` / `vulnerable` / `weak` /
  `energy` / `exhaust`. Easy to extend
- **Intent system** — every enemy turn rolls a weighted random behavior;
  next-turn intent shown above the enemy
- **Status effects** — `Vulnerable` on enemy (+50% damage taken),
  `Weak` on enemy (its outgoing attack -25%). Both tick down at end of turn
- **Card rewards** — after a non-boss combat, draft 3 cards weighted toward
  common (4:1 vs uncommon). Skip is allowed
- **Fight queue** — `MVP_FIGHT_QUEUE` array of enemy IDs, played in order:
  Acolyte → Imp → Tutor → Thornlord (boss)
- **End screens** — Victory ("Graduation Achieved") and Defeat
- **Setup → run → defeat/victory → restart** loop complete

### Data tables
- `CARDS` — 14 cards across rarity tiers (basic / common / uncommon / rare)
- `STARTER_DECK` — 4 Strike, 3 Defend, 2 Spark
- `ENEMIES` — 4 (3 regular + 1 boss). Each has `behaviors` (weighted list of
  intent rolls)
- `MVP_FIGHT_QUEUE` — placeholder linear sequence; replaced by the Act 1 map
  in MVP2

### Not yet built
- **MVP2** — Act 1 branching DAG map (STS-style), node types (combat / elite
  / rest / event / boss), node selection, tier-1 equipment rewards from
  midway nodes
- **MVP3** — Acts 2-4 (Robes / Gem / Ring paths), equipment-tier system
  (basic / fine / master), full graduation run
- **Eventually** — five wizard schools as STS-style playable classes,
  Powers (on-field state cards), more enemy variety, run-persistence

## 4. Architecture notes

### File layout
```
wizard-graduation/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── README.md
├── CLAUDE.md
├── index.html
└── src/
    ├── main.jsx     — React entry
    ├── App.jsx      — game + UI (single-file for now)
    └── index.css    — Tailwind + theme
```

### Conventions
- Effect keys grow over time. Add new keys to **`CARDS` data** AND **the
  dispatch in `playCard`** AND **`applyEnemyIntent`** (if enemy-applicable)
- `uid()` is a process-local counter; fine for a single-player game with
  no persistence. Once we add save/load this needs to change
- All state is in `App` — no Redux/context. Refactor when systems stabilize
- `pushLog(s)` appends to a 20-line log buffer rendered at the bottom

### Important state contracts
- **Block resets to 0 at end of turn** — applied in `endTurn()`. This is
  THE structural difference vs Arcane Workshop's persistent Defense
- **Discard reshuffles into Deck when empty** — handled in `drawFromPiles`
- **Exiled cards return to deck at end of combat** — MVP1 simplification.
  Real STS-style exile-per-run will land when run-persistence does
- **Intent is rolled at start of enemy turn** (= immediately after a player
  ends turn) so the player sees what's coming on their next turn

## 5. User preferences

Same as Arcane Workshop:
- **Honest pushback** preferred over "yes and"
- **Ship fast, iterate** — don't pre-polish
- **Tight scope** — no feature bloat
- He'll occasionally drop reference material (STS analysis, etc.)
- **Single-player roguelike** is the target experience — solo session, ~20-30 min

## 6. Roadmap

| MVP | Scope |
|---|---|
| 1 ✓ | Combat loop, intent, card rewards, linear fight chain |
| 2 | Act 1 (Staff Path) branching DAG with node types + boss equipment reward |
| 3 | Acts 2-4 + equipment tiers (basic/fine/master) + full run loop |
| 4 | Powers (on-field state), relics, rest sites with heal-or-upgrade |
| 5 | Five wizard schools as playable classes with distinct mechanics |
| 6 | Ascension-style difficulty ladder, run-persistence, leaderboards |

## 7. How to work on this

### Add a new card
1. Append to `CARDS` with `id` / `name` / `cost` / `type` / `rarity` /
   `effects` / `desc`
2. If `effects` uses a new key, branch it in `playCard`'s dispatcher
3. Card auto-rolls into the reward pool if rarity ∈ common/uncommon

### Add a new enemy
1. Append to `ENEMIES` with `id` / `name` / `maxHp` / `behaviors`
2. Each behavior: `{ kind, value, weight, telegraph, count? }`
   - `kind` ∈ `attack` / `attack-multi` / `block` / `vulnerable` / `weak`
3. If `kind` is new, branch it in `applyEnemyIntent`
4. Add to `MVP_FIGHT_QUEUE` if you want it in the linear chain (MVP1) or
   wait for the act-map (MVP2)

### Things NOT to do without asking
- Multi-player support
- Tile-board generation
- Familiar system
- Persistent meta-progression beyond per-run

When in doubt, ask Alan.
