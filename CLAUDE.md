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

## 3. Current implementation state (MVP5)

### Working (MVP1 + MVP2 + MVP3 + MVP4 + MVP5)
- **Single-file App** (`src/App.jsx`) like Arcane Workshop's pattern
- **Combat loop** — Energy, Block, HP, Hand, Deck, Discard, Exiled. 5-card
  hand at start of turn, 3 base energy, block resets at end of turn
- **Intent system** — every enemy turn rolls a weighted random behavior;
  next-turn intent shown above the enemy
- **Status effects** — Vulnerable / Weak on enemy AND player
- **Verbal combat (MVP5)** — the heart of the game. Cards now come in
  four types: WORD (phrase-fragment, contributes stat points to a "spell
  tray"), EFFECT (seals the tray and casts a spell), SKILL (utility, no
  spell contribution), POWER (installs on-field). The three stats are
  **Chutzpah** (bravado / intimidation), **Wit** (cleverness / convince),
  and **Jnsq** (je-ne-sais-quoi, chaos / confuse). Effect cards declare
  what they `scaleBy`, plus a `base` and `multiplier`. Damage =
  `(base + tray[scaleBy] * multiplier) * enemy.effectiveness[scaleBy]`.
  Spell tray clears at end-of-turn — if you played word cards without
  casting an effect, the spell **fizzles** (log says so, no damage).
  Enemies have **Composure** (verbal HP) and **HP** (physical HP — most
  enemies are effectively physical-immune by default; a few aren't).
  Defeat = composure ≤ 0 OR HP ≤ 0. Enemies have a per-stat
  `effectiveness` map: 1.0 = baseline, 0 = **immune** (a Lich does not
  laugh — chaos and bluster slide off entirely), >1 = susceptible,
  <1 = resistant. Physical Effect cards (Spark / Magic Missile / Sword
  Logic) exist for wizards who still want to throw something at
  Constructs, Thickets, Beetles, etc.
- **Card rewards** — 3-card draft after non-boss combat; elite combats
  weight toward uncommon + rare; skip is allowed
- **Branching DAG map** per act — `generateActMap(rows, width)` makes a new
  one per act. Node types: combat / elite / rest / event / material / skill /
  boss / start. Material nodes seed at rows 3/7/11 and skill nodes at rows
  5/9 (the rest of the rows roll through `pickNodeType`). Forge nodes were
  removed — equipment now comes from the crafting screen (Commit 3 of the
  crafting system; until then, boss kills auto-grant Master placeholder).
- **Equipment system** — `EQUIPMENT[slot][tier]` for staff / robes / gem /
  ring. Bonus payload keys: `strikeBonus`, `startBlock`, `maxHp`,
  `healOnCombatStart`, `extraStartHand`, `energyOnCombatStart`,
  `permanentEnergyBonus`. Read by combat loop at the right hooks
- **Acts 1-4** — Staff Path / Thread Path / Forge Path / Milliner's Path.
  Each has its own enemy pool (filtered via `enemy.act`), unique boss,
  and Master-tier equipment reward. Slot order: staff → robes → ring →
  hat. Each act is ~15 rows long.
- **Run chain** — boss kill → `act-cleared` screen → advanceToNextAct →
  next act's map. Heals 25% max HP between acts. Final act → graduation
- **Equipment progression** — staff/robe/gem/ring are Master tier only,
  granted on each act's boss kill. The basic and fine tiers in
  `EQUIPMENT[slot]` are kept in the data table but currently unreachable
  (no forge nodes route to them). They're handy if we ever reintroduce
  alternate equipment paths.
- **Events** — 8 starter events covering heal / loseHp / maxHp / random
  card by rarity

### Data tables
- `CARDS` — 19 cards across rarity tiers (basic / common / uncommon / rare)
- `STARTER_DECK` — 4 Strike, 3 Defend, 2 Spark
- `ENEMIES` — 24 total: 18 act-specific normals + elites, 4 act bosses,
  remaining slots for variety. Each has `act` (1-4) and `tier` (normal /
  elite / boss). Stats scale: act 1 ~20 HP enemies, act 4 ~70 HP elites,
  bosses 60→80→100→130
- `EQUIPMENT` — staff / robes / ring / hat at 3 tiers each (basic / fine / master). The auto-Master-on-boss flow uses Master tier here as a placeholder while the crafting system (planned: gather materials + skills along the act → crafting minigame at boss kill → equipment card enters deck) is being built. Gem slot data orphaned for possible reuse.
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

## 4¼. Stat identities — the three playstyles

The three combat stats are not interchangeable. Each has a
distinct playstyle that all new card design routes through.

**Chutzpah — the Ironclad.** Risk damage to deal damage. Trade HP
for output. "All-in" energy; bravado, posturing. Mechanical
levers: `loseHp` on play, low-HP scaling, drop-block-for-attack,
double-down riders that punish if the spell didn't kill. Reward
profile: huge damage if it lands.

**Wit — the defender.** Play safe, get out clean. Build slow,
finish strong. Card text: rhetorical, elaborate, footnoted.
Mechanical levers: block on effect, card draw / cycling, scaling
that grows with the length of the spell played this turn,
late-spell payoff. Reward profile: small early hits, big hits if
you string words together.

**Je ne sais quoi — the drunken wizard.** Lean into variance.
Coin-flip outcomes, but with dice loaded in the player's favour.
Card text: chaos-magic, non-sequiturs, "this might be a spell,
who can say". Mechanical levers: random outcomes, weighted
gambles (70/30 with a real downside), random stat boosts,
future-payment costs ("borrow tomorrow's confidence"). Reward
profile: variance high, EV slightly positive.

New effect keys this framework will need: `loseHp`,
`bonusPerWordThisTurn`, `chance: { prob, success, failure }`,
`randomStatBonus`. Add to the `applyEffects` / `playCard`
dispatcher when the first card using each key lands.

Don't design stat-agnostic filler. Every new card should commit
to one of these three identities — that's where the strategy
comes from.

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
| 4 ✓ | Powers (4a), relics + card upgrades + player debuffs (4b), map fog of war (4c), town intro / supply shop / familiar shop / naming (4d) |
| 5 ✓ | Verbal combat: word + effect card types, three stats (chutzpah/wit/jnsq), spell tray, fizzle, composure, per-stat effectiveness incl. immunity, physical Effects for the chuck-it-anyway path |
| 6 | Five wizard schools as playable classes with distinct mechanics |
| 7 | Ascension-style difficulty ladder, run-persistence, leaderboards |

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
