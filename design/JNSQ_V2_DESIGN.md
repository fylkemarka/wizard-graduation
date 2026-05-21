# Jnsq Lane v2 — The Tangent Engine

Sister doc to `WIT_V2_DESIGN.md` and `CHUTZPAH_V2_DESIGN.md`. Same architecture (3-slot grammar, card-tier-min spell tier, modifier 4th slot) — different voice, different tag set, different vocabulary.

Read the Wit doc for the system. This doc focuses on the jnsq pool.

## Voice — Kramer, Charlie Kelly

The wit wizard wins by being right. The chutzpah wizard wins by being loud. The jnsq wizard wins by being **so confidently sideways that nobody can find a foothold to disagree.**

Where wit cites and chutzpah demands, jnsq *digresses*. The enemy expected an argument. The jnsq wizard produces a parable about the moon. The sentence has internal logic — it just isn't the logic anyone else is using.

Voice cues:
- Non-sequitur openings — "Speaking of birds," "On a Tuesday,"
- Mystical references deployed with absolute certainty
- Cosmic timing claims (the third moon, the seventh of nothing)
- Hand gestures, theatrical asides
- Confidence in nonsense
- Conspiratorial intimacy — "I read this in a dream and I'm pretty sure it counts"

Compare:

| Wit | Chutzpah | Jnsq |
|-----|----------|------|
| "It strikes me that your central thesis lacks the seriousness it pretends to." | "Listen pal, your whole song and dance stops right now." | "Speaking of birds, your aura is the wrong color." |

Same engine. Three different sentences. Three different wizards.

## Jnsq tags

| Tag | Voice |
|-----|-------|
| **mystical** | woo-woo, cosmic, references to celestial bodies |
| **absurd** | weird premise stated as obvious fact |
| **chaotic** | non-sequitur energy, tangential leaps |
| **theatrical** | staged for effect, hand gestures, asides |
| **conspiratorial** | secret-knowledge tone, "I read this in a dream" |

Tier mechanic is identical to the other two lanes: spell tier = min(card tiers), T1×1.0 / T2×1.5 / T3×2.5. Tags are flavor + modifier-condition triggers + LLM stitcher input.

## Sample casts

### 3× Basic (the gentle weird)

```
Intro:    "Speaking of which,"      (Basic/T1, chaotic)
Subject:  "the moon"                (Basic/T1, mystical)
Target:   "is the wrong color."     (Common/T1, base 4, ×2, absurd)

Sentence: "Speaking of which, the moon is the wrong color."
Damage: (4 + 3×2) × 1.0 = 10
```

The enemy is now thinking about whether the moon has, in fact, a color, and whether it is the right one, and whether there's a right one to begin with. This is not what they wanted to be thinking about.

### 3× Rare (cosmic-confidence closer)

```
Modifier: "(briefly, becomes a stork,)"    (Rare/T3 — tier-3 payoff)
Intro:    "By the slow rotation of the
           kitchen, which is sacred,"      (Rare/T3, mystical/conspiratorial/theatrical)
Subject:  "the geometric impossibility
           of you, right now, here, in
           this configuration"             (Rare/T3, absurd/theatrical)
Target:   "is now a problem for
           the bees."                      (Rare/T3, base 10, ×3, +Vulnerable 2, absurd/chaotic)

Sentence: "By the slow rotation of the kitchen, which is sacred, the geometric
           impossibility of you, right now, here, in this configuration, is
           now a problem for the bees, briefly, becomes a stork."

Spell tier = T3 → ×2.5
Damage: (10 + 12×3) × 2.5 = 115
Modifier tier3 payoff fires: × 2 = 230 + Vulnerable 2 + Vulnerable 2
```

The bees are mentioned. The stork happens. Nobody asked, but the entire room is in three feet of metaphor now.

---

## The 75-card Jnsq v2 pool

### Intros (25)

Jnsq intros set a tangential frame. They are NOT short — chutzpah is short, jnsq meanders. The intro is the moment the conversation gets sideways.

#### Basic (5) — cost 0, +1 jnsq

1. **jv2-i-speaking-of** — `"Speaking of which,"` — `chaotic, conspiratorial`
   *You weren't speaking of anything. That's the point.*
2. **jv2-i-astrally** — `"Astrally,"` — `mystical, theatrical`
   *The astral plane is involved. Bring a sweater.*
3. **jv2-i-on-a-tuesday** — `"On a Tuesday,"` — `chaotic, absurd`
   *Which Tuesday: any. All. The concept itself.*
4. **jv2-i-now** — `"Now,"` — `theatrical, chaotic`
   *Now is a long time in jnsq.*
5. **jv2-i-funny-thing** — `"Funny thing —"` — `conspiratorial, chaotic`
   *It will not be funny. It will be a thing.*

#### Common (12) — cost 0, +2 jnsq

6. **jv2-i-remiss-not-mention** — `"It would be remiss not to mention"` — `theatrical, conspiratorial`
   *Remiss being a word from the dictionary nobody uses.*
7. **jv2-i-third-moon** — `"The third moon would tell you"` — `mystical, conspiratorial`
   *There are three. You haven't been paying attention.*
8. **jv2-i-speaking-of-nine** — `"Speaking of nine, which I was,"` — `chaotic, absurd`
   *You weren't. You also haven't been speaking. Doesn't matter.*
9. **jv2-i-trace-orbit** — `"If you trace the orbit,"` — `mystical, theatrical`
   *Orbit being a verb, in the right dialect.*
10. **jv2-i-not-saying-lentils** — `"Now I'm not saying it was the lentils,"` — `conspiratorial, absurd`
    *But.*
11. **jv2-i-between-you-void** — `"Between you and the void,"` — `mystical, theatrical`
    *Two parties. One participant.*
12. **jv2-i-morning-side** — `"On the morning side of yesterday,"` — `chaotic, mystical`
    *Yesterday has, on inspection, sides. This is the one.*
13. **jv2-i-birds-arent-real** — `"If we agree that birds aren't real,"` — `conspiratorial, absurd`
    *The if is the only honest part.*
14. **jv2-i-cat-standards** — `"By the standards of the cat,"` — `mystical, absurd`
    *The cat has standards. The cat has, in fact, only standards.*
15. **jv2-i-certain-angle** — `"From a certain angle,"` — `theatrical, chaotic`
    *Angles are involved. Geometry, for once, agrees.*
16. **jv2-i-backwards-keyhole** — `"Backwards through the keyhole,"` — `theatrical, absurd`
    *Forwards being the way ordinary people go.*
17. **jv2-i-walk-with-me** — `"Walk with me on this:"` — `conspiratorial, theatrical`
    *Walking being, here, a metaphor for staying very still.*

#### Uncommon (6) — cost 1, +3 jnsq

18. **jv2-i-seventh-nothing** — `"It is, of course, the seventh of nothing,"` — `mystical, absurd`
    *The of course doing most of the heavy lifting.*
19. **jv2-i-momentary-tangent** — `"If you'd permit me a momentary tangent and a hat,"` — `theatrical, chaotic`
    *The hat will come later. Or earlier. Recently.*
20. **jv2-i-read-in-dream** — `"I read this in a dream and I'm pretty sure it counts,"` — `conspiratorial, mystical`
    *The dream had footnotes. The footnotes had footnotes. It was a thorough dream.*
21. **jv2-i-horse-knows** — `"Now imagine, if you will, a horse that knows it's a horse,"` — `theatrical, absurd`
    *The horse is incidental. The knowing is the verb.*
22. **jv2-i-dont-ask-how-i-know** — `"Look — and don't ask me how I know this —"` — `conspiratorial, theatrical`
    *The answer to how is, often, the lentils. We don't discuss the lentils.*
23. **jv2-i-three-tuesdays-locally** — `"Three Tuesdays ago, but only locally,"` — `chaotic, mystical`
    *The locally is doing all the work. Globally, no Tuesdays. Globally, Wednesday at best.*

#### Rare (2) — cost 2, +4 jnsq

24. **jv2-i-kitchen-sacred** — `"By the slow rotation of the kitchen, which is sacred,"` — `mystical, conspiratorial, theatrical`
    *The kitchen has been rotating since you arrived. Slowly. Nobody else noticed.*
25. **jv2-i-moon-disagrees** — `"And here's the part where the moon usually disagrees with me, but —"` — `mystical, theatrical, conspiratorial`
    *The moon has, today, been overruled.*

---

### Subjects (25)

Jnsq subjects are often oblique — referring to the target through some intermediate (aura, cosmic ledger, your shadow) rather than addressing them directly.

#### Basic (5) — cost 0, +1 jnsq

26. **jv2-s-your-aura** — `"your aura"` — `mystical`
    *The aura is doing things. We will discuss what.*
27. **jv2-s-the-moon** — `"the moon"` — `mystical, theatrical`
    *The moon is involved. The moon is always involved.*
28. **jv2-s-this-afternoon** — `"this whole afternoon"` — `chaotic`
    *Afternoons being, in jnsq, structurally suspect.*
29. **jv2-s-the-rug** — `"the rug"` — `absurd, theatrical`
    *The rug knows what it did.*
30. **jv2-s-the-situation** — `"the situation"` — `conspiratorial, theatrical`
    *Said with the gravity of a man who reads paint labels.*

#### Common (12) — cost 0, +2 jnsq

31. **jv2-s-third-cousin** — `"the third cousin of your argument"` — `chaotic, conspiratorial`
    *Family resemblance is light. The reasoning was at a different wedding.*
32. **jv2-s-your-timing** — `"your timing"` — `mystical, theatrical`
    *Timing being a measurement only loosely related to clocks.*
33. **jv2-s-the-calendar** — `"the calendar"` — `mystical, absurd`
    *The calendar has opinions. They are not your opinions.*
34. **jv2-s-face-that-lies** — `"the part of your face that lies"` — `theatrical, absurd`
    *That part. The other parts may be considered later.*
35. **jv2-s-this-month-concept** — `"this entire month, as a concept"` — `mystical, theatrical`
    *Concepts being negotiable. Months less so. The combination: unstable.*
36. **jv2-s-small-mistakes-shadow** — `"the small mistakes your shadow keeps making"` — `mystical, conspiratorial`
    *Your shadow has been busy. We've been keeping track.*
37. **jv2-s-ambient-noise** — `"the ambient noise you've been generating"` — `theatrical, dismissive`
    *Generating being a verb of involuntary production.*
38. **jv2-s-hands-admitting** — `"what your hands have been admitting"` — `conspiratorial, mystical`
    *The hands have, in private, said too much.*
39. **jv2-s-cosmic-ledger** — `"the cosmic ledger"` — `mystical, conspiratorial`
    *The ledger exists. It is large. You are in it.*
40. **jv2-s-yesterday-version** — `"yesterday's version of you"` — `chaotic, mystical`
    *Yesterday's was, frankly, taller. We don't talk about this in public.*
41. **jv2-s-walk-into-rooms** — `"the way you walk into rooms"` — `theatrical, absurd`
    *Walking being a martial art with practitioners and amateurs.*
42. **jv2-s-eyebrows-say** — `"the things your eyebrows say"` — `theatrical, absurd`
    *The eyebrows have been editorial. The page count is climbing.*

#### Uncommon (6) — cost 1, +3 jnsq

43. **jv2-s-small-dog** — `"the very small dog of your reasoning"` — `absurd, chaotic`
    *Small dogs are dogs. Reasoning, less reliably.*
44. **jv2-s-slow-song-subconscious** — `"the slow song your subconscious has been humming"` — `mystical, theatrical`
    *The song has lyrics. The lyrics are about the subject. Not flatteringly.*
45. **jv2-s-patient-stupidity** — `"the patient stupidity of the moment"` — `chaotic, theatrical`
    *Patient because it has, frankly, all night.*
46. **jv2-s-seven-curtains** — `"the seven hidden assumptions of the curtains"` — `mystical, absurd, conspiratorial`
    *The curtains know. The curtains have always known. The curtains are not, technically, on our side.*
47. **jv2-s-fate-wrong-invoice** — `"the way your fate keeps showing up on the wrong invoice"` — `mystical, chaotic`
    *Fate has been miscoded. Accounting has been informed. Accounting does not care.*
48. **jv2-s-not-having-yet** — `"the conversation we're not having yet but will"` — `conspiratorial, theatrical`
    *The future tense is the only honest one available.*

#### Rare (2) — cost 1, +4 jnsq

49. **jv2-s-geometric-impossibility** — `"the geometric impossibility of you, right now, here, in this configuration"` — `mystical, theatrical, absurd`
    *Geometry, like the bouncer, has been called.*
50. **jv2-s-universe-preparing-mention** — `"everything the universe has been very patiently preparing to mention"` — `mystical, conspiratorial, theatrical`
    *Patience having an end. This end is approximately now.*

---

### Targets (15)

Jnsq targets are surreal — they make claims that are technically grammatical but logically tilt-shifted. They land BECAUSE they don't make sense in the ordinary way.

#### Common (5) — cost 1

51. **jv2-t-wrong-color** — `"is the wrong color."` — base 4, ×2, `absurd`
    *Color being, on inspection, definite.*
    Effect: `{ scaleBy: 'jnsq', base: 4, multiplier: 2, tags: ['absurd'] }`
52. **jv2-t-owes-nothing** — `"owes you nothing."` — base 4, ×2, `dismissive, mystical`
    *Debts being, in this currency, a private matter.*
53. **jv2-t-forgotten-name** — `"has forgotten its own name."` — base 5, ×2, `mystical, absurd`
    *Names being, in jnsq, a function of being seen by the right people.*
54. **jv2-t-levitating** — `"is, frankly, levitating."` — base 5, ×2, +Vulnerable 1, `theatrical, absurd`
    *Frankly being a word that, here, carries no weight. Like the subject.*
55. **jv2-t-not-from-here** — `"isn't even from around here."` — base 6, ×2, `dismissive, mystical`
    *Origin being a question with, in this case, an unsatisfying answer.*

#### Uncommon (6) — cost 2

56. **jv2-t-read-backwards** — `"is being read backwards by the moon."` — base 7, ×3, +Weak 1, `mystical, theatrical`
    *The moon reads. The moon has, increasingly, opinions.*
57. **jv2-t-wrong-number-legs** — `"has the wrong number of legs for that opinion."` — base 8, ×3, `absurd, chaotic`
    *Opinions and legs being, in jnsq cosmology, related quantities.*
58. **jv2-t-cat-warned** — `"is what the cat warned us about."` — base 8, ×2, +Vulnerable 1, `mystical, conspiratorial`
    *The cat has been right before. The cat will be right again.*
59. **jv2-t-never-invited** — `"was never properly invited."` — base 9, ×2, `theatrical, dismissive`
    *Proper invitations being a niche art.*
60. **jv2-t-third-tuesday** — `"is exactly what the third Tuesday looks like."` — base 8, ×3, `chaotic, absurd`
    *Tuesdays having visual qualities, once you start looking.*
61. **jv2-t-become-goose** — `"has, somehow, become a goose."` — base 9, ×2, +Weak 1, `absurd, theatrical`
    *The somehow is the part the enemy is going to dwell on for years.*

#### Rare (4) — cost 2–3

62. **jv2-t-problem-for-bees** — `"is now a problem for the bees."` — base 10, ×3, +Vulnerable 2, `absurd, chaotic, mystical`
    *The bees are, technically, the local authority. Don't argue.*
    Effect: `{ cost: 2, base: 10, multiplier: 3, rider: { vulnerable: 2 }, tags: ['absurd','chaotic','mystical'] }`
63. **jv2-t-lies-down-refuses** — `"is the part of the sentence that lies down and refuses."` — base 12, ×3, **doubles at Tier 3**, `theatrical, absurd`
    *Sentences have, in jnsq, anatomy. This is the spine.*
    Effect: `{ cost: 2, base: 12, multiplier: 3, tier3Double: true, tags: ['theatrical','absurd'] }`
64. **jv2-t-explained-rocks** — `"is being slowly explained to the rocks."` — base 11, ×3, `mystical, theatrical, conspiratorial`
    *The rocks are listening. The rocks have, frankly, been listening for years.*
    Effect: `{ cost: 2, base: 11, multiplier: 3, tags: ['mystical','theatrical','conspiratorial'] }`
65. **jv2-t-religion-france** — `"has, in the way these things do, become a small religion in southern France."` — base 14, ×3, **requires Tier 3**, `absurd, chaotic, mystical`
    *Southern France being, as everyone now knows, susceptible.*
    Effect: `{ cost: 3, base: 14, multiplier: 3, requiresTier3: { failureDamageMult: 0.5, exhaustOnFail: true }, tags: ['absurd','chaotic','mystical'] }`

---

### Modifiers (10)

#### Common (4)

66. **jv2-m-cosmic-sense** — `"in a cosmic sense,"` (pre) — cost 0, adds `mystical`, +1 jnsq
    *Cosmic being a measurement of seriousness, not size.*
67. **jv2-m-allegedly** — `"...allegedly,"` (post) — cost 1, adds `conspiratorial`, +Weak 1
    *Allegedly being a verb in disguise.*
68. **jv2-m-weirdly-enough** — `"weirdly enough,"` (pre) — cost 1, adds `chaotic`, draw 1 after cast
    *Weirdness being, in jnsq, the price of admission.*
69. **jv2-m-didnt-hear-from-me** — `"...you didn't hear it from me."` (post) — cost 1, adds `conspiratorial`, **+50% damage if Tier 2+**
    *The disavowal is, here, the most honest part of the speech.*

#### Uncommon (4)

70. **jv2-m-whispers-lamp** — `"(whispers to the lamp,)"` (action — replaces intro) — cost 1, adds `theatrical, mystical`, +Vulnerable 1
    *The lamp has, on several occasions, given useful counsel.*
71. **jv2-m-bees-agree** — `"...the bees agree,"` (post) — cost 2, adds `absurd, mystical`, **+50% damage**
    *The bees vote. The bees have always voted.*
72. **jv2-m-unwraps-object** — `"(unwraps a small object,)"` (pre) — cost 2, adds `theatrical, chaotic`, strips 2 enemy block + +Vulnerable 1
    *The object was always there. You just didn't see it. Few do.*
73. **jv2-m-also-moon** — `"...also, the moon,"` (post) — cost 2, **+1 damage per mystical tag in shared cards**
    *The moon being, in jnsq combat, a multiplier.*

#### Rare (2)

74. **jv2-m-lentils-clear** — `"...as the lentils made clear,"` (post) — cost 2, **at Tier 3: damage doubles AND apply Weak 2**
    *The lentils are, on this question, unanimous.*
75. **jv2-m-becomes-stork** — `"(briefly, becomes a stork,)"` (pre) — cost 2, adds `theatrical, absurd, mystical`, **doubles damage, applies Vulnerable 2**
    *The stork is brief. The implication, lasting.*
