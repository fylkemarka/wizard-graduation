// Inline SVG icon — replaces the emoji glyph vocabulary with real game
// icons (game-icons.net, CC BY 3.0 — see design/ICON_CREDITS.md).
// Renders with fill="currentColor", so tint with Tailwind text-* classes
// exactly like the emoji they replace. Default sizing matches a text
// glyph (1em square, baseline-aligned) so it drops into existing copy.

import { GAME_ICON_PATHS } from './gameIcons.js';

export default function Icon({ name, className = '', size = '1em', title }) {
  const paths = GAME_ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size}
         className={`inline-block align-[-0.125em] ${className}`}
         aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {paths.map((d, i) => <path key={i} d={d} fill="currentColor" />)}
    </svg>
  );
}
