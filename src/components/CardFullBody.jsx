// Card body renderer + effect-chip registry. Used by hand, reward, grant,
// upgrade-preview, forget, and Passing-Thoughts surfaces.
//
// v3.2.x layout refresh (Alan: "Direction A + C — slot-color + TCG art
// region, leave space for future per-card art"):
//   - Header row: slot label (color-coded by slot) + cost pill
//   - Art region (~36% of card height): placeholder gradient with the
//     slot's icon. When card.art is set (a future field pointing to an
//     image asset), the image replaces the placeholder. FFT row chip
//     overlays the bottom of the art region as a banner.
//   - Phrase: visual hero, large display font, slot-tinted
//   - Stats + effect chips: compact inline row
//   - Damage formula + rider (targets only)
//   - Flavor: italic at the bottom
//   - Tags: tiny single line, last
import { WIT_ROW_BY_ID, WIT_TIER_SUB_BONUSES } from '../cards/wit-v2-rows.js';

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

// Slot color palette. text = header label color, artBg = art-region
// gradient background, artText = placeholder icon/text in the art, icon =
// the default placeholder glyph (until card.art lands), bannerBg = the
// FFT row banner background overlaying the art bottom.
function slotPalette(slot) {
  switch (slot) {
    case 'intro':
      return { text: 'text-iris-700',  artBg: 'bg-gradient-to-br from-iris-200 to-iris-400',
               artText: 'text-iris-800', icon: '✒', bannerBg: 'bg-iris-100/95 text-iris-900' };
    case 'subject':
      return { text: 'text-moss-700',  artBg: 'bg-gradient-to-br from-moss-200 to-moss-400',
               artText: 'text-moss-800', icon: '🎯', bannerBg: 'bg-moss-100/95 text-moss-900' };
    case 'target':
      return { text: 'text-ember-700', artBg: 'bg-gradient-to-br from-ember-200 to-ember-400',
               artText: 'text-ember-800', icon: '💥', bannerBg: 'bg-ember-100/95 text-ember-900' };
    case 'modifier':
      return { text: 'text-gold-700',  artBg: 'bg-gradient-to-br from-gold-200 to-gold-400',
               artText: 'text-gold-800', icon: '✦', bannerBg: 'bg-gold-100/95 text-gold-900' };
    case 'gesture':
      return { text: 'text-ember-600', artBg: 'bg-gradient-to-br from-ember-100 to-ember-300',
               artText: 'text-ember-700', icon: '✊', bannerBg: 'bg-ember-100/95 text-ember-900' };
    case 'annotation':
      return { text: 'text-iris-600',  artBg: 'bg-gradient-to-br from-iris-100 to-iris-300',
               artText: 'text-iris-700', icon: '📝', bannerBg: 'bg-iris-100/95 text-iris-900' };
    case 'skill':
      return { text: 'text-ink-600',   artBg: 'bg-gradient-to-br from-ink-100 to-ink-300',
               artText: 'text-ink-600', icon: '🪶', bannerBg: 'bg-parchment-100/95 text-ink-800' };
    case 'power':
      return { text: 'text-gold-800',  artBg: 'bg-gradient-to-br from-gold-100 to-gold-300',
               artText: 'text-gold-800', icon: '⚜', bannerBg: 'bg-gold-100/95 text-gold-900' };
    default:
      return { text: 'text-ink-500',   artBg: 'bg-gradient-to-br from-parchment-100 to-parchment-300',
               artText: 'text-ink-400', icon: '◇', bannerBg: 'bg-parchment-100/95 text-ink-800' };
  }
}

export function CardFullBody({ card, costOverride, costPillClass, costTooltip }) {
  const displayName = card.name || card.phrase || '';
  // v3.3: Alan asked to drop flavor text from cards for now — only render
  // `desc` (the mechanical description) when present. Flavor stays in the
  // data files for future re-introduction but doesn't show in the card UI.
  const displayDesc = card.desc || '';
  const displayLabel = card.slot || card.type || '';
  const palette = slotPalette(card.slot);
  const dmgType = card.type === 'effect' || card.slot === 'target' ? card.effect?.damageType : null;
  const dmgLabel = dmgType === 'physical' ? 'Physical dmg' : dmgType === 'composure' ? 'Composure dmg' : null;
  const dmgChip = dmgType === 'physical' ? 'text-ember-700 bg-ember-100' : 'text-iris-700 bg-iris-100';
  const effCost = costOverride ?? card.cost ?? 0;
  const pillClass = costPillClass ?? 'bg-gold-500 text-ink-800';

  const effectChips = [];
  if (card.effects) {
    for (const [key, val] of Object.entries(card.effects)) {
      if (!val || key === 'exhaust') continue;
      const renderer = EFFECT_CHIP_RENDERERS[key];
      if (renderer) effectChips.push({ key, ...renderer(val) });
    }
  }

  const row = card.setId ? WIT_ROW_BY_ID[card.setId] : null;
  const tierName = card.tierId ? (WIT_TIER_SUB_BONUSES[card.tierId]?.name || card.tierId) : null;

  // Resonance tag fallback for legacy v1 effect cards (no v2 tags).
  const resonance = card.type === 'effect' && card.effect?.resonatesWith && card.effect.resonatesWith.length > 0
    ? card.effect.resonatesWith
    : null;

  return (
    <>
      {/* Header — slot + tier + cost (rarity hidden per Alan v3.3). */}
      <div className="flex justify-between items-start gap-1">
        <div className={`text-[10px] uppercase tracking-wider font-bold ${palette.text}`}>
          {displayLabel}{card.tier ? ` · T${card.tier}` : ''}
        </div>
        <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold ${pillClass}`}
             title={costTooltip}>
          {effCost}
        </div>
      </div>

      {/* Art region — placeholder gradient with slot icon. When card.art is
          set (future field for per-card image assets), the image replaces
          the placeholder. FFT row chip overlays the bottom as a banner. */}
      <div className={`relative w-full h-[100px] rounded overflow-hidden ${palette.artBg} flex items-center justify-center`}>
        {card.art ? (
          <img src={card.art} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className={`text-5xl ${palette.artText} opacity-30 select-none`}>{palette.icon}</span>
        )}
        {row && (
          <div className={`absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${palette.bannerBg}`}
               title={`Play all three cards of "${row.name}" together for Fully Formed Thought: ${row.riderDesc || 'special bonus'}`}>
            🎩 {tierName} · {row.name}
          </div>
        )}
      </div>

      {/* Phrase — the visual hero. */}
      <div className={`font-display text-[15px] leading-tight ${palette.text}`}>
        {displayName}
      </div>

      {/* Annotation duration banner */}
      {card.slot === 'annotation' && (
        <div className="text-[10px] font-bold text-iris-700 uppercase tracking-wider">
          📝 {card.duration || 3} turns · attach to enemy
        </div>
      )}

      {/* Stat chips — lane stats inline */}
      {((card.stats && (card.stats.chutzpah || card.stats.wit || card.stats.jnsq)) || (card.footnotes > 0)) && (
        <div className="flex gap-1 flex-wrap text-xs font-mono">
          {card.stats?.chutzpah ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.chutzpah}</span> : null}
          {(card.stats?.wit || card.footnotes > 0) ? (
            <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">
              ✨ {(card.stats?.wit || 0) + (card.footnotes || 0)}{card.footnotes > 0 ? ` ${'*'.repeat(Math.min(3, card.footnotes))}` : ''}
            </span>
          ) : null}
          {card.stats?.jnsq ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
        </div>
      )}

      {/* Effect chips (skills, gestures, etc.) */}
      {effectChips.length > 0 && (
        <div className="flex flex-col gap-0.5 text-[13px] font-bold uppercase tracking-wide">
          {effectChips.map(({ key, icon, label, tone }) => (
            <span key={key} className={tone}>{icon} {label}</span>
          ))}
        </div>
      )}

      {/* Target damage formula + rider */}
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
            <div className="text-[13px] font-bold text-ember-700 uppercase tracking-wide">
              {Object.entries(card.effect.rider).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' · ')}
            </div>
          )}
          {card.effect.loseHpOnCast && (
            <div className="text-[13px] font-bold text-ember-700 uppercase tracking-wide">
              🩸 −{card.effect.loseHpOnCast} HP on cast
            </div>
          )}
          {card.effect.tier3Double && <div className="text-xs text-ember-700 font-bold italic">Doubles at Tier 3</div>}
          {card.effect.requiresTier3 && <div className="text-xs text-ember-700 font-bold italic">Requires Tier 3 (else half damage)</div>}
          {card.effect.perLaneTag && (
            <div className="text-[13px] font-bold text-iris-700 uppercase tracking-wide">
              ✦ +{card.effect.perLaneTag.bonus} per {card.effect.perLaneTag.tags.join(' / ')} tag
            </div>
          )}
        </>
      )}

      {/* Modifier effect summary */}
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

      {/* Gesture summary */}
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
              {ge.exhaust === false ? 'Reusable · bypasses tray' : 'Exhausts · bypasses tray'}
            </div>
          </div>
        );
      })()}

      {/* Annotation effect */}
      {card.slot === 'annotation' && card.annotationEffect && (
        <div className="text-xs font-mono text-ink-700 leading-tight">
          {Object.entries(card.annotationEffect).map(([k, v]) => `${k}: ${v}`).join(' · ')}
        </div>
      )}

      {/* Flavor / desc — italic, growing region to push tags to bottom */}
      <div className="text-[13px] flex-1 font-quill leading-snug italic text-ink-600">{displayDesc}</div>

      {(card.effects?.exhaust || card.effect?.exhaust) && (
        <div className="text-[10px] italic text-ember-700">Exhaust</div>
      )}

      {/* Tags / resonance — last, single line, muted */}
      {(card.tags && card.tags.length > 0) ? (
        <div className="text-[10px] text-ink-500 italic border-t border-ink-300 pt-1">
          ✦ {card.tags.join(' · ')}
        </div>
      ) : resonance ? (
        <div className="text-[10px] text-iris-700 italic border-t border-ink-300 pt-1">
          ✦ {resonance.join(', ')}{card.effect?.resonanceBonus?.perTag ? ` (+${card.effect.resonanceBonus.perTag})` : ''}
        </div>
      ) : null}
    </>
  );
}
