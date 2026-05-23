# Conversation Mechanics — Design Framework

> Authoring premise: **If words really had power, what would a fight with words actually feel like?** Not abstract "cast a spell" — actual conversational dynamics. Losing your train of thought. Getting blinded by rage. Saying something and realizing two turns later you were wrong. Apologies. People who won't shut up. People who won't listen.
>
> The framework below maps those dynamics onto strategic mechanics, one per lane. The goal of the v2.24+ arc is to make the game STRATEGIC — meaningful decisions, not just bigger numbers.

This doc is the reference both `board-game-creator` and `board-game-nerd-tester` agents consult during the cycle arc.

---

## Lane identities (locked)

The three lanes already have distinct stat identities ([[project_wg_stat_identities]] in memory). The conversation-mechanics layer adds DECISION DENSITY on top of those identities — they don't change.

- **Chutzpah — "I won't back down."** Risk damage to deal damage. Bravado.
- **Wit — "Hear me out."** Build slow, finish strong. Footnoted scaling.
- **Jnsq — "What was I saying?"** Variance and gambles. Drunken wizardry.

---

## Chutzpah — Rage, Doubling Down, Storming Out

### Tunnel Vision (the rage meter)

A persistent per-combat meter. Fills by **+1 per chutzpah-tagged word played**, decays by 1 at end of turn if you played a non-chutzpah card.

At **5+ Tunnel Vision** at start of your turn, you enter **RAGE** state for that turn:
- All chutzpah damage cards do +50% damage.
- You CANNOT play SKILL cards (no Block, no Draw, no Heal).
- You DO NOT see the enemy's intent for next turn (you're not looking).
- At end of RAGE turn, Tunnel Vision resets to 0.

**Strategic decision:** ride the rage (huge damage but you eat unblocked) or break it (skip a chutzpah card on the turn you'd hit 5).

### Doubling Down (consequence stacks)

Chutzpah Effect cards may carry a `doubleDown` rider. Each `doubleDown` card played on a turn adds a **"Backed Into A Corner" token** to the player. If the enemy is not dead at end of turn, every token deals 2 HP damage to you. Tokens clear at end of turn (either way).

**Strategic decision:** how many of these can I land before I'm sure of the kill?

### Storming Out (commit-and-flee)

One-shot huge damage Effect. Costs all remaining energy. Ends your turn immediately — no draw, no block phase. Enemy intent for NEXT turn is hidden — you don't get to peek.

**Strategic decision:** end this combat in one swing, but if you don't kill, you eat whatever's coming blind.

### Hit Me Again (chutzpah escalation)

Power card (cost 1, installs). While installed: every enemy attack landed on you this combat (whether blocked or not) makes the enemy take +1 self-damage on their NEXT attack. Stacks. "Keep hitting me. Watch what it costs you."

**Strategic decision:** an offensive-defensive Power that turns enemy aggression into their own death-spiral. You don't dodge — you absorb and bill them.

> (Replaces the original "Saving Face" — too wit-flavored reactive for chutzpah identity. Creator note: chutzpah doesn't *notice* it was hit.)

---

## Wit — Long Thread, Footnotes, Corrections

### Long Thread (consecutive-turn scaling)

A persistent counter that ticks +1 at end of any turn where you cast at least one wit Effect card AND took no unblocked damage. If you took unblocked damage, the counter resets to 0. "The thread of your argument."

Wit Effect cards have a new modifier: `+N per Long Thread`. Late-spell payoff card profile. At 3+ Long Thread, your big wit casts are huge. But ANY interrupt resets you.

**Strategic decision:** play defensively to preserve the thread — Block everything, even cheap attacks. Sometimes the right play is to NOT cast on a low-damage turn just to keep the thread.

### Footnote (phrase-fragment install)

A Skill card type, cost 1, exhausts on play. On play: pick any **Word card** in your discard pile or hand. That word gains a `footnote: +1 wit` rider permanently for the rest of this combat. When that word appears in a spell going forward, the spell scales as if the word had +1 wit stat. Stacks (a word can be footnoted multiple times). "An asterisk you keep adding to a phrase."

**Strategic decision:** which word do you want to keep re-saying through more powerful spells? The phrase you commit to gets sharper every time.

> (Creator note: this is now how footnotes actually work — the asterisk attaches to the phrase, not the discarded card; the phrase re-surfaces in later spells with the rider attached.)

### "Actually—" (the correction)

A Skill card, cost 1. On play: re-resolve the LAST card you played this turn at +50% scaling. Single use per turn.

But it has a cost: enemies gain `arguing_back: +1` — a stacking debuff on YOU that adds +1 to the damage value of every next enemy attack until end of YOUR turn. "Every time you correct yourself, they hear it."

**Strategic decision:** which moment is worth the double-down? Cheap word for a small boost or burst attack for a real kill?

### Hold On — (interrupt-with-Thread)

A Wit Skill card, cost 1. Plays REACTIVELY during the enemy's intent reveal (before resolution). Reduces the enemy's next attack value by X, where X = your current Long Thread. "No, wait — listen."

This is Wit's signature conversational move. The Long Thread that's been carefully built now PROTECTS itself by reducing the very attack that would have broken it. Build, then defend the build with itself.

**Strategic decision:** when do you spend the Thread vs. preserve it for scaling? At low Thread (1-2) the interrupt is small; at high Thread (5+) it can negate a huge hit.

> (Creator note: this replaces "Awkward Pause" — that mechanic was tray-hold-and-double, which is a gambler's instinct, not a careful-arguer's. Awkward Pause migrates to Jnsq. The conversational move missing from Wit was *interrupting*, and Hold On — fills it.)

### Saying Something Wrong (delayed Misstep token)

A Wit Effect card with a powerful effect (high scaling), but **two turns later** a "Misstep" token appears in your hand. It costs 1 energy to discard, OR it auto-plays at end of turn doing 3 damage to you. The token has `exhaust: true` so it leaves play after.

**Strategic decision:** play the big card now and pay for it later, or hold.

---

## Jnsq — Tangent, Lost the Plot, Apology

### Tangent (commit to a detour)

A Jnsq Skill card, cost 1. On play: discard a random card from your draw pile, then fire a random Jnsq card from your DISCARD pile this turn (it resolves normally — costs 0 energy, doesn't enter hand). "You meant to say one thing. You ended up saying another. Both of them count."

**Strategic decision:** AGENCY — the player decides WHEN to take a detour, but not WHAT detour. Stack jnsq cards in discard before Tangent for richer outcomes. Reward for committing to jnsq-heavy decks.

> (Creator note: the original Tangent was pure variance — 25/25/50 outcome roulette that REMOVED player decisions. This rewrites it as a player-triggered detour: agency from the choice to commit; chaos from what surfaces.)

### The Awkward Pause (tray-hold) — moved from Wit

A Jnsq Skill card, cost 0. On play: DON'T cast this turn. Your spell tray persists into next turn. Next turn, the tray's stat values are doubled before any effect card resolves. Forces you to skip a casting turn. Holds the silence and gambles on the payoff.

**Strategic decision:** can I survive a turn without dealing damage? The double-payoff is a gambler's instinct — fits Jnsq's drunken-wizard identity.

### ~~Lost the Plot~~ — CUT

Pure variance, removes decisions, doesn't add density. Creator flagged this and Tangent (the old version) as the two mechanics least likely to produce strategic depth. Cut to free a slot.

(If we want a "what was I saying" mechanic later, the better shape would be a Power card that triggers on discard pile reshuffles — preserving agency by tying it to a planned event.)

### The Apology (clear and heal)

A Skill card, cost 1. On play: discard your spell tray (lose all stat accumulation this turn). Heal 4 HP. Apply +1 Vulnerable to enemy. "I shouldn't have said that. Have you eaten? You should eat."

**Strategic decision:** when you've over-committed and need to reset. Trades offense for survival.

### Won't Shut Up (commitment chain)

A jnsq Effect card with a powerful payload, BUT it carries `mustPlayAnotherJnsq: true`. If you don't play another jnsq card on the SAME turn, you take 3 damage at end of turn. "If you're going to say it like THAT you'd better follow through."

**Strategic decision:** the card is great but only if you have backup. Forces deck commitment.

### Drunken Confidence (damage-trade buff)

A Power card, cost 1, installs on field. While installed: take +2 damage from all enemy attacks, but ALL your effect cards scale +50%. Discardable for free. "What could go wrong?"

**Strategic decision:** turn-by-turn judgment about whether the +50% is worth the +2 damage taken.

---

## Cross-lane Shared Primitives (later cycles)

These are optional cross-lane mechanics that any lane can take advantage of. Not committed for the v2.24 arc — flagged for v2.30+ if the lane-specific layer works.

- **Patience meter** — fills by playing 0-energy cards or skipping turns. Spend to negate one debuff/status.
- **Listening** — enemy debuff: you have one turn to play a card matching their last attack stat or take +50% next attack.
- **The Reset** — extremely rare card: discard hand, redraw, next 3 cards this turn are free.

---

## Cycle planning

10 cycles per lane × 3 lanes = 30 cycles. Each cycle:

1. Run 100 sims for the active lane.
2. `board-game-creator` reads the report, critiques the current state, proposes the next mechanic from this framework (or amends one if data shows it isn't landing).
3. `board-game-nerd-tester` implements the proposed card(s), runs a 100-sim verification, writes a per-cycle report.
4. I synthesize, commit, push, repeat.

Target metric: **decision density**, not win rate. Specifically:
- Avg cards considered per turn (with how the AI picks)
- Number of distinct mechanics engaged per run
- Spread of card-play decisions (how often does the player face a meaningful choice vs. obviously-best play?)
- Engagement frequency of new primitives (Tunnel Vision triggers per game, Long Thread broken per game, Tangent fires per game, etc.)

Per-cycle commit titles: `v2.24 chutzpah/tunnel-vision`, `v2.25 chutzpah/doubling-down`, etc.

---

## Hard constraints

- **Don't change lane identities.** Chutzpah is still risk/damage; Wit is still defensive/scaling; Jnsq is still chaos. The new primitives REINFORCE the identity, not blur it.
- **Decision density > power.** A new card that "just deals more damage" is rejected. A new card that adds a meaningful choice is approved.
- **Stat-tagging matters.** New cards commit to ONE stat unless the mechanic explicitly demands a hybrid.
- **Pratchett tone.** Card flavor text follows the established voice rules ([[project_wg_voice_references]]).
- **Don't break the spell tray.** The verbal-combat tray + fizzle + composure/hp pools are the game's core. New mechanics ATTACH to that loop, they don't replace it.
