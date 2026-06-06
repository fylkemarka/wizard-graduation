# Icon credits

UI icons come from [game-icons.net](https://game-icons.net), licensed
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Per-icon authors:

| Icon key | Source icon | Author |
|---|---|---|
| attack | crossed-swords | Lorc |
| block | checked-shield | Lorc |
| poise | mirror-mirror | Lorc |
| energy | power-lightning | Lorc |
| hp | hearts | Skoll |
| composure | drama-masks | Lorc |
| bleed | drop | Lorc |
| weak | broken-bone | Lorc |
| peek | eye-target | Delapouite |
| annotate | quill-ink | Lorc |
| shout | shouting | Lorc |
| insult | on-target | Lorc |
| pressure | flame | Carl Olsen |
| stagger | vortex | Lorc |
| maul | bestial-fangs | Lorc |
| cast | fairy-wand | Lorc |
| relic | prayer-beads | Delapouite |
| paw | flat-paw-print | Lorc |
| scroll | scroll-unfurled | Lorc |
| sparkle | sparkles | Delapouite |

**Attribution requirement:** ship a visible credit ("Icons by Lorc, Delapouite,
Skoll, Carl Olsen — game-icons.net, CC BY 3.0") somewhere user-reachable —
the title-screen footer or a credits screen.

## Regenerating `src/icons/gameIcons.js`

1. Download `https://raw.githubusercontent.com/game-icons/icons/master/<author>/<name>.svg`
2. Strip the `M0 0h512v512H0z` background path; keep remaining `<path d>` values
3. Emit `{ key: [d, ...] }` into `GAME_ICON_PATHS`

`src/icons/Icon.jsx` renders them at `viewBox 0 0 512 512` with
`fill="currentColor"` so Tailwind `text-*` classes control the tint.
