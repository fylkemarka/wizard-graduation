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

## 3. Current implementation state (MVP3)

### Working (MVP1 + MVP2 + MVP3)
- **Single-file App** (`src/App.jsx`) like Arcane Workshop's pattern
- **Combat loop** — Energy, Block, HP, Hand, Deck, Discard, Exiled. 5-card
  hand at start of turn, 3 base energy, block resets at end of turn
- **Intent system** — every enemy turn rolls a weighted random behavior;
  next-turn intent shown above the enemy
- **Status effects** — Vulnerable / Weak on enemy (player-debuffs flavored
  but not yet mechanical)
- **Card rewards** — 3-card draft after non-boss combat; elite combats
  weight toward uncommon + rare; skip is allowed
- **Branching DAG map** per act — `generateActMap(rows, width)` makes a new
  one per act. Node types: combat / elite / rest / event / forge-basic /
  forge-fine / boss / start
- **Equipment system** — `EQUIPMENT[slot][tier]` for staff / robes / gem /
  ring. Bonus payload keys: `strikeBonus`, `startBlock`, `maxHp`,
  `healOnCombatStart`, `extraStartHand`, `energyOnCombatStart`,
  `permanentEnergyBonus`. Read by combat loop at the right hooks
- **Acts 1-4** — Staff Path / Thread Path / Stone Path / Forge Path. Each
  has its own enemy pool (filtered via `enemy.act`), unique boss, and
  master-tier reward
- **Run chain** — boss kill → `act-cleared` screen → advanceToNextAct →
  next act's map. Heals 25% max HP between acts. Final act → graduation
- **Forge nodes** — at rows/3 (basic) and 2*rows/3 (fine), player chooses
  to claim the tiered equipment OR skip toward the boss for master
- **Events** — 8 starter events covering heal / loseHp / maxHp / random
  card by rarity

### Data tables
- `CARDS` — 19 cards across rarity tiers (basic / common / uncommon / rare)
- `STARTER_DECK` — 4 Strike, 3 Defend, 2 Spark
- `ENEMIES` — 24 total: 18 act-specific normals + elites, 4 act bosses,
  remaining slots for variety. Each has `act` (1-4) and `tier` (normal /
  elite / boss). Stats scale: act 1 ~20 HP enemies, act 4 ~70 HP elites,
  bosses 60→80→100→130
- `EQUIPMENT` — full 3-tier ladders for all 4 slots
- `EVENTS` — 8 events with 2-3 choice payloads
- `ACTS` — 4 acts with `id`, `slot`, `name`, `flavor`, `rows`, `width`,
  `bossId`

### Not yet built
- **MVP4** — Powers (on-field state cards), relics, card upgrades at rest
  sites, more enemy variety per act
- **MVP5** — Five wizard schools as playable classes with distinct
  mechanics (Strength stacks / Block scaling / Stances / Heal-spec /
  Summoner)
- **MVP6** — Ascension difficulty ladder, run-persistence, leaderboards

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

## 4½. Tone — Terry Pratchett wizard humor

The flavor target for this game is **Pratchett, leaning Unseen
University**. Every piece of flavor text should aim for the
Pratchett rhythm: pompous setup → wry undercut → quiet observation
that recasts the joke. Examples:

> *Ostensible Inferno* — "The fire is technically there. The
> fire-flavoured atmosphere certainly is."
>
> *A Strongly Worded Letter* — "You will hear from the Bursar.
> Probably. He hasn't replied yet either."
>
> *Mildly Threatening Demeanour* — "You haven't done anything yet.
> But you might."

Tone guidance for adding content:

- **Names**: prefer formal-but-slightly-absurd. "Octarine Squint",
  "Inadvisable Acceleration", "The Significant Pause", "An Old
  Tome" (re-titled in flavor as BORROWED — RETURN BY THE EQUINOX
  OR FACE THE STACK CRONE).
- **Card flavor**: 1-2 short sentences. Never explain the mechanic.
  Always undercut something. If you mention magic, immediately
  qualify it.
- **Event flavor**: setup ("A figure in slightly-too-grey robes
  waits at a fork in the path") → middle ("They produce a card
  from a satchel") → undercut ("with the air of someone who has
  rehearsed this. Twice.").
- **Choice labels**: short, observational. "Refuse politely. They
  expected this."
- **Avoid**: epic-fantasy tone, grimdark, anime-style boast cards,
  long titles full of capitalised Significance.
- **Embrace**: bureaucracy of magic, footnote-style asides without
  footnotes, certifications and committees, donations bowls
  emptied daily, the school's bursar.

Card *mechanics* should be readable and STS-clean; tone goes in
`flavor` (a separate field on the card) and event flavor blocks.

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
| 2 ✓ | Act 1 (Staff Path) branching DAG with node types + boss equipment reward |
| 3 ✓ | Acts 2-4 + equipment tiers (basic/fine/master) + full run loop |
| 4 | Powers (on-field state), relics, rest sites with heal-or-upgrade, more enemy variety per act |
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
