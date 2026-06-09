# Animal Roles — Canvas for #5 (Alan designs, Claude implements)

Status 2026-06-09. Purpose: turn "figure out animal roles" into "fill the holes."
This maps every animal's *de-facto* role today, the mechanical levers already
wired, and the gaps. **Alan fills the gaps / assigns roles; Claude implements.**

Repetition ceiling diagnosis: combat is functional and the strength-buffs work,
but almost every animal's verb is "deal N composure/turn." The board is wide on
*damage* and thin on *verbs that change how you play the turn*.

---

## 1. Current roster, by de-facto role

Updated 2026-06-09 after Alan's roster pass (commit e9daa81).

| Role | Animals | The verb |
|---|---|---|
| **Heavy hitter** (raw dmg) | Goose 6/2t, Bear 9/3t, Young Buck 5/2t (burst) | just hits, big |
| **Amplifier** | Sheepdog (+30% adjacent → +50% trained, 0 atk) | makes neighbours hit harder |
| **Mimic** | Lyrebird (copies HIGHEST attacker ×0.75 → ×1.0 trained) | scales off your best |
| **Wall / keeper** | Drystone Ox (keeper, +4 Block/turn) | persistent block engine |
| **Reflect / tank** | Porcupine (absorb 5 + jab back, both pools, scales w/ Thicken) | converts incoming to outgoing |
| **Armor-strip** | Raven (3 atk, strips 6 Block EVERY turn), Hawk (Weak on exit) | opens the enemy up |
| **Value / cycle** | Field Mouse (Block+heal on exit), Rabbit (draw) | tempo / sustain |
| **Swarm / breeder** | Rabbit → Rabbit, Bonzai Bunaroo | goes wide |
| **Tempo control** | Sloth (enemy half-speed), Pigeon (scramble intent), Kangaroo (pouch dodge) | rewrites the enemy turn |
| **Predator chain** | Salmon → Bear (Fish Food line) | invest now, spike later |
| **Exit utility** | Rabid Scrubjay (redirect next enemy attack) | parting gift |

Tier-2 upgrades (Inn): Mecha-Mouse, Bonzai Bunaroo, James Deer.
**Removed 2026-06-09:** Mouse House / Long Hare / McCloven (combine results —
three-of-a-kind combines are now OFF, no targets) and the Stray fodder body.
The Poise-battery and Block-battery (combine) roles are now VACANT.

---

## 2. Levers already wired (free to reuse on a new animal — no new engine)

- **Per-turn grant**: `turnGrant: { block | poise: N }` (Ox, Hare, McCloven)
- **On-exit payload**: `onExit: { damage | block | healHp | healComp | applyWeak | redirectEnemyAttack }`
- **Adjacency amplify**: `amplifyAdjacent: N` (Sheepdog)
- **Copy neighbour**: `copiesLeft` (Lyrebird)
- **Reflect/absorb**: `thorns: N` (Porcupine)
- **Block strip on exit**: `birdTheft: N` (Raven)
- **Predator chain**: `predatorChain: { animalId, ... }` (Salmon→Bear)
- **Adjacent spawn**: `adjacentSpawn: { animalId, turnsToTrigger }` (Rabbit)
- **Activated ability** (click-a-verb): `activatedAbility: { id, label, cadence, energyCost?, endsTurn? }` (Pigeon, Kangaroo) — **this is the richest unused-by-most lever**
- **Keeper** (never ticks down): `keeper: true` (Ox)
- **Enemy debuff on attack**: `onAttackEffect: { applyVulnerable | applyWeak: N }`

## 3. Gaps — roles NOT currently covered (candidate fills for you)

1. **True debuffer / marker** — apply *Vulnerable* to the enemy (raises ALL your damage), not just Weak/strip. A "mark the prey" animal.
2. **Scaler** — an animal whose attack *grows each turn it survives* (rewards protecting it; pairs with Ox/Sheepdog). Nothing scales itself today.
3. **Finisher / executioner** — bonus or auto-kill vs a low-Composure enemy. Gives a reason to burst at the end.
4. **Economy** — energy back, or draw-per-turn (only Rabbit draws, once). An "engine" animal.
5. **Buffer (not amplifier)** — permanently raises *another* animal's stats (like a living Whet the Claws), vs Sheepdog's temporary aura.
6. **Pierce / unblockable** — ignores enemy Block (everything currently eats Block first).
7. **Per-turn healer** — sustain beyond one-shot exit heals.
8. **Sacrifice-payoff animal** — explicitly rewards being fed to the Memorial / Make It Count engine.
9. **More activated verbs** — only 2 of ~14 lures give a clickable ability. This is the single biggest untapped fun lever (verbs > stats).

## 4. Open questions for you

- Which 3–5 of the gaps above are the *first* wave? (Don't need all at once.)
- New animals = new lures, or new *abilities bolted onto existing* animals?
- Do animals get **active abilities** broadly (the Pigeon/Kangaroo model), or stay mostly passive with a few verb-carriers?
- Should roles map onto **feed families** (bird = aggro, small-land = value, no-feed = utility), or cut across them?

When you've picked roles + rough numbers, hand them over and I'll wire each
(`CARDS`/`ANIMALS` + lure + sim mirror + math-bar chip per the no-hidden-math rule).
See [[project_wg_v3_validated_roadmap]].
