// Reading Room — wit-only rest variant. Two random tiers are rolled, five
// random set-tagged cards are drawn from each tier's pool (10 cards total).
// The player picks 0-3 cards on a cost ladder:
//   0-1 cards: free
//   2 cards:   4 HP
//   3 cards:   8 HP
//
// Picked cards go to the player's discard (so they shuffle into the deck
// on the next reshuffle). Owning any card from a row auto-learns it in
// the Compendium.

import { useState, useMemo } from 'react';
import { CardFullBody } from './CardFullBody.jsx';
import { WIT_TIER_SUB_BONUSES, WIT_ROW_BY_ID } from '../cards/wit-v2-rows.js';

const TIER_IDS = ['atelier', 'hygiene', 'transportation'];

function rng(seed) {
  // Deterministic-enough shuffle for one screen.
  return Math.random();
}

function shuffle(arr) {
  const next = arr.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function costForCount(n) {
  if (n <= 1) return 0;
  if (n === 2) return 4;
  return 8; // 3 cards
}

export function ReadingRoom({ open, witCards, currentHp, ownedCards = [], onConfirm, onCancel }) {
  // Generate pool once per open: 2 random tiers, 5 cards each. We memoize
  // on `open` so re-renders don't reroll; closing + reopening rerolls.
  const pool = useMemo(() => {
    if (!open) return [];
    const tiers = shuffle(TIER_IDS).slice(0, 2);
    const draws = [];
    for (const t of tiers) {
      const tierCards = witCards.filter(c => c.tierId === t && c.setId);
      const picked = shuffle(tierCards).slice(0, 5);
      draws.push(...picked);
    }
    return draws;
  }, [open]);

  const [selectedUids, setSelectedUids] = useState(new Set());

  if (!open) return null;

  const selectedCount = selectedUids.size;
  const hpCost = costForCount(selectedCount);
  const canAfford = currentHp > hpCost; // Must survive (HP > cost, not >=).
  const atCap = selectedCount >= 3;

  // Helper: per-row progress in player's already-owned pool. Used to show
  // "X/3 owned" beside each pool card so the player knows what nudges them
  // toward an FFT completion.
  const ownedByRow = {};
  for (const c of ownedCards) {
    if (!c.setId) continue;
    if (!ownedByRow[c.setId]) ownedByRow[c.setId] = 0;
    ownedByRow[c.setId]++;
  }

  // Group displayed pool by tier for clarity.
  const groupedByTier = {};
  for (const c of pool) {
    if (!groupedByTier[c.tierId]) groupedByTier[c.tierId] = [];
    groupedByTier[c.tierId].push(c);
  }

  function toggle(uid) {
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else if (next.size < 3) next.add(uid);
      return next;
    });
  }

  function handleConfirm() {
    const picked = pool.filter(c => selectedUids.has(c.uid));
    onConfirm(picked, hpCost);
  }

  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-5xl mx-auto">
      <div className="text-center">
        <h2 className="font-display text-3xl text-iris-300">📖 The Reading Room</h2>
        <p className="font-quill italic text-parchment-200 mt-1 max-w-2xl mx-auto">
          A small library tucked beside the campfire. Pamphlets, monographs, and field-guides
          line the shelves. You have time to study a few before the road moves on.
        </p>
      </div>

      <div className="parchment-card p-3 flex items-center justify-center gap-6 text-sm">
        <div>
          <span className="text-parchment-300">Selected:</span>{' '}
          <span className="font-mono text-parchment-50">{selectedCount} / 3</span>
        </div>
        <div>
          <span className="text-parchment-300">Cost:</span>{' '}
          <span className={`font-mono ${hpCost > 0 ? 'text-ember-300' : 'text-moss-300'}`}>
            {hpCost === 0 ? 'Free' : `${hpCost} HP`}
          </span>
        </div>
        <div className="text-[11px] text-parchment-400 italic">
          1 free · 2 for 4 HP · 3 for 8 HP
        </div>
      </div>

      {TIER_IDS.filter(t => groupedByTier[t]).map(tierId => {
        const tier = WIT_TIER_SUB_BONUSES[tierId];
        return (
          <div key={tierId} className="parchment-card p-3">
            <div className="text-xs uppercase tracking-widest text-iris-300 mb-2">
              {tier?.name || tierId} · 5 sources
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {groupedByTier[tierId].map((c, i) => {
                const key = `${c.id}-${i}`;
                const isSelected = selectedUids.has(c.uid);
                const row = WIT_ROW_BY_ID[c.setId];
                const ownedInRow = ownedByRow[c.setId] || 0;
                return (
                  <button key={key}
                    onClick={() => toggle(c.uid)}
                    disabled={!isSelected && atCap}
                    className={`w-52 min-h-[270px] rounded-md border-2 p-3 text-left text-ink-800 flex flex-col gap-1.5 transition ${
                      isSelected
                        ? 'bg-gold-200 border-gold-600 ring-2 ring-gold-400 scale-105'
                        : (!isSelected && atCap)
                          ? 'bg-parchment-100 border-ink-400 opacity-50 cursor-not-allowed'
                          : 'bg-parchment-50 border-iris-500 hover:scale-105 hover:shadow-xl'
                    }`}>
                    <CardFullBody card={c} />
                    {row && ownedInRow > 0 && (
                      <div className="text-[10px] text-moss-700 font-bold border-t border-ink-300 pt-1 mt-auto">
                        You already have {ownedInRow}/3 of {row.name}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex gap-3 justify-center mt-2">
        <button onClick={onCancel} className="btn btn-ink">Leave Library</button>
        <button
          onClick={handleConfirm}
          disabled={!canAfford && selectedCount > 0}
          className={`btn ${canAfford || selectedCount === 0 ? 'btn-iris' : 'btn-ink opacity-50'}`}>
          {selectedCount === 0 ? 'Leave with nothing' : `Take ${selectedCount} card${selectedCount > 1 ? 's' : ''}${hpCost > 0 ? ` (−${hpCost} HP)` : ''}`}
        </button>
      </div>
      {!canAfford && selectedCount > 0 && (
        <div className="text-center text-xs text-ember-300 italic">
          The price would put you in the grave. Pick fewer.
        </div>
      )}
    </div>
  );
}
