# Wit Lane v2 — The Sentence Engine

## The problem with the current system

Wit, Chutzpah, and Jnsq are mechanically interchangeable: same effect cards
with a different stat name, same word cards that exist only to push that
stat. Damage output converges across all three. The "lane" is a label, not
a playstyle.

Worse: the WORDS don't have meaning. They're flavored multipliers. A card
called *"Frankly,"* could be replaced with *"+1 chutzpah"* and play the
same way.

## The new shape

A spell is a **sentence**. The player builds it across three slots:

```
<intro>  <subject>  <target>
```

- **Intro** — sets the rhetorical move. Carries its own connector ("Frankly," or "It strikes me that")
- **Subject** — what's being addressed (a noun phrase, no terminal punctuation)
- **Target** — the verb phrase that lands the sting (this is the Effect card)

The grammar guarantees that **any combination is syntactically valid**, regardless of which intro / subject / target the player has drawn. The lowest-rarity intro composed with the highest-rarity target reads cleanly; the same is true in reverse.

### Coherence example

```
"It strikes me that"  +  "your central thesis"  +  "lacks the seriousness it pretends to."
→ "It strikes me that your central thesis lacks the seriousness it pretends to."

"Frankly,"  +  "the syllabus"  +  "could have been written by a slightly drunk parrot."
→ "Frankly, the syllabus could have been written by a slightly drunk parrot."
```

## Tier system — the core deckbuilding mechanic

Every card has a **tier** equal to its rarity:

- **Tier 1** — Basic + Common cards. Cheap, plentiful, modest contribution. These are what you start with and what most offers give you.
- **Tier 2** — Uncommon cards. Mid-strength. Reliable but not the payoff.
- **Tier 3** — Rare cards. The dream cards. Few in the pool, hard to draw three at once.

**The spell's tier is the minimum tier of the three cards that compose it.**

```
spell_tier = min(intro.tier, subject.tier, target.tier)
```

One Tier 1 card in the mix drops the spell to Tier 1 even if the other two are Tier 3. **The weakest link sets the ceiling.**

### Why this matters

This is the deckbuilding loop:

| Hand drawn | Spell tier | Damage feel |
|------------|-----------|-------------|
| 3× T1 (early run, fresh deck) | T1 | Functional. Gets you through normals. |
| T1 + T2 + T3 (unfocused mid-run) | T1 | The rare card is wasted. *This is the punishment for not honing.* |
| 3× T2 (you're building toward something) | T2 | Solid. Bosses are killable. |
| 2× T3 + T1 (almost there) | T1 | Painful. The T3 is sitting in your hand contributing nothing extra. |
| 3× T3 (honed deck or great luck) | T3 | The damage spike Alan wants. |

The **deckbuilding strategy is to strip Tier 1 cards out** so a refilled hand reliably contains all-higher-tier cards. This mirrors Slay the Spire's economy precisely — the player's job is to thin the deck toward the cards that win.

### Damage formula

```
damage = (target.base + sum(card_wit_stats) × target.multiplier) × tier_multiplier
```

### Rarity → tier → stat contribution

Cards have **four rarities** (the offer-economy axis) but those map onto **three tiers** (the spell-potency axis):

| Rarity | Tier | Multiplier | Wit contribution |
|--------|------|------------|------------------|
| Basic (starter deck) | T1 | ×1.0 | +1 wit |
| Common (most offers) | T1 | ×1.0 | +2 wit |
| Uncommon | T2 | ×1.5 | +3 wit |
| Rare | T3 | ×2.5 | +4 wit |

Basic and Common both count as T1 for tier-multiplier purposes — but Common cards contribute more wit, so they're a strict upgrade over the Basic cards in the starter deck. The player still wants to swap Basics for Commons even though "the tier" hasn't changed.

Within a tier, upgrading rarity is a quiet progression. Across tiers, it's a damage cliff.

**The compounded scaling means a 3×T3 spell hits ~5× a 3×T1 spell**, not just 2.5×. The high-tier cards contribute more wit AND multiply more. This is the explosive payoff for honing.

### Worked example

```
3× Basic cast (starter deck only):
  Intro "Frankly," (Basic/T1, +1 wit)
  Subject "your reasoning" (Basic/T1, +1 wit)
  Target "shows." (Common/T1, base 4, ×2)
  → spell tier = T1, mult = ×1.0
  → damage = (4 + 3 × 2) × 1.0 = 10

3× Common cast (mid-build, all T1 but upgraded):
  Intro "Strictly speaking," (Common/T1, +2 wit)
  Subject "your central thesis" (Common/T1, +2 wit)
  Target "invites the questions you most fear." (Common/T1, base 5, ×2)
  → spell tier = T1, mult = ×1.0
  → damage = (5 + 6 × 2) × 1.0 = 17

Mixed cast (T3 intro + T2 subject + T1 target):
  Intro "And I say this with full possession of the facts," (Rare/T3, +4 wit)
  Subject "the elaborate edifice of your reasoning" (Uncommon/T2, +3 wit)
  Target "shows." (Common/T1, base 4, ×2)
  → spell tier = T1 (capped by Target!), mult = ×1.0
  → damage = (4 + (4+3+2) × 2) × 1.0 = 22
  → The Rare intro and Uncommon subject are dragged down to T1 multiplier.
  → Better than 3× Common (22 vs 17) because of the extra wit, but the
    +4 / +3 wit cards aren't reaching their potential.

3× Uncommon cast (you're getting there):
  Intro "Permit me to observe that" (Uncommon/T2, +3 wit)
  Subject "what passes for rigor here" (Uncommon/T2, +3 wit)
  Target "lacks the seriousness it pretends to." (Uncommon/T2, base 8, ×2, Weak 1)
  → spell tier = T2, mult = ×1.5
  → damage = (8 + 9 × 2) × 1.5 = 39 + Weak 1

3× Rare cast (honed deck):
  Intro "And I say this with full possession of the facts," (Rare/T3, +4 wit)
  Subject "the slow architecture of your self-deception" (Rare/T3, +4 wit)
  Target "will be cited in future studies of what to avoid." (Rare/T3, base 12, ×3)
  → spell tier = T3, mult = ×2.5
  → damage = (12 + 12 × 3) × 2.5 = 120
```

The 3×Rare cast is **12× the 3×Basic cast**. That's the cliff Alan wants — three rare cards in one hand is the moment the deck "works."

## Tags — flavor, stitcher input, modifier triggers (not core scoring)

Every card carries 1–3 **tags** describing its rhetorical posture:

| Tag | Voice |
|-----|-------|
| **academic** | citations, formal structure, scholarly framing |
| **dismissive** | looking down on the subject |
| **observational** | noticing what others missed |
| **ironic** | saying the opposite of what you mean |
| **cutting** | sharp, precise, wounding |

Tags do **not** drive the tier multiplier. Their roles:

1. **LLM stitcher input** — the spell stitcher reads the tags of the staged cards and produces a phrasing that emphasizes the dominant rhetorical posture. Three "academic" tags → the cast text leans formal/citational. Three "ironic" tags → the cast text leans deadpan.
2. **Modifier trigger conditions** — some modifiers say "if academic shared across all three slots, also apply Vulnerable." Tags are the conditional currency for the modifier layer.
3. **Future tag-payoff cards** — cards like "every academic tag in the staged cards adds +1 damage" could exist as rare picks. They reward committing to a tag identity within a tier.

So tags add a **secondary strategic axis** that overlays the core tier strategy. Most players will optimize for tier (the obvious axis). The skilled player ALSO optimizes for tag synergy within their tier picks.

## Modifiers — the fourth, optional slot

Modifiers attach to the spell before cast. They sit in the tray alongside intro / subject — they do not replace any of them; they amplify. The player can stage 0, 1, or (in rare cases) 2 modifiers per cast.

Modifiers do NOT affect the spell's tier (tier is locked by the intro/subject/target rarity floor). What they can do:

1. **Apply a status condition** — Weak, Vulnerable, etc.
2. **Conditional damage** — "+50% damage if Tier 3" gives all-T3 hands a bigger payoff and rewards saving the modifier for the right turn.
3. **Tag-condition damage** — "+1 damage per academic tag in the staged cards" — rewards tag commitment within a tier choice.
4. **Change cast flow** — draw extra cards, strip enemy block, refund energy.

Some modifiers are **pre-modifiers** ("Frankly,") and concatenate to the front. Some are **post-modifiers** ("...obviously,") and concatenate to the end. A few are **action modifiers** ("(stares meaningfully)") that replace the intro slot entirely with a stage direction.

### Modifier example, full sentence

```
Pre-modifier:    "(with all due respect,)"           (T1, tags: formal)
Intro:           "It strikes me that"                (T1, tags: observational, dismissive)
Subject:         "your central thesis"               (T2, tags: academic, cutting)
Target:          "lacks the seriousness it pretends to."  (T2, tags: academic, dismissive)

Final sentence:
"With all due respect, it strikes me that your central thesis lacks the
seriousness it pretends to."

Spell tier = min(T1, T2, T2) = T1   (intro is the weak link)
Modifier rider applies: enemy Weak 1
Damage = (8 + (1+2+2) × 2) × 1.0 = 18 + Weak

Same combo with the intro swapped for a T2:
Intro:  "Permit me to observe that"  (T2, +2 wit)
Spell tier = T2, × 1.5
Damage = (8 + (2+2+2) × 2) × 1.5 = 30 + Weak
```

Modifiers extend the puzzle — even when your tier is locked by the cards, a well-chosen modifier can change the outcome of the cast (block-strip, condition application, conditional damage).

## Why this differentiates the lanes

Wit, Chutzpah, and Jnsq each get their own pool, their own grammar voice, and their own tag set. The same mechanical engine produces different play feel:

- **Wit** — academic precision, ironic dismissal, cutting observation. The deck is about *understanding the target precisely enough to wound them with the truth*. Voice: Hawkeye M\*A\*S\*H, Fleabag.
- **Chutzpah** *(future)* — bold assertion, swagger, demanded compliance. Sentences are louder, shorter, more direct. Voice: Jack Burton, Walter Sobchak.
- **Jnsq** *(future)* — surreal logic, non-sequitur deflection, mystical timing. Sentences make sense only on a tilt. Voice: Kramer, Charlie.

In *Slay the Spire* terms: this is the difference between a Silent who builds a poison deck and a Silent who builds a shiv deck. Same character, same energy pool, but the card pool produces a meaningfully different playstyle. Now apply that diff between the three lanes.

## Honing the deck — the gameplay loop this enables

The deckbuilding strategy this design creates is a Slay-the-Spire-shaped
loop with three explicit phases:

### Phase 1 — early acts (mostly T1 cards)

Your starter deck is all Basics (+1 wit each, T1). Combat rewards give
you mostly Commons (+2 wit, also T1). Your damage feels modest but
steady. The goal in this phase is to **start collecting Uncommons**
from elite rewards and occasional Rare drops.

The temptation is to grab every Rare you see — but a Rare alone in a
deck full of Basics gets dragged to T1 every cast. The pickup is exciting
but not yet load-bearing.

### Phase 2 — middle acts (build for T2)

You start hitting hands that are 2× T2 + 1× T1. The T1 caps the tier.
This is the "deck-thinning frustration" phase — your nice cards exist
but the deck is too fat to draw them together. Rest sites become
strategic: every Basic stripped is a step closer to all-T2 hands.

By the end of phase 2, ideally you have a deck of mostly T2 cards
with 2–4 T3s seeded in. Hands consistently roll T2 with the occasional
T3-capped streak.

### Phase 3 — final acts (chase T3)

You've identified your Rares and built around them. Maybe you have a
T3 target you want to land — "will be cited in future studies" — and
you've kept the matching tag identity (academic + cutting) so your
T3 intro and subject support it. Every reward offer is evaluated by
"does this help me draw 3× T3 reliably?"

The final boss should be killable by a single 3×T3 cast plus modifier.
The combat IS the moment the deck pays off. If you've honed correctly,
you cast something like the nuclear payoff above and it ends in a
single sentence.

### Decisions a player makes around this loop

- **Skip vs take**: a Common card is fine if you're early, but bad
  in late phase 3 (it dilutes the T3 hand probability).
- **Upgrade priority** at rest sites: which T1 or T2 to graduate.
- **Tag commitment**: you can't have everything. A 3× academic-cutting
  deck plays differently from a 3× ironic-observational deck.
- **Modifier slots**: rare modifiers are a known damage boost. Are
  you willing to spend an offer on one over a target card?

This is the deckbuilding game the wit lane has been missing.

## How this slots into existing code

The change is contained to:

1. **Word cards** gain a `slot: 'intro' | 'subject'` field. Existing wit words become a v1 set; the v2 set below is parallel until tested.
2. **Effect cards** become **Target cards** — their `phrase` field is now a predicate (verb phrase), not a flavor footer. Damage calc multiplies by tier.
3. **Tray** tracks `tray.intro`, `tray.subject`, `tray.modifiers[]` slots distinctly. Casting requires intro + subject + target.
4. **Modifier cards** are a new type. They stage like words but don't fill intro or subject — they add to a `tray.modifiers` array.
5. **Tier computation** is one function: count tags present on all of `[intro, subject, target, ...modifiers]`. Apply the multiplier in `castStagedSpell`.

The change is **additive** — the v2 card pool can ship alongside the v1 pool, gated by a starting-character choice. If "Wit Scholar" is the v2 character, they draw exclusively from v2; the v1 Wit cards stay in the wider pool for the legacy characters.

---

## The 75-card Wit v2 pool

Format below: `id · slot · rarity · cost · stats · tags`. Phrase text is in quotes; flavor follows in italics.

### Intros (25)

The intro sets the move and carries the grammatical connector. Each card composes with any subject without further punctuation.

#### Basic (5) — cost 0, +1 wit

1. **wv2-i-frankly** — `"Frankly,"` — `dismissive, cutting`
   *The dictionary definition of confidence preceded by a comma.*
2. **wv2-i-actually** — `"Actually,"` — `academic, dismissive`
   *You haven't even said anything yet, but here we are.*
3. **wv2-i-honestly** — `"Honestly,"` — `observational, cutting`
   *Honesty has never been the issue.*
4. **wv2-i-truly** — `"Truly,"` — `observational, dismissive`
   *Said with the gravity of someone who knows they've said it before.*
5. **wv2-i-curiously** — `"Curiously,"` — `observational, ironic`
   *Curiosity is, of course, the polite name for it.*

#### Common (12) — cost 0, +2 wit

6. **wv2-i-strikes-me** — `"It strikes me that"` — `observational, dismissive`
   *The strike is yours. The me is not.*
7. **wv2-i-i-should-think** — `"I should think that"` — `formal, dismissive`
   *Should-think being a softer cousin of must-acknowledge.*
8. **wv2-i-pardon-saying** — `"Pardon my saying,"` — `formal, observational`
   *You will not pardon it. That is rather the point.*
9. **wv2-i-strictly-speaking** — `"Strictly speaking,"` — `academic, cutting`
   *Strictness is, today, a virtue worth performing.*
10. **wv2-i-memory-serves** — `"If memory serves,"` — `academic, ironic`
    *Memory is serving. The food is leftovers.*
11. **wv2-i-by-any-measure** — `"By any measure,"` — `academic, dismissive`
    *Most measures, anyway. Certainly the kind one.*
12. **wv2-i-speaking-plainly** — `"Speaking plainly,"` — `cutting, observational`
    *Plainness is the most decorated of the rhetorical arts.*
13. **wv2-i-or-rather** — `"Or rather,"` — `observational, ironic`
    *The revision is the point. The original was scaffolding.*
14. **wv2-i-it-would-appear** — `"It would appear that"` — `observational, dismissive`
    *Appearances, in matters like this, are the entire substance.*
15. **wv2-i-being-honest** — `"If we're being honest,"` — `dismissive, cutting`
    *The we is presumptuous. It always is.*
16. **wv2-i-one-could-argue** — `"One could argue that"` — `academic, ironic`
    *One could. One won't have to.*
17. **wv2-i-let-the-record** — `"Let the record show that"` — `formal, academic`
    *There is no record. The phrasing is the record.*

#### Uncommon (6) — cost 1, +3 wit

18. **wv2-i-permit-me-observe** — `"Permit me to observe that"` — `formal, academic`
    *Observation, in this dialect, is a verb that lands.*
19. **wv2-i-charitable** — `"Were I being charitable,"` — `ironic, dismissive`
    *Charity is a discipline. You may not be ready for it.*
20. **wv2-i-setting-aside** — `"Setting aside the obvious,"` — `academic, cutting`
    *The obvious is a heavy thing. You leave it on the table for now.*
21. **wv2-i-if-records-trusted** — `"If the records can be trusted,"` — `academic, ironic`
    *They can. That is, in fact, the worst part.*
22. **wv2-i-put-generously** — `"To put it generously,"` — `ironic, dismissive`
    *Generosity, here, is an act of restraint. Witnessed.*
23. **wv2-i-purely-analytical** — `"From a purely analytical perspective,"` — `academic, observational`
    *The analysis is purely a courtesy. The conclusion arrived earlier.*

#### Rare (2) — cost 2, +4 wit

24. **wv2-i-reasonable-observer** — `"By the standards of any reasonable observer,"` — `academic, formal, cutting`
    *Reasonable observers are a small population. You are, suddenly, one.*
25. **wv2-i-full-possession** — `"And I say this with full possession of the facts,"` — `academic, cutting, formal`
    *The facts have been alphabetized. Indexed. Cross-referenced. Their footnotes have footnotes.*

---

### Subjects (25)

The subject is a noun phrase — what the sentence is about. Always composable after an intro, always followed by a target.

#### Basic (5) — cost 0, +1 wit

26. **wv2-s-your-reasoning** — `"your reasoning"` — `academic, observational`
    *Reasoning, in this case, having done its part by trying.*
27. **wv2-s-this-argument** — `"this argument"` — `academic, observational`
    *The argument, taken on its own terms, having arrived too sure of itself.*
28. **wv2-s-your-conclusion** — `"your conclusion"` — `academic, dismissive`
    *The conclusion is the part that didn't survive the road.*
29. **wv2-s-your-sources** — `"your sources"` — `academic, cutting`
    *Where they go is not, strictly, anyone's concern. But they go somewhere.*
30. **wv2-s-the-matter-at-hand** — `"the matter at hand"` — `formal, observational`
    *The matter has been at hand for some time. It is patient.*

#### Common (12) — cost 0, +2 wit

31. **wv2-s-your-dissertation** — `"your dissertation"` — `academic, dismissive`
    *Bound, defended, and from this distance — undamaged.*
32. **wv2-s-this-entire-enterprise** — `"this entire enterprise"` — `dismissive, observational`
    *The word entire being asked to do unusual lifting today.*
33. **wv2-s-the-very-premise** — `"the very premise"` — `academic, cutting`
    *Very is the most generous adverb in the philosophical lexicon.*
34. **wv2-s-your-standards** — `"your standards"` — `academic, dismissive`
    *They are, at the very least, your own.*
35. **wv2-s-your-taste** — `"your taste"` — `observational, cutting`
    *Taste is a private matter that has, unfortunately, become public.*
36. **wv2-s-the-syllabus** — `"the syllabus"` — `academic, dismissive`
    *A reading list, in the older and more honest sense.*
37. **wv2-s-the-bibliography** — `"the bibliography you've assembled"` — `academic, ironic`
    *Assembled, here, being a polite word for collected and shrugged at.*
38. **wv2-s-your-central-thesis** — `"your central thesis"` — `academic, cutting`
    *Centrality is a function of geometry. Theses, of bone structure.*
39. **wv2-s-foundation-of-argument** — `"the very foundation of your argument"` — `academic, formal`
    *Foundations being load-bearing is, again, a generous reading.*
40. **wv2-s-your-methodology** — `"your methodology"` — `academic, formal`
    *Method, ology, and the silence between them.*
41. **wv2-s-this-so-called-proof** — `"this so-called proof"` — `academic, ironic`
    *So-called by the kindest among us. The rest have other words.*
42. **wv2-s-your-conclusions-drawn** — `"the conclusions you've drawn"` — `academic, observational`
    *Drawn the way water is — that is, with effort, and not for long.*

#### Uncommon (6) — cost 1, +3 wit

43. **wv2-s-elaborate-edifice** — `"the elaborate edifice of your reasoning"` — `academic, ironic`
    *Elaborate, in architecture, often signals load-bearing fashion.*
44. **wv2-s-studied-opacity** — `"the studied opacity of your prose"` — `academic, cutting`
    *Opacity, when studied, becomes a style. A bad one.*
45. **wv2-s-quietly-imported** — `"every assumption you've quietly imported"` — `academic, cutting`
    *Quietness is, on inspection, the most audible thing here.*
46. **wv2-s-what-passes-rigor** — `"what passes for rigor here"` — `academic, dismissive`
    *Passes, in this context, being a verb of movement, not validation.*
47. **wv2-s-breathtaking-confidence** — `"the breathtaking confidence of your claim"` — `observational, ironic`
    *Breath is being lost, certainly. The reason is unclear.*
48. **wv2-s-unexamined-certainty** — `"your impressively unexamined certainty"` — `observational, cutting`
    *Impressively because it has lasted this long. Unexamined for the same reason.*

#### Rare (2) — cost 1, +4 wit

49. **wv2-s-slow-architecture** — `"the slow architecture of your self-deception"` — `academic, cutting, ironic`
    *Slow because it had time. Architecture because someone clearly drew plans.*
50. **wv2-s-not-thought-through** — `"everything you have not thought through carefully"` — `academic, cutting, observational`
    *Everything is a strong word. It is, here, the precisely correct one.*

---

### Targets (15)

The target is the verb phrase that LANDS — i.e. the Effect card. It carries the base damage, multiplier, and any riders. Damage formula: `(base + wit × multiplier) × tier_multiplier`.

#### Common (5) — cost 1

51. **wv2-t-shows** — `"shows."` — base 4, ×2, `cutting`
    *The whole sentence is a setup. This is the snap.*
    Effect: `{ scaleBy: 'wit', base: 4, multiplier: 2, damageType: 'composure', tags: ['cutting'] }`
52. **wv2-t-what-i-expected** — `"is exactly what I expected."` — base 5, ×2, `dismissive, observational`
    *Expectations, in this case, were a kindness.*
    Effect: `{ scaleBy: 'wit', base: 5, multiplier: 2, tags: ['dismissive','observational'] }`
53. **wv2-t-not-survive-scrutiny** — `"will not survive this scrutiny."` — base 5, ×2, `academic, cutting`
    *Survival being a matter of one careful look.*
    Effect: `{ scaleBy: 'wit', base: 5, multiplier: 2, tags: ['academic','cutting'] }`
54. **wv2-t-politely-overlooked** — `"has been politely overlooked, until now."` — base 6, ×2, `ironic, dismissive`
    *Politeness is a renewable resource. Today it ran out.*
    Effect: `{ scaleBy: 'wit', base: 6, multiplier: 2, tags: ['ironic','dismissive'] }`
55. **wv2-t-questions-you-fear** — `"invites the questions you most fear."` — base 5, ×2, `cutting, observational`
    *The fear is the answer. The questions are formality.*
    Effect: `{ scaleBy: 'wit', base: 5, multiplier: 2, tags: ['cutting','observational'] }`

#### Uncommon (6) — cost 2

56. **wv2-t-lacks-seriousness** — `"lacks the seriousness it pretends to."` — base 8, ×2, +Weak 1, `academic, dismissive`
    *The pretense was the only weight it carried.*
    Effect: `{ base: 8, multiplier: 2, rider: { weak: 1 }, tags: ['academic','dismissive'] }`
57. **wv2-t-drunk-parrot** — `"could have been written by a slightly drunk parrot."` — base 8, ×3, `ironic, cutting`
    *Slightly drunk because the parrot, like you, has standards.*
    Effect: `{ base: 8, multiplier: 3, tags: ['ironic','cutting'] }`
58. **wv2-t-mistakes-vehemence** — `"mistakes vehemence for vigor."` — base 7, ×3, +Vulnerable 1, `academic, cutting`
    *The two have, at this point, never even been introduced.*
    Effect: `{ base: 7, multiplier: 3, rider: { vulnerable: 1 }, tags: ['academic','cutting'] }`
59. **wv2-t-dried-apricot** — `"has the texture of a dried apricot."` — base 7, ×3, `ironic, observational`
    *The apricot, to be fair, never claimed to be more.*
    Effect: `{ base: 7, multiplier: 3, tags: ['ironic','observational'] }`
60. **wv2-t-remembered-briefly** — `"will be remembered, briefly, with embarrassment."` — base 8, ×3, `cutting, dismissive`
    *Briefly, because embarrassment is exhausting work.*
    Effect: `{ base: 8, multiplier: 3, tags: ['cutting','dismissive'] }`
61. **wv2-t-survives-by-dullness** — `"survives only by being too dull to attack."` — base 9, ×2, `ironic, cutting`
    *And yet, here we are.*
    Effect: `{ base: 9, multiplier: 2, tags: ['ironic','cutting'] }`

#### Rare (4) — cost 2–3

62. **wv2-t-generous-error** — `"is, in the most generous reading, an error."` — base 10, ×3, +Weak 2, `academic, formal, ironic`
    *Less generous readings have been collected and indexed.*
    Effect: `{ cost: 2, base: 10, multiplier: 3, rider: { weak: 2 }, tags: ['academic','formal','ironic'] }`
63. **wv2-t-future-studies** — `"will be cited in future studies of what to avoid."` — base 12, ×3, **doubles at Tier 3**, `academic, cutting`
    *The citation is the gift. The avoidance is the lesson.*
    Effect: `{ cost: 2, base: 12, multiplier: 3, tags: ['academic','cutting'], tier3Double: true }`
64. **wv2-t-announces-itself** — `"announces itself, repeatedly, while saying nothing."` — base 11, ×3, `observational, ironic, cutting`
    *The announcement was the entire content. Loudness mistaken for substance.*
    Effect: `{ cost: 2, base: 11, multiplier: 3, tags: ['observational','ironic','cutting'] }`
65. **wv2-t-own-punctuation** — `"collapses under the weight of its own punctuation."` — base 14, ×3, **requires Tier 3** (else: Tier 1 damage and exhaust), `academic, cutting`
    *Em dashes can carry a great deal. Not, however, this.*
    Effect: `{ cost: 3, base: 14, multiplier: 3, tags: ['academic','cutting'], requiresTier3: { failureDamageMult: 0.5, exhaustOnFail: true } }`

---

### Modifiers (10)

Modifiers attach to the spell before cast. They add tags to the shared-set, apply riders, or unlock conditional payoffs. The player can stage up to two; rares always count as one of the two.

#### Common (4)

66. **wv2-m-due-respect** — `"With all due respect,"` (pre-modifier) — cost 0, adds `formal` tag, +1 wit
    *Respect is, in this dialect, a verb tense.*
    Effect: `{ modifier: 'pre', addsTag: 'formal', stats: { wit: 1 } }`
67. **wv2-m-obviously** — `"...obviously,"` (post-modifier) — cost 1, adds `dismissive` tag, +Weak 1
    *Obviousness has, in this case, taken its sweet time.*
    Effect: `{ modifier: 'post', addsTag: 'dismissive', rider: { weak: 1 } }`
68. **wv2-m-i-daresay** — `"I daresay,"` (pre-modifier) — cost 1, adds `academic` tag, draw 1 after cast
    *Daresay being the verb form of having said it earlier in private.*
    Effect: `{ modifier: 'pre', addsTag: 'academic', drawAfterCast: 1 }`
69. **wv2-m-and-i-quote** — `"...and I quote,"` (post-modifier) — cost 1, adds `academic` tag, **+50% damage if Tier 2+**
    *Quotation marks are, on their best day, a small gift.*
    Effect: `{ modifier: 'post', addsTag: 'academic', conditionalMult: { tier2Plus: 1.5 } }`

#### Uncommon (4)

70. **wv2-m-stares-meaningfully** — `"(stares meaningfully)"` (action modifier — replaces intro) — cost 1, adds `observational` tag, +Vulnerable 1
    *The staring is the rhetoric. The meaningful is the multiplier.*
    Effect: `{ modifier: 'replaces-intro', addsTag: 'observational', rider: { vulnerable: 1 } }`
71. **wv2-m-apologies-mother** — `"...with apologies to your mother,"` (post-modifier) — cost 2, adds `cutting` tag, **+50% damage**
    *Apologies being the only honest part of the sentence.*
    Effect: `{ modifier: 'post', addsTag: 'cutting', damageMult: 1.5 }`
72. **wv2-m-back-row-hears** — `"(shouted clearly so the back row hears)"` (pre-modifier) — cost 2, adds `dismissive` tag, +Weak 2, **-1 composure to self**
    *Volume is, on rare occasions, the entire argument.*
    Effect: `{ modifier: 'pre', addsTag: 'dismissive', rider: { weak: 2 }, selfComposureCost: 1 }`
73. **wv2-m-three-ways** — `"...and I mean this in three ways,"` (post-modifier — **double entendre**) — cost 2, **+1 damage per tag matched in shared-set** (compounds with tier)
    *Three ways being a polite undercount.*
    Effect: `{ modifier: 'post', perSharedTag: 1 }`

#### Rare (2)

74. **wv2-m-needlepoint** — `"...to be made into a needlepoint by your enemies,"` (post-modifier) — cost 2, **at Tier 3: damage doubles AND +Vulnerable 2**
    *The needlepoint will hang in their hallway. They will see it daily.*
    Effect: `{ modifier: 'post', tier3Payoff: { damageMult: 2.0, rider: { vulnerable: 2 } } }`
75. **wv2-m-anyone-with-eyes** — `"(as anyone with eyes can see)"` (pre-modifier) — cost 2, adds `observational` tag, **strips 2 enemy block, then +50% damage**
    *The eyes have, until now, been politely closed.*
    Effect: `{ modifier: 'pre', addsTag: 'observational', stripEnemyBlock: 2, damageMult: 1.5 }`

---

## The nuclear payoff cast (3× Rare + T3 modifier)

```
Modifier: "...to be made into a needlepoint
           by your enemies,"                 (Rare/T3 — tier-3 payoff modifier)
Intro:    "And I say this with full
           possession of the facts,"         (Rare/T3, +4 wit, academic/cutting/formal)
Subject:  "the slow architecture of your
           self-deception"                   (Rare/T3, +4 wit, academic/cutting/ironic)
Target:   "will be cited in future studies
           of what to avoid."                (Rare/T3, base 12, ×3, tier3Double, academic/cutting)

Sentence: "And I say this with full possession of the facts, the slow
           architecture of your self-deception will be cited in future studies
           of what to avoid, to be made into a needlepoint by your enemies."

Spell tier = min(T3, T3, T3) = T3 → ×2.5
Base damage: (12 + (4+4+4) × 3) × 2.5 = 120
Target's tier3Double fires: 120 × 2 = 240
Modifier's tier3 payoff: ×2 again AND apply Vulnerable 2 = 480 + Vulnerable 2

(That's a huge number. 3×Rare-cards plus a Rare-tier3-payoff modifier is the
maximum-effort nuclear cast. It should win combats outright — bosses
included if all the pieces land. The deckbuilding question is "how do I
reliably reach this hand?" — strip Basics with rest-site upgrades,
prioritize Rare offers, and bring modifiers that synergize with the tier.)
```

Compare outcomes for the same lane:

| Hand shape | Damage | Status |
|------------|--------|--------|
| 3× Basic (starter) | 10 | — |
| 3× Common (upgraded T1) | 17 | — |
| Mixed T1/T2/T3 | 22 | — |
| 3× Uncommon (T2 build) | 39 | Weak 1 |
| 3× Rare (T3 build) | 120 | — |
| 3× Rare + T3 modifier | 480 | Vulnerable 2 |

**That 48× spread between Basic-starter and fully-honed Rare+modifier is the deckbuilding payoff curve.** The point of every reward pick, upgrade, and deck-thin is to compress hands toward the right side of that table.

---

## What this gives the game

1. **The phrase IS the gameplay.** Reading a Tier 3 sentence aloud is satisfying because it actually lands as English; the mechanical reward and the narrative reward fire simultaneously.
2. **Decks have rhetorical strategies, not just multipliers.** A wit deck built around `academic+formal` tags plays differently from one built around `ironic+observational` tags. Same lane, different voice.
3. **Modifiers are the puzzle layer.** "I have Tier 2. The Wit Scholar across the table has a modifier that pushes them to Tier 3. Do I save it for the boss, or burn it now to clear this elite?"
4. **Card rarity becomes voice depth.** Rare cards aren't just numerically stronger — they're more *rhetorically specific*. "And I say this with full possession of the facts" is a different kind of intro than "Curiously,".
5. **Replayability through phrasing.** Two players who draw different card mixes will literally cast different sentences. The combat log becomes a quotable artifact.

## What this needs (followups)

- **Chutzpah v2 pool** — same architecture, different voice: short demanding sentences, threats that escalate.
- **Jnsq v2 pool** — same architecture, different voice: non-sequitur logic, mystical-flavored deflection.
- **Stitcher integration** — the LLM stitcher mentioned in memory can sit on TOP of this pool and add prose connective tissue between intro/subject/target when at Tier 3 (e.g., add a parenthetical aside). The grammar template guarantees the LLM has scaffolding to ride on, not free-text mode.
- **Character selection screen** — the v2 pools imply a "pick your wizard" step at run start (Wit Scholar, Chutzpah Bruiser, Jnsq Fool). The v1 pools could continue to exist as the "Generalist" character, which mixes all three.
- **UI work** — the tray needs visible Intro / Subject / Target / Modifier slot indicators. Right now it's a single staging area; this design needs 3-4 clearly labeled slots.
