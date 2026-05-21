# Chutzpah Lane v2 — The Demand Engine

Sister doc to `WIT_V2_DESIGN.md`. Same architecture (3-slot grammar, card-tier-min spell tier, modifier 4th slot) — different voice, different tag set, different vocabulary.

Read the Wit doc for the system. This doc focuses on the chutzpah pool.

## Voice — Jack Burton, Walter Sobchak

The wit wizard wins by being correct. The chutzpah wizard wins by being **louder, surer, and not backing down**. Where wit wields citations, chutzpah wields *certainty*. The sentence isn't a precision instrument — it's a hammer.

Voice cues:
- Short, declarative sentences. Few subordinate clauses.
- Working-class confidence — blue-collar swagger, not academic posturing.
- Volume as substance. Repetition as emphasis.
- Threats deployed with comic certainty (Walter Sobchak voice).
- "Listen pal" energy. Direct address.
- The chutzpah wizard talks AT the enemy, not ABOUT them.

Compare:

| Wit | Chutzpah |
|-----|----------|
| "It strikes me that your central thesis lacks the seriousness it pretends to." | "Listen pal, your whole song and dance stops right now." |
| "By the standards of any reasonable observer, the slow architecture of your self-deception will be cited in future studies of what to avoid." | "I'm only going to say this once: the entire universe you've built around this is fixin' to get acquainted with how I actually feel." |

Same grammar slot, totally different sentence. Same engine, different game.

## Chutzpah tags

| Tag | Voice |
|-----|-------|
| **demanding** | making the other party do something (or stop doing something) |
| **threatening** | implication of consequences, escalation |
| **dismissive** | looking down, not bothering to engage |
| **swaggering** | confidence display, almost cocky |
| **direct** | saying it without filter, no subtlety |

The grammar is the same as Wit's (`<intro> <subject> <target>` with optional modifiers), and the tier mechanic is the same (spell tier = min of card tiers, T1×1.0 / T2×1.5 / T3×2.5). Tags are flavor + modifier-condition triggers.

## Sample casts

### 3× Basic (10 damage, classic Jack Burton)

```
Intro:    "Listen pal,"        (Basic/T1, demanding/direct)
Subject:  "this nonsense"      (Basic/T1, dismissive)
Target:   "stops here."        (Common/T1, base 4, ×2, demanding)

Sentence: "Listen pal, this nonsense stops here."
Damage: (4 + 3×2) × 1.0 = 10
```

### 3× Rare (the swaggering closer)

```
Intro:    "Now I don't say this lightly,
           and I won't say it twice:"        (Rare/T3, threatening/direct/swaggering)
Subject:  "the long, long list of
           unforced errors you've called
           a career"                         (Rare/T3, dismissive/threatening)
Target:   "is gonna be a TED talk in three
           weeks, the unhinged kind."        (Rare/T3, base 12, ×3, tier3Double, dismissive/threatening)

Sentence: "Now I don't say this lightly, and I won't say it twice:
           the long, long list of unforced errors you've called a career
           is gonna be a TED talk in three weeks, the unhinged kind."

Spell tier = T3 → ×2.5
Damage: (12 + 12×3) × 2.5 = 120
Target's tier3Double fires: × 2 = 240
```

Add the Rare action modifier `(slams hand on table, doesn't blink)` and the damage doubles again on T3 hit. Boss-killer territory.

---

## The 75-card Chutzpah v2 pool

### Intros (25)

The intro sets the demand. Chutzpah intros are SHORT — often a single word — but they land with weight. The connector is usually a comma; no "that" subordinations because chutzpah doesn't use those.

#### Basic (5) — cost 0, +1 chutzpah

1. **cv2-i-look** — `"Look,"` — `direct, demanding`
   *Two letters. One verb. Full sentence.*
2. **cv2-i-listen-pal** — `"Listen pal,"` — `demanding, direct`
   *Pal is doing a lot of work here.*
3. **cv2-i-hey-now** — `"Hey now,"` — `demanding, dismissive`
   *Now being the operative word.*
4. **cv2-i-buddy** — `"Buddy,"` — `dismissive, direct`
   *The friendliest insult in the language.*
5. **cv2-i-okay** — `"Okay,"` — `direct, dismissive`
   *Not okay. Not at all. But also: okay.*

#### Common (12) — cost 0, +2 chutzpah

6. **cv2-i-listen-carefully** — `"Listen carefully now,"` — `demanding, threatening`
   *The careful is for them, not you.*
7. **cv2-i-lemme-explain** — `"Lemme explain something,"` — `swaggering, direct`
   *Explanation being a form of physical contact.*
8. **cv2-i-once** — `"I'm gonna tell you once,"` — `threatening, demanding`
   *Once being, in this dialect, a sacred number.*
9. **cv2-i-heres-the-thing** — `"Here's the thing —"` — `direct, swaggering`
   *The em-dash is the threat.*
10. **cv2-i-get-this-through** — `"Get this through your head:"` — `demanding, threatening`
    *Through being a verb of force.*
11. **cv2-i-bottom-line** — `"Bottom line,"` — `direct, dismissive`
    *Lines have bottoms. Conversations end at them.*
12. **cv2-i-end-of-story** — `"End of story,"` — `dismissive, swaggering`
    *The story has been short. It ends shorter.*
13. **cv2-i-straight-up** — `"Straight up,"` — `direct, swaggering`
    *No qualifier necessary. There's the qualifier.*
14. **cv2-i-cut-the-crap** — `"Cut the crap,"` — `dismissive, demanding`
    *Crap-cutting being, in some dojos, a martial art.*
15. **cv2-i-real-talk** — `"Real talk:"` — `direct, swaggering`
    *Talk has, until now, been other things.*
16. **cv2-i-be-clear** — `"Let me be clear:"` — `direct, demanding`
    *Clarity, in this case, being a verb performed at volume.*
17. **cv2-i-period** — `"Period:"` — `dismissive, threatening`
    *The shortest sentence in chutzpah ends in a colon.*

#### Uncommon (6) — cost 1, +3 chutzpah

18. **cv2-i-now-you-listen** — `"Now you listen to me, friend,"` — `demanding, threatening, direct`
    *Friend is hostile when stretched to three syllables.*
19. **cv2-i-only-going-to-say** — `"I'm only going to say this once:"` — `threatening, swaggering`
    *Once is generous. Once is restraint.*
20. **cv2-i-hold-up** — `"Hold up, hold up, hold up —"` — `demanding, swaggering`
    *The triple is for emphasis. Also for time, which you do not have.*
21. **cv2-i-wanna-know** — `"You wanna know what I think?"` — `swaggering, direct`
    *Answer: no. Are they about to find out anyway: yes.*
22. **cv2-i-bring-it-on** — `"Bring it on, but understand —"` — `threatening, swaggering`
    *The understanding is doing more work than the bringing.*
23. **cv2-i-look-in-my-eyes** — `"Look in my eyes and tell me:"` — `demanding, direct`
    *Eye contact has a load-bearing function.*

#### Rare (2) — cost 2, +4 chutzpah

24. **cv2-i-dont-say-lightly** — `"Now I don't say this lightly, and I won't say it twice:"` — `threatening, direct, swaggering`
    *Lightly being a word for other people. Twice, also.*
25. **cv2-i-comes-a-time** — `"There comes a time, see, and that time is right now:"` — `demanding, swaggering, threatening`
    *The time has come. The time has been coming. You are the time.*

---

### Subjects (25)

Subjects address the target directly — chutzpah doesn't talk ABOUT the enemy, it talks AT them. Subjects often include "your" or "you" directly.

#### Basic (5) — cost 0, +1 chutzpah

26. **cv2-s-this-nonsense** — `"this nonsense"` — `dismissive`
    *Diagnosis: nonsense. Prognosis: about to be over.*
27. **cv2-s-your-attitude** — `"your attitude"` — `dismissive, direct`
    *Attitude being a thing that can, in fact, be confiscated.*
28. **cv2-s-this-whole-thing** — `"this whole thing"` — `dismissive`
    *Whole being a measurement of the problem.*
29. **cv2-s-all-of-it** — `"all of it"` — `dismissive, demanding`
    *All. Of. It. Three short words. Three short verdicts.*
30. **cv2-s-your-face** — `"your face"` — `direct, dismissive`
    *The face has been doing things. Things are noted.*

#### Common (12) — cost 0, +2 chutzpah

31. **cv2-s-your-big-talk** — `"your big talk"` — `dismissive, threatening`
    *Big being, here, a comparative measure with nothing to compare it to.*
32. **cv2-s-this-charade** — `"this whole charade"` — `dismissive, swaggering`
    *Charade is the technical term. Other words are available.*
33. **cv2-s-entire-premise** — `"the entire premise"` — `dismissive, direct`
    *Premises being something the bouncer escorts you out of.*
34. **cv2-s-little-routine** — `"your little routine"` — `dismissive`
    *Little is the unkindest of adjectives.*
35. **cv2-s-every-word** — `"every word coming out of your mouth"` — `dismissive, direct`
    *Every. Word. The math is exhaustive.*
36. **cv2-s-your-problem** — `"your problem"` — `direct, demanding`
    *Problem ownership is, in this dialect, an aggressive return of property.*
37. **cv2-s-song-and-dance** — `"this whole song and dance"` — `dismissive, swaggering`
    *Two art forms collapse into one verdict.*
38. **cv2-s-half-baked-plan** — `"your half-baked plan"` — `dismissive, threatening`
    *Half being the part that came out of the oven.*
39. **cv2-s-sorry-excuse** — `"your sorry excuse for an argument"` — `dismissive, threatening`
    *Sorry, in this register, is the only sincere word.*
40. **cv2-s-handling-yourself** — `"the way you're handling yourself"` — `direct, threatening`
    *Handling being a verb of escalating concern.*
41. **cv2-s-last-five-minutes** — `"everything you've said in the last five minutes"` — `dismissive, direct`
    *Five minutes being a charitable estimate.*
42. **cv2-s-your-tone** — `"your tone with me"` — `demanding, threatening`
    *Tone, having been with you, is now between us.*

#### Uncommon (6) — cost 1, +3 chutzpah

43. **cv2-s-audacity** — `"the audacity of bringing that here"` — `dismissive, threatening`
    *Audacity being its own category of crime.*
44. **cv2-s-keep-showing-up** — `"the way you keep showing up"` — `dismissive, threatening, direct`
    *The keep is the part we'll be discussing.*
45. **cv2-s-basic-respect** — `"your continued lack of basic respect"` — `demanding, dismissive`
    *Continued being the part that signals: this is a pattern now.*
46. **cv2-s-entire-universe** — `"the entire universe you've built around this"` — `dismissive, swaggering`
    *Universes being, in this case, structurally unsound.*
47. **cv2-s-special-grade** — `"the special grade of nonsense you've prepared"` — `dismissive, threatening`
    *Special grade implying considerable effort. The effort is noted.*
48. **cv2-s-standing-pretending** — `"the way you stand there pretending"` — `dismissive, direct`
    *The standing is the indictment. The pretending is the closing argument.*

#### Rare (2) — cost 1, +4 chutzpah

49. **cv2-s-unforced-errors** — `"the long, long list of unforced errors you've called a career"` — `dismissive, threatening, direct`
    *Long, long being two of the most damning words in commercial English.*
50. **cv2-s-brought-you-here** — `"everything that brought you to this exact moment, here, in front of me"` — `threatening, direct, swaggering`
    *Brought being a verb of unwanted gravity.*

---

### Targets (15)

Targets are short, declarative endings. They land. Chutzpah targets sometimes break grammar deliberately — "stops here" instead of "stops here, immediately, and with finality." The brevity IS the threat.

#### Common (5) — cost 1

51. **cv2-t-stops-now** — `"stops right now."` — base 5, ×2, +Weak 1, `demanding, direct`
    *Now being a word that, in chutzpah, carries actual force.*
    Effect: `{ scaleBy: 'chutzpah', base: 5, multiplier: 2, rider: { weak: 1 }, tags: ['demanding','direct'] }`
52. **cv2-t-is-over** — `"is over."` — base 4, ×2, `demanding, dismissive`
    *Two words, one verdict.*
53. **cv2-t-wont-fly** — `"won't fly here."` — base 4, ×2, `dismissive, direct`
    *Flying having been previously discussed and ruled out.*
54. **cv2-t-cost-you** — `"is gonna cost you."` — base 5, ×2, `threatening`
    *Gonna is the threat. Cost is the receipt.*
55. **cv2-t-ends-today** — `"ends today."` — base 5, ×2, `swaggering, demanding`
    *Today being the new deadline. There was an old one. We don't talk about it.*

#### Uncommon (6) — cost 2

56. **cv2-t-find-weather** — `"is about to find some weather."` — base 7, ×3, +Weak 1, `threatening, swaggering`
    *Weather being a forthcoming meteorological fact.*
57. **cv2-t-bit-off** — `"just bit off more than it can chew."` — base 8, ×3, `threatening, dismissive`
    *The chewing was always optional. The biting is now mandatory.*
58. **cv2-t-find-out** — `"is gonna find out exactly how this works."` — base 8, ×2, +Vulnerable 1, `threatening, direct`
    *Find out being a phrase with established consequences.*
59. **cv2-t-wrong-building** — `"is the wrong building, friend."` — base 9, ×2, `dismissive, threatening`
    *Friend, in chutzpah, is a contranym.*
60. **cv2-t-worst-day** — `"has chosen the worst day of its short life."` — base 8, ×3, `swaggering, threatening`
    *Choice having been a hypothetical for some time.*
61. **cv2-t-consequences** — `"is gonna learn what consequences look like."` — base 9, ×2, +Weak 2, `threatening, demanding`
    *Look like being a polite way to say feel like.*

#### Rare (4) — cost 2–3

62. **cv2-t-over-my-head** — `"is officially over my head."` — base 10, ×3, +Weak 2, `dismissive, swaggering`
    *Said with the gravity of a man with an extra inch of headroom.*
    Effect: `{ cost: 2, base: 10, multiplier: 3, rider: { weak: 2 }, tags: ['dismissive','swaggering'] }`
63. **cv2-t-ted-talk** — `"is gonna be a TED talk in three weeks, the unhinged kind."` — base 12, ×3, **doubles at Tier 3**, `dismissive, threatening`
    *Three weeks being the standard processing time for unhinged.*
    Effect: `{ cost: 2, base: 12, multiplier: 3, tier3Double: true, tags: ['dismissive','threatening'] }`
64. **cv2-t-stops-here-ends-here** — `"stops here, ends here, and gets buried here."` — base 11, ×3, +Vulnerable 1, `demanding, threatening, direct`
    *The triple is for those who didn't hear the first time.*
    Effect: `{ cost: 2, base: 11, multiplier: 3, rider: { vulnerable: 1 }, tags: ['demanding','threatening','direct'] }`
65. **cv2-t-actually-feel** — `"is fixin' to get acquainted with how I actually feel."` — base 14, ×3, **requires Tier 3**, `threatening, direct, swaggering`
    *Acquainted being a verb with substantial sequelae.*
    Effect: `{ cost: 3, base: 14, multiplier: 3, requiresTier3: { failureDamageMult: 0.5, exhaustOnFail: true }, tags: ['threatening','direct','swaggering'] }`

---

### Modifiers (10)

#### Common (4)

66. **cv2-m-swear-to-god** — `"I swear to god,"` (pre) — cost 0, adds `swaggering`, +1 chutzpah
    *The god is invoked rhetorically. Often.*
67. **cv2-m-and-i-mean-it** — `"...and I mean it."` (post) — cost 1, adds `demanding`, +Weak 1
    *Mean being a verb in continuous tense.*
68. **cv2-m-no-kidding** — `"no kidding,"` (pre) — cost 1, adds `direct`, draw 1 after cast
    *Kidding having been ruled out from the opening.*
69. **cv2-m-not-even-a-little** — `"...not even a little."` (post) — cost 1, adds `dismissive`, **+50% damage if Tier 2+**
    *A little, in this measure, is the smallest unit of forgiveness.*

#### Uncommon (4)

70. **cv2-m-slams-hand** — `"(slams hand on table,)"` (action — replaces intro) — cost 1, adds `direct`, +Vulnerable 1
    *Table is, structurally, fine. Was.*
71. **cv2-m-promise** — `"...and that's a promise."` (post) — cost 2, adds `threatening`, **+50% damage**
    *Promises being, in this currency, redeemable on arrival.*
72. **cv2-m-very-calmly** — `"(very calmly,)"` (pre) — cost 2, adds `threatening`, +Vulnerable 1, removes 1 enemy block
    *The calm IS the threat. Witnesses report goosebumps.*
73. **cv2-m-louder** — `"...and I'll say it again louder."` (post) — cost 2, **doubles damage if 2 chutzpah tags repeated in shared cards** (echo effect)
    *Volume being, in chutzpah, a multiplier on truth.*

#### Rare (2)

74. **cv2-m-mark-my-words** — `"...mark my words, write 'em down,"` (post) — cost 2, **at Tier 3: damage doubles AND apply Weak 2**
    *The writing-down is for the courts.*
75. **cv2-m-doesnt-blink** — `"(eye contact, doesn't blink,)"` (pre) — cost 2, adds `threatening, demanding`, strips 2 enemy block + +50% damage
    *Blinking having been ruled out at the door.*
