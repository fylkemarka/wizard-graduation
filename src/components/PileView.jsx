// PileView — a focused modal that lists the cards currently in ONE pile
// (draw or discard). Unlike DeckView (which is an FFT-grouped inventory of
// everything you own), this answers the in-combat question "what's left to
// draw?" / "what have I burned through?".
//
// The draw pile is shown SORTED (by cost, then name), NOT in draw order —
// the player asked to see WHAT is left without it leaking the next-draw
// sequence (Alan, 2026-06-01).
import { useMemo } from 'react';
import { CardFullBody } from './CardFullBody.jsx';

export function PileView({ open, onClose, title, note, cards = [], lane = null }) {
  const sorted = useMemo(() => {
    if (!open) return [];
    return [...cards].sort((a, b) => {
      const ca = a.cost ?? 0, cb = b.cost ?? 0;
      if (ca !== cb) return ca - cb;
      return (a.name || a.phrase || '').localeCompare(b.name || b.phrase || '');
    });
  }, [open, cards]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-ink-900 bg-opacity-85 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="parchment-card-strong max-w-5xl max-h-[92vh] overflow-y-auto p-6 relative"
           onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
                className="absolute top-3 right-3 text-ink-400 hover:text-parchment-50 text-2xl leading-none">✕</button>
        <div className="mb-4">
          <div className="font-display text-2xl text-moss-300">{title} · {sorted.length}</div>
          {note && <div className="text-sm text-parchment-300 mt-1 italic">{note}</div>}
        </div>
        {sorted.length === 0 ? (
          <div className="text-center text-parchment-400 italic py-8">This pile is empty.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sorted.map((c, i) => (
              <div key={c.uid ?? `${c.id}-${i}`}
                className="w-48 min-h-[280px] rounded-lg border-2 p-2.5 text-left flex flex-col gap-1 shadow-md bg-parchment-50 text-ink-800 border-ink-300">
                <CardFullBody card={c} lane={lane} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
