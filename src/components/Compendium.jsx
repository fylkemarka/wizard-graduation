// Compendium modal — wit-only. Shows all 24 FFT rows grouped by tier.
// A row is "learned" when the player owns at least one card from it
// (anywhere across hand/deck/discard/exiled/tray). Learned rows reveal
// the canonical sentence + rider; unlearned rows show only the row name
// + tier as a teaser.
//
// Opens from the combat-screen FFT Progress panel. Click backdrop or
// the close button to dismiss.

import { WIT_ROWS, WIT_TIER_SUB_BONUSES, WIT_PARTIAL_ROW_BONUSES } from '../cards/wit-v2-rows.js';

const TIER_ORDER = ['atelier', 'hygiene', 'transportation'];

function describeBonus(bonus) {
  if (!bonus) return '';
  const parts = [];
  if (bonus.longThreadPerm) parts.push(`+${bonus.longThreadPerm} LT perm`);
  if (bonus.composure)      parts.push(`+${bonus.composure} Composure`);
  if (bonus.block)          parts.push(`+${bonus.block} Block`);
  if (bonus.poise)          parts.push(`+${bonus.poise} Poise`);
  if (bonus.energy)         parts.push(`+${bonus.energy} Energy`);
  if (bonus.draw)           parts.push(`draw ${bonus.draw}`);
  if (bonus.damageMult)     parts.push(`×${bonus.damageMult} damage`);
  if (bonus.bonus)          parts.push(`+${bonus.bonus} flat dmg`);
  return parts.join(' · ');
}

export function Compendium({ open, onClose, hand = [], deck = [], discard = [], exiled = [], tray = null }) {
  if (!open) return null;
  const trayCards = tray
    ? [tray.intro, tray.subject, tray.target, ...(tray.modifiers || [])].filter(Boolean)
    : [];
  const allCards = [...hand, ...deck, ...discard, ...exiled, ...trayCards];

  // For each row, compute progress + learned state.
  const progressByRow = {};
  for (const c of allCards) {
    if (!c.setId) continue;
    if (!progressByRow[c.setId]) progressByRow[c.setId] = { intro: false, subject: false, target: false };
    if (c.setSlot === 'intro')   progressByRow[c.setId].intro = true;
    if (c.setSlot === 'subject') progressByRow[c.setId].subject = true;
    if (c.setSlot === 'target')  progressByRow[c.setId].target = true;
  }

  const rowsByTier = {};
  for (const tier of TIER_ORDER) rowsByTier[tier] = [];
  for (const row of WIT_ROWS) {
    if (rowsByTier[row.tierId]) rowsByTier[row.tierId].push(row);
  }

  // Count learned + full-row stats for the header.
  const totalRows = WIT_ROWS.length;
  let learnedCount = 0;
  let completedCount = 0;
  for (const row of WIT_ROWS) {
    const p = progressByRow[row.id];
    if (p) {
      const owned = (p.intro ? 1 : 0) + (p.subject ? 1 : 0) + (p.target ? 1 : 0);
      if (owned > 0) learnedCount++;
      if (owned === 3) completedCount++;
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900 bg-opacity-80 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="parchment-card-strong max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative"
           onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
                className="absolute top-3 right-3 text-ink-400 hover:text-parchment-50 text-2xl leading-none">
          ✕
        </button>
        <div className="mb-4">
          <div className="font-display text-2xl text-iris-300 flex items-center gap-2">
            📚 Compendium of Fully Formed Thoughts
          </div>
          <div className="text-sm text-parchment-300 mt-1">
            {learnedCount} of {totalRows} rows known · {completedCount} complete
          </div>
          <div className="text-[11px] text-parchment-400 italic mt-1">
            Own any card of a row to reveal its phrase + rider. Cast 2 or 3 cards of a row in one spell for the bonus.
          </div>
        </div>

        {TIER_ORDER.map(tierId => {
          const tier = WIT_TIER_SUB_BONUSES[tierId];
          const partial = WIT_PARTIAL_ROW_BONUSES[tierId];
          const rows = rowsByTier[tierId] || [];
          return (
            <div key={tierId} className="mb-5">
              <div className="flex items-baseline gap-3 mb-2 pb-1 border-b border-iris-800">
                <div className="font-display text-lg text-iris-200">{tier?.name || tierId}</div>
                <div className="text-[11px] text-parchment-400">
                  All-3 tier bonus: <span className="text-iris-300">{describeBonus(tier)}</span>
                  {' · '}
                  Half-formed (2-of-row): <span className="text-iris-300">{describeBonus(partial)}</span>
                </div>
              </div>
              <div className="grid gap-2">
                {rows.map(row => {
                  const p = progressByRow[row.id] || { intro: false, subject: false, target: false };
                  const owned = (p.intro ? 1 : 0) + (p.subject ? 1 : 0) + (p.target ? 1 : 0);
                  const learned = owned > 0;
                  const complete = owned === 3;
                  return (
                    <div key={row.id}
                         className={`p-2 rounded border ${
                           complete ? 'bg-gold-900/40 border-gold-500'
                                    : learned ? 'bg-iris-900/40 border-iris-700'
                                              : 'bg-ink-700/40 border-ink-600'
                         }`}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className={`font-display text-base ${learned ? 'text-parchment-50' : 'text-parchment-400'}`}>
                            {row.name}
                            {!learned && <span className="text-[11px] text-ink-400 ml-2 italic">(undiscovered)</span>}
                          </div>
                          {learned && (
                            <>
                              <div className="text-sm text-parchment-200 italic mt-1">
                                "{row.canonical}"
                              </div>
                              <div className="text-[11px] text-gold-300 mt-1">
                                Full row: {row.riderDesc || '(rider TBD)'}
                              </div>
                            </>
                          )}
                        </div>
                        <div className={`shrink-0 text-xs font-bold px-2 py-1 rounded border ${
                          complete ? 'bg-gold-700 text-parchment-50 border-gold-400'
                                   : learned ? 'bg-iris-800 text-parchment-100 border-iris-500'
                                             : 'bg-ink-600 text-parchment-400 border-ink-500'
                        }`}>
                          {owned}/3
                        </div>
                      </div>
                      {learned && (
                        <div className="flex gap-2 mt-1 text-[10px] uppercase tracking-wider">
                          <span className={p.intro ? 'text-moss-400' : 'text-ink-500'}>
                            {p.intro ? '✓' : '○'} Intro
                          </span>
                          <span className={p.subject ? 'text-moss-400' : 'text-ink-500'}>
                            {p.subject ? '✓' : '○'} Subject
                          </span>
                          <span className={p.target ? 'text-moss-400' : 'text-ink-500'}>
                            {p.target ? '✓' : '○'} Target
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
