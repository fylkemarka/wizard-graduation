# Art generation prompts — Witch Mountain Bridge

Drop generated images into `public/art/` using the exact filenames below.
The UI has live slots (`ArtSlot` component) that render each image the
moment the file exists and stay invisible while it doesn't — no code
changes needed per image. PNG preferred; JPG also works if you rename.

## Global style block (prepend to every prompt)

> Storybook fantasy illustration in the spirit of Terry Pratchett's
> Discworld — warm candlelit palette of parchment, umber, antique gold
> and deep ink-brown; muted purple and ember-red accents; painterly
> gouache texture; gentle absurdist humor, characters slightly pompous
> and visibly out of their depth; NO grimdark, NO anime, NO photorealism;
> dark vignetted background that fades to near-black at the edges
> (#140f08) so it blends into the game's backdrop.

## Characters — `public/art/characters/<lane>.png` (1024×768, landscape)

| File | Prompt (after style block) |
|---|---|
| `wit.png` | A lean middle-aged wizard scholar in immaculate silk pajama-robes and a tidy travelling scarf, one eyebrow raised mid-rebuttal, holding a footnoted scroll like a weapon; secretly uptight, faintly smug; a leather satchel of annotated books at his hip. |
| `handler.png` | A broad, weathered wizard in a many-pocketed oilskin coat festooned with lures, feathers and a suspicious amount of birdseed; a salmon under one arm and an unbothered owl on the shoulder; the confidence of a man who has talked to bears and expects them to listen. |
| `jnsq.png` | A rumpled, beaming wizard whose robes are buttoned one button wrong, hat at an angle physics disputes, holding dice that are mid-roll and glowing; an aura of chaotic luck; somehow both a disaster and the most relaxed person on the mountain. |

## Acts — `public/art/acts/act-<n>.png` (1920×1080)
*(not yet wired to a slot — generate last; will back the map screen)*

| File | Prompt |
|---|---|
| `act-1.png` | A winding mountain path through a valley of enormous half-woven tapestries strung between standing stones, threads drifting like fog; loom-light in the distance. |
| `act-2.png` | A glittering forge-canyon, veins of crystal in the rock, distant anvil-glow and chimney smoke rising from workshops carved into cliffs. |
| `act-3.png` | A bramble-choked ascent past a ruined wizard school outpost, thorn hedges grown through lecture halls, a thornlord's silhouette far above. |
| `act-4.png` | The final ridge to Witch Mountain Bridge itself — a rope-and-plank bridge over cloud, graduation banners weathered to rags, the school far below. |

## Enemies — `public/art/enemies/<id>.png` (512×512, square bust/portrait)

Enemies are rogue wizards and their leavings — graduates who never came
back. Keep each one slightly tragic and slightly ridiculous.

### Act 1 — Thread Path
| File | Prompt |
|---|---|
| `e2-hollow-weaver.png` | A hollow-robed figure of empty cloth animated by habit, endlessly weaving with no hands, loose threads where a face should be. |
| `e2-silk-wraith.png` | A translucent wraith of drifting silk scarves, elegant and faintly disapproving, re-weaving itself as parts of it unravel. |
| `e2-loom-familiar.png` | A small, officious creature built from a portable loom, shuttle snapping like jaws, wearing its warp-threads like a barrister's wig. |
| `e-rogue-linenfast.png` | Bartholomew Linenfast: a once-dapper wizard sewn into robes he is still adjusting, pins in his mouth, measuring tape moving on its own; deceased but impeccably hemmed. |
| `e2-pattern-maker.png` | An imperious figure whose body is a living dress-pattern, chalk lines and arrows over muslin, gesturing as if everyone else is fabric to be corrected. |
| `e2-silent-spinner.png` | A tall hooded spinner at a wheel that spins quiet itself — sound visibly being drawn out of the air into thread. |
| `e2-boss-tapestry.png` | BOSS: The Tapestry Walker — a vast figure mid-stride out of a hanging tapestry, half woven scene and half person, landscapes still moving across its body. |

### Act 2 — Forge Path
| File | Prompt |
|---|---|
| `e3-geode-crab.png` | A squat crab whose shell is a split geode, amethyst teeth in the cleft, scuttling with misplaced dignity. |
| `e3-glow-mite.png` | A drifting constellation of ember-bright mites forming a vaguely annoyed face. |
| `e3-crystal-beetle.png` | A fist-sized beetle of faceted quartz, light refracting wrongly through it, polishing itself smugly. |
| `e-rogue-smelterson.png` | Smelterson, J.C. (alloyed): a wizard half-merged with bronze from a forge accident he refuses to discuss, monocle fused in place, gesturing with a ladle. |
| `e3-quartz-sentinel.png` | A towering sentinel of cloudy quartz in the remains of academic robes, light pulsing slowly inside like a thought it never finishes. |
| `e3-vein-devourer.png` | A serpentine thing of ore and appetite chewing through a crystal vein, gemstone dust on its chin. |
| `e3-boss-anvil.png` | BOSS: The Anvil-Forged — a massive figure hammered into being on its own back-anvil, seams glowing, each movement ringing faintly. |

### Act 3 — Staff Path
| File | Prompt |
|---|---|
| `e1-acolyte.png` | A lost acolyte wizard, robes gone feral with moss, clutching a staff that is clearly just a stick he has strong feelings about. |
| `e1-imp.png` | A pact imp the size of a kettle, contract clauses tattooed on its skin, grinning with notarized malice. |
| `e1-shrine-rat.png` | A pack of shrine rats wearing tiny votive offerings as armor, one carrying a candle like a standard-bearer. |
| `e-rogue-ashweather.png` | Doctor Phin Ashweather (recently inanimate): a distinguished wizard statue-grey from the waist down, still lecturing, dust rising when he gestures. |
| `e1-tutor.png` | A stern tutor with a red-ink quill like a rapier, marginalia floating around her head, gaze that deducts points on contact. |
| `e1-thicket.png` | A living thicket with a lectern grown into its chest, brambles curled like crossed arms. |
| `e1-boss-thornlord.png` | BOSS: The Thornlord — a crowned mass of rose-briar in the shape of a headmaster, blossoms opening when it is pleased, which is never. |

### Special
| File | Prompt |
|---|---|
| `sq-critical-apparition.png` | Prof. Augustus Hewn-Greaves (deceased, 1893): a translucent Victorian professor's ghost, mid-footnote, pince-nez and disappointment intact. |
| `tutorial-bursar.png` | The Bursar (practice match): a gentle, slightly transparent administrator holding a clipboard, radiating the calm of a man for whom this is all expense-reportable. |

## Title — `public/art/title.png` (1920×1080)
*(not yet wired — optional hero art behind the menu)*

> The Witch Mountain Bridge at dusk seen from below: a rope bridge over
> clouds between two peaks, a single tiny wizard with a walking staff
> beginning the climb, warm window-lights of the school behind them.

## Workflow

1. Generate with the global style block + per-image prompt.
2. Crop/resize to the listed dimensions (slots use `object-cover`, so
   modest aspect drift is fine).
3. Drop into `public/art/...` with the exact filename, reload — done.
4. Commit the images (they deploy with the site via Vercel).
