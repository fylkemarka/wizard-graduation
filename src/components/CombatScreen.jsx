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

import { motion } from 'framer-motion';
import { TIER_MULTIPLIER, computeSpellTier, computeSpellDamage, composeSpellText } from '../cards/shared.js';
import { CardFullBody } from './CardFullBody.jsx';
import { equipmentEffectSummary, relicEffectSummary } from './effectSummary.js';
import { WIT_ROWS, WIT_SAME_SCHOOL_BONUSES, WIT_ROW_BY_ID, WIT_PARTIAL_ROW_BONUSES, WIT_MIXED_SCHOOL_BONUSES, detectFFT } from '../cards/wit-v2-rows.js';

export function CombatScreen({ enemy, enemyComposure, enemyHp, enemyBlock, enemyIntent, intentTick, peekedNextIntent,
                       enemyDmgMult, playerDmgMult,
                       enemyHitFlash, playerHitFlash, dmgFloaters,
                       hp, maxHp, playerComposure, playerComposureMax,
                       block, poise, energy, energyMax, hand, deck, discard, exiled = [], tray,
                       amplifyPlaysThisCombat,
                       equipment, powers, relics, familiar, familiarName,
                       onPlayCard, onEndTurn, onUnstage, onCast, castPreview, log,
                       castsThisTurn, maxCastsPerTurn,
                       isChutzpah, stakeAmount, setStakeAmount,
                       isJnsq, rollOptIn, setRollOptIn, lastRoll, combatRolls,
                       tunnelVision, rageActive, cornerTokens, intentHidden, loudCount,
                       longThread = 0, isWit = false, wordsBank = 0,
                       crescendoBuildup = 0, crescendoBuildupRows = [],
                       scheduledEffects = [], thornsCharges = null,
                       enemySkipNextAttack = false, enemyAnnotation = null,
                       footnotePromptActive = false, onApplyFootnote, onCancelFootnote,
                       lastCastSnapshot = null, arguingBackThisTurn = 0,
                       holdOnArmed = false, holdOnValue = 0,
                       pendingMissteps = [],
                       combatTurn = 1, openingExtended = false,
                       patienceInstalled = false, patienceStacks = 0,
                       pauseHeld = false, pauseHeldActive = false,
                       wontShutUpArmed = false, staggerActive = false,
                       notListeningCharges = 0, hitMeAgainCharges = 0,
                       weaveStacks = 0, riposteCharge = 0, braceArmedDraw = 0,
                       onOpenCompendium, onOpenDeckView }) {
  const composureMax = enemy?.composureMax ?? 999;
  const hpMax = enemy?.hpMax ?? 999;
  const showComposure = composureMax < 999;
  const showHp = hpMax < 999;
  const eff = enemy?.effectiveness || { chutzpah: 1, wit: 1, jnsq: 1, physical: 1 };
  const eff_label = (v) => v === 0 ? 'immune' : v >= 1.5 ? `×${v} susceptible` : v <= 0.5 ? `×${v} resistant` : `×${v}`;
  const eff_color = (v) => v === 0 ? 'bg-ink-500 text-parchment-300' : v >= 1.5 ? 'bg-moss-700 text-parchment-50' : v <= 0.5 ? 'bg-ember-800 text-parchment-100' : 'bg-ink-600 text-parchment-200';
  // Hit-shake: re-key on every enemyHitFlash change so the animation
  // restarts even on rapid consecutive hits.
  const shakeClass = enemyHitFlash ? 'enemy-hit-shake' : '';

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
      lines.push(`🩸 Applies Vulnerable ${intent.value} — its attacks deal +${25*intent.value}% damage to you next turns.`);
    } else if (intent.kind === 'weak') {
      lines.push(`⛧ Applies Weak ${intent.value} — your spell potency drops by ${25*intent.value}% next turns.`);
    }
    if (intent.riders) {
      const r = intent.riders;
      if (r.weak)       lines.push(`+ rider ⛧ Weak ${r.weak} — your spell potency also drops ${25*r.weak}%.`);
      if (r.vulnerable) lines.push(`+ rider 🩸 Vulnerable ${r.vulnerable} — enemy will deal +${25*r.vulnerable}% more damage too.`);
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div key={`enemy-${enemyHitFlash || 0}`} className={`parchment-card-strong p-4 relative ${shakeClass}`}>
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
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="font-display text-3xl text-ember-300 flex items-center gap-2 flex-wrap">
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
            <div className="text-sm text-parchment-300 italic">
              {enemy?.tier === 'boss' ? 'Boss' : enemy?.tier === 'elite' ? 'Elite' : 'Enemy'}
            </div>
          </div>
          <div className="text-right">
            {showComposure && (
              <div className="text-3xl font-mono text-iris-300" title="Composure — drain to 0 to make them back down.">
                ✨ {enemyComposure} <span className="text-base text-parchment-300">/ {composureMax}</span>
              </div>
            )}
            {showHp && (
              <div className="text-3xl font-mono text-ember-400" title="Physical HP — only physical effects hit this.">
                ❤ {enemyHp} <span className="text-base text-parchment-300">/ {hpMax}</span>
              </div>
            )}
            <div className="text-base">🛡 {enemyBlock}</div>
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
               title={intentHidden
                 ? "You stormed out — you didn't see what they're winding up. Reveals next turn."
                 : (intentTooltip(enemyIntent) || 'No intent yet — it will telegraph what the enemy plans before their turn.')}>
            <div className="text-xs uppercase text-ember-300 tracking-widest">Intent <span className="text-ember-400">ⓘ</span></div>
            <div className="text-lg text-parchment-50">
              {intentHidden ? '🌫 ???' : (enemyIntent?.telegraph || '...')}
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
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.chutzpah ?? 1)}`} title={`Chutzpah ${eff_label(eff.chutzpah ?? 1)}`}>💪 Chutz {eff_label(eff.chutzpah ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.wit ?? 1)}`} title={`Wit ${eff_label(eff.wit ?? 1)}`}>✨ Wit {eff_label(eff.wit ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.jnsq ?? 1)}`} title={`Jnsq ${eff_label(eff.jnsq ?? 1)}`}>🌀 Jnsq {eff_label(eff.jnsq ?? 1)}</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${eff_color(eff.physical ?? 1)}`} title={`Physical ${eff_label(eff.physical ?? 1)}`}>⚔ Phys {eff_label(eff.physical ?? 1)}</span>
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
            {playerDmgMult > 1.0 && (
              <span className="px-3 py-1.5 rounded bg-iris-700 text-parchment-50 text-sm font-bold border border-iris-400"
                title={`Enemy is taking ×${playerDmgMult.toFixed(2)} damage from your spells. From Amplify on you, Vulnerable rider on enemy, predator hits, etc. Drifts toward 1.00 by 0.10/turn.`}>
                🩸 Enemy Vulnerable +{Math.round((playerDmgMult - 1) * 100)}%
              </span>
            )}
            {playerDmgMult < 1.0 && (
              <span className="px-3 py-1.5 rounded bg-ember-700 text-parchment-50 text-sm font-bold border border-ember-500"
                title={`Your spells deal ×${playerDmgMult.toFixed(2)} damage. Weak applied to you by enemy. Drifts toward 1.00 by 0.10/turn.`}>
                ⛧ Your spells {Math.round((playerDmgMult - 1) * 100)}% (Weak on you)
              </span>
            )}
            {enemyDmgMult > 1.0 && (
              <span className="px-3 py-1.5 rounded bg-ember-700 text-parchment-50 text-sm font-bold border border-ember-500"
                title={`You're vulnerable — enemy attacks hit you for ×${enemyDmgMult.toFixed(2)}. Applied by enemy intent. Drifts toward 1.00 by 0.10/turn.`}>
                🩸 You're Vulnerable +{Math.round((enemyDmgMult - 1) * 100)}% (incoming)
              </span>
            )}
            {enemyDmgMult < 1.0 && (
              <span className="px-3 py-1.5 rounded bg-iris-700 text-parchment-50 text-sm font-bold border border-iris-400"
                title={`Enemy attacks deal ×${enemyDmgMult.toFixed(2)} damage. From Sap card, Weak rider on enemy, etc. Drifts toward 1.00 by 0.10/turn.`}>
                ⛧ Enemy Weak {Math.round((enemyDmgMult - 1) * 100)}% (their attacks)
              </span>
            )}
          </div>
        )}
      </div>

      {/* v3.4.28 — YOUR STATE panel (right column). Compact view of HP /
          Comp / Block / Poise / Defense / Energy. End Turn button anchors
          the bottom-right so it's always in the same place. */}
      <div key={`player-vitals-${playerHitFlash || 0}`}
           className={`parchment-card-strong p-4 flex flex-col gap-2 ${playerHitFlash ? 'hit-shake' : ''}`}>
        <div className="text-xs uppercase tracking-widest text-moss-300 mb-1">Your State</div>
        <div className="grid grid-cols-3 gap-2">
          <div title="HP — physical health. 0 = defeat.">
            <div className="text-[10px] uppercase text-parchment-300">HP</div>
            <div className="text-2xl font-mono text-moss-300">{hp}<span className="text-sm text-parchment-300">/{maxHp}</span></div>
          </div>
          <div title="Composure — verbal HP. 0 = lose your nerve.">
            <div className="text-[10px] uppercase text-parchment-300">Composure</div>
            <div className="text-2xl font-mono text-iris-200">{playerComposure}<span className="text-sm text-parchment-300">/{playerComposureMax}</span></div>
          </div>
          <div title="Energy — refills each turn.">
            <div className="text-[10px] uppercase text-parchment-300">Energy</div>
            <div className="text-2xl font-mono text-gold-300">⚡ {energy}/{energyMax}</div>
          </div>
          <div title="Block — absorbs physical (HP) hits. Resets each turn.">
            <div className="text-[10px] uppercase text-parchment-300">Block</div>
            <div className="text-2xl font-mono text-iris-300">🛡 {block}</div>
          </div>
          <div title="Poise — absorbs composure (mental) hits. Resets each turn.">
            <div className="text-[10px] uppercase text-parchment-300">Poise</div>
            <div className="text-2xl font-mono text-moss-300">🪞 {poise}</div>
          </div>
          {(() => {
            const rawDef = equipment.reduce((s, eq) => s + (eq.bonus?.damageReduction || 0), 0)
                          + (familiar?.bonus?.damageReduction || 0);
            const def = Math.min(2, rawDef);
            return rawDef > 0 ? (
              <div title={`Defense reduces every incoming hit by ${def} (min 1 damage taken). Capped at 2.`}>
                <div className="text-[10px] uppercase text-parchment-300">Defense</div>
                <div className="text-2xl font-mono text-moss-200">🛡✦ {def}</div>
              </div>
            ) : null;
          })()}
        </div>
        <div className="flex justify-end pt-2 border-t border-ink-500 mt-auto">
          <button onClick={onEndTurn} className="btn btn-ember text-base px-5 py-2">End Turn</button>
        </div>
      </div>
      </div>

      {/* v2 SENTENCE TRAY — intro + subject + target + 0-2 modifiers.
          Playing a target auto-casts. End the turn without a target and
          the spell fizzles. */}
      <V2SpellTray tray={tray} onUnstage={onUnstage} onCast={onCast}
        castsThisTurn={castsThisTurn} maxCastsPerTurn={maxCastsPerTurn}
        isChutzpah={isChutzpah} stakeAmount={stakeAmount} setStakeAmount={setStakeAmount}
        playerHp={hp}
        isJnsq={isJnsq} rollOptIn={rollOptIn} setRollOptIn={setRollOptIn}
        lastRoll={lastRoll} combatRolls={combatRolls} loudCount={loudCount}
        playerDmgMult={playerDmgMult} enemyDmgMult={enemyDmgMult}
        combatTurn={combatTurn} openingExtended={openingExtended}
        pauseHeldActive={pauseHeldActive} enemy={enemy}
        weaveStacks={weaveStacks} riposteCharge={riposteCharge} braceArmedDraw={braceArmedDraw}
        wordsBank={wordsBank} crescendoBuildup={crescendoBuildup} crescendoBuildupRows={crescendoBuildupRows} />

      {/* FFT Progress panel — wit-only. Shows player progress on the named
          Fully Formed Thought rows (set-collection overlay). A row's three
          cards live anywhere in the player's pool (hand/deck/discard/tray/
          exiled). Hover for the canonical sentence + rider. Only renders
          rows the player has at least 1 card from, to avoid clutter; if no
          set-tagged cards are owned at all, the panel is hidden entirely. */}
      {isWit && WIT_ROWS.length > 0 && (() => {
        const trayCards = [tray?.intro, tray?.subject, tray?.target, ...(tray?.modifiers || [])].filter(Boolean);
        const allCards = [...hand, ...deck, ...discard, ...exiled, ...trayCards];
        const progress = WIT_ROWS.map(row => {
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
            {onOpenCompendium && (
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
            {visible.length === 0 && (
              <span className="text-[11px] text-parchment-400 italic">No rows collected yet — pick up a set-tagged card to start.</span>
            )}
            {visible.map(({ row, owned, has }) => {
              const tier = WIT_SAME_SCHOOL_BONUSES[row.schoolId];
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

      {/* Relic chip row — persistent across the run, shown all combats. */}
      {relics.length > 0 && (
        <div className="parchment-card p-2 flex gap-2 flex-wrap items-center">
          <span className="text-[10px] uppercase tracking-widest text-gold-300 mr-1">📿 Relics</span>
          {relics.map(r => {
            const summary = relicEffectSummary(r);
            return (
              <span key={r.id}
                title={`${r.name}\n\n${r.desc || ''}${summary ? '\n\nEffects:\n' + summary : ''}${r.flavor ? '\n\n"' + r.flavor + '"' : ''}`}
                className="px-2 py-1 bg-gold-700 text-parchment-50 rounded border border-gold-500 text-xs cursor-help">
                {r.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Active Powers row — visible while at least one power is on the
          field OR a pending "Sorry — what?" absorb is armed. Hover shows
          the trigger + flavor. */}
      {(powers.length > 0 || notListeningCharges > 0 || staggerActive) && (
        <div className="parchment-card p-2 flex gap-2 flex-wrap items-center">
          <span className="text-[10px] uppercase tracking-widest text-iris-300 mr-1">📿 Powers in effect</span>
          {powers.map((p, i) => {
            const isHitMeAgain = p.installPower?.id === 'hit-me-again' || p.id === 'cv2-p-hit-me-again';
            const isPatience = p.installPower?.id === 'patience' || p.id === 'wv2-p-patience';
            const isDrunken  = p.installPower?.id === 'drunken-confidence' || p.id === 'jv2-p-hold-my-drink';
            const isBabbling = p.installPower?.id === 'babbling' || p.id === 'jv2-p-wait-and-another-thing';
            return (
              <span key={p.uid || i}
                title={isDrunken
                  ? 'Drunken Confidence — all your spell casts deal +50% damage, BUT every enemy attack adds +2 raw damage before block. Play "sober second thought," to remove.'
                  : isBabbling
                  ? 'Babbling — vestigial after v2.87 removed the cast cap. Originally lifted the per-turn cap from 1 → 2 with a 0.6× scalar on the 2nd cast; that scalar still fires but the cap no longer exists, so you can cast as many times as your energy allows even without this Power.'
                  : `${p.desc}${p.flavor ? '\n\n' + p.flavor : ''}`}
                className="px-2 py-1 bg-iris-800 text-parchment-50 rounded border border-iris-600 text-xs cursor-help">
                {p.name}
                {isHitMeAgain && (
                  <span className="ml-1 px-1 rounded bg-ember-700 text-parchment-50">
                    ⚡{hitMeAgainCharges}
                  </span>
                )}
                {isPatience && (
                  <span className="ml-1 px-1 rounded bg-iris-700 text-parchment-50">
                    🌿{patienceStacks}
                  </span>
                )}
                {isDrunken && (
                  <span className="ml-1 px-1 rounded bg-ember-700 text-parchment-50">
                    🍺×1.5 / +2
                  </span>
                )}
                {isBabbling && (
                  <span className="ml-1 px-1 rounded bg-iris-700 text-parchment-50">
                    🗯 2× / 60%
                    {castsThisTurn === 1 && <span className="ml-1 text-[10px]">(2nd cast available)</span>}
                  </span>
                )}
              </span>
            );
          })}
          {notListeningCharges > 0 && (
            <span title="Sorry — what? — pending: the next enemy Weak/Vulnerable attempt is ignored."
              className="px-2 py-1 bg-iris-800 text-parchment-50 rounded border border-iris-600 text-xs cursor-help">
              Sorry — what?
              <span className="ml-1 px-1 rounded bg-iris-700 text-parchment-50">
                🙉{notListeningCharges}
              </span>
            </span>
          )}
          {staggerActive && (
            <span title="Drunken Stagger — this turn, every enemy attack swing has a 50% chance to fully miss."
              className="px-2 py-1 bg-iris-800 text-parchment-50 rounded border border-iris-600 text-xs cursor-help">
              Drunken Stagger
              <span className="ml-1 px-1 rounded bg-ember-700 text-parchment-50">
                🌀 50% miss
              </span>
            </span>
          )}
        </div>
      )}

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
          return (
            <motion.button key={card.uid}
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={() => isFootnoteEligible ? onApplyFootnote(card.uid) : onPlayCard(i)}
              disabled={!(playable || isFootnoteEligible)}
              className={`w-[180px] h-72 shrink-0 rounded-lg border-2 p-2.5 text-left flex flex-col gap-1.5 shadow-lg transition-all ${
                isFootnoteEligible
                  ? `bg-iris-900/60 text-iris-100 border-iris-400 ring-2 ring-iris-400 hover:scale-105 hover:shadow-2xl cursor-pointer`
                : playable
                  ? `bg-parchment-50 text-ink-800 ${tint} hover:scale-105 hover:shadow-2xl cursor-pointer`
                  : 'bg-ink-600 text-parchment-400 border-ink-500 opacity-50 cursor-not-allowed'
              }`}>
              <CardFullBody card={card} costOverride={effCost} costPillClass={costPillClass} costTooltip={costTooltip} />
            </motion.button>
          );
        })}
      </div>

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

      {/* v3.4.28 — Resources / Effects strip. Vitals (HP/Comp/Block/Poise/
          Energy/Defense) now live in the top-right Your State panel; this
          strip holds wit-specific resources (Long Thread, Word Bank,
          Crescendo Buildup) + over-time effect chips (Patience, Hold,
          Misstep, Opening, etc.) + player status pills. End Turn button
          now lives in the Your State panel. */}
      <div key={`player-hud-${playerHitFlash || 0}`}
           className={`parchment-card p-3 flex justify-between items-center flex-wrap gap-2 ${playerHitFlash ? 'hit-shake' : ''}`}>
        <div className="flex gap-4 items-center flex-wrap">
          {/* v3.4.x: surface previously-invisible wit identity stats. Alan:
              "I still don't know what Thread and the Word Bank are/do." */}
          {isWit && longThread > 0 && (
            <div title={`Long Thread — wit's signature defender mechanic. Ticks +1 each turn you cast a wit spell AND don't take unblocked damage. Some wit targets deal +N damage per stack. Decays by 1 on each unblocked hit.`}>
              <div className="text-xs uppercase text-iris-300">Long Thread <span className="text-parchment-500">ⓘ</span></div>
              <div className="text-2xl font-mono text-iris-300">🧵 {longThread}</div>
            </div>
          )}
          {/* Word Bank: Crescendo's currency. v3.4.23 — Crescendo-school
              cards only. Cap 10. */}
          {isWit && (
            <div title={`Words Bank — Crescendo's currency. Only Crescendo-school cards add to it (+1 each). Cap 10. Spent at the Crescendo CLIMAX cast for massive damage.`}>
              <div className="text-xs uppercase text-gold-300">Word Bank <span className="text-parchment-500">ⓘ</span></div>
              <div className="text-2xl font-mono text-gold-300">📚 {wordsBank || 0}<span className="text-sm text-parchment-500">/10</span></div>
            </div>
          )}
          {/* v3.4.23 — Crescendo Buildup meter. 3 stages: opener (0 dmg),
              builder (½ dmg), climax (full dmg ×3, bank consumed). Shown
              once buildup > 0 OR when player has crescendo cards in hand. */}
          {/* v3.4.27 (Alan): also show Buildup whenever a crescendo card
              is in hand, so the player can plan around it even before
              the first build cast. */}
          {isWit && (crescendoBuildup > 0 || (hand || []).some(c => c?.schoolId === 'crescendo')) && (
            <div title={`Crescendo Buildup — each full-FFT Crescendo cast advances this. Stage 3 unleashes the climax (× buildup damage scaling, bank consumed).${crescendoBuildupRows.length === 2 && crescendoBuildupRows[0] === crescendoBuildupRows[1] ? ' Same-row × 1.5 lockstep is active.' : ''}`}>
              <div className="text-xs uppercase text-gold-300">Buildup</div>
              <div className="text-2xl font-mono text-gold-300">
                {'●'.repeat(crescendoBuildup)}{'○'.repeat(3 - crescendoBuildup)}
                {crescendoBuildupRows.length >= 2 && crescendoBuildupRows[0] === crescendoBuildupRows[1] && (
                  <span className="text-xs text-gold-200 ml-1">🎵</span>
                )}
              </div>
            </div>
          )}
          {/* v2.24: chutzpah TUNNEL VISION pip + RAGE badge. Shown when the
              meter has anything in it OR rage is active. Color: ember (chutzpah
              palette). */}
          {(isChutzpah || tunnelVision > 0 || rageActive) && (
            <div title={`Tunnel Vision — chutzpah rage meter. At 5+ entering a turn, you enter RAGE: +50% potency for that turn, then the meter resets.`}>
              <div className="text-xs uppercase text-ember-300">Tunnel</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-mono text-ember-300">🔥 {tunnelVision}</span>
                {rageActive && (
                  <span className="px-2 py-1 rounded text-xs font-bold bg-ember-700 text-parchment-50 border border-ember-500"
                        title="RAGE — chutzpah unleashed (+50% damage this turn). Resets at end of turn.">
                    RAGE
                  </span>
                )}
              </div>
            </div>
          )}
          {/* v3.4.27 (Alan): Active Defenses panel. Surfaces all
              currently-armed over-time defensive effects so the player
              can SEE what's absorbing their incoming damage. Aggregates
              scheduledEffects by kind, plus thorns aura, plus annotation
              reduction, plus the skip-next-attack flag. */}
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
            const thornsAuraAmount = thornsAuraTurns > 0 ? (thornsCharges?.amount || 0) : 0;
            const thornsSchedule = Array.isArray(thornsCharges?.schedule) ? thornsCharges.schedule : null;
            const hasAny = Object.keys(buckets).length > 0 || annRed > 0 || enemySkipNextAttack
                          || thornsAuraTurns > 0 || (thornsCharges?.count || 0) > 0;
            if (!hasAny) return null;
            const ROW = ({ icon, label, value, tone = 'text-parchment-100' }) => (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="w-4">{icon}</span>
                <span className={tone + ' flex-1 truncate'}>{label}</span>
                <span className="font-mono">{value}</span>
              </div>
            );
            return (
              <div className="border border-iris-600 bg-ink-800/80 rounded px-2 py-1.5 flex flex-col gap-0.5 min-w-[180px]"
                   title="Over-time effects currently armed. Compare against the enemy's intent value to predict the actual hit you'll take.">
                <div className="text-[10px] uppercase text-iris-300 mb-0.5 flex items-center gap-1">
                  🛡 Active Defenses
                </div>
                {enemySkipNextAttack && (
                  <ROW icon="🤐" label="Next attack: SKIPPED" value="✓" tone="text-gold-300" />
                )}
                {buckets.block && <ROW icon="🛡" label="+Block / turn" value={`${buckets.block.amount} × ${buckets.block.turns}t`} />}
                {buckets.poise && <ROW icon="🪞" label="+Poise / turn" value={`${buckets.poise.amount} × ${buckets.poise.turns}t`} />}
                {buckets.hpRegen && <ROW icon="💚" label="+HP / turn" value={`${buckets.hpRegen.amount} × ${buckets.hpRegen.turns}t`} />}
                {longThread > 0 && (
                  <ROW icon="🧵" label="LT defensive" value={`−${Math.min(2, longThread)} / swing`} tone="text-iris-200" />
                )}
                {annRed > 0 && (
                  <ROW icon="📝" label={`Annotation atk-red`} value={`−${annRed}`} tone="text-iris-200" />
                )}
                {thornsAuraTurns > 0 && !thornsSchedule && (
                  <ROW icon="🌹" label="Reflect aura" value={`${thornsAuraAmount} × ${thornsAuraTurns}t`} />
                )}
                {thornsSchedule && thornsSchedule.length > 0 && (
                  <ROW icon="🌹" label="Reflect schedule" value={thornsSchedule.join(',')} />
                )}
                {(thornsCharges?.count || 0) > 0 && (
                  <ROW icon="🌹" label="Reflect charges" value={`${thornsCharges.amount} × ${thornsCharges.count}`} />
                )}
                {buckets.stripBlock && (
                  <ROW icon="🛇" label="Strip enemy block / turn" value={`${buckets.stripBlock.amount} × ${buckets.stripBlock.turns}t`} />
                )}
                {buckets.weak && (
                  <ROW icon="💢" label="Weak on enemy / turn" value={`${buckets.weak.amount} × ${buckets.weak.turns}t`} />
                )}
                {buckets.vuln && (
                  <ROW icon="🩸" label="Vuln on enemy / turn" value={`${buckets.vuln.amount} × ${buckets.vuln.turns}t`} />
                )}
              </div>
            );
          })()}
          {/* v2.25: chutzpah DOUBLING DOWN pip. Each token bills 2 unblocked
              HP at end of turn IF the enemy is still alive. Resets every turn.
              Shown only when non-zero. */}
          {cornerTokens > 0 && (
            <div title={`Backed Into A Corner — ${cornerTokens} token${cornerTokens === 1 ? '' : 's'}. End of turn: if enemy isn't dead, you take ${cornerTokens * 2} unblocked HP. Resets each turn.`}>
              <div className="text-xs uppercase text-ember-300">Corner</div>
              <div className="text-2xl font-mono text-ember-300">🏚 {cornerTokens}</div>
            </div>
          )}
          {/* v2.29: chutzpah SAYING IT LOUDER pip. Each demanding-tagged
              chutzpah word card staged this turn adds +1; a target with
              loudScaling reads it for +3 dmg/loud. Resets each turn. */}
          {loudCount > 0 && (
            <div title={`Saying it Louder — ${loudCount} demanding word${loudCount === 1 ? '' : 's'} staged this turn. A target with "Said It Louder" gets +${loudCount * 3} flat dmg on cast. Resets each turn.`}>
              <div className="text-xs uppercase text-ember-300">Loud</div>
              <div className="text-2xl font-mono text-ember-300">📢 {loudCount}</div>
            </div>
          )}
          {/* v2.48: jnsq AWKWARD PAUSE pip. pauseHeld = armed this turn
              (graduates at end of turn). pauseHeldActive = doubling banked
              for THIS turn's cast. Both render the same 🤫 badge with
              different tooltips so the player can read where the pause is
              in its lifecycle. Cleared the moment a cast fires. */}
          {(pauseHeld || pauseHeldActive) && (
            <div title={pauseHeldActive
              ? `Awkward Pause — next cast doubles every staged card's jnsq stat contribution. Single-use; cast now to spend.`
              : `Paused — at end of turn the doubling banks. Hold the silence.`}>
              <div className="text-xs uppercase text-amber-300">{pauseHeldActive ? 'Pause: ×2' : 'Paused'}</div>
              <div className="text-2xl font-mono text-amber-200">🤫</div>
            </div>
          )}
          {/* v2.46: jnsq WON'T SHUT UP pip. Armed when a target with
              `mustPlayAnotherJnsq` resolves a cast. Player must play another
              jnsq-lane card this turn or eat 3 unblocked HP at end of turn.
              Cleared by any jnsq play after the rider fires. */}
          {wontShutUpArmed && (
            <div title={`Won't Shut Up — you committed mid-statement. Play any jnsq card before end of turn or take 3 HP.`}>
              <div className="text-xs uppercase text-amber-300">Going on</div>
              <div className="text-2xl font-mono text-amber-200">🗣 !</div>
            </div>
          )}
          {/* v2.34: wit LONG THREAD pip. Ticks +1 every turn the player
              casts a wit Effect AND takes zero unblocked HP damage. Resets
              to 0 when an unblocked hit lands. Wit targets with
              threadScaling read this for +N × LT flat dmg. Color: iris
              (wit palette). Shown whenever wit-committed OR meter > 0. */}
          {(isWit || longThread > 0) && (
            <div title={`Long Thread — wit's consecutive-turn scaling. Ticks +1 at end of turn IF you cast a wit Effect AND took no unblocked HP damage. Take an unblocked hit, lose the thread. Wit threadScaling targets get +N × Long Thread on cast.`}>
              <div className="text-xs uppercase text-iris-300">Thread</div>
              <div className="text-2xl font-mono text-iris-200">🧵 {longThread}</div>
            </div>
          )}
          {/* v2.39: OPENING STATEMENT — show "OPENING" pip while combat is
              on turn 1, or "REVISIT" pip while the to-revisit-my-opening-
              point bridge is armed. The pip tells the wit player whether
              their openingBonus cards are currently active. */}
          {isWit && (combatTurn === 1 || openingExtended) && (
            <div title={openingExtended
              ? `Opening extended — your next wit Effect cast still benefits from openingBonus damage, even though it's now turn ${combatTurn}.`
              : `Turn 1 — wit Effect cards with openingBonus deal their bonus damage. Cast now or hold "to revisit my opening point," to keep the bonus alive into a later turn.`}>
              <div className="text-xs uppercase text-iris-300">{openingExtended ? 'Revisit' : 'Opening'}</div>
              <div className="text-2xl font-mono text-iris-200">🎩{openingExtended ? '↩' : ''}</div>
            </div>
          )}
          {/* v2.40: PATIENCE pip. Shows the current banked stacks while
              the power is installed. Each stack = +2 flat damage on the
              next cast. Clears when the cast lands. */}
          {patienceInstalled && (
            <div title={`Patience — banked stacks. Each end-of-turn where you DID NOT cast adds +1 to the bank. The next cast adds Patience × 2 flat damage and clears the bank.`}>
              <div className="text-xs uppercase text-iris-300">Patience</div>
              <div className="text-2xl font-mono text-iris-200">🌿 {patienceStacks}</div>
            </div>
          )}
          {/* v2.37: HOLD ON armed indicator. Shows the snapshotted reduction
              that the next enemy swing will eat. Persists across turns
              until consumed (or auto-cleared at start of next turn — but
              endTurn fires the clear AFTER the enemy intent, so the
              indicator only disappears once the swing happened). */}
          {holdOnArmed && (
            <div title={`Hold On — armed. The next enemy swing's damage is reduced by ${holdOnValue} (snapshotted from your Long Thread at play time). Clears when the next attack resolves OR at the start of your next turn.`}>
              <div className="text-xs uppercase text-iris-300">Hold</div>
              <div className="text-2xl font-mono text-iris-200">🛑 −{holdOnValue}</div>
            </div>
          )}
          {/* v2.38: SAYING SOMETHING WRONG pip. Shows pending Misstep tokens
              counting down (the off-stage clock) AND the count of Misstep
              tokens currently in hand (the actual decision). Together: how
              many shoes are about to drop, and how many are already on the
              floor. Iris palette since this is a wit mechanic. */}
          {(pendingMissteps.length > 0 || (hand || []).some(c => c?.id === 'wv2-tok-misstep')) && (() => {
            const inHand = (hand || []).filter(c => c?.id === 'wv2-tok-misstep').length;
            const pendingTxt = pendingMissteps.length > 0
              ? pendingMissteps.map(p => `T-${p.turnsRemaining}`).join(' · ')
              : '—';
            return (
              <div title={`Missteps in flight. ${inHand > 0 ? `${inHand} in hand: discard for 1 Energy, or end-of-turn = -3 HP each. ` : ''}Pending: ${pendingTxt}.`}>
                <div className="text-xs uppercase text-iris-300">Misstep</div>
                <div className="text-2xl font-mono text-iris-200">
                  📜 {inHand > 0 ? <span className="text-ember-300">{inHand}!</span> : pendingMissteps.length}
                </div>
              </div>
            );
          })()}
          <div title={`Deck pile (${deck.length}) → Discard pile (${discard.length}). When the deck empties, the discard reshuffles back in.`}>
            <div className="text-xs uppercase text-parchment-300">Deck</div>
            <div className="text-base font-mono text-parchment-200">{deck.length} ▸ {discard.length}</div>
          </div>
          {/* PLAYER STATUS — Weak / Vulnerable / Strengthened / etc. Only
              shows pills for active (non-1.0) modifiers. Same numbers as
              the enemy-side display, but labeled from the player's POV so
              "what am I afflicted with" is unambiguous. */}
          {(playerDmgMult !== 1.0 || enemyDmgMult !== 1.0) && (
            <div className="flex flex-col gap-1">
              <div className="text-xs uppercase text-parchment-300">Status</div>
              <div className="flex gap-1 flex-wrap">
                {playerDmgMult < 1.0 && (
                  <span className="px-2 py-1 rounded text-xs bg-ember-800 text-parchment-50 border border-ember-600"
                        title={`Weak — your spell potency is at ×${playerDmgMult.toFixed(2)} (${Math.round((playerDmgMult-1)*100)}%). Drifts back toward 1.00 by 0.25/turn.`}>
                    ⛧ Weak ×{playerDmgMult.toFixed(2)}
                  </span>
                )}
                {playerDmgMult > 1.0 && (
                  <span className="px-2 py-1 rounded text-xs bg-moss-800 text-parchment-50 border border-moss-600"
                        title={`Strengthened — your spell potency is at ×${playerDmgMult.toFixed(2)} (+${Math.round((playerDmgMult-1)*100)}%). Drifts back toward 1.00 by 0.25/turn.`}>
                    💫 Strong ×{playerDmgMult.toFixed(2)}
                  </span>
                )}
                {enemyDmgMult > 1.0 && (
                  <span className="px-2 py-1 rounded text-xs bg-ember-800 text-parchment-50 border border-ember-600"
                        title={`Vulnerable — incoming damage is at ×${enemyDmgMult.toFixed(2)} (+${Math.round((enemyDmgMult-1)*100)}%). Drifts back toward 1.00 by 0.25/turn.`}>
                    🩸 Vuln ×{enemyDmgMult.toFixed(2)}
                  </span>
                )}
                {enemyDmgMult < 1.0 && (
                  <span className="px-2 py-1 rounded text-xs bg-moss-800 text-parchment-50 border border-moss-600"
                        title={`Sapped — enemy attack damage is at ×${enemyDmgMult.toFixed(2)} (${Math.round((enemyDmgMult-1)*100)}%). Drifts back toward 1.00 by 0.25/turn.`}>
                    🛡 Sapped ×{enemyDmgMult.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}
          {familiar && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-ink-600 border border-ink-400 text-sm"
                  title={familiar.desc}>
              <span className="text-lg leading-none">{familiar.emoji}</span>
              <span className="text-gold-300">{familiarName || familiar.species}</span>
            </span>
          )}
          {equipment.length > 0 && (
            <div className="text-xs flex gap-2 flex-wrap ml-2">
              {equipment.map(eq => (
                <span key={eq.id} className="text-gold-300 cursor-help"
                  title={`${eq.name}\n\n${eq.desc || ''}${equipmentEffectSummary(eq) ? '\n\nEffects:\n' + equipmentEffectSummary(eq) : ''}`}>⚜ {eq.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* v3.3: action log hidden by default (Alan: "doesn't need to be
          visible on the combat screen"). The log array is still
          populated for telemetry / replay / future debug overlay. */}
    </div>
  );
}

export function V2SpellTray({ tray, onUnstage, onCast, castsThisTurn = 0, maxCastsPerTurn = 1,
                       isChutzpah = false, stakeAmount = 0, setStakeAmount = () => {},
                       playerHp = 70,
                       isJnsq = false, rollOptIn = false, setRollOptIn = () => {},
                       lastRoll = null, combatRolls = [], loudCount = 0,
                       playerDmgMult = 1.0, enemyDmgMult = 1.0,
                       combatTurn = 1, openingExtended = false,
                       pauseHeldActive = false, enemy = null,
                       weaveStacks = 0, riposteCharge = 0, braceArmedDraw = 0,
                       wordsBank = 0, crescendoBuildup = 0, crescendoBuildupRows = [] }) {
  const intro = tray.intro;
  const subject = tray.subject;
  const target = tray.target || tray.effectCard;
  const modifiers = tray.modifiers || [];
  const anyStaged = intro || subject || target || modifiers.length > 0;

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
    const { damage, riders, stakeBonus, loudBonus, predatorBonus, openingBonus, insultBonus, insultMatches, insultMatchedTags } = computeSpellDamage(intro, subject, target, modifiers, { stakeAmount, loudCount, playerDmgMult, enemyDmgMult, combatTurn, openingExtended, insultVulnerabilities: enemy?.insultVulnerabilities || [], pauseDoubled: pauseHeldActive });
    predicted = { damage, riders, stakeBonus: stakeBonus || 0, loudBonus: loudBonus || 0, predatorBonus: predatorBonus || 0, openingBonus: openingBonus || 0, insultBonus: insultBonus || 0, insultMatches: insultMatches || 0, insultMatchedTags: insultMatchedTags || [] };
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
  // v2.11: requirements + caps for ALL IN. v2.13 nerfed cap from
  // /3 → /4 (keeps "I bleed for damage" without uncapped spirals).
  const stakeMax = Math.max(0, Math.floor(playerHp / 4));
  const stakeRequired = target?.effect?.requiresStake || 0;
  const stakeBlocked = ready && stakeRequired > 0 && stakeAmount < stakeRequired;
  const stakeNudge = (delta) => setStakeAmount(Math.max(0, Math.min(stakeMax, stakeAmount + delta)));
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
    return chips;
  }

  const slotPill = (card, slotName, color) => {
    if (!card) {
      return (
        <div className={`px-3 py-2 rounded border border-dashed ${color.empty} text-xs italic text-center opacity-60 min-w-[110px]`}>
          {slotName}
        </div>
      );
    }
    const contrib = cardContribution(card, slotName);
    // v3.3: surface FFT row affiliation on the staged pill so the
    // player can SEE which school/row each card belongs to mid-cast.
    const row = card.setId ? WIT_ROW_BY_ID[card.setId] : null;
    const tierName = card.schoolId ? (WIT_SAME_SCHOOL_BONUSES[card.schoolId]?.name || card.schoolId) : null;
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
    <div className={`parchment-card p-3 border-l-4 ${anyStaged ? 'border-l-iris-400' : 'border-l-ink-500'}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs uppercase tracking-widest text-iris-300 font-bold">📜 Spell Tray</div>
        {tier > 0 && (
          <div className={`text-sm font-bold font-mono ${tier === 3 ? 'text-ember-300' : tier === 2 ? 'text-iris-200' : 'text-parchment-300'}`}>
            {tierLabel} ×{tierMult.toFixed(1)}
          </div>
        )}
      </div>

      {/* Sentence preview */}
      <div className="text-sm font-quill italic text-parchment-100 min-h-[1.5rem] mb-2 leading-relaxed">
        {ready
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

      {/* Tag chip row */}
      {Object.keys(tagCounts).length > 0 && (
        <div className="mb-2 flex gap-1 flex-wrap text-xs font-mono">
          <span className="text-iris-300">✦</span>
          {Object.entries(tagCounts).map(([tag, n]) => (
            <span key={tag} className="px-2 py-0.5 rounded bg-iris-800 text-parchment-100">
              {tag}{n > 1 ? ` ×${n}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Slot row */}
      <div className="flex flex-wrap items-stretch gap-2">
        {slotPill(intro, 'intro', { empty: 'border-iris-600 text-iris-400', filled: 'bg-iris-700 hover:bg-iris-600 border border-iris-400' })}
        {slotPill(subject, 'subject', { empty: 'border-iris-600 text-iris-400', filled: 'bg-iris-700 hover:bg-iris-600 border border-iris-400' })}
        {slotPill(target, 'target', { empty: 'border-ember-600 text-ember-500', filled: 'bg-ember-700 hover:bg-ember-600 border border-ember-400' })}
        {modifiers.map(m => slotPill(m, 'modifier', { empty: '', filled: 'bg-gold-700 hover:bg-gold-600 border border-gold-400' }))}
        {modifiers.length < 2 && slotPill(null, modifiers.length === 0 ? 'modifier (optional)' : 'modifier 2 (optional)', { empty: 'border-gold-600 text-gold-500', filled: '' })}
        <div className="flex-1" />
        {ready && predicted && (
          <div className="text-right flex flex-col items-end gap-1">
            <div>
              <div className="text-[10px] uppercase text-parchment-300">Predicted</div>
              <div className="text-2xl font-bold font-mono text-iris-200"
                   title={`Tier ${tier} × ${tierMult.toFixed(1)} multiplier${predicted.stakeBonus ? `, +${predicted.stakeBonus} from stake` : ''}${predicted.predatorBonus ? `, +${predicted.predatorBonus} predator (enemy debuffed)` : ''}`}>
                {predicted.damage} <span className="text-sm text-parchment-300">{mathBreakdown?.dmgType === 'block' ? '🛡 block' : mathBreakdown?.dmgType === 'physical' ? 'phys' : 'comp'}</span>
                {predicted.stakeBonus > 0 && (
                  <span className="text-xs text-ember-300 ml-1">(+{predicted.stakeBonus})</span>
                )}
                {predicted.predatorBonus > 0 && (
                  <span className="text-xs text-ember-300 ml-1" title="Predator rider — enemy is Vulnerable or Weak.">🩸+{predicted.predatorBonus}</span>
                )}
                {/* v2.42: insult-hit chip — tag overlap with enemy.insultVulnerabilities */}
                {predicted.insultBonus > 0 && (
                  <span className="text-xs text-iris-300 ml-1"
                    title={`Insult-hit: ${(predicted.insultMatchedTags || []).slice(0, 3).join(', ')} (${Math.min(predicted.insultMatches || 0, 3)} match${(predicted.insultMatches || 0) === 1 ? '' : 'es'} × pierce).`}>
                    🎯+{predicted.insultBonus}
                  </span>
                )}
              </div>
            </div>
            {/* v3.4.21 — FFT preview chips. Surface incoming DoT /
                reflect / bank effects so the player can see what the
                cast will fire alongside the raw damage. */}
            {[fftPreview, mixedPreview].filter(Boolean).map((p, pi) => {
              const chips = summarizeRider(p.rider);
              if (chips.length === 0) return null;
              const tone = p.kind === 'full' ? 'border-iris-500 bg-iris-900 text-iris-200'
                         : p.kind === 'partial' ? 'border-gold-500 bg-ink-700 text-gold-200'
                         : p.kind === 'mixed' ? 'border-moss-500 bg-ink-700 text-moss-200'
                         : 'border-ink-500 bg-ink-700 text-parchment-300';
              const icon = p.kind === 'full' ? '✨' : p.kind === 'partial' ? '📐' : p.kind === 'mixed' ? '🎨' : '🎵';
              return (
                <div key={pi} className={`mt-1 px-2 py-1 rounded border ${tone} max-w-xs`}>
                  <div className="text-[10px] uppercase tracking-wide opacity-90">{icon} {p.label}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5 justify-end">
                    {chips.map((c, i) => (
                      <span key={i} className="text-[10px] bg-ink-800 border border-ink-600 rounded px-1.5 py-0.5">{c}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* v3.4.23 — Crescendo Buildup preview. Shows the stage this
                cast would advance to, the expected damage at that stage,
                and whether the same-row × 1.5 lockstep would activate. */}
            {crescendoPreview && (() => {
              const { stage, dmg, sameRow, consumeBank, wordsBank: wb, rowName } = crescendoPreview;
              const stageLabel = stage === 1 ? 'OPENING NOTE (0 dmg)'
                               : stage === 2 ? `BUILDING (~${dmg} half-dmg)`
                               : sameRow ? `🎵 SAME-ROW CLIMAX (~${dmg} dmg)` : `THE CLIMAX (~${dmg} dmg)`;
              return (
                <div className="mt-1 px-2 py-1 rounded border border-gold-400 bg-ink-700 text-gold-200 max-w-xs">
                  <div className="text-[10px] uppercase tracking-wide opacity-90">
                    📚 Crescendo Buildup → {stage}/3
                  </div>
                  <div className="text-[10px] mt-0.5 font-bold">{stageLabel}</div>
                  {stage === 3 && (
                    <div className="text-[10px] mt-0.5 opacity-80">
                      Bank {wb} × {consumeBank} × 2 = +{wb * consumeBank * 2} bonus · BANK CONSUMED
                    </div>
                  )}
                  {stage < 3 && wb > 0 && (
                    <div className="text-[10px] mt-0.5 opacity-80">
                      Bank {wb} (held until climax)
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        {/* v2.99.4: CAST button moved inline with the slot row so it
            shares horizontal space with the slots + Predicted, instead
            of taking a full line below them. Tightens the combat
            screen's vertical footprint considerably. */}
        <button onClick={onCast}
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
        </button>
        {/* v3.0 cycle 5: ALL IN / CHAOS DICE moved up to share the slot
            row with CAST. They're lane-exclusive (only one shows at a
            time) so giving them their own line was wasted vertical
            space. The math row + enemy-state row below stay basis-full
            (full damage chain + status chips need their own line). */}
        {isChutzpah && (() => {
          const stakeMultsList = [tray.intro, tray.subject, tray.target, ...tray.modifiers]
            .map(c => c?.stakeMultiplier || c?.effect?.stakeMultiplier || 0)
            .filter(m => m > 0);
          const stakeMult = stakeMultsList.length > 0 ? Math.max(...stakeMultsList) : 1.5;
          const stakeAutoDouble = tray.modifiers.some(m => m?.modifierEffect?.stakeAutoDouble);
          const evBonus = stakeAmount > 0
            ? Math.ceil(stakeAmount * stakeMult) * (stakeAutoDouble ? 2 : 1)
            : 0;
          const remainingPool = ready && enemy
            ? (mathBreakdown?.dmgType === 'physical' ? enemy.currentHp : enemy.currentComp)
            : 0;
          const wouldKill = ready && predicted && remainingPool > 0
            && predicted.damage >= remainingPool;
          const stakeKills = ready && predicted && remainingPool > 0
            && stakeAmount === 0
            && (predicted.damage + Math.ceil(1 * stakeMult)) >= remainingPool;
          return (
            <div className={`flex items-center gap-1 ml-2 px-2 py-1 rounded border-2 ${
              wouldKill ? 'border-moss-500 bg-moss-900 bg-opacity-30' :
              stakeKills ? 'border-gold-500 bg-gold-900 bg-opacity-30 animate-pulse' :
              'border-ember-500 bg-ember-900 bg-opacity-30'
            }`}
                 title={`Spend HP for bonus damage. ×${stakeMult.toFixed(1)} damage per HP${stakeAutoDouble ? ' (×2 from "not even half kidding")' : ''}. Capped at ¼ of current HP. ${ready ? '' : '(stage a target to see EV)'}`}>
              <span className="text-[10px] uppercase tracking-wider text-ember-300 font-bold">🩸 ALL IN</span>
              <button onClick={() => stakeNudge(-1)} disabled={stakeAmount <= 0}
                className={`w-6 h-6 rounded text-xs font-bold ${stakeAmount > 0 ? 'bg-ember-700 text-parchment-50 hover:bg-ember-600' : 'bg-ink-700 text-parchment-500 cursor-not-allowed'}`}>−</button>
              <span className={`font-mono text-sm font-bold ${stakeAmount > 0 ? 'text-ember-200' : 'text-parchment-400'} w-12 text-center`}>
                {stakeAmount > 0 ? `-${stakeAmount} HP` : '—'}
              </span>
              <button onClick={() => stakeNudge(1)} disabled={stakeAmount >= stakeMax}
                className={`w-6 h-6 rounded text-xs font-bold ${stakeAmount < stakeMax ? 'bg-ember-700 text-parchment-50 hover:bg-ember-600' : 'bg-ink-700 text-parchment-500 cursor-not-allowed'}`}>+</button>
              <button onClick={() => stakeNudge(2)} disabled={stakeAmount + 3 > stakeMax}
                className={`px-1.5 h-6 rounded text-[10px] font-bold ${stakeAmount + 3 <= stakeMax ? 'bg-ember-700 text-parchment-50 hover:bg-ember-600' : 'bg-ink-700 text-parchment-500 cursor-not-allowed'}`}>+3</button>
              <button onClick={() => setStakeAmount(stakeMax)} disabled={stakeAmount === stakeMax}
                className={`px-1.5 h-6 rounded text-[10px] font-bold ${stakeAmount < stakeMax ? 'bg-ember-700 text-parchment-50 hover:bg-ember-600' : 'bg-ink-700 text-parchment-500 cursor-not-allowed'}`}>MAX</button>
              {evBonus > 0 && (
                <span className="ml-1 text-[11px] font-mono text-ember-200 font-bold">
                  → <span className="text-ember-100">+{evBonus} dmg</span>
                  <span className="text-parchment-400"> (×{stakeMult.toFixed(1)}{stakeAutoDouble ? ' · auto-2×' : ''})</span>
                </span>
              )}
              {stakeKills && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gold-600 text-ink-900">
                  ⚔ stake to kill
                </span>
              )}
              {stakeRequired > 0 && (
                <span className={`ml-1 text-[10px] font-bold uppercase ${stakeBlocked ? 'text-ember-300' : 'text-moss-300'}`}>
                  req {stakeRequired}+
                </span>
              )}
            </div>
          );
        })()}
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
        {/* v2.79: math breakdown — full-width row INSIDE the same flex
            container (basis-full forces a new line). Surfaces every step
            of the damage formula so the player can SEE where the number
            comes from. Tag resonance, predator, opening, insult, stake
            bonuses get explicit callouts. */}
        {mathBreakdown && (
          <div className="basis-full mt-2 pt-2 border-t border-ink-500 text-[11px] font-mono text-parchment-300 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-iris-300 font-bold text-[10px] uppercase tracking-widest mr-1">Math:</span>
            {/* v2.94: explicit parens + running subtotal — `5 + 4×1 = 4`
                misread as `5+4=4`. New shape: `(5 + 4×1) = 9` then `× …`. */}
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
              <span className="text-parchment-500">×</span>
              <span className={mathBreakdown.playerMult > 1 ? 'text-iris-300' : 'text-ember-300'}
                title={mathBreakdown.playerMult > 1
                  ? `Enemy is Vulnerable — your spells deal +${Math.round((mathBreakdown.playerMult - 1) * 100)}% damage.`
                  : `You're Weak — your spells deal ${Math.round((mathBreakdown.playerMult - 1) * 100)}% damage.`}>
                {mathBreakdown.playerMult > 1 ? '🩸 enemy Vuln ' : '⛧ you Weak '}
                {mathBreakdown.playerMult.toFixed(2)}×
              </span>
            </>)}
            {mathBreakdown.secondCastScalar !== 1 && (<>
              <span className="text-parchment-500">×</span>
              <span className="text-ember-300"
                title={`Cast #${castsThisTurn + 1} this turn — each cast after the first scales to 60%. Energy still gates how many you can fire, but diminishing returns push back on chain-casting.`}>
                0.6× cast#{castsThisTurn + 1}
              </span>
            </>)}
            {mathBreakdown.tagBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-iris-300 font-bold"
                title={`Tag-resonance bonus from the target's perLaneTag rider — +N damage per matching tag in your staged cards.`}>
                ✦{mathBreakdown.tagBonus}
              </span>
            </>)}
            {predicted.loudBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-ember-300" title="Saying-it-Louder — +3 dmg per demanding-tagged chutzpah word staged.">📢+{predicted.loudBonus}</span>
            </>)}
            {predicted.openingBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-iris-300" title="Opening Statement — turn-1 (or revisit-extended) bonus.">🎩+{predicted.openingBonus}</span>
            </>)}
            {predicted.predatorBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-ember-300" title="Predator rider — enemy is debuffed.">🩸+{predicted.predatorBonus}</span>
            </>)}
            {predicted.insultBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-iris-300" title={`Insult-hit — staged-tag overlap with enemy's insultVulnerabilities.`}>🎯+{predicted.insultBonus}</span>
            </>)}
            {predicted.stakeBonus > 0 && (<>
              <span className="text-parchment-500">+</span>
              <span className="text-ember-300" title="ALL IN — staked HP buys damage.">🩸+{predicted.stakeBonus}</span>
            </>)}
            {mathBreakdown.enemyBlock > 0 && (<>
              <span className="text-parchment-500">−</span>
              <span className="text-parchment-100 bg-ink-700 px-1 rounded"
                title={`Enemy has ${mathBreakdown.enemyBlock} Block — absorbed before pool damage lands.`}>
                🛡 {mathBreakdown.enemyBlock}
              </span>
            </>)}
            <span className="text-parchment-500">=</span>
            <span className="font-bold text-iris-200 text-sm">{predicted.damage}</span>
          </div>
        )}
        {/* v2.98: enemy-state row. Surfaces enemy statuses that don't change
            the cast's damage number but DO affect what comes next:
            phase-shifts, weave debt, annotations. Read-only info chips. */}
        {enemy && (() => {
          const chips = [];
          if (enemy.phaseShifted) {
            chips.push({ key: 'phase', label: '🕸 thinned (wit-resist + comp regen)', tone: 'text-ember-300' });
          }
          if (enemy.annotation) {
            chips.push({ key: 'ann', label: `📝 ${enemy.annotation.cardName || 'annotated'} (${enemy.annotation.turnsRemaining}t)`, tone: 'text-iris-300' });
          }
          if (weaveStacks > 0) {
            chips.push({ key: 'weave', label: `🪡 Weave debt ${weaveStacks} (fires if you don't cast)`, tone: 'text-ember-300' });
          }
          if (riposteCharge > 0) {
            chips.push({ key: 'rip', label: `🛡⚔ Riposte ${riposteCharge} primed`, tone: 'text-iris-300' });
          }
          if (braceArmedDraw > 0) {
            chips.push({ key: 'brace', label: `🛡✦ Brace draw +${braceArmedDraw} (if no HP hit)`, tone: 'text-moss-300' });
          }
          if (chips.length === 0) return null;
          return (
            <div className="basis-full mt-1 text-[11px] font-mono text-parchment-400 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-parchment-500 uppercase tracking-widest text-[10px] mr-1">enemy state:</span>
              {chips.map(c => (
                <span key={c.key} className={c.tone}>{c.label}</span>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
