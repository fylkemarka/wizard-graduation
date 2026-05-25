# Witch Mountain Bridge — Design Context

> Formerly **Wizard Graduation**. Folder path, repo, and Vercel subdomain still
> use the old slug; display name is Witch Mountain Bridge everywhere user-facing.

Single-player STS-inspired roguelike deckbuilder. Pivoted from a co-op tile-board
prototype. Alan designs, Claude Code implements.

## 1. Pitch

Apprentice wizard sets out from the school on a path of trials. To graduate, they
must return with **staff**, **robes**, **gem**, and **ring(s)** — each won from
its own trial-path. Lower tiers claimable earlier; master tier from the act boss.
Cards are earned, not bought.

## 2. Current state (MVP5)

### Working
- **Single-file App** (`src/App.jsx`)
- **Combat loop** — Energy, Block, HP, Hand/Deck/Discard/Exiled. 5-card hand,
  3 base energy, block resets end-of-turn
- **Intent system** — enemy rolls weighted behavior; next-turn intent shown
- **Status effects** — Vulnerable / Weak on enemy AND player
- **Verbal combat (the heart of the game)** — four card types:
  - **WORD** — phrase-fragment, contributes stat points to a "spell tray"
  - **EFFECT** — seals the tray and casts; declares `scaleBy` + `base` + `multiplier`
  - **SKILL** — utility, no spell contribution
  - **POWER** — installs on-field
  Three stats: **Chutzpah** (bravado), **Wit** (cleverness), **Jnsq** (chaos).
  Damage = `(base + tray[scaleBy] * multiplier) * enemy.effectiveness[scaleBy]`.
  Tray clears end-of-turn; words without an effect **fizzle**.
  Enemies have **Composure** (verbal HP) and **HP** (most are physical-immune by
  default). Defeat = either ≤ 0. Per-stat `effectiveness` map: 0 = immune, >1
  susceptible, <1 resistant. Physical Effect cards exist for chuck-it-anyway play.
- **Card rewards** — 3-card draft post-combat; elites weight to uncommon/rare; skip allowed
- **Branching DAG map** per act — `generateActMap(rows, width)`. Node types:
  combat / elite / rest / event / material / skill / boss / start. Material rows
  3/7/11, skill rows 5/9; rest via `pickNodeType`
- **Equipment system** — `EQUIPMENT[slot][tier]` for staff / robes / gem / ring.
  Bonus keys: `strikeBonus`, `startBlock`, `maxHp`, `healOnCombatStart`,
  `extraStartHand`, `energyOnCombatStart`, `permanentEnergyBonus`
- **Acts 1-4** — Staff / Thread / Forge / Milliner Paths. Per-act enemy pool
  (`enemy.act`), unique boss, Master-tier reward. Slot order staff → robes →
  ring → hat. ~15 rows each
- **Run chain** — boss → `act-cleared` → next act. Heals 25% max HP between acts.
  Final act → graduation
- **Crafting system (live)** — at boss kill: pick primary material from act's
  `inventory[slot]`, play gauge-timing minigame (zones widen with craft skill),
  confirm output:
  - Staff → drawable Effect card (cost 2, chutzpah-scaling, resonance tags)
  - Hat → drawable Power card (cost 1, start-of-turn Block + Draw)
  - Robes → stat-stick (start-of-combat Block, optional HP regen)
  - Ring → stat-stick with per-turn tick (energy/draw/block at combat start)
  Quality: Rough 0.5× / Fine 1.0× / Master 1.5×. No material → Salvaged Scrap,
  forced Rough. Legacy `EQUIPMENT[slot]` table kept as data but no longer used
  in boss-grant flow
- **Events** — 8 starters covering heal / loseHp / maxHp / random card by rarity

### Data tables (at-a-glance)
- `CARDS` — 19 cards across basic / common / uncommon / rare
- `STARTER_DECK` — 4 Strike, 3 Defend, 2 Spark
- `ENEMIES` — 24 total: 18 act-specific normals + elites, 4 bosses. Per-act
  scaling (act 1 ~20 HP → act 4 ~70 HP; bosses 60→80→100→130)
- `EQUIPMENT` — staff / robes / ring / hat at 3 tiers each. Gem slot data
  orphaned for possible reuse
- `EVENTS` — 8 events with 2-3 choice payloads
- `ACTS` — 4 acts: `id`, `slot`, `name`, `flavor`, `rows`, `width`, `bossId`

## 3. Architecture notes

- `src/App.jsx` is the main game file (intentionally large). Per-lane cards
  extracted to `src/cards/{wit,chutzpah,jnsq}-v2.js`. Don't split App.jsx
  further unless asked
- `sim/playSimV2.js` is a Node-side greedy-AI **mirror** of the gameplay
  logic — its own card pool, effect dispatcher, cast resolver. **Every
  card/effect change must land in both.** This duplication is the #1 source
  of drift bugs; always grep both before considering a change shipped
- `sim/HUMAN_PLAY_PROFILE.md` holds telemetry-derived behavior signatures
  from real playtest sessions. Use it as ground truth when tuning the sim AI
- All state in `App` — no Redux/context. Refactor when systems stabilize
- Effect keys: add to **`CARDS` data** + **`playCard` dispatcher** +
  **`applyEnemyIntent`** (if enemy-applicable) + **sim mirror**
- `uid()` is process-local; revisit when save/load lands
- `pushLog(s)` → 20-line log buffer at bottom

### State contracts
- **Block resets to 0 at end of turn** (`endTurn()`)
- **Discard reshuffles into Deck when empty** (`drawFromPiles`)
- **Exiled cards return to deck at end of combat** — MVP simplification
- **Intent is rolled at start of enemy turn** so player sees what's coming
- **React setState updaters must be pure** — no `pushLog`/`setTimeout`/nested
  setState inside `setX(prev => ...)`. StrictMode re-invokes them and any
  side effect cascades into infinite loops. Side-effects go AFTER the
  setState call
- **onClick hands you a SyntheticEvent as arg[0]** — `onClick={fn}` clobbers
  default-null params. Wrap with `() => fn()` or drop the param
- **Vite build ≠ runtime safety** — a clean build doesn't catch render-time
  crashes in App.jsx. Reload the dev server and click through the affected
  flow before reporting done

### Bug-check pattern when something feels off in playtest
1. Did both App.jsx **and** `sim/playSimV2.js` get the change? Drift bugs
   look like "the sim says X but the game does Y"
2. Are setState updaters pure (no side effects inside the prev=>next fn)?
3. Did a new effect key get branched in every dispatcher (`playCard`,
   `applyEnemyIntent`, sim mirror)?
4. Did the math-bar UI get the new rider as its own chip? Hidden math kills
   strategy engagement (see [feedback memory: v2.79 math bar])

## 4. Stat identities — the three playstyles

Stats are NOT interchangeable. Every new card commits to one of these — no
stat-agnostic filler.

**Chutzpah — the Ironclad.** Risk damage to deal damage. Trade HP for output.
Levers: `loseHp` on play, low-HP scaling, drop-block-for-attack, double-down
riders that punish if the spell didn't kill. Reward: huge damage if it lands.

**Wit — the defender.** Play safe, get out clean. Build slow, finish strong.
Text: rhetorical, elaborate, footnoted. Levers: block on effect, draw/cycling,
scaling that grows with spell length this turn, late-spell payoff. Reward: small
early hits, big payoff if you chain words.

**Je ne sais quoi — the drunken wizard.** Lean into variance, with dice loaded
in player's favor. Text: chaos-magic, non-sequiturs. Levers: random outcomes,
weighted gambles (70/30 with real downside), random stat boosts, future-payment
costs ("borrow tomorrow's confidence"). Reward: high variance, slightly +EV.

New effect keys this framework will need: `loseHp`, `bonusPerWordThisTurn`,
`chance: { prob, success, failure }`, `randomStatBonus`. Add to `applyEffects` /
`playCard` dispatcher when the first card using each key lands.

## 5. Tone — Terry Pratchett wizard humor

Target is **Pratchett, leaning Unseen University**. Flavor rhythm: pompous setup
→ wry undercut → quiet observation that recasts the joke.

> *Ostensible Inferno* — "The fire is technically there. The fire-flavoured
> atmosphere certainly is."
>
> *Mildly Threatening Demeanour* — "You haven't done anything yet. But you might."

Guidance:
- **Names**: formal-but-slightly-absurd. "Octarine Squint", "Inadvisable
  Acceleration", "The Significant Pause"
- **Card flavor**: 1-2 short sentences. Never explain the mechanic. Always
  undercut. Magic mentioned → immediately qualify
- **Event flavor**: setup → middle → undercut
- **Choice labels**: short, observational. "Refuse politely. They expected this."
- **Avoid**: epic-fantasy, grimdark, anime boast cards, capitalised Significance
- **Embrace**: bureaucracy of magic, footnote asides without footnotes,
  certifications and committees, the school's bursar

Mechanics stay STS-clean and readable; tone lives in `flavor` field + event blocks.

## 6. User preferences

- **Honest pushback** over "yes and"
- **Ship fast, iterate** — don't pre-polish (no animations / theming unless asked)
- **Tight scope** — no feature bloat. Each addition justifies itself against playtest-readiness
- **Push after every commit** — Vercel deploys from origin; `git commit` alone doesn't ship
- **Structure proposals as priority rankings** so Alan can pick
- **Summarize what changed + 3-5 short clarifying questions** when genuinely useful (not every turn)
- Target experience: solo 20-30 min roguelike run

## 7. How to work on this

### Add a card
1. Append to `CARDS` (`id` / `name` / `cost` / `type` / `rarity` / `effects` / `desc`)
2. New `effects` key → branch in `playCard` dispatcher
3. Auto-pools into rewards if rarity ∈ common/uncommon

### Add an enemy
1. Append to `ENEMIES` (`id` / `name` / `maxHp` / `behaviors`)
2. Behavior shape: `{ kind, value, weight, telegraph, count? }` where `kind` ∈
   `attack` / `attack-multi` / `block` / `vulnerable` / `weak`
3. New `kind` → branch in `applyEnemyIntent`

### Things NOT to do without asking
- Multi-player support
- Tile-board generation
- Familiar system
- Persistent meta-progression beyond per-run
- Reintroduce a low per-turn cast cap (energy IS the rate-limiter; current
  `MAX_CASTS_PER_TURN = 99`)
- Add cross-lane cards (each lane is a separate character with unique
  mechanics — Annotation = wit-only, Tunnel Vision = chutzpah-only, etc.)
- Split `App.jsx` into many files (per-lane cards already extracted; that's enough)
- Add polish unprompted (animations, theming, micro-interactions)

When in doubt, ask Alan.
