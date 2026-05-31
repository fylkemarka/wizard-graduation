// Combat-screen + spell-tray components. Extracted from App.jsx
// (architect-review item #4: App.jsx ≥ 11k lines, this is the largest
// single screen — 800+ lines combined with V2SpellTray).
//
// Imports: framer-motion (for hand-card animation), shared cast utilities
// (TIER_MULTIPLIER + computeSpellTier + computeSpellDamage +
// composeSpellText), and CardFullBody for hand-card body rendering.
//
// All other behavior (state, callbacks, refs) flows in via props — these
// components are pure-presentational. Each prop is declared explicitly
// in the function signature so the prop surface is grep-friendly.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TIER_MULTIPLIER, computeSpellTier, computeSpellDamage, composeSpellText } from '../cards/shared.js';
import { CardFullBody } from './CardFullBody.jsx';
import { equipmentEffectSummary, relicEffectSummary } from './effectSummary.js';
import { WIT_ROWS, WIT_SAME_SCHOOL_BONUSES, WIT_ROW_BY_ID, WIT_PARTIAL_ROW_BONUSES, WIT_MIXED_SCHOOL_BONUSES, detectFFT } from '../cards/wit-v2-rows.js';
// handler row imports removed 2026-05-31 — FFT system retired for handler.

export function CombatScreen({ enemy, enemyComposure, enemyHp, enemyBlock, enemyIntent, intentTick, peekedNextIntent,
                       enemyDmgMult, playerDmgMult,
                       enemyHitFlash, playerHitFlash, dmgFloaters,
                       hp, maxHp, playerComposure, playerComposureMax,
                       block, poise, energy, energyMax, hand, deck, discard, exiled = [], tray,
                       amplifyPlaysThisCombat,
                       equipment, powers, relics, familiar, familiarName,
                       onPlayCard, onEndTurn, onUnstage, onCast, castPreview, log,
                       castsThisTurn, maxCastsPerTurn,
                       isHandler,
                       isJnsq, rollOptIn, setRollOptIn, lastRoll, combatRolls,
                       longThread = 0, isWit = false, wordsBank = 0,
                       crescendoBuildup = 0, crescendoBuildupRows = [],
                       scheduledEffects = [], thornsCharges = null,
                       mirrorReflectCharges = null,
                       tempHp = 0, tempHpTurns = 0,
                       playerIncomingMult = 1.0, enemyPressure = 0,
                       enemySkipNextAttack = false, enemyAnnotation = null,
                       footnotePromptActive = false, onApplyFootnote, onCancelFootnote,
                       lastCastSnapshot = null, arguingBackThisTurn = 0,
                       holdOnArmed = false, holdOnValue = 0,
                       pendingMissteps = [],
                       combatTurn = 1,
                       pauseHeld = false, pauseHeldActive = false,
                       wontShutUpArmed = false, staggerActive = false,
                       notListeningCharges = 0,
                       weaveStacks = 0, riposteCharge = 0, braceArmedDraw = 0,
                       tutorFlash = null,
                       tutorArmed = false,
                       animals = {},
                       shooPromptActive = false,
                       onShooAnimal = () => {},
                       onCancelShoo = () => {},
                       whistlePromptActive = false, whistlePick1Slot = null,
                       onWhistleClick = () => {},
                       onCancelWhistle = () => {},
                       treatPromptActive = false,
                       onTreatClick = () => {},
                       onCancelTreat = () => {},
                       eatItPromptActive = false,
                       onEatItClick = () => {},
                       onCancelEatIt = () => {},
                       buffetArmed = false,
                       onCancelBuffet = () => {},
                       onOpenCompendium, onOpenDeckView }) {
  // Drag state — which empty stage slot is the dragged hand card currently
  // hovering over? Lives at this level so the hand-card's onDragEnd can
  // clear it on cancelled drops. The slot pill (inside V2SpellTray) reads
  // and writes via prop callbacks.
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const composureMax = enemy?.composureMax ?? 999;
  const hpMax = enemy?.hpMax ?? 999;
  const showComposure = composureMax < 999;
  // v3.4.54 (Alan): physical damage to enemies removed altogether. Enemy
  // HP is no longer drained by any player card; hide the HP bar.
  const showHp = false;
  const eff = enemy?.effectiveness || { handler: 1, wit: 1, jnsq: 1, physical: 1 };
  const eff_label = (v) => v === 0 ? 'immune' : v >= 1.5 ? `×${v} susceptible` : v <= 0.5 ? `×${v} resistant` : `×${v}`;
  const eff_color = (v) => v === 0 ? 'bg-ink-500 text-parchment-300' : v >= 1.5 ? 'bg-moss-700 text-parchment-50' : v <= 0.5 ? 'bg-ember-800 text-parchment-100' : 'bg-ink-600 text-parchment-200';
  // Hit-shake: re-key on every enemyHitFlash change so the animation
  // restarts even on rapid consecutive hits.
  const shakeClass = enemyHitFlash ? 'enemy-hit-shake' : '';

  // v3.4.62 (Alan): Show the EFFECTIVE damage the enemy will actually
  // hit for (post-Weak / enemyDmgMult), not the raw telegraph value. The
  // player shouldn't have to math out "12 × 0.75 = 9". Falls back to the
  // hardcoded telegraph for non-damage intents (block / buff / debuff).
  const intentDisplay = (intent) => {
    if (!intent) return { display: '...', reduced: false, amplified: false, rawValue: 0, effValue: 0 };
    const mult = enemyDmgMult ?? 1;
    if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
      const raw = intent.value;
      const eff = Math.round(raw * mult);
      const reduced = eff < raw;
      const amplified = eff > raw;
      const count = intent.kind === 'attack-multi' ? (intent.count || 1) : null;
      const poolIcon = intent.pool === 'composure' ? '🎭' : '⚔';
      // Pull the (label) suffix from the original telegraph if present.
      const tg = intent.telegraph || '';
      const labelMatch = tg.match(/\((.*?)\)\s*$/);
      const label = labelMatch ? ` (${labelMatch[1]})` : '';
      // Pull "+rider Vuln/Weak" tail if present in the telegraph.
      const riderMatch = tg.match(/(\+ [^()]+)$/);
      const riderTail = riderMatch && !labelMatch ? ' ' + riderMatch[1] : '';
      let body = count ? `${eff}×${count}` : `${eff}`;
      return { display: `${poolIcon} ${body}${label}${riderTail}`, reduced, amplified, rawValue: raw, effValue: eff };
    }
    // v3.4.81 (Alan: "Weave + 2 is unclear. What does weave do? What's it
    // hit for?") — surface the projected composure damage if the player
    // doesn't cast: current stacks + this turn's add.
    if (intent.kind === 'weave') {
      const projected = (weaveStacks || 0) + intent.value;
      return {
        display: `🪡 Weave +${intent.value} → ${projected} 🎭 if no cast`,
        reduced: false, amplified: false,
        rawValue: intent.value, effValue: projected,
      };
    }
    return { display: intent.telegraph || '...', reduced: false, amplified: false, rawValue: intent.value, effValue: intent.value };
  };

  // Build a plain-language tooltip for the enemy's intent box. The
  // telegraph string ('🎭 5 (pattern-wrong)') is opaque on first read —
  // this is what teaches the icon vocabulary on hover.
  const intentTooltip = (intent) => {
    if (!intent) return '';
    const lines = [];
    if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
      const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
      const total = intent.value * hits;
      const pool = intent.pool === 'composure' ? 'Composure' : 'HP';
      const poolIcon = intent.pool === 'composure' ? '🎭' : '⚔';
      if (hits > 1) {
        lines.push(`${poolIcon} Attacks ${hits}× for ${intent.value} each (${total} total) — targets your ${pool}.`);
      } else {
        lines.push(`${poolIcon} Attacks for ${intent.value} damage — targets your ${pool}.`);
      }
      if (intent.pool === 'composure') {
        lines.push('Composure attacks bypass HP. Lose all Composure and you fail by losing your nerve.');
      }
    } else if (intent.kind === 'block') {
      lines.push(`🛡 Gains ${intent.value} Block — absorbs your damage to it until its next turn.`);
    } else if (intent.kind === 'vulnerable') {
      lines.push(`🩸 Applies Vulnerable ${intent.value} — your incoming damage will be amplified for the next few turns.`);
    } else if (intent.kind === 'weak') {
      lines.push(`⛧ Applies Weak ${intent.value} — your spell damage will be reduced for the next few turns.`);
    } else if (intent.kind === 'weave') {
      // v3.4.81: Hollow Weaver's signature mechanic. Most players have
      // never seen "Weave" anywhere else; the tooltip is their teacher.
      const projected = (weaveStacks || 0) + intent.value;
      lines.push(`🪡 Adds ${intent.value} to your Weave debt (currently ${weaveStacks || 0}, becoming ${projected}).`);
      lines.push(`If you END YOUR TURN without casting an FFT, the entire Weave debt fires as composure damage and resets.`);
      lines.push(`Cast any FFT this turn and the Weave silently clears — no damage.`);
    }
    if (intent.riders) {
      const r = intent.riders;
      if (r.weak)       lines.push(`+ rider ⛧ Weak ${r.weak} — also reduces your spell damage.`);
      if (r.vulnerable) lines.push(`+ rider 🩸 Vulnerable ${r.vulnerable} — also amplifies your incoming damage.`);
      if (r.block)      lines.push(`+ rider 🛡 ${r.block} — also gains Block.`);
    }
    lines.push('Block + Defense reduce attack damage to either pool. Debuffs drift back toward neutral by 0.25/turn.');
    return lines.join('\n');
  };
  // v3.4.28 (Alan): UI refresh — fixed-location information zones.
  // Top: 2-column grid (Enemy ↔ Your State).
  // Middle: Spell Tray (centered).
  // Below tray: Resources/effects strip (Active Defenses + wit chips
  // + status pills) so over-time and resource info lives together.
  // Bottom: Hand.
  // Bottom action bar: End Turn + deck/discard/exile buttons.
  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-6xl mx-auto">
      {tutorFlash && (
        <div key={tutorFlash.t} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="parchment-card-strong px-6 py-3 border-2 border-gold-400 shadow-2xl animate-pulse">
            <div className="text-xs uppercase tracking-widest text-gold-300 font-display">✨ The sentence finishes itself</div>
            <div className="text-lg font-display text-parchment-50 mt-1">
              <span className="text-iris-200">{tutorFlash.cardName}</span>
              <span className="text-parchment-300 text-sm ml-2">pulled from {tutorFlash.fromPile} → spell tray (ready to cast)</span>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div key={`enemy-${enemyHitFlash || 0}`} className={`parchment-card-strong p-1.5 relative ${shakeClass}`}>
        {/* Damage floaters — composure (iris) and physical (ember). */}
        {dmgFloaters && dmgFloaters.length > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-20">
            {dmgFloaters.map(f => (
              <div key={f.id}
                className={`dmg-float absolute font-display font-bold text-3xl tabular-nums whitespace-nowrap drop-shadow-lg ${
                  f.dmgType === 'physical' ? 'text-ember-300' : 'text-iris-200'
                }`}
                style={{ left: 0 }}>
                −{f.amount}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between items-start mb-0.5">
          <div>
            <div className="font-display text-base text-ember-300 flex items-center gap-2 flex-wrap leading-tight">
              {enemy?.name}
              {/* v2.99.2: phase-shift badge — prominent next to the enemy
                  name so players see the state change immediately when
                  the Silk Wraith (or future phase-shifters) thins. */}
              {enemy?.phaseShifted && (
                <span className="text-xs px-2 py-1 rounded uppercase tracking-widest font-bold font-mono bg-iris-900 border-2 border-iris-400 text-iris-200 animate-pulse"
                  title="The enemy has shifted phase. Its effectiveness profile and per-turn behaviors have changed — check the lane chips below.">
                  🕸 Thinned
                </span>
              )}
            </div>
            <div className="text-[10px] text-parchment-300 italic leading-none">
              {enemy?.tier === 'boss' ? 'Boss' : enemy?.tier === 'elite' ? 'Elite' : 'Enemy'}
            </div>
          </div>
          <div className="text-right flex items-baseline gap-2">
            {showComposure && (
              <span className="text-base font-mono text-iris-300" title="Composure — drain to 0 to make them back down.">
                ✨{enemyComposure}<span className="text-[11px] text-parchment-300">/{composureMax}</span>
              </span>
            )}
            {/* v3.4.60 — Silk Wraith phase-shift composure regen. Persistent
                chip so the player understands why their drain isn't sticking. */}
            {enemy?.id === 'e2-silk-wraith' && enemy?.phaseShifted && (
              <span className="text-[11px] font-mono text-moss-300 cursor-help"
                    title="The Silk Wraith has phase-shifted (at ≤50% Composure). It re-weaves +1 Composure at the start of each of its turns, and is wit-resistant (×0.5).">
                🕸 +1 comp/turn
              </span>
            )}
            {/* v3.4.67 — Handler Pressure chip. Bluster casts stack
                Pressure on the enemy; Bluster cards with pressureBonus get
                +Pressure flat damage; capstones consume Pressure × N. */}
            {enemyPressure > 0 && (
              <span className="text-[11px] font-mono text-ember-300 cursor-help"
                    title={`Pressure: ${enemyPressure} stack${enemyPressure > 1 ? 's' : ''}. Bluster casts deal +${enemyPressure} flat damage; capstones consume it for a × multiplier spike.`}>
                🔥 {enemyPressure} pressure
              </span>
            )}
            {showHp && (
              <span className="text-base font-mono text-ember-400" title="Physical HP — only physical effects hit this.">
                ❤{enemyHp}<span className="text-[11px] text-parchment-300">/{hpMax}</span>
              </span>
            )}
            <span className="text-[11px] font-mono">🛡{enemyBlock}</span>
            {/* v3.4: enemy DoT counter (Poison-style). Shows current
                damage-per-turn AND turns remaining. Drains to 0 → expires. */}
            {enemy?.dot?.turnsRemaining > 0 && enemy?.dot?.damage > 0 && (
              <div className="text-base text-ember-300"
                   title={`Damage-over-time: each enemy turn, they take ${enemy.dot.damage} composure damage. ${enemy.dot.turnsRemaining} turns left. Bypasses block.`}>
                🩸 DoT {enemy.dot.damage}/turn × {enemy.dot.turnsRemaining}
              </div>
            )}
            {/* v2.65: removed duplicate Atk ×N chip — the STATUS row
                below now surfaces enemyDmgMult / playerDmgMult shifts
                more prominently. */}
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div key={`intent-${intentTick}`}
               className="intent-flash px-3 py-2 bg-ember-900 bg-opacity-60 rounded border border-ember-700 cursor-help"
               title={intentTooltip(enemyIntent) || 'No intent yet — it will telegraph what the enemy plans before their turn.'}>
            <div className="text-xs uppercase text-ember-300 tracking-widest">Intent <span className="text-ember-400">ⓘ</span></div>
            <div className="text-lg">
              {(() => {
                const { display, reduced, amplified, rawValue, effValue } = intentDisplay(enemyIntent);
                const color = reduced ? 'text-moss-300' : amplified ? 'text-ember-300' : 'text-parchment-50';
                const tooltip = reduced
                  ? `Reduced by Weak: was ${rawValue}, now ${effValue}.`
                  : amplified
                  ? `Amplified: was ${rawValue}, now ${effValue}.`
                  : '';
                return <span className={color + (tooltip ? ' cursor-help' : '')} title={tooltip}>{display}</span>;
              })()}
            </div>
            {/* v2.36: ACTUALLY— arguing-back surcharge. Each Actually—
                played this turn adds +1 to this enemy attack's raw damage.
                Shown inline with intent so the player sees the cost of
                their re-fires before the swing lands. */}
            {arguingBackThisTurn > 0 && (
              <div className="text-xs font-mono text-iris-300 mt-0.5"
                   title={`You corrected yourself ${arguingBackThisTurn}× — the enemy is paying attention. Next attack: +${arguingBackThisTurn} damage. Clears at end of your turn.`}>
                🗣 +{arguingBackThisTurn} (arguing back)
              </div>
            )}
          </div>
          {peekedNextIntent && (
            <div className="px-3 py-2 bg-iris-900 bg-opacity-60 rounded border border-iris-700"
                 title="You peeked the enemy's next move.">
              <div className="text-xs uppercase text-iris-300 tracking-widest">👁 Peek (next)</div>
              <div className="text-lg text-parchment-50">{peekedNextIntent.telegraph}</div>
            </div>
          )}
          {enemy?.annotation && (() => {
            const ae = enemy.annotation.effect || {};
            const parts = [];
            if (ae.enemyAtkReduction)         parts.push(`Enemy attacks deal −${ae.enemyAtkReduction} damage`);
            if (ae.damageOnDraw)              parts.push(`+${ae.damageOnDraw} composure damage each time you draw a card`);
            if (ae.damageOnTurnStart)         parts.push(`+${ae.damageOnTurnStart} composure damage at the start of every turn`);
            if (ae.damageOnTurnEnd)           parts.push(`+${ae.damageOnTurnEnd} composure damage at the end of every turn`);
            if (ae.damageOnEnemyAttack)       parts.push(`+${ae.damageOnEnemyAttack} composure damage to the enemy every time they attack`);
            if (ae.bonusSpellDamage)          parts.push(`Your spells deal +${ae.bonusSpellDamage} bonus damage`);
            if (ae.bonusSpellDamagePerCast)   parts.push(`Your spells deal +${ae.bonusSpellDamagePerCast} per cast already made this combat`);
            if (ae.energyOnTurnStart)         parts.push(`+${ae.energyOnTurnStart} energy at the start of every turn`);
            const effectSummary = parts.length > 0 ? parts.join('. ') + '.' : 'No active effect.';
            const tip = `${enemy.annotation.name} — ${enemy.annotation.turnsRemaining} turn${enemy.annotation.turnsRemaining === 1 ? '' : 's'} remaining.\n\nEffect: ${effectSummary}`;
            return (
              <div className="px-3 py-2 bg-iris-900 bg-opacity-40 rounded border border-iris-400 cursor-help"
                   title={tip}>
                <div className="text-xs uppercase text-iris-300 tracking-widest">📝 Annotated</div>
                <div className="text-sm italic text-parchment-50">{enemy.annotation.phrase} <span className="text-iris-300">({enemy.annotation.turnsRemaining}t)</span></div>
                <div className="text-[10px] text-iris-200 mt-0.5 leading-tight">{effectSummary}</div>
              </div>
            );
          })()}
          {/* v3.4.29 (Alan): single-line resistance chips — just symbol +
              multiplier, no 'resistant/susceptible' suffix. Tooltip still
              spells it out. Trims a full text row off the enemy panel. */}
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${eff_color(eff.handler ?? 1)}`} title={`Handler ${eff_label(eff.handler ?? 1)}`}>💪 ×{eff.handler ?? 1}</span>
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${eff_color(eff.wit ?? 1)}`} title={`Wit ${eff_label(eff.wit ?? 1)}`}>✨ ×{eff.wit ?? 1}</span>
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${eff_color(eff.jnsq ?? 1)}`} title={`Jnsq ${eff_label(eff.jnsq ?? 1)}`}>🌀 ×{eff.jnsq ?? 1}</span>
          {/* v3.4.54: physical effectiveness chip hidden — no card deals
              physical damage to enemies anymore. */}
        </div>
        {/* v2.65: STATUS row — what YOU have done to the enemy this combat
            (and what they've done to you). Pulled out from the lane-chip
            row to a dedicated band with bigger styling so the player can
            see at a glance "I have +30% spell potency from 2 Amplifies"
            without parsing a row of similar-looking chips. Hidden when
            both multipliers are at baseline. */}
        {(playerDmgMult !== 1.0 || enemyDmgMult !== 1.0) && (
          <div className="mt-2 p-2 rounded bg-ink-700/60 border border-ink-500 flex gap-3 flex-wrap items-center">
            <span className="text-[10px] uppercase tracking-widest text-parchment-300">In effect</span>
            {/* v2.83: label disambiguation. Same word ("Vulnerable") was
                used for both player-side and enemy-side states, which was
                confusing. Now each badge spells out WHO the effect is on
                and WHAT changed. Color = good-for-player (iris) vs
                bad-for-player (ember).
                  playerDmgMult > 1 → enemy is taking more from us (good)
                  playerDmgMult < 1 → our spells weak (bad)
                  enemyDmgMult > 1 → we're vulnerable to their attacks (bad)
                  enemyDmgMult < 1 → enemy attacks sapped (good)
            */}
            {/* v3.4.63 (Alan): never make the player do math. Icons say
                WHAT is active; the magnitude is already baked into the
                displayed Predicted damage + enemy intent values. */}
            {playerDmgMult > 1.0 && (
              <span className="px-3 py-1.5 rounded bg-iris-700 text-parchment-50 text-sm font-bold border border-iris-400 cursor-help"
                title="Enemy is Vulnerable — your Predicted damage is already amplified. Drifts back to neutral over time.">
                🩸 ENEMY VULNERABLE
              </span>
            )}
            {playerDmgMult < 1.0 && (
              <span className="px-3 py-1.5 rounded bg-ember-700 text-parchment-50 text-sm font-bold border border-ember-500 cursor-help"
                title="You are Weak — your Predicted damage is already reduced. Drifts back to neutral over time.">
                ⛧ YOU ARE WEAK
              </span>
            )}
            {enemyDmgMult > 1.0 && (
              <span className="px-3 py-1.5 rounded bg-ember-700 text-parchment-50 text-sm font-bold border border-ember-500 cursor-help"
                title="You are Vulnerable — the enemy's intent damage is already amplified. Drifts back to neutral over time.">
                🩸 YOU ARE VULNERABLE
              </span>
            )}
            {enemyDmgMult < 1.0 && (
              <span className="px-3 py-1.5 rounded bg-iris-700 text-parchment-50 text-sm font-bold border border-iris-400 cursor-help"
                title="Enemy is Weak — their intent damage is already reduced. Drifts back to neutral over time.">
                ⛧ ENEMY WEAK
              </span>
            )}
          </div>
        )}
      </div>

      {/* v3.4.28 — YOUR STATE panel (right column). Compact view of HP /
          Comp / Block / Poise / Defense / Energy. End Turn button anchors
          the bottom-right so it's always in the same place. */}
      <div key={`player-vitals-${playerHitFlash || 0}`}
           className={`parchment-card-strong p-1.5 flex flex-col gap-0.5 ${playerHitFlash ? 'hit-shake' : ''}`}>
        <div className="text-[10px] uppercase tracking-widest text-moss-300 leading-none">Your State</div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
          <span title="HP — physical health. 0 = defeat." className="font-mono text-sm text-moss-300">{hp}<span className="text-[10px] text-parchment-400">/{maxHp}</span><span className="text-[9px] uppercase text-parchment-400 ml-0.5">HP</span></span>
          <span title="Composure — verbal HP. 0 = lose your nerve." className="font-mono text-sm text-iris-200">{playerComposure}<span className="text-[10px] text-parchment-400">/{playerComposureMax}</span><span className="text-[9px] uppercase text-parchment-400 ml-0.5">Comp</span></span>
          <span title="Energy — refills each turn." className="font-mono text-sm text-gold-300">⚡{energy}/{energyMax}</span>
          <span title="Block — absorbs physical hits. Resets each turn." className="font-mono text-sm text-iris-300">🛡{block}</span>
          <span title="Poise — absorbs composure hits. Resets each turn." className="font-mono text-sm text-moss-300">🪞{poise}</span>
          {(() => {
            const rawDef = equipment.reduce((s, eq) => s + (eq.bonus?.damageReduction || 0), 0)
                          + (familiar?.bonus?.damageReduction || 0);
            const def = Math.min(2, rawDef);
            return rawDef > 0 ? (
              <span title={`Defense reduces every incoming hit by ${def} (min 1).`} className="font-mono text-sm text-moss-200">🛡✦{def}</span>
            ) : null;
          })()}
          {/* v3.4.31 (Alan): wit identity chips (Long Thread / Word Bank /
              Crescendo Buildup) inlined into Your State so they sit
              alongside HP / Comp / Block / Poise / Energy. */}
          {isWit && longThread > 0 && (
            <span title="Long Thread — wit defender. +1 per turn you cast a wit spell and take no unblocked damage. Reduces incoming damage by Math.min(2, LT) per swing."
                  className="font-mono text-sm text-iris-300">🧵{longThread}</span>
          )}
          {isWit && (
            <span title="Words Bank — Crescendo's currency. Only Crescendo-school cards add (+1 each). Cap 10. Spent at the CLIMAX cast."
                  className="font-mono text-sm text-gold-300">📚{wordsBank || 0}<span className="text-[9px] text-parchment-500">/10</span></span>
          )}
          {isWit && (crescendoBuildup > 0 || (hand || []).some(c => c?.schoolId === 'crescendo')) && (
            <span title={`Crescendo Buildup — each full-FFT Crescendo cast advances this. Stage 3 unleashes the climax.${crescendoBuildupRows.length === 2 && crescendoBuildupRows[0] === crescendoBuildupRows[1] ? ' Same-row × 1.5 lockstep is active.' : ''}`}
                  className="font-mono text-sm text-gold-300">
              {'●'.repeat(crescendoBuildup)}{'○'.repeat(3 - crescendoBuildup)}
              {crescendoBuildupRows.length >= 2 && crescendoBuildupRows[0] === crescendoBuildupRows[1] && (
                <span className="text-[10px] text-gold-200 ml-0.5">🎵</span>
              )}
            </span>
          )}
          {/* v3.4.32 (Alan): Deck + Familiar + Equipment + conditional
              over-time chips MOVED UP from the lower strip. */}
          <span title={`Deck pile (${deck.length}) → Discard pile (${discard.length}). When the deck empties, the discard reshuffles back in.`}
                className="font-mono text-sm text-parchment-200">{deck.length}▸{discard.length}<span className="text-[9px] uppercase text-parchment-400 ml-0.5">Deck</span></span>
          {familiar && (
            <span title={familiar.desc}
                  className="font-mono text-sm inline-flex items-center gap-0.5">
              <span className="leading-none">{familiar.emoji}</span>
              <span className="text-gold-300 text-[11px]">{familiarName || familiar.species}</span>
            </span>
          )}
          {equipment.length > 0 && equipment.map(eq => (
            <span key={eq.id} className="text-[11px] text-gold-300 cursor-help font-mono"
              title={`${eq.name}\n\n${eq.desc || ''}${equipmentEffectSummary(eq) ? '\n\nEffects:\n' + equipmentEffectSummary(eq) : ''}`}>⚜{eq.name}</span>
          ))}
          {/* v3.4.63 (Alan): just show WEAK / STRONG / VULN / SAPPED.
              The multiplier is already baked into Predicted damage and the
              enemy intent — the player doesn't need the math here too. */}
          {playerDmgMult < 1.0 && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-ember-900 text-ember-100 cursor-help"
                  title={`Weak — your spell potency reduced. Drifts back toward neutral by 0.10/turn.`}>⛧ WEAK</span>
          )}
          {playerDmgMult > 1.0 && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-moss-900 text-moss-100 cursor-help"
                  title={`Strengthened — your spell potency boosted. Drifts back toward neutral by 0.10/turn.`}>💫 STRONG</span>
          )}
          {enemyDmgMult > 1.0 && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-ember-900 text-ember-100 cursor-help"
                  title={`Vulnerable — incoming enemy attacks deal more damage. Drifts back toward neutral by 0.10/turn.`}>🩸 VULN</span>
          )}
          {enemyDmgMult < 1.0 && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-moss-900 text-moss-100 cursor-help"
                  title={`Sapped — enemy attacks deal less damage. Drifts back toward neutral by 0.10/turn.`}>🛡 SAPPED</span>
          )}
          {/* Wit-only over-time chips: Hold / Misstep */}
          {holdOnArmed && (
            <span className="text-[11px] text-iris-200 font-mono"
                  title={`Hold On — armed. Next enemy swing damage reduced by ${holdOnValue}.`}>🛑−{holdOnValue}</span>
          )}
          {(pendingMissteps.length > 0 || (hand || []).some(c => c?.id === 'wv2-tok-misstep')) && (() => {
            const inHand = (hand || []).filter(c => c?.id === 'wv2-tok-misstep').length;
            const pendingTxt = pendingMissteps.length > 0
              ? pendingMissteps.map(p => `T-${p.turnsRemaining}`).join(' · ')
              : '—';
            return (
              <span className="text-[11px] text-iris-200 font-mono"
                    title={`Missteps in flight. ${inHand > 0 ? `${inHand} in hand: discard for 1 Energy, or end-of-turn = -3 HP each. ` : ''}Pending: ${pendingTxt}.`}>
                📜{inHand > 0 ? <span className="text-ember-300">{inHand}!</span> : pendingMissteps.length}
              </span>
            );
          })()}
          {/* Tunnel Vision / RAGE chip removed 2026-05-31 with the
              chutzpah → handler pivot. State/UI fully ripped. */}
          {(pauseHeld || pauseHeldActive) && (
            <span className="text-[11px] text-amber-200 font-mono"
                  title={pauseHeldActive ? `Awkward Pause — next cast doubles staged jnsq stats.` : `Paused — graduates at end of turn.`}>🤫{pauseHeldActive ? '×2' : ''}</span>
          )}
          {wontShutUpArmed && (
            <span className="text-[11px] text-amber-200 font-mono"
                  title={`Won't Shut Up — play any jnsq card before end of turn or take 3 HP.`}>🗣!</span>
          )}
        </div>
        {/* Active Defenses panel — bordered sub-box that renders only when
            something is armed. Moved here from the deleted lower strip. */}
        {(() => {
          const buckets = {};
          for (const eff of (scheduledEffects || [])) {
            if (eff.trigger !== 'player-turn-start') continue;
            if (!['block', 'poise', 'hpRegen', 'stripBlock'].includes(eff.kind)) continue;
            if (!buckets[eff.kind]) buckets[eff.kind] = { amount: 0, turns: 0 };
            buckets[eff.kind].amount += eff.amount;
            buckets[eff.kind].turns = Math.max(buckets[eff.kind].turns, eff.turnsRemaining);
          }
          for (const eff of (scheduledEffects || [])) {
            if (eff.trigger !== 'enemy-turn-start') continue;
            if (!['weak', 'vuln'].includes(eff.kind)) continue;
            if (!buckets[eff.kind]) buckets[eff.kind] = { amount: 0, turns: 0 };
            buckets[eff.kind].amount += eff.amount;
            buckets[eff.kind].turns = Math.max(buckets[eff.kind].turns, eff.turnsRemaining);
          }
          const annRed = enemyAnnotation?.effect?.enemyAtkReduction || 0;
          const thornsAuraTurns = thornsCharges?.turnsRemaining || 0;
          const thornsSchedule = Array.isArray(thornsCharges?.schedule) ? thornsCharges.schedule : null;
          const mirrorCount = mirrorReflectCharges?.count || 0;
          const mirrorCap = mirrorReflectCharges?.capPerHit || 0;
          const hasAny = Object.keys(buckets).length > 0 || annRed > 0 || enemySkipNextAttack
                        || thornsAuraTurns > 0 || (thornsCharges?.count || 0) > 0 || mirrorCount > 0
                        || tempHp > 0 || playerIncomingMult > 1.0;
          if (!hasAny) return null;
          const chips = [];
          if (enemySkipNextAttack) chips.push(<span key="skip" className="text-gold-300 cursor-help" title="The enemy's next attack will be fully skipped.">🤐 SKIP NEXT</span>);
          if (buckets.block) chips.push(<span key="b" className="cursor-help" title={`At the start of each of your next ${buckets.block.turns} turn${buckets.block.turns > 1 ? 's' : ''}, gain +${buckets.block.amount} Block.`}>🛡+{buckets.block.amount}/turn × {buckets.block.turns}t</span>);
          if (buckets.poise) chips.push(<span key="p" className="cursor-help" title={`At the start of each of your next ${buckets.poise.turns} turn${buckets.poise.turns > 1 ? 's' : ''}, gain +${buckets.poise.amount} Poise.`}>🪞+{buckets.poise.amount}/turn × {buckets.poise.turns}t</span>);
          if (buckets.hpRegen) chips.push(<span key="h" className="cursor-help" title={`Heal ${buckets.hpRegen.amount} HP at the start of each of your next ${buckets.hpRegen.turns} turn${buckets.hpRegen.turns > 1 ? 's' : ''}.`}>💚+{buckets.hpRegen.amount}/turn × {buckets.hpRegen.turns}t</span>);
          if (longThread > 0) chips.push(
            <span key="lt" className="text-iris-200 cursor-help"
                  title={`Long Thread — ${longThread} stack${longThread > 1 ? 's' : ''}. Reduces incoming damage by ${Math.min(2, longThread)} per swing (cap 2).\n\nGrows by 1 each turn you cast a wit Effect AND take no unblocked HP damage. Decays by 1 on an unblocked HP hit.`}>
              🧵{longThread} (−{Math.min(2, longThread)}/swing)
            </span>
          );
          if (annRed > 0) chips.push(<span key="a" className="text-iris-200 cursor-help" title={`Enemy annotation: every incoming enemy attack value is reduced by ${annRed} before block / poise routing.`}>📝 enemy atk −{annRed}</span>);
          if (thornsAuraTurns > 0 && !thornsSchedule) chips.push(<span key="ta" className="cursor-help" title={`Thorns aura: every enemy attack reflects ${thornsCharges?.amount || 0} composure damage back. Active for ${thornsAuraTurns} more turn${thornsAuraTurns > 1 ? 's' : ''}.`}>🌹 reflect {thornsCharges?.amount || 0}/hit × {thornsAuraTurns}t</span>);
          if (thornsSchedule && thornsSchedule.length > 0) chips.push(<span key="ts" className="cursor-help" title={`Thorns ramping schedule: incoming attacks reflect by these values, one per turn, in order.`}>🌹 ramp [{thornsSchedule.join(',')}]</span>);
          if ((thornsCharges?.count || 0) > 0) chips.push(<span key="tc" className="cursor-help" title={`Thorns charges: ${thornsCharges.count} enemy hit${thornsCharges.count > 1 ? 's' : ''} reflect ${thornsCharges.amount} composure damage each.`}>🌹 reflect {thornsCharges.amount} × {thornsCharges.count} hits</span>);
          if (mirrorCount > 0) chips.push(<span key="mr" title={`Mirror reflect: next ${mirrorCount} enemy hit${mirrorCount > 1 ? 's' : ''} each reflect 100% of damage taken (cap ${mirrorCap} per hit).`} className="text-iris-200 cursor-help">🪞 mirror × {mirrorCount} (cap {mirrorCap})</span>);
          // v3.4.67 — Handler school chips.
          if (tempHp > 0) chips.push(<span key="thp" className="text-gold-300 cursor-help" title={`Ballooning Temp HP: absorbs HP damage BEFORE your real HP. Expires after ${tempHpTurns} more turn${tempHpTurns > 1 ? 's' : ''}; any unused Temp HP is lost.`}>🎈 {tempHp} Temp HP × {tempHpTurns}t</span>);
          if (playerIncomingMult > 1.0) chips.push(<span key="sv" className="text-ember-300 cursor-help" title="Self-Vulnerable — incoming enemy damage to you is amplified. Decays back to neutral.">🩸 YOU VULN</span>);
          if (buckets.stripBlock) chips.push(<span key="sb" className="cursor-help" title={`At the start of each of your next ${buckets.stripBlock.turns} turn${buckets.stripBlock.turns > 1 ? 's' : ''}, strip ${buckets.stripBlock.amount} of the enemy's Block.`}>🛇 strip {buckets.stripBlock.amount}/turn × {buckets.stripBlock.turns}t</span>);
          if (buckets.weak) chips.push(<span key="w" className="cursor-help" title={`At the start of each of the enemy's next ${buckets.weak.turns} turn${buckets.weak.turns > 1 ? 's' : ''}, apply +${buckets.weak.amount} Weak (-25% attack per stack).`}>💢 Weak +{buckets.weak.amount}/turn × {buckets.weak.turns}t</span>);
          if (buckets.vuln) chips.push(<span key="v" className="cursor-help" title={`At the start of each of the enemy's next ${buckets.vuln.turns} turn${buckets.vuln.turns > 1 ? 's' : ''}, apply +${buckets.vuln.amount} Vulnerable (+25% spell potency per stack).`}>🩸 Vuln +{buckets.vuln.amount}/turn × {buckets.vuln.turns}t</span>);
          return (
            <div className="border border-iris-600 bg-ink-800/60 rounded px-1.5 py-0.5 flex flex-wrap gap-x-2 gap-y-0 items-baseline mt-0.5"
                 title="Over-time effects currently armed.">
              <span className="text-[9px] uppercase text-iris-300">🛡 Defenses</span>
              <div className="flex flex-wrap gap-x-1.5 gap-y-0 text-[11px] font-mono items-baseline">{chips}</div>
            </div>
          );
        })()}
        {/* v3.4.52 — Relics moved INTO Your State (was a separate strip
            below the spell tray). Run-persistent, always shown when any
            relic is held. */}
        {relics.length > 0 && (
          <div className="border border-gold-600 bg-ink-800/60 rounded px-1.5 py-0.5 flex flex-wrap gap-x-2 gap-y-0 items-baseline mt-0.5">
            <span className="text-[9px] uppercase tracking-widest text-gold-300">📿 Relics</span>
            <div className="flex flex-wrap gap-x-1.5 gap-y-0 text-[11px] font-mono items-baseline">
              {relics.map(r => {
                const summary = relicEffectSummary(r);
                return (
                  <span key={r.id}
                    title={`${r.name}\n\n${r.desc || ''}${summary ? '\n\nEffects:\n' + summary : ''}${r.flavor ? '\n\n"' + r.flavor + '"' : ''}`}
                    className="text-gold-300 cursor-help">{r.name}</span>
                );
              })}
            </div>
          </div>
        )}
        {/* v3.4.52 — Powers In Effect moved INTO Your State. */}
        {(powers.length > 0 || notListeningCharges > 0 || staggerActive) && (
          <div className="border border-iris-600 bg-ink-800/60 rounded px-1.5 py-0.5 flex flex-wrap gap-x-2 gap-y-0 items-baseline mt-0.5">
            <span className="text-[9px] uppercase tracking-widest text-iris-300">📿 Powers</span>
            <div className="flex flex-wrap gap-x-1.5 gap-y-0 text-[11px] font-mono items-baseline">
              {powers.map((p, i) => {
                const isDrunken  = p.installPower?.id === 'drunken-confidence' || p.id === 'jv2-p-hold-my-drink';
                const isBabbling = p.installPower?.id === 'babbling' || p.id === 'jv2-p-wait-and-another-thing';
                return (
                  <span key={p.uid || i}
                    title={isDrunken
                      ? 'Drunken Confidence — all your spell casts deal +50% damage, BUT every enemy attack adds +2 raw damage before block. Play "sober second thought," to remove.'
                      : isBabbling
                      ? 'Babbling — lifts the per-turn cast cap from 1 → 2 with a 0.6× scalar on the 2nd cast.'
                      : `${p.desc}${p.flavor ? '\n\n' + p.flavor : ''}`}
                    className="text-iris-200 cursor-help">
                    {p.name}
                    {isDrunken && <span className="ml-0.5 text-ember-300">🍺×1.5/+2</span>}
                    {isBabbling && <span className="ml-0.5 text-iris-300">🗯2×/60%{castsThisTurn === 1 && ' (2nd ready)'}</span>}
                  </span>
                );
              })}
              {notListeningCharges > 0 && (
                <span title="Sorry — what? — pending: the next enemy Weak/Vulnerable attempt is ignored."
                      className="text-iris-200 cursor-help">Sorry — what?<span className="ml-0.5">🙉{notListeningCharges}</span></span>
              )}
              {staggerActive && (
                <span title="Drunken Stagger — this turn, every enemy attack swing has a 50% chance to fully miss."
                      className="text-iris-200 cursor-help">Drunken Stagger<span className="ml-0.5 text-ember-300">🌀50%</span></span>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* v2 SENTENCE TRAY — intro + subject + target + 0-2 modifiers.
          Playing a target auto-casts. End the turn without a target and
          the spell fizzles. */}
      <V2SpellTray tray={tray} onUnstage={onUnstage} onCast={onCast}
        castsThisTurn={castsThisTurn} maxCastsPerTurn={maxCastsPerTurn}
        isHandler={isHandler}
        playerHp={hp} playerMaxHp={maxHp}
        tempHp={tempHp}
        isJnsq={isJnsq} rollOptIn={rollOptIn} setRollOptIn={setRollOptIn}
        lastRoll={lastRoll} combatRolls={combatRolls}
        playerDmgMult={playerDmgMult} enemyDmgMult={enemyDmgMult}
        combatTurn={combatTurn}
        pauseHeldActive={pauseHeldActive} enemy={enemy}
        weaveStacks={weaveStacks} riposteCharge={riposteCharge} braceArmedDraw={braceArmedDraw}
        wordsBank={wordsBank} crescendoBuildup={crescendoBuildup} crescendoBuildupRows={crescendoBuildupRows}
        animals={animals} tutorArmed={tutorArmed}
        shooPromptActive={shooPromptActive} onShooAnimal={onShooAnimal}
        whistlePromptActive={whistlePromptActive} whistlePick1Slot={whistlePick1Slot} onWhistleClick={onWhistleClick}
        treatPromptActive={treatPromptActive} onTreatClick={onTreatClick}
        eatItPromptActive={eatItPromptActive} onEatItClick={onEatItClick}
        onPlayCard={onPlayCard}
        dragOverSlot={dragOverSlot} setDragOverSlot={setDragOverSlot} />

      {/* v2.35: FOOTNOTE picker banner. Surfaces when the player has just
          played the "As Hewn-Greaves notes in his footnotes," skill and
          needs to pick a Word card (intro/subject/modifier) from hand or
          discard. Clicking any eligible card bumps its `footnotes` count
          by 1; cancelling dismisses the prompt without applying. */}
      {footnotePromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-iris-500 bg-iris-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-iris-100">
            <span className="font-bold">📖 Footnote:</span> click a Word card (intro / subject / modifier) in your hand or discard to attach a permanent +1 wit footnote.
          </div>
          <button onClick={onCancelFootnote}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}
      {shooPromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-gold-400 bg-gold-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-gold-100">
            <span className="font-bold">👋 Shoo!</span> click a summoned animal in the spell tray to dismiss it. (Lures are not eligible — wait for them to arrive first.)
          </div>
          <button onClick={onCancelShoo}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}
      {whistlePromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-gold-400 bg-gold-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-gold-100">
            <span className="font-bold">🎶 Whistle:</span> {whistlePick1Slot
              ? `first slot ${whistlePick1Slot} selected. Click a second slot to swap.`
              : 'click any two slots in order to swap their contents.'}
          </div>
          <button onClick={onCancelWhistle}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}
      {treatPromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-gold-400 bg-gold-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-gold-100">
            <span className="font-bold">🍖 Treat:</span> click a summoned animal to extend its stay by 1 turn.
          </div>
          <button onClick={onCancelTreat}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}
      {eatItPromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-gold-400 bg-gold-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-gold-100">
            <span className="font-bold">🍴 Just Eat It:</span> click a staged lure to summon its animal right now.
          </div>
          <button onClick={onCancelEatIt}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}
      {buffetArmed && (
        <div className="mb-2 p-3 rounded border-2 border-gold-400 bg-gold-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-gold-100">
            <span className="font-bold">🍽 Buffet armed:</span> your next lure will spread across every empty stage slot.
          </div>
          <button onClick={onCancelBuffet}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2 flex-nowrap min-h-[260px] items-stretch justify-center overflow-x-auto">
        {hand.map((card, i) => {
          // Amplify gets +1 cost per prior play this combat. UI shows the
          // current (escalated) cost so the player doesn't get surprised.
          const effCost = card.id === 'c-amplify'
            ? (card.cost || 0) + (amplifyPlaysThisCombat || 0)
            : (card.cost || 0);
          // v2.35: FOOTNOTE picker — eligible cards are Word cards (intro,
          // subject, modifier). When the prompt is active, those cards
          // become clickable for footnoting INSTEAD of playing.
          const isFootnoteEligible = footnotePromptActive
            && (card.slot === 'intro' || card.slot === 'subject' || card.slot === 'modifier');
          // v2.36: ACTUALLY— gate. The skill is unplayable when no cast has
          // landed this turn (lastCastSnapshot === null). UI disables; sim
          // AI skips for the same reason.
          const isActuallySkill = !!card.effects?.refireLastCast;
          const actuallyBlocked = isActuallySkill && !lastCastSnapshot;
          const playable = !footnotePromptActive && effCost <= energy && !actuallyBlocked;
          const escalated = card.id === 'c-amplify' && amplifyPlaysThisCombat > 0;
          // v2.38: Misstep token override — bright red dashed border so it
          // stands out as an active hazard in hand. Pratchett tone: the
          // realisation that you said something wrong is visible on you.
          const isMisstepTok = card.id === 'wv2-tok-misstep';
          // Card frame tint. v2 cards: intro/subject = iris, target =
          // ember, modifier = gold. v1 fallback by card.type for utilities.
          const tint = isMisstepTok ? 'border-red-500 border-dashed'
                     : card.slot === 'intro' || card.slot === 'subject' ? 'border-iris-500'
                     : card.slot === 'target' ? 'border-ember-500'
                     : card.slot === 'modifier' ? 'border-gold-500'
                     : card.slot === 'annotation' ? 'border-iris-400 border-dashed' // v2.10
                     : card.type === 'word'   ? 'border-iris-500'
                     : card.type === 'effect' ? 'border-ember-500'
                     : card.type === 'power'  ? 'border-gold-500'
                     :                          'border-moss-500';
          const costPillClass = playable
            ? (escalated ? 'bg-ember-500 text-parchment-50' : 'bg-gold-500 text-ink-800')
            : 'bg-ink-500 text-parchment-300';
          const costTooltip = escalated
            ? `Amplify costs +${amplifyPlaysThisCombat} this combat (base ${card.cost}).`
            : undefined;
          // v3.4.75 (Alan) — Punchline & other Loudness-consume cards show
          // Punchline / consumeLoudnessAsDamage live-damage preview removed
          // 2026-05-31 with the chutzpah → handler pivot (Loudness ripped).
          const displayCard = card;
          // Lure cards in hand are draggable to a specific stage slot.
          // dataTransfer carries the hand index; the slot's onDrop reads it
          // and calls onPlayCard(handIdx, { targetSlot }) to land the lure
          // in the chosen slot rather than the default first-empty.
          const isLure = card.slot === 'lure' && playable;
          return (
            <motion.button key={card.uid}
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              draggable={isLure}
              onDragStart={isLure ? (e) => {
                e.dataTransfer.setData('text/plain', String(i));
                e.dataTransfer.effectAllowed = 'move';
              } : undefined}
              onDragEnd={isLure ? () => setDragOverSlot(null) : undefined}
              onClick={() => isFootnoteEligible ? onApplyFootnote(card.uid) : onPlayCard(i)}
              disabled={!(playable || isFootnoteEligible)}
              className={`w-[180px] h-72 shrink-0 rounded-lg border-2 p-2.5 text-left flex flex-col gap-1.5 shadow-lg transition-all ${
                isFootnoteEligible
                  ? `bg-iris-900/60 text-iris-100 border-iris-400 ring-2 ring-iris-400 hover:scale-105 hover:shadow-2xl cursor-pointer`
                : playable
                  ? `bg-parchment-50 text-ink-800 ${tint} hover:scale-105 hover:shadow-2xl cursor-pointer`
                  : 'bg-ink-600 text-parchment-400 border-ink-500 opacity-50 cursor-not-allowed'
              }`}>
              <CardFullBody card={displayCard} costOverride={effCost} costPillClass={costPillClass} costTooltip={costTooltip} />
            </motion.button>
          );
        })}
      </div>

      {/* Action bar — always-visible row with Compendium / Deck / End Turn.
          When wit, the FFT Progress strip merges into this same row below the
          buttons. Pre-2026-05-31 this whole strip was wit-gated, which left
          handler/jnsq with NO End Turn button after the chutzpah pivot. */}
      <div className="parchment-card p-2 flex gap-2 flex-wrap items-center">
        {onOpenCompendium && isWit && (
          <button onClick={onOpenCompendium}
                  title="Open the Compendium of Fully Formed Thoughts"
                  className="px-2 py-1 text-xs rounded border bg-iris-700 text-parchment-50 border-iris-400 hover:bg-iris-600">
            📚 Compendium
          </button>
        )}
        {onOpenDeckView && (
          <button onClick={onOpenDeckView}
                  title="View all the cards currently in your deck (hand + draw + discard + exiled + tray), grouped by row"
                  className="px-2 py-1 text-xs rounded border bg-moss-700 text-parchment-50 border-moss-400 hover:bg-moss-600">
            🗂 Deck
          </button>
        )}
        <button onClick={onEndTurn} className="btn btn-ember text-sm px-4 py-1 ml-auto">End Turn</button>
      </div>

      {/* v3.4.28 (Alan): FFT Progress panel — Wit-only set-collection
          overlay; shows owned rows + their canonical phrase + rider on
          hover. Hidden when no set-tagged cards have been collected. */}
      {(() => {
        // Wit-only FFT Progress (handler retired FFT 2026-05-31).
        const laneRows = isWit ? WIT_ROWS : null;
        const laneBonuses = isWit ? WIT_SAME_SCHOOL_BONUSES : null;
        if (!laneRows || laneRows.length === 0) return null;
        const trayCards = [tray?.intro, tray?.subject, tray?.target, ...(tray?.modifiers || [])].filter(Boolean);
        const allCards = [...hand, ...deck, ...discard, ...exiled, ...trayCards];
        const progress = laneRows.map(row => {
          const has = { intro: false, subject: false, target: false };
          for (const c of allCards) {
            if (c.setId === row.id) {
              if (c.setSlot === 'intro')   has.intro = true;
              if (c.setSlot === 'subject') has.subject = true;
              if (c.setSlot === 'target')  has.target = true;
            }
          }
          const owned = (has.intro ? 1 : 0) + (has.subject ? 1 : 0) + (has.target ? 1 : 0);
          return { row, owned, has };
        });
        const visible = progress.filter(p => p.owned > 0);
        return (
          <div className="parchment-card p-2 flex gap-2 flex-wrap items-center">
            <span className="text-[10px] uppercase tracking-widest text-iris-300 mr-1">🎩 FFT Progress</span>
            {visible.length === 0 && (
              <span className="text-[11px] text-parchment-400 italic">No rows collected yet — pick up a set-tagged card to start.</span>
            )}
            {visible.map(({ row, owned, has }) => {
              const tier = laneBonuses?.[row.schoolId];
              const complete = owned === 3;
              const slotsLabel = `Intro ${has.intro ? '✓' : '✗'} · Subject ${has.subject ? '✓' : '✗'} · Target ${has.target ? '✓' : '✗'}`;
              return (
                <span key={row.id}
                  title={`"${row.canonical}"\n\nTier: ${tier?.name || row.schoolId}\nRider: ${row.riderDesc || '(none)'}\n\n${slotsLabel}`}
                  className={`px-2 py-1 text-xs rounded border cursor-help ${
                    complete ? 'bg-gold-700 text-parchment-50 border-gold-400 font-bold'
                             : owned === 2 ? 'bg-iris-800 text-parchment-100 border-iris-500'
                             : 'bg-ink-700 text-parchment-200 border-ink-500'
                  }`}>
                  {row.name} {owned}/3
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* v2.35: FOOTNOTE — discard-pile picker. Renders inline below the
          hand when the prompt is active. Only intros / subjects / modifiers
          are eligible (target cards aren't word slots; gestures /
          annotations / skills aren't wit-stat-bearing in the relevant
          way). Filtering by slot keeps the picker focused on the
          phrase-install spec. */}
      {footnotePromptActive && (
        <div className="mt-2 p-3 rounded border-2 border-iris-500/60 bg-iris-900/30">
          <div className="text-xs uppercase tracking-wider text-iris-200 mb-2">
            Discard pile — eligible cards ({discard.filter(c => c.slot === 'intro' || c.slot === 'subject' || c.slot === 'modifier').length})
          </div>
          {discard.filter(c => c.slot === 'intro' || c.slot === 'subject' || c.slot === 'modifier').length === 0 ? (
            <div className="text-sm italic text-parchment-400">No eligible cards in discard. Pick from hand instead.</div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {discard.map((c, i) => {
                if (c.slot !== 'intro' && c.slot !== 'subject' && c.slot !== 'modifier') return null;
                const fn = c.footnotes || 0;
                return (
                  <button key={`${c.uid}-${i}`}
                    onClick={() => onApplyFootnote(c.uid)}
                    className="px-2 py-1.5 bg-iris-800 text-iris-100 rounded border border-iris-400 hover:bg-iris-700 hover:scale-105 text-xs transition-all">
                    <div className="font-display text-sm">{c.name || c.phrase}</div>
                    <div className="text-[10px] text-iris-300">
                      {c.slot} · ✨ wit {(c.stats?.wit || 0) + fn}{fn > 0 ? ` (+${fn} *)` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* v3.3: action log hidden by default (Alan: "doesn't need to be
          visible on the combat screen"). The log array is still
          populated for telemetry / replay / future debug overlay. */}
    </div>
  );
}

export function V2SpellTray({ tray, onUnstage, onCast, castsThisTurn = 0, maxCastsPerTurn = 1,
                       isHandler = false,
                       playerHp = 70, playerMaxHp = 70,
                       tempHp = 0,
                       isJnsq = false, rollOptIn = false, setRollOptIn = () => {},
                       lastRoll = null, combatRolls = [],
                       playerDmgMult = 1.0, enemyDmgMult = 1.0,
                       combatTurn = 1,
                       pauseHeldActive = false, enemy = null,
                       weaveStacks = 0, riposteCharge = 0, braceArmedDraw = 0,
                       wordsBank = 0, crescendoBuildup = 0, crescendoBuildupRows = [],
                       animals = {}, tutorArmed = false,
                       shooPromptActive = false, onShooAnimal = () => {},
                       whistlePromptActive = false, whistlePick1Slot = null, onWhistleClick = () => {},
                       treatPromptActive = false, onTreatClick = () => {},
                       eatItPromptActive = false, onEatItClick = () => {},
                       onPlayCard = () => {},
                       dragOverSlot = null, setDragOverSlot = () => {} }) {
  // Handler Animal Summoner (2026-05-31, slice 1): a tray slot may hold a
  // { kind: 'lure' | 'animal' } envelope instead of a raw card. Cast preview
  // / FFT detection only treats raw cards as content; envelopes are rendered
  // separately as summon pills below.
  const isSummonEnvelope = (v) => v && (v.kind === 'lure' || v.kind === 'animal');
  const introCard = isSummonEnvelope(tray.intro) ? null : tray.intro;
  const subjectCard = isSummonEnvelope(tray.subject) ? null : tray.subject;
  const targetCard = isSummonEnvelope(tray.target) ? null : (tray.target || tray.effectCard);
  const intro = introCard;
  const subject = subjectCard;
  const target = targetCard;
  const modifiers = tray.modifiers || [];
  const summonIntro = isSummonEnvelope(tray.intro) ? tray.intro : null;
  const summonSubject = isSummonEnvelope(tray.subject) ? tray.subject : null;
  const summonTarget = isSummonEnvelope(tray.target) ? tray.target : null;
  const anySummon = !!(summonIntro || summonSubject || summonTarget);
  const anyStaged = intro || subject || target || modifiers.length > 0 || anySummon;

  // Compose sentence + damage preview when all 3 primary slots filled.
  const ready = !!(intro && subject && target);
  const tier = ready ? computeSpellTier(intro, subject, target) : 0;
  const tierMult = TIER_MULTIPLIER[tier] || 1.0;
  const tierLabel = tier === 3 ? 'DEVASTATING' : tier === 2 ? 'RESONANT' : tier === 1 ? 'COHERENT' : '';
  let sentence = '';
  let predicted = null;
  let fftPreview = null;
  let mixedPreview = null;
  let crescendoPreview = null;
  if (ready) {
    sentence = composeSpellText(intro, subject, target, modifiers);
    const { damage: baseDamage, riders, predatorBonus, insultBonus, insultMatches, insultMatchedTags } = computeSpellDamage(intro, subject, target, modifiers, { playerDmgMult, enemyDmgMult, combatTurn, insultVulnerabilities: enemy?.insultVulnerabilities || [], pauseDoubled: pauseHeldActive });
    // v3.4.73 (Alan): predicted damage previously showed only the cast
    // base from computeSpellDamage — but full FFT riders fire AFTER the
    // base and can add huge amounts (Bluster-1's `bonus: 12`, pressure
    // bonus, RAGE × 2, missing-HP scaling, consume-Pressure spike, etc.).
    // Without baking these in, a player staging Bluster-1 saw "8 comp"
    // and got hit for 21. Now Predicted shows the actual delivered total.
    let damage = baseDamage;
    const damageParts = [];
    const fftPre = detectFFT(intro, subject, target);
    if (fftPre.fft) {
      const r = fftPre.fft.rider || {};
      if (r.damageMult)  { damage = Math.round(damage * r.damageMult); damageParts.push(`× ${r.damageMult} (rider)`); }
      if (r.bonus)       { damage += r.bonus; damageParts.push(`+${r.bonus} (FFT bonus)`); }
      if (r.pressureBonus && (enemy?.pressure || 0) > 0) {
        damage += enemy.pressure;
        damageParts.push(`+${enemy.pressure} Pressure bonus`);
      }
      if (r.consumePressureMult && (enemy?.pressure || 0) > 0) {
        const spike = enemy.pressure * r.consumePressureMult;
        damage += spike;
        damageParts.push(`+${spike} (Pressure ${enemy.pressure} × ${r.consumePressureMult})`);
      }
      // consumeLoudnessMult + rageDouble preview chips removed 2026-05-31
      // with the chutzpah → handler pivot.
      if (r.missingHpScaling) {
        const missing = Math.max(0, playerMaxHp - playerHp);
        const bonus = missing * r.missingHpScaling;
        if (bonus > 0) {
          damage += bonus;
          damageParts.push(`+${bonus} missing-HP scaling`);
        }
      }
      if (r.consumeTempHpAsDamage && tempHp > 0) {
        const bonus = Math.round(tempHp * r.consumeTempHpAsDamage);
        damage += bonus;
        damageParts.push(`+${bonus} (Temp HP ${tempHp} × ${r.consumeTempHpAsDamage})`);
      }
    }
    // v3.4.82 (Alan: "Predicted said 12, hit for 16 with enemy Vulnerable").
    // Bake the enemy stat-effectiveness AND playerDmgMult (carries enemy
    // Vulnerable / player Weak) into the Predicted number. App.jsx applies
    // both at cast time (lines 6285-6286), so Predicted without them was
    // structurally low whenever Vulnerable was up or stat-eff != 1.0.
    const targetStat = target?.effect?.scaleBy || target?.lane || 'wit';
    const enemyStatMult = enemy?.effectiveness?.[targetStat] ?? 1.0;
    if (enemyStatMult !== 1.0) {
      const before = damage;
      damage = Math.round(damage * enemyStatMult);
      if (damage !== before) damageParts.push(`× ${enemyStatMult.toFixed(2)} (enemy ${targetStat}-eff)`);
    }
    if ((playerDmgMult || 1.0) !== 1.0) {
      const before = damage;
      damage = Math.round(damage * (playerDmgMult || 1.0));
      if (damage !== before) damageParts.push(`× ${(playerDmgMult || 1.0).toFixed(2)} (Vuln/Weak mult)`);
    }
    predicted = { damage, baseDamage, damageParts, riders, predatorBonus: predatorBonus || 0, openingBonus: 0, insultBonus: insultBonus || 0, insultMatches: insultMatches || 0, insultMatchedTags: insultMatchedTags || [] };
    // v3.4.21 (Alan): preview the FFT-tier rider that will fire on cast.
    // Most specific match wins (full → partial → same-school). Each tier
    // surfaces its rider as readable chips under the Predicted damage so
    // the player can see incoming DoT / reflect / bank effects before
    // they commit to the cast.
    const fft = detectFFT(intro, subject, target);
    if (fft.fft) {
      fftPreview = { kind: 'full', label: `Full FFT — ${fft.fft.name}`, rider: fft.fft.rider || {}, riderDesc: fft.fft.riderDesc };
      // v3.4.23 — Crescendo "Build then Climax" damage preview. Mirrors
      // the logic in castV2SentenceSpell so the player can see what the
      // next FFT crescendo cast will deliver at the current buildup stage.
      if (fft.fft.schoolId === 'crescendo') {
        const consumeBank = fft.fft.rider?.consumeBank || 0;
        const nextBuildup = crescendoBuildup + 1;  // 1, 2, or 3
        const nextRows = [...crescendoBuildupRows, fft.fft.id];
        const sameRow = nextBuildup === 3 && nextRows[0] === nextRows[1] && nextRows[1] === nextRows[2];
        // v3.4.24 — matches the cast formula: stage 1=0, stage 2=1, stage 3=2.
        const stageMult = nextBuildup === 1 ? 0 : nextBuildup === 2 ? 1 : 2;
        const baseRaw = predicted.damage + consumeBank * wordsBank * stageMult;
        const stagedDmg = nextBuildup === 1 ? 0
                        : nextBuildup === 2 ? Math.round(baseRaw * 0.5)
                        : Math.round(baseRaw * (sameRow ? 1.5 : 1.0));
        crescendoPreview = {
          stage: nextBuildup,
          dmg: stagedDmg,
          sameRow,
          consumeBank,
          wordsBank,
          rowName: fft.fft.name,
          stageMult,
        };
      }
    } else if (fft.partialRow) {
      const partial = WIT_PARTIAL_ROW_BONUSES[fft.partialRow.schoolId];
      if (partial) {
        const schoolName = (partial.name || '').replace(' (half-formed)', '') || fft.partialRow.schoolId;
        fftPreview = { kind: 'partial', label: `Half-formed ${schoolName}`, rider: partial };
      }
    } else if (fft.schoolId) {
      const sub = WIT_SAME_SCHOOL_BONUSES[fft.schoolId];
      if (sub) fftPreview = { kind: 'same-school', label: `Same-school ${sub.name}`, rider: sub };
    }
    // v3.4.22 — mixed-school preview (additive, can fire alongside fftPreview).
    const castSchools = new Set([intro?.schoolId, subject?.schoolId, target?.schoolId].filter(Boolean));
    if (castSchools.size >= 2) {
      const key = [...castSchools].sort().join('+');
      const mixed = WIT_MIXED_SCHOOL_BONUSES[key];
      if (mixed) mixedPreview = { kind: 'mixed', label: `Mixed-school ${mixed.name}`, rider: mixed };
    }
  }
  // v3.4.77 — ALL IN stake mechanic pulled. The variables stayed
  // referenced elsewhere; stubbed to defaults so the rest of the
  // component compiles unchanged.
  const stakeBlocked = false;
  const stakeRequired = 0;
  // v2.12: jnsq CHAOS DICE — auto-roll when a forceRoll modifier or
  // alwaysRolls target is staged; otherwise opt-in via toggle.
  const forcedRoll = ready && (
    modifiers.some(m => m?.modifierEffect?.forceRoll) ||
    target?.effect?.alwaysRolls === true
  );
  const rollRequired = target?.effect?.requiresPriorRoll || 0;
  const rollBlocked = ready && rollRequired > 0 && !combatRolls.includes(rollRequired);

  const tagCounts = {};
  for (const c of [intro, subject, target, ...modifiers]) {
    if (!c) continue;
    for (const t of c.tags || []) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }

  // v2.79: per-card stat contribution. The lane the target uses for
  // its scaleBy drives which stat the words contribute. For each staged
  // card show its `+N` stat in the lane plus, for targets, the base
  // damage. Helps the player see WHAT each card is adding to the cast.
  const castLane = target?.effect?.scaleBy || target?.lane || intro?.lane || 'wit';
  const cardContribution = (card, slotName) => {
    if (!card) return null;
    const laneStat = card.stats?.[castLane] || 0;
    const isTarget = slotName === 'target';
    const base = isTarget ? (card.effect?.base || 0) : 0;
    const mult = isTarget ? (card.effect?.multiplier || 1) : 0;
    // Footnote rider on word slots — adds to effective lane stat.
    const footnote = card.footnotes || 0;
    return { laneStat, base, mult, footnote };
  };

  // v3.4.21 — summarize a rider object as readable chip strings.
  // Handles DoT (flat + schedule), thorns, bank consume/refill, scheduled
  // per-turn effects (vuln/weak/dormant/block/draw), and a handful of
  // immediate-state riders (composure, block, draw, longThread).
  // Returns an array of short chip strings.
  function summarizeRider(rider) {
    if (!rider) return [];
    const chips = [];
    // DoT: flat (setDotMinDamage × setDotMinTurns) OR schedule.
    if (rider.setDotMinDamage && rider.setDotMinTurns) {
      chips.push(`🩸 DoT ${rider.setDotMinDamage}/turn × ${rider.setDotMinTurns}`);
    } else if (rider.setDotMinDamage) {
      chips.push(`🩸 DoT ${rider.setDotMinDamage}`);
    }
    if (Array.isArray(rider.setDotSchedule) && rider.setDotSchedule.length > 0) {
      chips.push(`🩸 DoT ${rider.setDotSchedule.join(',')}`);
    }
    if (rider.addDotDamage) chips.push(`🩸 +${rider.addDotDamage}/turn to DoT`);
    if (rider.addDotTurns) chips.push(`🩸 +${rider.addDotTurns} DoT turns`);
    if (rider.dotMultiply) chips.push(`🩸 DoT ×${rider.dotMultiply}`);
    if (rider.dotConsumeBig) chips.push(`💥 Detonate DoT`);
    // Thorns reflect (discrete charges).
    if (rider.thorns) {
      const t = rider.thorns;
      let s = `🌹 Reflect ${t.amount} × next ${t.count}`;
      if (t.weakOnReflect) s += ` + Weak`;
      chips.push(s);
    }
    // Thorns reflect aura (duration).
    if (rider.selfThornsPerTurn) chips.push(`🌹 Reflect ${rider.selfThornsPerTurn.amount}/hit × ${rider.selfThornsPerTurn.turns} turns`);
    if (Array.isArray(rider.selfThornsSchedule) && rider.selfThornsSchedule.length > 0) chips.push(`🌹 Reflect ${rider.selfThornsSchedule.join(',')}/turn`);
    if (rider.stripEnemyBlock) chips.push(`🛇 Strip ${rider.stripEnemyBlock} block`);
    if (rider.stripEnemyBlockPerTurn) chips.push(`🛇 Strip ${rider.stripEnemyBlockPerTurn.amount} block/turn × ${rider.stripEnemyBlockPerTurn.turns}`);
    if (rider.forceSkipNextAttack) chips.push(`🛑 Skip their next attack`);
    // Crescendo bank.
    if (rider.consumeBank) chips.push(`📚 Spend bank ×${rider.consumeBank}`);
    if (rider.addBank) chips.push(`📚 +${rider.addBank} bank`);
    if (rider.bankDoublePerTurn) chips.push(`📚 Bank doubles for ${rider.bankDoublePerTurn.turns} turns`);
    // Scheduled per-turn enemy debuffs.
    if (rider.enemyVulnPerTurn) chips.push(`🩸 Vuln ${rider.enemyVulnPerTurn.amount}/turn × ${rider.enemyVulnPerTurn.turns}`);
    if (rider.enemyWeakPerTurn) chips.push(`💢 Weak ${rider.enemyWeakPerTurn.amount}/turn × ${rider.enemyWeakPerTurn.turns}`);
    if (rider.dormantDamage) chips.push(`⏱ Dormant ${rider.dormantDamage.amount} in ${rider.dormantDamage.delay} turns`);
    if (rider.selfBlockPerTurn) chips.push(`🛡 +${rider.selfBlockPerTurn.amount} Block/turn × ${rider.selfBlockPerTurn.turns}`);
    if (rider.selfPoisePerTurn) chips.push(`🪞 +${rider.selfPoisePerTurn.amount} Poise/turn × ${rider.selfPoisePerTurn.turns}`);
    if (rider.selfHpRegenPerTurn) chips.push(`💚 +${rider.selfHpRegenPerTurn.amount} HP/turn × ${rider.selfHpRegenPerTurn.turns}`);
    if (rider.selfDrawPerTurn) chips.push(`📥 +${rider.selfDrawPerTurn.amount} draw/turn × ${rider.selfDrawPerTurn.turns}`);
    // Immediate-state riders.
    if (rider.block) chips.push(`🛡 +${rider.block} Block`);
    if (rider.poise) chips.push(`🪞 +${rider.poise} Poise`);
    if (rider.composure) chips.push(`🎭 -${rider.composure} comp`);
    if (rider.draw) chips.push(`📥 +${rider.draw} draw`);
    if (rider.energy) chips.push(`⚡ +${rider.energy} energy`);
    if (rider.longThreadPerm) chips.push(`🧵 +${rider.longThreadPerm} thread`);
    // v3.4.71 — handler school riders.
    if (rider.addPressure) chips.push(`🔥 +${rider.addPressure} Pressure`);
    if (rider.pressureBonus) {
      const cur = enemy?.pressure || 0;
      chips.push(cur > 0 ? `🔥 +${cur} from Pressure` : `🔥 +Pressure bonus`);
    }
    if (rider.consumePressureMult) {
      const cur = enemy?.pressure || 0;
      const bonus = cur * rider.consumePressureMult;
      chips.push(cur > 0 ? `🔥 Consume ${cur} Pressure × ${rider.consumePressureMult} = +${bonus}` : `🔥 Consume Pressure × ${rider.consumePressureMult}`);
    }
    // addLoudness + consumeLoudnessMult rider chips removed 2026-05-31.
    if (rider.addTempHp) chips.push(`🎈 +${rider.addTempHp.amount} Temp HP × ${rider.addTempHp.turns}t`);
    if (rider.consumeTempHpAsDamage) {
      const cur = tempHp || 0;
      const bonus = Math.round(cur * rider.consumeTempHpAsDamage);
      chips.push(cur > 0 ? `🎈 Pop ${cur} Temp HP × ${rider.consumeTempHpAsDamage} = +${bonus}` : `🎈 Pop Temp HP × ${rider.consumeTempHpAsDamage}`);
    }
    if (rider.selfVulnerable) chips.push(`🩸 YOU Vuln ${rider.selfVulnerable.amount} × ${rider.selfVulnerable.turns}t`);
    // rageDouble rider chip removed 2026-05-31 (RAGE machinery ripped).
    if (rider.missingHpScaling) {
      const missing = Math.max(0, (maxHp || 0) - (hp || 0));
      const bonus = missing * rider.missingHpScaling;
      chips.push(bonus > 0 ? `🩸 +${bonus} from missing HP` : `🩸 +N × missing HP`);
    }
    // addTunnelVision rider chip removed 2026-05-31.
    return chips;
  }

  const slotPill = (card, slotName, color) => {
    if (!card) {
      // Empty slots are drop targets for hand lures AND click targets for
      // Whistle (slot swap can target empty slots — moves an animal into
      // empty space). Whistle takes precedence over the drop affordance
      // when active. Drag-and-drop preventDefault is required by HTML5 DnD.
      // dragOverSlot drives a clear hover highlight so the player can see
      // where the card will land before releasing.
      const whistleArmed = whistlePromptActive;
      const isWhistlePick1 = whistleArmed && whistlePick1Slot === slotName;
      const isDragOver = dragOverSlot === slotName;
      return (
        <div
          onClick={whistleArmed ? () => onWhistleClick(slotName) : undefined}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDragEnter={() => setDragOverSlot(slotName)}
          onDragLeave={() => setDragOverSlot(s => s === slotName ? null : s)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverSlot(null);
            const handIdxRaw = e.dataTransfer.getData('text/plain');
            const handIdx = parseInt(handIdxRaw, 10);
            if (!Number.isNaN(handIdx) && onPlayCard) onPlayCard(handIdx, { targetSlot: slotName });
          }}
          title={whistleArmed ? `🎶 Click to ${whistlePick1Slot ? 'swap with ' + whistlePick1Slot : 'pick this slot'}` : undefined}
          className={`rounded text-sm italic text-center min-w-[140px] min-h-[120px] flex flex-col items-center justify-center transition-all duration-150 ${
            isDragOver
              ? 'bg-moss-700/70 border-4 border-moss-300 ring-4 ring-moss-400 text-parchment-50 scale-105 shadow-2xl'
              : whistleArmed
                ? (isWhistlePick1
                    ? 'bg-gold-900 border-2 border-gold-300 ring-2 ring-gold-400 text-gold-100 opacity-100 cursor-pointer p-3'
                    : 'border-2 border-dashed border-gold-400 text-gold-200 opacity-100 cursor-pointer hover:bg-gold-900/50 p-3')
                : `border-2 border-dashed ${color.empty} opacity-70 hover:opacity-100 hover:border-solid p-3`
          }`}>
          <span className="font-bold uppercase tracking-widest text-xs opacity-80">{slotName}</span>
          {isDragOver && <span className="text-[10px] mt-1 not-italic font-mono">↓ drop here</span>}
          {isWhistlePick1 && <span className="text-[10px] mt-1 not-italic">🎶</span>}
        </div>
      );
    }
    // Handler Animal Summoner — slot can hold a lure envelope, animal
    // envelope, or an OCCUPIED placeholder (a cell mirrored from a
    // multi-slot animal anchored elsewhere — e.g. Mouse House spans two).
    if (card.kind === 'occupied') {
      return (
        <div className="px-3 py-2 rounded bg-ember-800/40 border border-ember-700 border-dashed text-parchment-100 text-xs flex flex-col items-center gap-0.5 min-w-[110px] max-w-[200px] cursor-help"
             title={`This slot is occupied by the animal anchored in slot ${card.occupiedBy}.`}>
          <span className="font-mono text-[10px] opacity-70">{slotName} · occupied</span>
          <span className="font-bold text-center text-base opacity-80">⬅ part of {card.occupiedBy}</span>
        </div>
      );
    }
    if (card.kind === 'lure') {
      const animal = animals?.[card.animalId];
      // Lures are click targets for Whistle (swap) and Just Eat It (summon
      // now). First match wins by precedence: Just Eat It → Whistle.
      const whistleArmed = whistlePromptActive;
      const isWhistlePick1 = whistleArmed && whistlePick1Slot === slotName;
      const eatItArmed = eatItPromptActive;
      const clickHandler = eatItArmed ? () => onEatItClick(slotName)
                          : whistleArmed ? () => onWhistleClick(slotName)
                          : undefined;
      const armedTitle = eatItArmed
        ? `🍴 Click to summon the ${animal?.name || 'animal'} immediately.`
        : whistleArmed
        ? `🎶 Click to ${whistlePick1Slot ? 'swap with ' + whistlePick1Slot : 'pick this slot'}.`
        : `${card.cardName} — Lure. ${animal?.name || card.animalId} arrives in ${card.turnsRemaining} turn${card.turnsRemaining === 1 ? '' : 's'}.`;
      const armed = eatItArmed || whistleArmed;
      return (
        <motion.button key={card.uid}
          layout
          initial={{ scale: 0.5, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          onClick={clickHandler}
          title={armedTitle}
          className={`px-3 py-2 rounded text-parchment-50 text-xs flex flex-col items-center gap-0.5 min-w-[110px] max-w-[200px] ${
            armed
              ? (isWhistlePick1
                  ? 'bg-gold-900 border-2 border-gold-300 ring-2 ring-gold-400 animate-pulse cursor-pointer'
                  : 'bg-gold-700 border-2 border-gold-300 ring-2 ring-gold-400 animate-pulse cursor-pointer hover:bg-gold-600')
              : 'bg-moss-800 border border-moss-500 cursor-help'
          }`}>
          <span className="font-mono text-[10px] opacity-70">{slotName} · lure{isWhistlePick1 ? ' · 🎶' : ''}</span>
          <span className="font-bold text-center">🪱 {card.cardName}</span>
          <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 rounded bg-parchment-100/95 text-ink-800 text-center leading-tight">
            {animal?.icon || '🐾'} {animal?.name || card.animalId} in {card.turnsRemaining}t
          </span>
        </motion.button>
      );
    }
    if (card.kind === 'animal') {
      const animal = animals?.[card.animalId];
      // Predator-chain hint is hidden when the animal carries hidePredatorChain.
      const predatorNote = animal?.predatorChain && !animal?.hidePredatorChain
        ? ` · ${animals?.[animal.predatorChain.animalId]?.name || '?'} in ${animal.predatorChain.turnsToTrigger - (card.predatorProgress || 0)}t`
        : '';
      // Animals are click targets for Shoo, Treat, and Whistle. Precedence:
      // Shoo → Treat → Whistle.
      const shooArmed = shooPromptActive;
      const treatArmed = treatPromptActive;
      const whistleArmed = whistlePromptActive;
      const isWhistlePick1 = whistleArmed && whistlePick1Slot === slotName;
      const clickHandler = shooArmed ? () => onShooAnimal(slotName)
                          : treatArmed ? () => onTreatClick(slotName)
                          : whistleArmed ? () => onWhistleClick(slotName)
                          : undefined;
      const armed = shooArmed || treatArmed || whistleArmed;
      const armedTitle = shooArmed
        ? `👋 Click to Shoo this ${animal?.name || 'animal'} away.`
        : treatArmed
        ? `🍖 Click to extend ${animal?.name || 'animal'} by 1 turn.`
        : whistleArmed
        ? `🎶 Click to ${whistlePick1Slot ? 'swap with ' + whistlePick1Slot : 'pick this slot'}.`
        : `${animal?.name || card.animalId} — ${animal?.desc || ''} ${card.durationRemaining} turn${card.durationRemaining === 1 ? '' : 's'} left.${predatorNote}`;
      const armedLabel = shooArmed ? ' · 👋 click to shoo'
                       : treatArmed ? ' · 🍖 click to treat'
                       : whistleArmed ? (isWhistlePick1 ? ' · 🎶' : ' · 🎶 click to swap')
                       : '';
      return (
        <motion.button key={card.animalId + '-' + slotName}
          layout
          initial={{ scale: 0.5, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          onClick={clickHandler}
          title={armedTitle}
          className={`px-3 py-2 rounded text-parchment-50 text-xs flex flex-col items-center gap-0.5 min-w-[110px] max-w-[200px] ${
            armed
              ? (isWhistlePick1
                  ? 'bg-gold-900 border-2 border-gold-300 ring-2 ring-gold-400 animate-pulse cursor-pointer'
                  : 'bg-gold-700 border-2 border-gold-300 ring-2 ring-gold-400 animate-pulse cursor-pointer hover:bg-gold-600')
              : 'bg-ember-800 border border-ember-500 cursor-help'
          }`}>
          <span className="font-mono text-[10px] opacity-70">{slotName} · animal{armedLabel}</span>
          <span className="font-bold text-center text-base">{animal?.icon} {animal?.name}</span>
          <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 rounded bg-parchment-100/95 text-ink-800 text-center leading-tight">
            {(animal?.attack || 0) > 0
              ? `${animal.attack} 🎭 / turn · ${card.durationRemaining}t left`
              : `(flops) · ${card.durationRemaining}t left`}
            {predatorNote}
          </span>
        </motion.button>
      );
    }
    const contrib = cardContribution(card, slotName);
    // v3.3: surface FFT row affiliation on the staged pill so the
    // player can SEE which school/row each card belongs to mid-cast.
    const row = card.setId ? WIT_ROW_BY_ID[card.setId] : null;
    const tierName = card.schoolId
      ? (WIT_SAME_SCHOOL_BONUSES[card.schoolId]?.name || card.schoolId)
      : null;
    return (
      <motion.button key={card.uid}
        layout
        initial={{ scale: 0.5, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        onClick={() => onUnstage(card.uid)}
        title={`${card.phrase || card.name} — click to unstage`}
        className={`px-3 py-2 rounded ${color.filled} text-parchment-50 text-xs flex flex-col items-center gap-0.5 min-w-[110px] max-w-[200px]`}>
        <span className="font-mono text-[10px] opacity-70">{slotName}</span>
        <span className="font-bold text-center">{card.phrase || card.name}</span>
        {row && (
          <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 rounded bg-parchment-100/95 text-ink-800 text-center leading-tight"
            title={`Play all three cards of "${row.name}" together → ${row.riderDesc || 'Fully Formed Thought'}`}>
            🎩 {tierName} · {row.name}
          </span>
        )}
        {contrib && (
          <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 rounded bg-ink-900/40 text-parchment-200"
            title={slotName === 'target'
              ? `Target contributes: ${contrib.base} base + (×${contrib.mult} on the stat sum).`
              : `Word contributes: +${contrib.laneStat + contrib.footnote} ${castLane} to the spell's stat sum${contrib.footnote > 0 ? ` (includes +${contrib.footnote} footnote)` : ''}.`}>
            {slotName === 'target'
              ? `${contrib.base} + ${castLane.slice(0, 4)}×${contrib.mult}`
              : `+${contrib.laneStat + contrib.footnote} ${castLane.slice(0, 4)}${contrib.footnote > 0 ? '*' : ''}`}
          </span>
        )}
      </motion.button>
    );
  };

  // v2.79: math breakdown — the step-by-step calculation that the
  // player can read alongside the predicted number. Surfaces tag-
  // resonance (perLaneTag), tier multiplier, enemy effectiveness, and
  // player potency contributions so the player sees WHERE the damage
  // comes from. Only computed when the spell is ready (full tray).
  let mathBreakdown = null;
  if (ready && predicted) {
    const introStat = (intro.stats?.[castLane] || 0) + (intro.footnotes || 0);
    const subjStat  = (subject.stats?.[castLane] || 0) + (subject.footnotes || 0);
    const tgtStat   = (target.stats?.[castLane] || 0);
    const modStat   = modifiers.reduce((s, m) => s + ((m?.stats?.[castLane] || 0) + (m?.footnotes || 0)), 0);
    const statTotal = introStat + subjStat + tgtStat + modStat;
    const baseDmg   = target.effect?.base || 0;
    const mult      = target.effect?.multiplier || 1;
    const preTier   = baseDmg + statTotal * mult;
    const preEnemy  = preTier * tierMult;
    const dmgType   = target.effect?.damageType || 'composure';
    const enemyEff  = enemy?.effectiveness
      ? (dmgType === 'physical' ? (enemy.effectiveness.physical ?? 1) : (enemy.effectiveness[castLane] ?? 1))
      : 1;
    // perLaneTag bonus from the target rider
    const perTag = target.effect?.perLaneTag;
    let tagBonus = 0;
    if (perTag) {
      const allTags = [intro, subject, target, ...modifiers]
        .flatMap(c => c?.tags || []);
      const matches = allTags.filter(t => perTag.tags.includes(t)).length;
      tagBonus = matches * perTag.bonus;
    }
    // v2.94: 2nd-cast 0.6× scalar — universal since v2.91, but wasn't surfaced
    // in the math bar. Players were seeing the multiplier chain end at a
    // bigger number than the actual damage dealt because this scalar fires
    // post-display. Now appears as `× 0.6 cast#N` when applicable.
    const secondCastScalar = castsThisTurn >= 1 ? 0.6 : 1;
    // v2.98: surface enemy block as a separate subtraction chip. The cast
    // formula applies enemy.block AFTER all multipliers (see App.jsx cast
    // resolver — block absorbs first before the damage hits the pool).
    const enemyBlockNow = enemy?.block || 0;
    mathBreakdown = {
      statTotal, baseDmg, mult, preTier, tierMult, preEnemy,
      enemyEff, playerMult: playerDmgMult, tagBonus,
      castLane, dmgType, secondCastScalar,
      enemyBlock: enemyBlockNow,
    };
  }

  return (
    <>
    <div className={`parchment-card p-2 border-l-4 ${anyStaged ? 'border-l-iris-400' : 'border-l-ink-500'}`}>
      {/* v3.4.28 — header / sentence / tags sit in a left column; slot
          pills + Predicted sit in a right column on the same row. */}
      <div className="flex gap-3 items-start">
        {/* Left column: label + sentence + tags */}
        <div className="flex flex-col gap-1 min-w-[180px] max-w-[280px]">
          <div className="flex justify-between items-center">
            <div className="text-[10px] uppercase tracking-widest text-iris-300 font-bold">📜 Spell Tray</div>
            <div className="flex items-center gap-2">
              {tutorArmed && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gold-700 text-parchment-50 border border-gold-400 animate-pulse cursor-help"
                      title="The Tutor is armed. The next time you stage an intro AND a subject from the same FFT row, the matching target is pulled from your hand / deck / discard directly into the tray, ready to cast.">
                  📚 TUTOR ARMED
                </span>
              )}
              {tier > 0 && (
                <div className={`text-[10px] font-bold font-mono ${tier === 3 ? 'text-ember-300' : tier === 2 ? 'text-iris-200' : 'text-parchment-300'}`}>
                  {tierLabel} ×{tierMult.toFixed(1)}
                </div>
              )}
            </div>
          </div>
          <div className="text-[11px] font-quill italic text-parchment-100 leading-snug">
            {isHandler
              ? (anySummon
                  ? <span className="text-parchment-300">Your menagerie is on the case. Stage more lures, defend the slots.</span>
                  : <span className="text-parchment-400">(empty — play a lure to summon an animal to a slot)</span>)
              : ready
                ? <span>"{sentence}"</span>
                : !anyStaged
                  ? <span className="text-parchment-400">(empty — stage intro + subject + target to cast)</span>
                  : <span>
                      {intro && <span>{intro.phrase} </span>}
                      {subject && <span>{subject.phrase} </span>}
                      {!target && <span className="text-parchment-400 not-italic">… (need a target to cast)</span>}
                    </span>
            }
          </div>
          {Object.keys(tagCounts).length > 0 && (
            <div className="flex gap-1 flex-wrap text-[10px] font-mono">
              <span className="text-iris-300">✦</span>
              {Object.entries(tagCounts).map(([tag, n]) => (
                <span key={tag} className="px-1.5 py-0.5 rounded bg-iris-800 text-parchment-100">
                  {tag}{n > 1 ? ` ×${n}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right column: slot pills + Predicted + Cast */}
        {/* v3.4.31 (Alan): no-wrap + overflow-x-auto so the Cast button
            stays anchored to the right side regardless of how wide the
            slot pills get when staged. Pills shrink-min before wrapping. */}
        <div className="flex-1 flex flex-nowrap items-stretch gap-2 overflow-x-auto">
        {slotPill(tray.intro, 'intro', { empty: 'border-iris-600 text-iris-400', filled: 'bg-iris-700 hover:bg-iris-600 border border-iris-400' })}
        {slotPill(tray.subject, 'subject', { empty: 'border-iris-600 text-iris-400', filled: 'bg-iris-700 hover:bg-iris-600 border border-iris-400' })}
        {slotPill(tray.target, 'target', { empty: 'border-ember-600 text-ember-500', filled: 'bg-ember-700 hover:bg-ember-600 border border-ember-400' })}
        {modifiers.map(m => slotPill(m, 'modifier', { empty: '', filled: 'bg-gold-700 hover:bg-gold-600 border border-gold-400' }))}
        {modifiers.length < 2 && slotPill(null, modifiers.length === 0 ? 'modifier (optional)' : 'modifier 2 (optional)', { empty: 'border-gold-600 text-gold-500', filled: '' })}
        <div className="flex-1" />
        {ready && predicted && (
          <div className="text-right flex flex-col items-end gap-1">
            <div>
              <div className="text-[10px] uppercase text-parchment-300">Predicted</div>
              {(() => {
                // v3.4.62 (Alan): color the predicted damage when the
                // player's damage mult is amplified (e.g. enemy Vulnerable)
                // or weakened. The raw 'predicted.damage' already includes
                // playerDmgMult, but the visual didn't signal it.
                const amped = (playerDmgMult ?? 1) > 1.05;
                const sapped = (playerDmgMult ?? 1) < 0.95;
                const color = amped ? 'text-moss-300' : sapped ? 'text-ember-300' : 'text-iris-200';
                const ampTitle = amped
                  ? `Amplified ×${(playerDmgMult ?? 1).toFixed(2)} — enemy is Vulnerable.`
                  : sapped
                  ? `Sapped ×${(playerDmgMult ?? 1).toFixed(2)} — you are Weakened.`
                  : '';
                const partsTooltip = (predicted.damageParts && predicted.damageParts.length > 0)
                  ? `Base cast: ${predicted.baseDamage}\n${predicted.damageParts.map(p => '  ' + p).join('\n')}\nFinal: ${predicted.damage}`
                  : '';
                const baseTitle = ampTitle || `Tier ${tier} × ${tierMult.toFixed(1)} multiplier${predicted.predatorBonus ? `, +${predicted.predatorBonus} predator (enemy debuffed)` : ''}`;
                const fullTitle = partsTooltip ? `${baseTitle}\n\n${partsTooltip}` : baseTitle;
                return (
                  <div className={`text-2xl font-bold font-mono ${color} cursor-help`}
                       title={fullTitle}>
                    {amped && <span className="text-xs mr-1">🩸</span>}
                    {predicted.damage} <span className="text-sm text-parchment-300">{mathBreakdown?.dmgType === 'block' ? '🛡 block' : mathBreakdown?.dmgType === 'physical' ? 'phys' : 'comp'}</span>
                    {predicted.predatorBonus > 0 && (
                      <span className="text-xs text-ember-300 ml-1" title="Predator rider — enemy is Vulnerable or Weak.">🩸+{predicted.predatorBonus}</span>
                    )}
                    {predicted.insultBonus > 0 && (
                      <span className="text-xs text-iris-300 ml-1"
                        title={`Insult-hit: ${(predicted.insultMatchedTags || []).slice(0, 3).join(', ')} (${Math.min(predicted.insultMatches || 0, 3)} match${(predicted.insultMatches || 0) === 1 ? '' : 'es'} × pierce).`}>
                        🎯+{predicted.insultBonus}
                      </span>
                    )}
                    {/* loudnessGain badge removed 2026-05-31. */}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {/* v2.99.4: CAST button moved inline with the slot row so it
            shares horizontal space with the slots + Predicted, instead
            of taking a full line below them. Tightens the combat
            screen's vertical footprint considerably. */}
        {!isHandler && (<button onClick={onCast}
          disabled={!ready || castsThisTurn >= maxCastsPerTurn || stakeBlocked || rollBlocked}
          title={
            stakeBlocked ? `Target requires ${stakeRequired}+ HP staked.` :
            rollBlocked ? `Target requires a prior ${rollRequired} rolled this combat.` :
            castsThisTurn >= maxCastsPerTurn ? 'Cast cap reached (defensive ceiling, shouldn\'t trigger).' :
            'Cast the staged spell.'
          }
          className={`btn text-base px-6 py-2 ml-2 self-center ${
            castsThisTurn >= maxCastsPerTurn || stakeBlocked || rollBlocked ? 'bg-ink-600 text-parchment-400 cursor-not-allowed' :
            ready ? 'btn-iris animate-pulse' : 'bg-ink-600 text-parchment-400 cursor-not-allowed'
          }`}>
          ✨ CAST {castsThisTurn > 0 && <span className="text-[10px] ml-1">(#{castsThisTurn + 1} this turn)</span>}
        </button>)}
        {/* v3.4.77 (Alan): ALL IN stake UI pulled — see commit notes.
            Stake mechanic still has dead-but-harmless code in App.jsx
            and shared.js in case it returns as a Ballistic-school
            feature later. */}
        {isJnsq && ready && (
          <div className="flex items-center gap-1 ml-2 px-2 py-1 rounded border border-moss-500 bg-moss-900 bg-opacity-30"
               title="Roll a 1d6 on this cast. Modifies damage and adds side effects per the outcome.">
            <button onClick={() => !forcedRoll && setRollOptIn(!rollOptIn)}
              disabled={forcedRoll}
              className={`px-2 h-7 rounded text-xs font-bold uppercase tracking-wide ${
                forcedRoll || rollOptIn
                  ? 'bg-moss-600 text-parchment-50 hover:bg-moss-500'
                  : 'bg-ink-700 text-parchment-300 hover:bg-ink-600'
              }`}>
              🎲 {forcedRoll ? 'FORCED' : rollOptIn ? 'WILL ROLL' : 'ROLL?'}
            </button>
            {lastRoll !== null && (
              <span className="text-xs text-moss-200 font-mono" title="Last roll this combat.">last: {lastRoll}</span>
            )}
            {combatRolls.length > 0 && (
              <span className="text-[10px] text-moss-300 font-mono opacity-70"
                    title={`Rolls this combat: ${combatRolls.join(', ')}`}>
                [{combatRolls.slice(-4).join(' · ')}]
              </span>
            )}
            {rollRequired > 0 && (
              <span className={`ml-1 text-[10px] font-bold uppercase ${rollBlocked ? 'text-ember-300' : 'text-moss-300'}`}
                    title={`Target requires a prior ${rollRequired} rolled this combat.`}>
                req {rollRequired}
              </span>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
    {/* v3.4.30 (Alan): Cast Details strip — math row + enemy state
        chips MOVED OUT of the spell tray so the tray itself stays the
        same height whether empty or staged. Always rendered with a
        min-height so the screen below doesn't jitter when you stage. */}
    <div className="parchment-card px-2 py-1 flex flex-col gap-0.5" style={{ minHeight: 32 }}>
      {/* v3.4.30 — FFT preview chips + Crescendo preview moved here from
          inside the spell tray. Compact inline rows so the strip stays
          a few lines tall. */}
      {([fftPreview, mixedPreview].filter(Boolean).length > 0 || crescendoPreview) && (
        <div className="flex flex-wrap gap-1 items-center text-[10px]">
          {[fftPreview, mixedPreview].filter(Boolean).map((p, pi) => {
            const chips = summarizeRider(p.rider);
            if (chips.length === 0) return null;
            const tone = p.kind === 'full' ? 'border-iris-500 bg-iris-900 text-iris-200'
                       : p.kind === 'partial' ? 'border-gold-500 bg-ink-700 text-gold-200'
                       : p.kind === 'mixed' ? 'border-moss-500 bg-ink-700 text-moss-200'
                       : 'border-ink-500 bg-ink-700 text-parchment-300';
            const icon = p.kind === 'full' ? '✨' : p.kind === 'partial' ? '📐' : p.kind === 'mixed' ? '🎨' : '🎵';
            return (
              <span key={pi} className={`px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${tone}`}>
                <span className="uppercase tracking-wide font-bold">{icon} {p.label}</span>
                {chips.map((c, i) => (
                  <span key={i} className="bg-ink-800 border border-ink-600 rounded px-1 py-0">{c}</span>
                ))}
              </span>
            );
          })}
          {crescendoPreview && (() => {
            const { stage, dmg, sameRow, consumeBank, wordsBank: wb } = crescendoPreview;
            const stageLabel = stage === 1 ? 'OPENING NOTE (0 dmg)'
                             : stage === 2 ? `BUILDING (~${dmg} half-dmg)`
                             : sameRow ? `🎵 SAME-ROW CLIMAX (~${dmg} dmg)` : `THE CLIMAX (~${dmg} dmg)`;
            const tail = stage === 3
              ? `· Bank ${wb}×${consumeBank}×2 = +${wb * consumeBank * 2} · BANK CONSUMED`
              : (wb > 0 ? `· Bank ${wb} held` : '');
            return (
              <span className="px-1.5 py-0.5 rounded border border-gold-400 bg-ink-700 text-gold-200 inline-flex items-center gap-1">
                <span className="uppercase tracking-wide font-bold">📚 Buildup → {stage}/3</span>
                <span className="font-bold">{stageLabel}</span>
                {tail && <span className="opacity-80">{tail}</span>}
              </span>
            );
          })()}
        </div>
      )}
      {mathBreakdown && (
        <div className="text-[11px] font-mono text-parchment-300 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-iris-300 font-bold text-[10px] uppercase tracking-widest mr-1">Math:</span>
          <span title={`${mathBreakdown.baseDmg} base + ${mathBreakdown.statTotal} stat × ${mathBreakdown.mult} target multiplier.`}>
            ({mathBreakdown.baseDmg} + {mathBreakdown.statTotal}×{mathBreakdown.mult})
          </span>
          <span className="text-parchment-500">=</span>
          <span className="font-bold text-parchment-100">{mathBreakdown.preTier}</span>
          {tierMult !== 1 && (<>
            <span className="text-parchment-500">×</span>
            <span title={`Tier ${tier} multiplier — earned by tag-cohesive intro/subject/target.`}>
              {tierMult.toFixed(1)}{tier === 3 ? ' (T3)' : tier === 2 ? ' (T2)' : ''}
            </span>
          </>)}
          {mathBreakdown.enemyEff !== 1 && (<>
            <span className="text-parchment-500">×</span>
            <span className={mathBreakdown.enemyEff > 1 ? 'text-moss-300' : 'text-ember-300'}
              title={`Enemy is ${mathBreakdown.enemyEff > 1 ? 'susceptible' : 'resistant'} to ${mathBreakdown.castLane} (×${mathBreakdown.enemyEff}).`}>
              {mathBreakdown.enemyEff}× eff
            </span>
          </>)}
          {mathBreakdown.playerMult !== 1 && (<>
            <span className={mathBreakdown.playerMult > 1 ? 'text-iris-300 ml-2' : 'text-ember-300 ml-2'}
              title={mathBreakdown.playerMult > 1
                ? `Enemy is Vulnerable — your Predicted damage is already amplified.`
                : `You're Weak — your Predicted damage is already reduced.`}>
              {mathBreakdown.playerMult > 1 ? '🩸 ENEMY VULN' : '⛧ YOU WEAK'}
            </span>
          </>)}
          {mathBreakdown.secondCastScalar !== 1 && (<>
            <span className="text-parchment-500">×</span>
            <span className="text-ember-300"
              title={`Cast #${castsThisTurn + 1} this turn — each cast after the first scales to 60%.`}>
              0.6× cast#{castsThisTurn + 1}
            </span>
          </>)}
          {mathBreakdown.tagBonus > 0 && (<>
            <span className="text-parchment-500">+</span>
            <span className="text-iris-300 font-bold" title={`Tag-resonance bonus.`}>✦{mathBreakdown.tagBonus}</span>
          </>)}
          {/* loudBonus chip removed 2026-05-31. */}
          {predicted.predatorBonus > 0 && (<>
            <span className="text-parchment-500">+</span>
            <span className="text-ember-300" title="Predator rider.">🩸+{predicted.predatorBonus}</span>
          </>)}
          {predicted.insultBonus > 0 && (<>
            <span className="text-parchment-500">+</span>
            <span className="text-iris-300" title="Insult-hit.">🎯+{predicted.insultBonus}</span>
          </>)}
          {/* v3.4.74 (Alan): surface FFT rider bonuses (Bluster pressure,
              consume spike, RAGE × 2, missing-HP scaling, Pop Off Temp HP,
              flat FFT bonus) so the jump from base to Predicted is legible. */}
          {predicted.damageParts && predicted.damageParts.length > 0 && predicted.damageParts.map((part, pi) => (
            <span key={`rp-${pi}`} className="text-gold-300 font-bold" title={`From FFT rider — ${part}`}>
              {part.startsWith('×') ? part : (part.startsWith('+') ? part : '+ ' + part)}
            </span>
          ))}
          {mathBreakdown.enemyBlock > 0 && (<>
            <span className="text-parchment-500">−</span>
            <span className="text-parchment-100 bg-ink-700 px-1 rounded"
              title={`Enemy Block ${mathBreakdown.enemyBlock} — absorbed before pool damage lands.`}>
              🛡 {mathBreakdown.enemyBlock}
            </span>
          </>)}
          <span className="text-parchment-500">=</span>
          <span className="font-bold text-iris-200 text-sm">{predicted.damage}</span>
        </div>
      )}
      {enemy && (() => {
        const chips = [];
        if (enemy.phaseShifted) chips.push({ key: 'phase', label: '🕸 thinned', tone: 'text-ember-300' });
        if (enemy.annotation) chips.push({ key: 'ann', label: `📝 ${enemy.annotation.cardName || 'annotated'} (${enemy.annotation.turnsRemaining}t)`, tone: 'text-iris-300' });
        if (weaveStacks > 0) chips.push({ key: 'weave', label: `🪡 Weave ${weaveStacks}`, tone: 'text-ember-300', tooltip: `Weave debt: ${weaveStacks} stack${weaveStacks === 1 ? '' : 's'}. End the turn without casting an FFT and this fires as ${weaveStacks} composure damage and clears. Cast any FFT to neutralize it silently.` });
        if (riposteCharge > 0) chips.push({ key: 'rip', label: `🛡⚔ Riposte ${riposteCharge}`, tone: 'text-iris-300' });
        if (braceArmedDraw > 0) chips.push({ key: 'brace', label: `🛡✦ Brace +${braceArmedDraw}`, tone: 'text-moss-300' });
        if (chips.length === 0) return null;
        return (
          <div className="text-[11px] font-mono text-parchment-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-parchment-500 uppercase tracking-widest text-[10px] mr-1">enemy state:</span>
            {chips.map(c => (
              <span key={c.key} className={c.tooltip ? `${c.tone} cursor-help` : c.tone} title={c.tooltip}>{c.label}</span>
            ))}
          </div>
        );
      })()}
    </div>
    </>
  );
}
