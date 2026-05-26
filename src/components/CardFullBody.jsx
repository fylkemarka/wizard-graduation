// Card body renderer + effect-chip registry. Used by hand, reward, grant,
// upgrade-preview, forget, and Passing-Thoughts surfaces. Extracted from
// App.jsx (architect-review item #3 + #8: "5 divergent card renderers"
// unified via CardFullBody in v2.86, then moved to its own module here).
import { WIT_ROW_BY_ID, WIT_TIER_SUB_BONUSES } from '../cards/wit-v2-rows.js';

// Data-driven map of card.effects keys → render-chip metadata. Adding a
// new effect key here makes it visible across every CardFullBody surface
// (hand, reward, grant, upgrade preview) automatically. Booleans (e.g.
// v2.93 PT flags) use a zero-arg renderer that ignores the value.
export const EFFECT_CHIP_RENDERERS = {
  // Numeric / classic
  weak:                    (v) => ({ icon: '⛧',  label: `Weak ${v}`,                 tone: 'text-ember-700' }),
  vulnerable:              (v) => ({ icon: '🩸', label: `Vuln ${v}`,                 tone: 'text-ember-700' }),
  block:                   (v) => ({ icon: '🛡', label: `+${v} Block`,               tone: 'text-iris-700'  }),
  draw:                    (v) => ({ icon: '📥', label: `Draw ${v}`,                 tone: 'text-moss-700'  }),
  loseHp:                  (v) => ({ icon: '🩸', label: `−${v} HP`,                  tone: 'text-ember-700' }),
  hp:                      (v) => ({ icon: '💚', label: `+${v} HP`,                  tone: 'text-moss-700'  }),
  energy:                  (v) => ({ icon: '⚡', label: `+${v} Energy`,              tone: 'text-gold-700'  }),
  poise:                   (v) => ({ icon: '🪶', label: `+${v} Poise`,               tone: 'text-iris-700'  }),
  composure:               (v) => ({ icon: '🎭', label: `+${v} Composure`,           tone: 'text-iris-700'  }),
  compDmg:                 (v) => ({ icon: '🎭', label: `${v} Comp dmg`,             tone: 'text-iris-700'  }),
  physDmg:                 (v) => ({ icon: '⚔',  label: `${v} Phys dmg`,             tone: 'text-ember-700' }),
  discardRandom:           (v) => ({ icon: '🗑', label: `Discard ${v}`,              tone: 'text-ember-700' }),
  returnDiscardToHand:     (v) => ({ icon: '↻',  label: `From discard: ${v}`,        tone: 'text-moss-700'  }),
  removeWeak:              ()  => ({ icon: '🧹', label: `Clear Weak`,                tone: 'text-iris-700'  }),
  reflectNextDebuff:       (v) => ({ icon: '🪞', label: `Reflect next ${v} debuff`,  tone: 'text-iris-700'  }),
  nextCastDamageMult:      (v) => ({ icon: '✶',  label: `Next cast ×${v}`,           tone: 'text-ember-700' }),
  // v2.93 Passing Thought flags (booleans)
  enemySkipNextAttack:     ()  => ({ icon: '🚫', label: `Skip next enemy attack`,    tone: 'text-iris-700'  }),
  swapNextHitToComp:       ()  => ({ icon: '↔',  label: `Next HP hit → Comp`,        tone: 'text-iris-700'  }),
  reflectNextHitAsComp:    ()  => ({ icon: '↩',  label: `Reflect next hit as Comp`,  tone: 'text-iris-700'  }),
  bracingArmed:            ()  => ({ icon: '🛡', label: `Brace: draw 3 if HP drops`, tone: 'text-iris-700'  }),
  blockFromComposure:      ()  => ({ icon: '🛡', label: `Block from ⅓ Comp`,         tone: 'text-iris-700'  }),
  compDmgFromEnemyMissing: ()  => ({ icon: '🎭', label: `+1 Comp per missing Comp`,  tone: 'text-iris-700'  }),
  nextCastBypassEff:       ()  => ({ icon: '🎯', label: `Next cast bypasses Eff`,    tone: 'text-ember-700' }),
  nextCastBonusEqualsLast: ()  => ({ icon: '↻',  label: `Next cast + last cast dmg`, tone: 'text-ember-700' }),
  nextCastDoubles:         ()  => ({ icon: '✕2', label: `Next cast resolves twice`,  tone: 'text-ember-700' }),
};

// Single canonical card-body renderer used by hand, reward, grant, and
// upgrade-preview surfaces. Optional props let the hand override the cost
// pill (amplify recoloring) and tooltip without forking the markup.
export function CardFullBody({ card, costOverride, costPillClass, costTooltip }) {
  const displayName = card.name || card.phrase || '';
  const displayDesc = card.desc || (card.flavor ? `"${card.flavor}"` : '');
  const displayLabel = card.slot || card.type || '';
  const dmgType = card.type === 'effect' || card.slot === 'target' ? card.effect?.damageType : null;
  const dmgLabel = dmgType === 'physical' ? 'Physical dmg' : dmgType === 'composure' ? 'Composure dmg' : null;
  const dmgChip = dmgType === 'physical' ? 'text-ember-700 bg-ember-100' : 'text-iris-700 bg-iris-100';
  const effCost = costOverride ?? card.cost ?? 0;
  const pillClass = costPillClass ?? 'bg-gold-500 text-ink-800';
  const tagOrResonance =
    card.tags && card.tags.length > 0
      ? <div className="text-[11px] text-ink-500 italic">✦ {card.tags.join(' · ')}</div>
      : card.type === 'effect' && card.effect?.resonatesWith && card.effect.resonatesWith.length > 0
      ? <div className="text-[11px] text-iris-700 italic">✦ {card.effect.resonatesWith.join(', ')}{card.effect.resonanceBonus?.perTag ? ` (+${card.effect.resonanceBonus.perTag})` : ''}</div>
      : null;
  const effectChips = [];
  if (card.effects) {
    for (const [key, val] of Object.entries(card.effects)) {
      if (!val || key === 'exhaust') continue;
      const renderer = EFFECT_CHIP_RENDERERS[key];
      if (renderer) effectChips.push({ key, ...renderer(val) });
    }
  }
  return (
    <>
      <div className="flex justify-between items-start gap-1">
        <div className={`text-[10px] uppercase tracking-wider font-bold ${card.slot === 'target' ? 'text-ember-700' : card.slot === 'modifier' ? 'text-gold-700' : card.slot ? 'text-iris-700' : 'text-ink-400'}`}>
          {displayLabel}{card.tier ? ` · T${card.tier}` : ''}{card.rarity ? ` · ${card.rarity}` : ''}
        </div>
        <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold ${pillClass}`}
             title={costTooltip}>
          {effCost}
        </div>
      </div>
      {card.setId && WIT_ROW_BY_ID[card.setId] && (
        <div className="text-[10px] font-bold text-iris-700 uppercase tracking-wider"
             title={`Play all three cards of "${WIT_ROW_BY_ID[card.setId].name}" together for Fully Formed Thought: ${WIT_ROW_BY_ID[card.setId].riderDesc || 'special bonus'}`}>
          🎩 {(WIT_TIER_SUB_BONUSES[card.tierId]?.name || card.tierId)} · {WIT_ROW_BY_ID[card.setId].name}
        </div>
      )}
      <div className="font-display text-[15px] leading-tight">{displayName}</div>
      {card.slot === 'annotation' && (
        <div className="text-[11px] font-bold text-iris-700 uppercase tracking-wider">
          📝 {card.duration || 3} turns · attach to enemy
        </div>
      )}
      {(card.stats && (card.stats.chutzpah || card.stats.wit || card.stats.jnsq)) || (card.footnotes > 0) ? (
        <div className="flex gap-1 flex-wrap text-xs font-mono">
          {card.stats?.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
          {(card.stats?.wit || card.footnotes > 0) ? (
            <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">
              ✨ {(card.stats?.wit || 0) + (card.footnotes || 0)}{card.footnotes > 0 ? ` ${'*'.repeat(Math.min(3, card.footnotes))}` : ''}
            </span>
          ) : null}
          {card.stats?.jnsq ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
        </div>
      ) : null}
      {effectChips.length > 0 && (
        <div className="flex flex-col gap-0.5 text-sm font-bold uppercase tracking-wide">
          {effectChips.map(({ key, icon, label, tone }) => (
            <span key={key} className={tone}>{icon} {label}</span>
          ))}
        </div>
      )}
      {(card.slot === 'target' || card.type === 'effect') && card.effect && (
        <>
          <div className="text-sm font-mono text-ink-700">
            {card.effect.base} + {(card.effect.scaleBy || card.lane || 'wit').toUpperCase()}×{card.effect.multiplier}
          </div>
          {dmgLabel && (
            <div className={`text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 self-start ${dmgChip}`}>
              {dmgLabel}
            </div>
          )}
          {card.effect.rider && (
            <div className="text-sm font-bold text-ember-700 uppercase tracking-wide">
              {Object.entries(card.effect.rider).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' · ')}
            </div>
          )}
          {card.effect.loseHpOnCast && (
            <div className="text-sm font-bold text-ember-700 uppercase tracking-wide">
              🩸 −{card.effect.loseHpOnCast} HP on cast
            </div>
          )}
          {card.effect.tier3Double && <div className="text-xs text-ember-700 font-bold italic">Doubles at Tier 3</div>}
          {card.effect.requiresTier3 && <div className="text-xs text-ember-700 font-bold italic">Requires Tier 3 (else half damage)</div>}
          {card.effect.perLaneTag && (
            <div className="text-sm font-bold text-iris-700 uppercase tracking-wide">
              ✦ +{card.effect.perLaneTag.bonus} per {card.effect.perLaneTag.tags.join(' / ')} tag
            </div>
          )}
        </>
      )}
      {card.slot === 'modifier' && card.modifierEffect && (
        <div className="text-[11px] text-gold-700 italic leading-tight">
          ({card.modifierKind})
          {card.modifierEffect.damageMult ? ` · ×${card.modifierEffect.damageMult} dmg` : ''}
          {card.modifierEffect.conditionalMult?.tier2Plus ? ` · ×${card.modifierEffect.conditionalMult.tier2Plus} if T2+` : ''}
          {card.modifierEffect.tier3Payoff ? ` · T3 payoff` : ''}
          {card.modifierEffect.rider ? ' · ' + Object.entries(card.modifierEffect.rider).map(([k, v]) => `+${v} ${k}`).join(' ') : ''}
          {card.modifierEffect.drawAfterCast ? ` · +${card.modifierEffect.drawAfterCast} draw` : ''}
          {card.modifierEffect.stripEnemyBlock ? ` · strip ${card.modifierEffect.stripEnemyBlock} block` : ''}
        </div>
      )}
      {card.slot === 'gesture' && card.gestureEffect && (() => {
        const ge = card.gestureEffect;
        const laneLabel = (card.lane || 'wit').toUpperCase();
        const gType = ge.damageType === 'physical' ? 'phys' : 'comp';
        return (
          <div className="text-sm font-mono text-ink-700 leading-tight">
            <div className="font-bold">
              {ge.icon || '✊'} {ge.damage} {gType}
              {ge.trayMultiplier ? ` + ${laneLabel}×${ge.trayMultiplier}` : ''}
            </div>
            {ge.rider && Object.keys(ge.rider).length > 0 && (
              <div className="text-xs text-ember-700 font-bold uppercase">
                {Object.entries(ge.rider).map(([k, v]) => `+${v} ${k}`).join(' · ')}
              </div>
            )}
            {ge.stripEnemyBlock ? <div className="text-xs text-iris-700">🛇 strip {ge.stripEnemyBlock} block</div> : null}
            {ge.draw ? <div className="text-xs text-moss-700">📥 draw {ge.draw}</div> : null}
            <div className="text-[10px] italic text-ink-500">
              {ge.exhaust === false ? 'Reusable · bypasses spell tray' : 'Exhausts · bypasses spell tray'}
            </div>
          </div>
        );
      })()}
      {card.slot === 'annotation' && card.annotationEffect && (
        <div className="text-sm font-mono text-ink-700 leading-tight">
          <div className="text-xs">
            {Object.entries(card.annotationEffect).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </div>
        </div>
      )}
      <div className="text-sm flex-1 font-quill leading-snug italic">{displayDesc}</div>
      {(card.effects?.exhaust || card.effect?.exhaust) && <div className="text-[10px] italic text-ember-700">Exhaust</div>}
      {tagOrResonance && (
        <div className="mt-auto pt-1.5 border-t border-ink-300">{tagOrResonance}</div>
      )}
    </>
  );
}
