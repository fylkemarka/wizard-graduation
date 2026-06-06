// Bitmap art slot — renders an image from /art/** if the file exists,
// renders NOTHING if it doesn't (404 → onError → hidden). This lets the
// UI ship with empty slots that light up as generated images are dropped
// into public/art/ — no code change per image. See design/ART_PROMPTS.md
// for the full list of expected files + generation prompts.

import { useState } from 'react';

export default function ArtSlot({ src, alt = '', className = '', fallback = null }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (failedSrc === src) return fallback;
  return (
    <img src={src} alt={alt} className={className} draggable={false}
         onError={() => setFailedSrc(src)} />
  );
}
