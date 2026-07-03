# Audio Overrides — filename spec

All game audio is WebAudio-synthesized (src/audio.js), so it works with zero
assets. Any real file you drop into `public/audio/` **overrides** its synth
version automatically — same pattern as the art slots (public/art/**).
Format: `.mp3`. A file is used only if the server returns an `audio/*`
content-type for it (missing files fall back to synth silently).

## public/audio/sfx/ — one-shot effects

| File | Plays when |
|---|---|
| `hit.mp3` | anyone takes physical (HP) damage |
| `hit-composure.mp3` | anyone takes composure damage |
| `block.mp3` | gaining Block / an attack fully absorbed |
| `poise.mp3` | gaining Poise |
| `cast.mp3` | casting a spell (the sentence fires) |
| `victory.mp3` | enemy defeated |

## public/audio/sfx/animal-<id>.mp3 — summon calls

Played when the animal arrives on the board. One per animalId:

`animal-goose` (honk) · `animal-raven` (caw) · `animal-field-mouse` (squeak) ·
`animal-mecha-mouse` · `animal-young-buck` (snort) · `animal-james-deer` ·
`animal-rabbit` (thump) · `animal-bonzai-bunaroo` · `animal-ox` (low) ·
`animal-sheepdog` (bark) · `animal-lyrebird` (trill) · `animal-porcupine`
(rustle) · `animal-sloth` (slow yawn) · `animal-pigeon` (coo) ·
`animal-kangaroo` (boing) · `animal-salmon` (splash) · `animal-bear` (roar) ·
`animal-hawk` (screech) · `animal-owl` (hoot) · `animal-rabid-scrubjay`
(harsh chirp)

## public/audio/music/ — combat beds (looped)

| File | Plays for |
|---|---|
| `normal.mp3` | normal combats |
| `elite.mp3` | elite combats (incl. sidequest elites) |
| `boss.mp3` | act bosses |

Procedural fallback (no files): normal = slow drone + sparse minor-pentatonic
pluck (~70bpm); elite = adds a driving eighth-note bass pulse, dorian colour
(~104); boss = adds percussion + a half-step menace arpeggio (~128).

Music starts on combat entry, stops on any combat exit. Mute toggle (🔊/🔇)
lives in the combat action bar; state persists in localStorage.
