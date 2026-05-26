// DeckView modal — full inventory of cards the player currently owns,
// grouped by FFT row (for collection planning) plus an "Unaffiliated"
// bucket for cards not in any row. Each card shows where it currently
// lives (hand / deck / discard / exiled / tray) so the player can
// reason about what's drawable now vs. later.
//
// Opened from the combat screen FFT Progress panel as a sibling to
// the Compendium button. The two surfaces are complementary:
//   Compendium  — system-level: every row, canonical + rider, learned
//                 state derived from card ownership.
//   DeckView    — inventory: the actual cards in your deck, grouped
//                 by row so you can see what you're collecting toward.
import { useMemo } from 'react';
import { CardFullBody } from './CardFullBody.jsx';
import { WIT_ROWS, WIT_ROW_BY_ID, WIT_TIER_SUB_BONUSES } from '../cards/wit-v2-rows.js';

const TIER_ORDER = ['slowburn', 'thorns', 'crescendo'];
const SLOT_ORDER = ['intro', 'subject', 'target', 'modifier', 'gesture', 'annotation', 'skill', 'power'];

function locationLabel(loc) {
  switch (loc) {
    case 'hand':    return { text: 'in hand',    cls: 'bg-moss-700 text-parchment-50' };
    case 'tray':    return { text: 'staged',     cls: 'bg-gold-700 text-parchment-50' };
    case 'discard': return { text: 'discard',    cls: 'bg-ink-600 text-parchment-200' };
    case 'exiled':  return { text: 'exiled',     cls: 'bg-ember-800 text-parchment-200' };
    case 'deck':    return { text: 'in deck',    cls: 'bg-iris-700 text-parchment-50' };
    default:        return { text: loc,          cls: 'bg-ink-600 text-parchment-200' };
  }
}

export function DeckView({ open, onClose, hand = [], deck = [], discard = [], exiled = [], tray = null }) {
  const allOwned = useMemo(() => {
    if (!open) return [];
    const trayCards = tray
      ? [tray.intro, tray.subject, tray.target, ...(tray.modifiers || [])].filter(Boolean).map(c => ({ ...c, _loc: 'tray' }))
      : [];
    return [
      ...hand.map(c => ({ ...c, _loc: 'hand' })),
      ...deck.map(c => ({ ...c, _loc: 'deck' })),
      ...discard.map(c => ({ ...c, _loc: 'discard' })),
      ...exiled.map(c => ({ ...c, _loc: 'exiled' })),
      ...trayCards,
    ];
  }, [open, hand, deck, discard, exiled, tray]);

  if (!open) return null;

  // Group: row → cards owned in that row.
  const rowGroups = {};
  for (const c of allOwned) {
    if (!c.setId) continue;
    if (!rowGroups[c.setId]) rowGroups[c.setId] = [];
    rowGroups[c.setId].push(c);
  }

  // Group: tier → list of rows with progress > 0.
  const rowsByTier = {};
  for (const tier of TIER_ORDER) rowsByTier[tier] = [];
  for (const row of WIT_ROWS) {
    if (rowGroups[row.id] && rowGroups[row.id].length > 0) {
      rowsByTier[row.tierId].push(row);
    }
  }

  // Unaffiliated wit cards (have lane='wit' or slot, but no setId).
  const unaffiliated = allOwned.filter(c => !c.setId && (c.slot === 'intro' || c.slot === 'subject' || c.slot === 'target' || c.slot === 'modifier'));
  const utilityCards = allOwned.filter(c => c.slot === 'gesture' || c.slot === 'annotation' || c.slot === 'skill' || c.slot === 'power' || c.type === 'skill' || c.type === 'power');
  const unaffByType = {};
  for (const c of unaffiliated) {
    const k = c.slot || 'other';
    if (!unaffByType[k]) unaffByType[k] = [];
    unaffByType[k].push(c);
  }

  const totalOwned = allOwned.length;
  const tagged = allOwned.filter(c => c.setId).length;

  const cardCard = (c, key) => (
    <div key={key}
      className="w-48 min-h-[280px] rounded-lg border-2 p-2.5 text-left flex flex-col gap-1 shadow-md bg-parchment-50 text-ink-800 border-ink-300 relative">
      <div className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${locationLabel(c._loc).cls}`}>
        {locationLabel(c._loc).text}
      </div>
      <CardFullBody card={c} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-ink-900 bg-opacity-85 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="parchment-card-strong max-w-6xl max-h-[92vh] overflow-y-auto p-6 relative"
           onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
                className="absolute top-3 right-3 text-ink-400 hover:text-parchment-50 text-2xl leading-none">✕</button>
        <div className="mb-4">
          <div className="font-display text-2xl text-moss-300 flex items-center gap-2">
            🗂 Your Deck
          </div>
          <div className="text-sm text-parchment-300 mt-1">
            {totalOwned} cards owned · {tagged} set-tagged · grouped by FFT row, then by slot
          </div>
        </div>

        {TIER_ORDER.map(tierId => {
          const tier = WIT_TIER_SUB_BONUSES[tierId];
          const rows = rowsByTier[tierId];
          if (rows.length === 0) return null;
          return (
            <div key={tierId} className="mb-6">
              <div className="font-display text-lg text-iris-200 mb-2 pb-1 border-b border-iris-800">
                {tier?.name || tierId}
              </div>
              {rows.map(row => {
                const cardsOwned = rowGroups[row.id] || [];
                const slotsOwned = new Set(cardsOwned.map(c => c.setSlot));
                const owned = slotsOwned.size;
                const complete = owned === 3;
                return (
                  <div key={row.id} className="mb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-display text-base text-parchment-50">{row.name}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                        complete ? 'bg-gold-700 text-parchment-50 border-gold-400'
                                 : owned === 2 ? 'bg-iris-800 text-parchment-100 border-iris-500'
                                               : 'bg-ink-600 text-parchment-200 border-ink-500'
                      }`}>{owned}/3</span>
                      <span className="text-[11px] text-parchment-400 italic">"{row.canonical}"</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cardsOwned.map((c, i) => cardCard(c, `${row.id}-${i}`))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Unaffiliated word cards */}
        {Object.keys(unaffByType).length > 0 && (
          <div className="mb-6">
            <div className="font-display text-lg text-parchment-200 mb-2 pb-1 border-b border-ink-500">
              Unaffiliated word cards
            </div>
            {SLOT_ORDER.filter(s => unaffByType[s]).map(slot => (
              <div key={slot} className="mb-3">
                <div className="text-xs uppercase tracking-widest text-parchment-400 mb-1.5">{slot}s ({unaffByType[slot].length})</div>
                <div className="flex flex-wrap gap-2">
                  {unaffByType[slot].map((c, i) => cardCard(c, `unaff-${slot}-${i}`))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Utility cards (skills, gestures, annotations, powers) */}
        {utilityCards.length > 0 && (
          <div className="mb-2">
            <div className="font-display text-lg text-parchment-200 mb-2 pb-1 border-b border-ink-500">
              Utility ({utilityCards.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {utilityCards.map((c, i) => cardCard(c, `util-${i}`))}
            </div>
          </div>
        )}

        {totalOwned === 0 && (
          <div className="text-center text-parchment-400 italic py-8">
            No cards in deck. (You may be between combats.)
          </div>
        )}
      </div>
    </div>
  );
}
