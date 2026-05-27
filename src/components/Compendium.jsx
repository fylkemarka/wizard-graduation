// Compendium modal — wit-only. v3.3 refresh: skill-tree-style 3-column
// layout. Each tier (Slow Burn / Thorns / Crescendo) is a vertical
// column with its sub-bonus + half-formed bonus at the top, and its 5
// rows listed as nodes below. Owned cards highlight the slot dots;
// completed rows light up gold. Riders are ALWAYS visible (no
// hover-to-reveal) so the player can read the whole school as a
// "skill tree" of available archetypes.
//
// Alan: "Phrases still didn't feel relevant. They should be as clear
// as a skill tree in a game where characters level up."

import { WIT_ROWS, WIT_TIER_SUB_BONUSES, WIT_PARTIAL_ROW_BONUSES } from '../cards/wit-v2-rows.js';

const TIER_ORDER = ['slowburn', 'thorns', 'crescendo'];

const TIER_PALETTE = {
  slowburn:  { name: 'Slow Burn',     icon: '🔥', columnBg: 'bg-ember-900/30', border: 'border-ember-500', accent: 'text-ember-300', header: 'bg-ember-800/60' },
  thorns:    { name: 'Thorns',        icon: '🌹', columnBg: 'bg-iris-900/30',  border: 'border-iris-500',  accent: 'text-iris-300',  header: 'bg-iris-800/60' },
  crescendo: { name: 'Crescendo',     icon: '📚', columnBg: 'bg-gold-900/30',  border: 'border-gold-500',  accent: 'text-gold-300',  header: 'bg-gold-800/60' },
};

function describeBonus(bonus) {
  if (!bonus) return '';
  const parts = [];
  if (bonus.longThreadPerm) parts.push(`+${bonus.longThreadPerm} LT perm`);
  if (bonus.composure)      parts.push(`+${bonus.composure} Comp`);
  if (bonus.block)          parts.push(`+${bonus.block} Block`);
  if (bonus.poise)          parts.push(`+${bonus.poise} Poise`);
  if (bonus.energy)         parts.push(`+${bonus.energy} Energy`);
  if (bonus.draw)           parts.push(`draw ${bonus.draw}`);
  if (bonus.damageMult)     parts.push(`×${bonus.damageMult} dmg`);
  if (bonus.bonus)          parts.push(`+${bonus.bonus} flat`);
  if (bonus.dot)            parts.push(`DoT ${bonus.dot.amount}/turn × ${bonus.dot.turns}`);
  if (bonus.thorns)         parts.push(`Reflect ${bonus.thorns.amount} × ${bonus.thorns.count}`);
  if (bonus.addBank)        parts.push(`+${bonus.addBank} Words`);
  return parts.join(' · ');
}

export function Compendium({ open, onClose, hand = [], deck = [], discard = [], exiled = [], tray = null }) {
  if (!open) return null;
  const trayCards = tray
    ? [tray.intro, tray.subject, tray.target, ...(tray.modifiers || [])].filter(Boolean)
    : [];
  const allCards = [...hand, ...deck, ...discard, ...exiled, ...trayCards];

  const progressByRow = {};
  for (const c of allCards) {
    if (!c.setId) continue;
    if (!progressByRow[c.setId]) progressByRow[c.setId] = { intro: false, subject: false, target: false };
    if (c.setSlot === 'intro')   progressByRow[c.setId].intro = true;
    if (c.setSlot === 'subject') progressByRow[c.setId].subject = true;
    if (c.setSlot === 'target')  progressByRow[c.setId].target = true;
  }

  const rowsByTier = {};
  for (const t of TIER_ORDER) rowsByTier[t] = [];
  for (const row of WIT_ROWS) {
    if (rowsByTier[row.tierId]) rowsByTier[row.tierId].push(row);
  }

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
    <div className="fixed inset-0 bg-ink-900 bg-opacity-90 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="parchment-card-strong max-w-7xl w-full max-h-[92vh] overflow-y-auto p-5 relative"
           onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
                className="absolute top-3 right-3 text-ink-400 hover:text-parchment-50 text-2xl leading-none">✕</button>
        <div className="mb-4">
          <div className="font-display text-2xl text-iris-200 flex items-center gap-2">
            📚 Compendium — Wit Skill Trees
          </div>
          <div className="text-sm text-parchment-300 mt-1">
            {learnedCount} of {totalRows} rows discovered · {completedCount} complete · cast 3 cards of the same row for a Fully Formed Thought
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TIER_ORDER.map(tierId => {
            const tier = WIT_TIER_SUB_BONUSES[tierId];
            const partial = WIT_PARTIAL_ROW_BONUSES[tierId];
            const palette = TIER_PALETTE[tierId];
            const rows = rowsByTier[tierId] || [];
            return (
              <div key={tierId}
                   className={`rounded-lg border-2 ${palette.border} ${palette.columnBg} p-3 flex flex-col gap-2`}>
                {/* Column header — tier identity */}
                <div className={`rounded ${palette.header} p-2 border ${palette.border}`}>
                  <div className={`font-display text-xl ${palette.accent} flex items-center gap-2`}>
                    {palette.icon} {tier?.name || tierId}
                  </div>
                  <div className="text-[11px] text-parchment-200 mt-1 leading-tight italic">
                    {tier?.flavor}
                  </div>
                  <div className="text-[10px] mt-1.5 text-parchment-300 leading-tight">
                    <div><span className="font-bold">Same-tier (3-of-tier):</span> {describeBonus(tier) || '—'}</div>
                    <div><span className="font-bold">Half-formed (2-of-row):</span> {describeBonus(partial) || '—'}</div>
                  </div>
                </div>

                {/* Skill-tree nodes — 5 rows per tier */}
                {rows.map(row => {
                  const p = progressByRow[row.id] || { intro: false, subject: false, target: false };
                  const owned = (p.intro ? 1 : 0) + (p.subject ? 1 : 0) + (p.target ? 1 : 0);
                  const complete = owned === 3;
                  const partialOwned = owned >= 1;
                  return (
                    <div key={row.id}
                         className={`rounded border-2 p-2 ${
                           complete ? 'bg-gold-100/95 border-gold-500'
                                    : partialOwned ? 'bg-parchment-50 border-iris-500'
                                                   : 'bg-ink-800/40 border-ink-500'
                         }`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`font-display text-sm ${complete ? 'text-ink-800' : partialOwned ? 'text-ink-700' : 'text-parchment-300'}`}>
                          {row.name}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          complete ? 'bg-gold-600 text-parchment-50'
                                   : partialOwned ? 'bg-iris-600 text-parchment-50'
                                                  : 'bg-ink-600 text-parchment-300'
                        }`}>{owned}/3</span>
                      </div>
                      {/* Slot dots — visually communicates which slot is missing */}
                      <div className="flex gap-1.5 text-[10px] mb-1.5">
                        <span className={p.intro   ? 'text-moss-700 font-bold' : 'text-ink-400'}>{p.intro ? '●' : '○'} Intro</span>
                        <span className={p.subject ? 'text-moss-700 font-bold' : 'text-ink-400'}>{p.subject ? '●' : '○'} Subj</span>
                        <span className={p.target  ? 'text-moss-700 font-bold' : 'text-ink-400'}>{p.target ? '●' : '○'} Tgt</span>
                      </div>
                      {/* Canonical + rider — ALWAYS visible (no hover gate) */}
                      <div className={`text-[11px] italic leading-tight mb-1 ${complete || partialOwned ? 'text-ink-700' : 'text-parchment-400'}`}>
                        "{row.canonical}"
                      </div>
                      <div className={`text-[11px] font-bold leading-tight ${complete ? 'text-gold-800' : partialOwned ? 'text-iris-800' : 'text-parchment-300'}`}>
                        ★ {row.riderDesc || '(rider)'}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="text-[11px] text-parchment-400 italic text-center mt-3">
          Pick up matching intro + subject + target to assemble a Fully Formed Thought.
          Half-formed (2-of-row) and tier-matched (3-of-tier) casts deliver smaller bonuses on the way to the full payout.
        </div>
      </div>
    </div>
  );
}
