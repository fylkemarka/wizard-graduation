# Act 1 — The Thread Path: enemy roster expansion (2026-06-08)

Act 1 is the countryside: failed-graduate **textile/weaving** rogue wizards and
the half-alive things their craft left behind. Pratchett tone. Player wins by
draining **Composure** (most Act-1 enemies are HP-immune); the player dies on
**HP** (block answers HP) or **Composure** (poise answers composure).

## Problems being fixed
- **Silk Wraith is too hard as an opener** (multi-hit + maul + composure whisper).
- No **difficulty curve** — combat nodes picked any normal at random, so the
  first fight could be the hardest and the order felt same-y.
- Too few enemies → repetitive order; only 2 elites.
- Every fight is "attack / block / debuff / maul." Want mechanics that force
  *different* play: burst vs. a healer, hard-defend a wind-up, manage adds.

## New systems
- **Difficulty rank `diff: 1|2|3`** on every Act-1 enemy. Combat-node selection
  biases by map progress (early rows → diff 1, late rows → diff 3) with ±1
  spillover so the order still varies. Silk Wraith → diff 3 (late normal).
- **New behavior kinds** (engine logic in App.jsx + sim mirror):
  - `heal N` — enemy restores N of its own Composure. Forces burst/tempo: a
    slow grind loses to the regen.
  - `charge { value, telegraph }` — winds up; the big hit lands on the enemy's
    NEXT turn (a 2-beat "stop me or eat it" — defend hard or disrupt with
    Mime/Pigeon/skip). Shown in the Incoming bar as a pending hit.
  - `summon { companionId }` — calls a companion INTO the fight mid-combat (the
    explicit "enemy that summons a companion" ask). Fills the companion slot if
    empty; no-op if already occupied.
- **More duos** (main + companion via `duoPartnerId`, already supported).
- (Deferred, flagged) true 3-simultaneous fights need the single-`companion`
  slot generalized to an array — a focused follow-up. The `summon` mechanic and
  new duos cover multi-enemy variety now.

## The 10 new enemies

### Easy (diff 1) — gentle openers, one idea each
1. **Lint Sprite** (normal, comp 22). Chip attacks + the occasional self-puff
   (block). Teaches clean block timing with zero nasty riders. *"Technically
   alive. Mostly lint. Deeply offended by tidiness."*
2. **Button Drone** (normal, comp 18, **real HP 16**). A clockwork sorter —
   the early enemy with real HP, so physical-leaning play sees it work.
   Predictable small swings. *"Sorts buttons by virtue. Has opinions about
   yours."*
3. **The Unraveller** (normal, comp 24). A gentle `weak` debuffer — teaches
   debuff management long before the Silk Wraith. *"Finds the loose thread in
   everything. Including you. Especially you."*

### Mid (diff 2)
4. **Patchwork Golem** (normal, comp 34). First `heal` user — re-stitches itself
   each few turns. You must out-pace the regen. *"Made of everyone's abandoned
   mending. Optimistic about its chances."*
5. **Needlepoint Twins** (DUO). **Cross** (main, comp 30) does the X; **Stitch**
   (companion, comp 14) blocks/bolsters Cross and chips you. Kill Stitch to stop
   the shielding, or race Cross. *"Insists on the X." / "Does the quiet half.
   Resents it quietly."*
6. **The Moth Choir** (normal, comp 30). A swarm: attack-multi + composure
   whispers + Weak. Punishes undefended turns with many small hits (block-multi
   matters). *"Several moths agreeing loudly. The agreement is the threat."*
7. **Spindlewight** (normal, comp 32). First `charge` user — telegraphs a
   spinning strike that lands NEXT turn for ~16. Defend hard or disrupt the
   wind-up. *"It is winding up. It has been winding up for some time. It would
   like you to appreciate the wind-up."*

### Hard (diff 3) — pre-boss pressure
8. **The Spinster Matron** (**ELITE**, comp 44). The `summon`er: calls **Thread
   Wisp** companions into the fight, so the threat compounds if you don't close.
   Forces you to choose between the adds and the Matron. *"Runs a tight
   household of one. Always has room for one more. You begin to suspect you are
   the one more."*  Summons **Thread Wisp** (companion, comp 12): chip + bolster.
9. **Warp & Weft** (DUO). A heavy pre-boss gauntlet. **Warp** (main, comp 40):
   Weave debt + hard attacks + a composure cut. **Weft** (companion, comp 16):
   blocks, bolsters Warp, chips. *"Holds the tension. All of it. Including the
   tension in the room."*
10. **The Gauze Revenant** (normal, comp 36). The proper hard late-normal that
    replaces Silk Wraith as a first fight. `heal`-on-presence + a maul + a
    2×multi. A wraith you must burst before its regen + snare grind you out.
    *"What's left when the shroud outlives the wearer. Still cold. Still
    fussy about its drape."*

## Revisit of existing Act-1 enemies
- **Silk Wraith** → `diff 3` (was effectively the opener). Unchanged stats; it's
  now a *late* normal, which is where its multi+maw+whisper kit belongs.
- **Loom Familiar** → `diff 2` (hand-pressure is a mid-game teach).
- **Hollow Weaver** (duo) → `diff 2` (weave debt is a mid concept).
- **Bartholomew Linenfast** → `diff 1` (straightforward, a fine early fight).
- **Garth Maul** (summoner-only) → `diff 2` for the handler pool.
- **Pattern-Maker** elite → `diff 2`; **Silent Spinner** elite → `diff 3`.
- No stat nerfs — the fix is *placement* (curve), per measure-first discipline.
