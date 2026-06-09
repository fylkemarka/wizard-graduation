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
import { PileView } from './PileView.jsx';
import { equipmentEffectSummary, relicEffectSummary } from './effectSummary.js';
import { WIT_ROWS, WIT_SAME_SCHOOL_BONUSES, WIT_ROW_BY_ID, WIT_PARTIAL_ROW_BONUSES, WIT_MIXED_SCHOOL_BONUSES, detectFFT } from '../cards/wit-v2-rows.js';
import { ADJACENCY_COMBOS } from '../data/animals.js';
import Icon from '../icons/Icon.jsx';
import ArtSlot from './ArtSlot.jsx';
// handler row imports removed 2026-05-31 — FFT system retired for handler.

// v3.5 art pass — slim vitals bar. Width animates via .stat-bar-fill's
// CSS transition, so damage/heals read as motion, not just number flips.
function StatBar({ value, max, fillClass, label }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="stat-bar flex-1 min-w-[60px]" title={label}>
      <div className={`stat-bar-fill ${fillClass}`} style={{ width: pct + '%' }} />
    </div>
  );
}

export function CombatScreen({ enemy, enemyComposure, enemyHp, enemyBlock, enemyIntent, intentTick, incomingProjection, peekedNextIntent,
                       companion = null, castTarget = 'main', onSetCastTarget = () => {},
                       enemyTurnSkipped = false, enemyWillSloth = false,
                       enemyDmgMult, playerDmgMult,
                       enemyDmgTurns = 0, playerDmgTurns = 0,
                       enemyHitFlash, playerHitFlash, dmgFloaters,
                       screenHitFlash = 0, maulNotice = null, pouchNotice = null,
                       hp, maxHp, playerComposure, playerComposureMax,
                       block, poise, energy, energyMax, hand, deck, discard, exiled = [], tray,
                       amplifyPlaysThisCombat, getEffectiveCost,
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
                       pendingMenagerieBlock = 0,
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
                       animals = {}, luresPlayedThisTurn = [],
                       whistlePromptActive = false, whistlePick1Slot = null,
                       onWhistleClick = () => {},
                       onCancelWhistle = () => {},
                       treatPromptActive = false,
                       onTreatClick = () => {},
                       onCancelTreat = () => {},
                       strengthenPromptActive = false,
                       onStrengthenClick = () => {},
                       onCancelStrengthen = () => {},
                       eatItPromptActive = false,
                       onEatItClick = () => {},
                       onCancelEatIt = () => {},
                       sacrificePromptActive = false,
                       onSacrificeClick = () => {},
                       onCancelSacrifice = () => {},
                       gorgePromptActive = false,
                       onGorgeClick = () => {},
                       onCancelGorge = () => {},
                       wellDrilledPromptActive = false,
                       onWellDrilledClick = () => {},
                       onCancelWellDrilled = () => {},
                       drilledSpecies = {},
                       summonStrength = 0,
                       redirectArmed = false,
                       silencedTurns = 0,
                       animalsTurned = false,
                       menagerieAttackTotal = 0,
                       betrayPending = false,
                       herdPromptActive = false,
                       onHerdClick = () => {},
                       onCancelHerd = () => {},
                       onSacrificeAnimal = () => {},
                       onActivateAnimal = () => {},
                       abilitiesUsedThisTurn = [],
                       narrowChooserOpen = false,
                       narrowCandidates = [],
                       onNarrowLure = () => {},
                       onCancelNarrow = () => {},
                       buffetArmed = false,
                       onFeedAnimal = () => {},
                       onFeedSpecies = () => {},
                       feedCost = 1,
                       onDiscardTactic = () => {},
                       onOpenCompendium, onOpenDeckView }) {
  // Drag state — which empty stage slot is the dragged hand card currently
  // hovering over? Lives at this level so the hand-card's onDragEnd can
  // clear it on cancelled drops. The slot pill (inside V2SpellTray) reads
  // and writes via prop callbacks.
  const [dragOverSlot, setDragOverSlot] = useState(null);
  // Track which hand card is currently being dragged so feed slots can
  // pre-highlight when the dragged card's feedKey matches them — gives the
  // player a visible target before they get close to the drop zone.
  const [draggingHandIdx, setDraggingHandIdx] = useState(null);
  // Which pile the player is peeking at ('deck' | 'discard' | null).
  const [pileView, setPileView] = useState(null);
  const composureMax = enemy?.composureMax ?? 999;
  const hpMax = enemy?.hpMax ?? 999;
  const showComposure = composureMax < 999;
  // v3.4.54 (Alan): physical damage to enemies removed altogether. Enemy
  // HP is no longer drained by any player card; hide the HP bar.
  const showHp = false;
  // effectiveness chip helpers removed 2026-05-31 with the per-lane
  // effectiveness rip.
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
      // Maul attacks lead with 🦷 so the threat reads at a glance: block it
      // all or the strongest animal is torn off the board.
      const maulMark = intent.maul ? '🦷 ' : '';
      // Charged release (Spindlewight wind-up) reads loudly so the player
      // knows the big telegraphed hit is landing this turn.
      const chargeMark = intent.charged ? '🌀 CHARGED ' : '';
      return { display: `${chargeMark}${maulMark}${poolIcon} ${body}${label}${riderTail}`, reduced, amplified, rawValue: raw, effValue: eff };
    }
    // v3.4.81 (Alan: "Weave + 2 is unclear. What does weave do? What's it
    // hit for?") — surface the projected composure damage if the player
    // doesn't strike back: current stacks + this turn's add. 2026-06-02: the
    // clear condition is now "deal damage to the enemy" (lane-agnostic), not
    // "cast" — so the Handler can play around it too.
    if (intent.kind === 'weave') {
      const projected = (weaveStacks || 0) + intent.value;
      return {
        display: `🪡 Weave +${intent.value} → ${projected} 🎭 lands end of your next turn`,
        reduced: false, amplified: false,
        rawValue: intent.value, effValue: projected,
      };
    }
    return { display: intent.telegraph || '...', reduced: false, amplified: false, rawValue: intent.value, effValue: intent.value };
  };

  // Build a plain-language tooltip for the enemy's intent box. The
  // telegraph string ('🎭 5 (pattern-wrong)') is opaque on first read —
  // this is what teaches the icon vocabulary on hover.
  // v3 (Alan, 2026-06-08): project WHICH animal a maul will tear, so the intent
  // bar names the specific victim instead of the ambiguous "your strongest".
  // HP maul → the animal with the highest BLOCK (the wall); composure maul →
  // the highest ATTACK. Mirrors App.maulStrongestAnimal. (Pecking Order would
  // flip to the lowest; the common case names what the player expects.)
  const projectedMaulVictim = (intent) => {
    if (!intent?.maul) return null;
    const composureMaul = intent.pool === 'composure';
    const cands = ['intro', 'subject', 'target']
      .map(s => ({ s, slot: tray?.[s] }))
      .filter(x => x.slot?.kind === 'animal')
      .map(x => {
        const a = animals?.[x.slot.animalId];
        // NOTE: effAnimalAttack lives in the V2SpellTray sub-component, NOT this
        // scope — referencing it here crashed the intent bar (Alan, 2026-06-09).
        // A self-contained estimate (base + permanent atkBonus + Summon Strength)
        // is plenty for ranking the composure-maul victim.
        const stat = composureMaul
          ? (a?.attack || 0) + (x.slot.attackBonus || 0) + (summonStrength || 0)
          : (a?.turnGrant?.block || x.slot.turnGrantTemp?.block || 0) + (x.slot.blockBonus || 0);
        return { name: a?.name || x.slot.animalId, icon: a?.icon || '🐾', stat };
      });
    if (cands.length === 0) return null;
    cands.sort((a, b) => b.stat - a.stat);
    return cands[0];
  };
  // v3 (Alan, 2026-06-09): freeze + betray both grab the highest-ATTACK animal
  // (mirrors App.resolveBetray / the freeze branch). Name it so the intent bar
  // never says the ambiguous "your strongest animal" — it says WHICH one.
  const projectedStrongestByAttack = () => {
    const cands = ['intro', 'subject', 'target']
      .map(s => tray?.[s])
      .filter(sl => sl?.kind === 'animal')
      .map(sl => {
        const a = animals?.[sl.animalId];
        const stat = (a?.attack || 0) + (sl.attackBonus || 0) + (summonStrength || 0);
        return { name: a?.name || sl.animalId, icon: a?.icon || '🐾', stat };
      });
    if (cands.length === 0) return null;
    cands.sort((a, b) => b.stat - a.stat);
    return cands[0];
  };
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
      if (intent.maul) {
        const v = projectedMaulVictim(intent);
        const by = intent.pool === 'composure' ? 'highest Attack' : 'highest Block';
        const shield = intent.pool === 'composure' ? 'Poise' : 'Block';
        lines.push(`🦷 Maul: if any of this leaks past your ${shield}, it tears the animal with the ${by}${v ? ` — right now ${v.name}` : ''}. ${shield} it ALL to keep your menagerie. (Ducking into the pouch dodges the damage but NOT the maul.)`);
      }
    } else if (intent.kind === 'block') {
      lines.push(`🛡 Gains ${intent.value} Block — absorbs your damage to it until its next turn.`);
    } else if (intent.kind === 'vulnerable') {
      lines.push(`🩸 Applies Vulnerable ${intent.value} — your incoming damage will be amplified for the next few turns.`);
    } else if (intent.kind === 'weak') {
      lines.push(`⛧ Applies Weak ${intent.value} — your spell damage will be reduced for the next few turns.`);
    } else if (intent.kind === 'weave') {
      // Hollow Weaver's signature: a telegraphed DELAYED composure hit.
      const projected = (weaveStacks || 0) + intent.value;
      lines.push(`🪡 Weave: banks ${intent.value} composure (currently ${weaveStacks || 0}, becoming ${projected}).`);
      lines.push(`At the end of your NEXT turn the banked total lands as composure damage, then resets. You see it a turn ahead — race the Weaver's own composure down before it adds up.`);
    } else if (intent.kind === 'betray') {
      const v = projectedStrongestByAttack();
      lines.push(`🗡 Recruits the animal with the highest Attack${v ? ` — right now ${v.name}` : ''} as a Turncoat that hits your Composure. It defects on the enemy's NEXT turn unless you sacrifice / spend it first.`);
    } else if (intent.kind === 'freeze') {
      const v = projectedStrongestByAttack();
      lines.push(`❄ Freezes the animal with the highest Attack${v ? ` — right now ${v.name}` : ''} for ${intent.value || 1} turn${(intent.value || 1) > 1 ? 's' : ''}. It can't attack while frozen.`);
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
    <div key={`screenshake-${screenHitFlash || 0}`}
         className={`min-h-screen flex flex-col p-4 gap-3 max-w-6xl mx-auto ${screenHitFlash ? 'screen-hit-shake' : ''}`}>
      {/* Red edge-flash when the enemy lands damage — re-keyed per hit. */}
      {screenHitFlash ? (
        <div key={`hitflash-${screenHitFlash}`} className="screen-hit-flash pointer-events-none fixed inset-0 z-40" />
      ) : null}
      {/* Maul toast — names the animal torn off and WHY, dead-centre, loud. */}
      {maulNotice && (
        <div key={maulNotice.id} className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none maul-toast">
          <div className="parchment-card-strong px-6 py-3 border-2 border-ember-400 shadow-2xl text-center">
            <div className="text-xs uppercase tracking-widest text-ember-300 font-display">🦷 Mauled</div>
            <div className="text-2xl font-display text-parchment-50 mt-1">
              {maulNotice.icon} {maulNotice.name} <span className="text-ember-300">torn off the board</span>
            </div>
            <div className="text-sm text-parchment-300 italic mt-0.5">
              {maulNotice.enemy} mauled it — {maulNotice.reason}.
            </div>
          </div>
        </div>
      )}
      {/* Pouch toast — the kangaroo pouch absorbed the whole enemy turn. The
          log line buries fast, so this makes the no-damage outcome obvious. */}
      {pouchNotice && (
        <div data-testid="pouch-notice" key={pouchNotice.id}
             className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none maul-toast">
          <div className="parchment-card-strong px-6 py-3 border-2 border-moss-400 shadow-2xl text-center">
            <div className="text-xs uppercase tracking-widest text-moss-300 font-display">🦘 Safe in the Pouch</div>
            <div className="text-2xl font-display text-parchment-50 mt-1">
              No damage <span className="text-moss-300">this turn</span>
            </div>
            <div className="text-sm text-parchment-300 italic mt-0.5">
              {pouchNotice.enemy}'s turn glances right off.
            </div>
          </div>
        </div>
      )}
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
      {/* v3.5 duo layout (Alan, 2026-06-07): five columns — each enemy is
          its own 1/5 panel, the shared forecast (one Incoming bar for ALL
          enemies) takes the middle, Your State is 1/5 on the right. Solo
          fights: the forecast widens into the companion's column. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
      <div data-testid="enemy-panel" key={`enemy-${enemyHitFlash || 0}`}
           data-targeted={companion ? (castTarget === 'main' ? 'true' : 'false') : undefined}
           onClick={companion && castTarget !== 'main' ? () => onSetCastTarget('main') : undefined}
           title={companion ? (castTarget === 'main'
             ? 'Your casts and animals are aimed at this one.'
             : 'Click to aim your casts and animals back at this one.') : undefined}
           className={`parchment-card-strong p-1.5 relative lg:col-span-1 ${shakeClass} ${
             companion ? (castTarget === 'main' ? 'ring-2 ring-gold-400' : 'cursor-pointer hover:ring-1 hover:ring-gold-600') : ''
           }`}>
        {/* Damage floaters — composure (iris) and physical (ember). */}
        {dmgFloaters && dmgFloaters.length > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-10 z-20">
            {dmgFloaters.map(f => (
              <div key={f.id}
                className={`dmg-float absolute font-display font-black tabular-nums whitespace-nowrap ${
                  f.big ? 'text-5xl dmg-float-big' : 'text-3xl'
                } ${f.dmgType === 'physical' ? 'text-ember-300' : 'text-iris-200'}`}
                style={{ left: 0, '--dx': `${f.dx || 0}px`, '--dy': `${f.dy || 0}px` }}>
                −{f.amount}{f.big && <span className="text-2xl align-top ml-0.5">!</span>}
              </div>
            ))}
          </div>
        )}
        {/* Header restructured (Alan, 2026-06-08): name + numeric readouts
            were one horizontal row, so a wrapping name (Silk Wraith / long
            rogue names) collided with the composure number. Now they STACK —
            portrait+name on top (name wraps freely), then a full-width
            readout row, then the vitals bars. Nothing overlaps. */}
        <div className="flex items-start gap-2 mb-1">
          {/* Bitmap portrait slot — /art/enemies/<id>.png; hidden until then. */}
          {enemy?.id && (
            <ArtSlot src={`/art/enemies/${enemy.id}.png`} alt={enemy.name}
                     className="w-14 h-14 rounded-md border-2 border-ember-700 object-cover shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm text-ember-300 leading-tight break-words flex items-center gap-x-2 gap-y-0.5 flex-wrap">
              <span className="break-words">{enemy?.name}</span>
              {companion && castTarget === 'main' && (
                <span className="px-1.5 py-0.5 rounded bg-gold-600 text-ink-800 text-[9px] uppercase tracking-widest font-bold"
                      title="Your casts are aimed at this one. Click the companion below to switch.">
                  🎯 your casts
                </span>
              )}
              {/* Phase-shift badge — slimmer chip so it doesn't shove the name. */}
              {enemy?.phaseShifted && (
                <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-bold font-mono bg-iris-900 border border-iris-400 text-iris-200"
                  title="The enemy has shifted phase. Its per-turn behavior has changed.">
                  🕸 Thinned
                </span>
              )}
            </div>
            <div className="text-[10px] text-parchment-300 italic leading-none">
              {enemy?.tier === 'boss' ? 'Boss' : enemy?.tier === 'elite' ? 'Elite' : 'Enemy'}
            </div>
          </div>
        </div>
        {/* Numeric readouts — own full-width row, can't collide with the name. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-1 font-mono">
          {showComposure && (
            <span className="text-base text-iris-300" data-testid="enemy-composure" data-value={enemyComposure} title="Composure — drain to 0 to make them back down.">
              <Icon name="composure" className="mr-0.5" />{enemyComposure}<span className="text-[11px] text-parchment-300">/{composureMax}</span>
            </span>
          )}
          {showHp && (
            <span className="text-base text-ember-400" title="Physical HP — only physical effects hit this.">
              <Icon name="hp" className="mr-0.5" />{enemyHp}<span className="text-[11px] text-parchment-300">/{hpMax}</span>
            </span>
          )}
          <span className="text-[11px]"><Icon name="block" className="mr-0.5" />{enemyBlock}</span>
          {/* Silk Wraith phase-shift composure regen — why your drain slips. */}
          {enemy?.id === 'e2-silk-wraith' && enemy?.phaseShifted && (
            <span className="text-[11px] text-moss-300 cursor-help"
                  title="The Silk Wraith has phase-shifted (at ≤50% Composure). It re-weaves +1 Composure at the start of each of its turns, and is wit-resistant (×0.5).">
              🕸 +1 comp/turn
            </span>
          )}
          {enemyPressure > 0 && (
            <span className="text-[11px] text-ember-300 cursor-help"
                  title={`Pressure: ${enemyPressure} stack${enemyPressure > 1 ? 's' : ''}. Bluster casts deal +${enemyPressure} flat damage; capstones consume it for a × multiplier spike.`}>
              <Icon name="pressure" className="mr-0.5" />{enemyPressure} pressure
            </span>
          )}
          {enemy?.dot?.turnsRemaining > 0 && enemy?.dot?.damage > 0 && (
            <span className="text-[11px] text-ember-300"
                  title={`Damage-over-time: each enemy turn, they take ${enemy.dot.damage} composure damage. ${enemy.dot.turnsRemaining} turns left. Bypasses block.`}>
              <Icon name="bleed" className="mr-0.5" />DoT {enemy.dot.damage}×{enemy.dot.turnsRemaining}
            </span>
          )}
        </div>
        {/* v3.5 art pass — enemy vitals bars under the readouts. */}
        <div className="flex gap-2 items-center mb-1">
          {showComposure && (
            <StatBar value={enemyComposure} max={composureMax} fillClass="bg-iris-400"
                     label={`Composure ${enemyComposure}/${composureMax}`} />
          )}
          {showHp && (
            <StatBar value={enemyHp} max={hpMax} fillClass="bg-ember-400"
                     label={`HP ${enemyHp}/${hpMax}`} />
          )}
        </div>
      </div>
      {/* Companion panel — a full 1/5 enemy panel of its own (Alan,
          2026-06-07). Click toggles your attack target; block shown with
          the same prominence as the leader's. */}
      {companion && (
        <button type="button"
          data-testid="companion-panel"
          data-targeted={castTarget === 'companion' ? 'true' : 'false'}
          onClick={() => onSetCastTarget(castTarget === 'companion' ? 'main' : 'companion')}
          className={`parchment-card-strong p-1.5 text-left flex flex-col gap-1 transition cursor-pointer lg:col-span-1 ${
            castTarget === 'companion' ? 'ring-2 ring-gold-400' : 'hover:ring-1 hover:ring-gold-600'
          }`}
          title={`${companion.def.name} — ${companion.def.flavor || 'a second enemy'}.\n\nClick to ${castTarget === 'companion' ? 'aim your attacks back at the leader' : 'aim your attacks at this one instead'}. Casts AND animals follow your target; DoTs, riders and annotations stay on the leader. If the leader falls, this one flees.`}>
          <div className="flex items-start gap-2">
            <ArtSlot src={`/art/enemies/${companion.def.id}.png`} alt={companion.def.name}
                     className="w-14 h-14 rounded-md border-2 border-ember-700 object-cover shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-base text-ember-300 flex items-center gap-2 flex-wrap leading-tight">
                {companion.def.name}
                {castTarget === 'companion' && (
                  <span className="px-1.5 py-0.5 rounded bg-gold-600 text-ink-800 text-[9px] uppercase tracking-widest font-bold">
                    🎯 your casts
                  </span>
                )}
              </div>
              <div className="text-[10px] text-parchment-300 italic leading-none">Companion</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
            <span className="text-base font-mono text-iris-300" title="Composure — drain to 0 and it flees.">
              <Icon name="composure" className="mr-0.5" />{companion.composure}<span className="text-[11px] text-parchment-300">/{companion.def.composureMax}</span>
            </span>
            <span className="text-[11px] font-mono" title="Companion Block — absorbs your attacks first, fades at its turn.">
              <Icon name="block" className="mr-0.5" />{companion.block}
            </span>
          </div>
          {/* Wrap in a row so the StatBar's flex-1 grows HORIZONTALLY — the
              companion panel is a flex-col, so a bare StatBar stretched to fill
              the column height (Alan, 2026-06-08: "that health bar is FAT"). */}
          <div className="flex gap-2 items-center">
            <StatBar value={companion.composure} max={companion.def.composureMax} fillClass="bg-iris-400"
                     label={`Composure ${companion.composure}/${companion.def.composureMax}`} />
          </div>
          {companion.intent && (
            <div className="text-xs text-parchment-200 mt-0.5">{companion.intent.telegraph}</div>
          )}
          {castTarget !== 'companion' && (
            <span className="self-start px-1.5 py-0.5 rounded bg-ink-700 text-parchment-400 text-[9px] uppercase tracking-widest font-bold">
              click to target
            </span>
          )}
        </button>
      )}
      {/* Shared forecast card — ONE Incoming math bar for every enemy
          present, plus intent headline / peek / annotation / in-effect. */}
      <div className={`parchment-card relative ${companion ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
        <div className="rounded bg-ember-950/50 border border-ember-800">
          {/* Wall / Speechless armed — the enemy's coming turn is forfeit.
              Without this banner the only feedback was a log line, and a
              player couldn't tell whether an ability actually armed
              the wall. */}
          {enemyTurnSkipped && (
            <div data-testid="enemy-turn-skipped"
                 className="px-3 py-1.5 bg-moss-900/70 border-b border-moss-600 text-moss-200 text-sm font-bold flex items-center gap-2">
              🧱 WALL UP — the enemy's next turn is skipped. Nothing below will happen.
            </div>
          )}
          {/* Sloth slow — telegraph that the upcoming enemy turn is too slow
              to act, so the dimmed intent below won't fire (Alan 2026-06-08). */}
          {!enemyTurnSkipped && enemyWillSloth && (
            <div data-testid="enemy-slothd"
                 className="px-3 py-1.5 bg-iris-900/70 border-b border-iris-600 text-iris-200 text-sm font-bold flex items-center gap-2">
              🦥 SLOTH'D — time dilates; the enemy is too slow to act this turn.
            </div>
          )}
          <div key={`intent-${intentTick}`}
               className={`intent-flash px-3 py-2 cursor-help ${(enemyTurnSkipped || enemyWillSloth) ? 'opacity-40 line-through' : ''}`}
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
            {/* v3 (Alan): name the specific animal a maul will tear. */}
            {enemyIntent?.maul && !enemyTurnSkipped && !enemyWillSloth && (() => {
              const v = projectedMaulVictim(enemyIntent);
              return (
                <div className="text-xs font-mono text-ember-200 mt-0.5"
                     title={`A maul grabs the animal with the highest ${enemyIntent.pool === 'composure' ? 'Attack' : 'Block'}. ${enemyIntent.pool === 'composure' ? 'Poise' : 'Block'} it all to keep your menagerie.`}>
                  {v ? <>🦷 will maul {v.icon} {v.name}</> : '🦷 maul — no animals to grab'}
                </div>
              );
            })()}
            {/* v3 (Alan): name the specific animal a betray/freeze will take. */}
            {enemyIntent?.kind === 'betray' && !enemyTurnSkipped && !enemyWillSloth && (() => {
              const v = projectedStrongestByAttack();
              return (
                <div className="text-xs font-mono text-ember-200 mt-0.5"
                     title="The recruitment takes the animal with the highest Attack. Sacrifice or spend it before her next turn to deny her.">
                  {v ? <>🗡 will recruit {v.icon} {v.name}</> : '🗡 recruit — no animals to take'}
                </div>
              );
            })()}
            {enemyIntent?.kind === 'freeze' && !enemyTurnSkipped && !enemyWillSloth && (() => {
              const v = projectedStrongestByAttack();
              return (
                <div className="text-xs font-mono text-ember-200 mt-0.5"
                     title="The freeze pins the animal with the highest Attack — it can't attack while frozen.">
                  {v ? <>❄ will freeze {v.icon} {v.name}</> : '❄ freeze — no animals'}
                </div>
              );
            })()}
            {/* v3 (Alan, 2026-06-09): the menagerie turned on you — the math bar
                was blank for this intent. Surface the self-damage it'll deal. */}
            {(enemyIntent?.kind === 'turnAgainst' || animalsTurned) && !enemyTurnSkipped && !enemyWillSloth && (
              <div className="text-xs font-mono text-ember-200 mt-0.5"
                   title="Your menagerie has been turned against you — at the end of your turn its attacks hit YOUR Composure instead of the enemy. Spend or sacrifice the animals first to deny it.">
                🔄 menagerie turned — ~{menagerieAttackTotal} composure to YOU {animalsTurned ? 'this turn' : 'next turn'}
              </div>
            )}
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
            <div className="px-3 py-1.5 border-t border-ember-800/60 text-sm"
                 title="You peeked the enemy's next move.">
              <span className="text-iris-300 font-mono text-xs uppercase tracking-widest mr-2"><Icon name="peek" /> next</span>
              <span className="text-parchment-50">{peekedNextIntent.telegraph}</span>
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
              <div className="px-3 py-1.5 border-t border-ember-800/60 cursor-help" title={tip}>
                <span className="text-iris-300 font-mono text-xs uppercase tracking-widest mr-2"><Icon name="annotate" /> annotated</span>
                <span className="text-sm italic text-parchment-50">{enemy.annotation.phrase} <span className="text-iris-300">({enemy.annotation.turnsRemaining}t)</span></span>
                <div className="text-[10px] text-iris-200 mt-0.5 leading-tight">{effectSummary}</div>
              </div>
            );
          })()}
          {/* Per-lane effectiveness chips removed 2026-05-31 with the
              effectiveness-system rip. All multipliers are now 1.0 globally
              so the chips were noise (and lying). */}
        {/* v3.4.68 — INCOMING-HIT math bar. Mirrors the player spell-tray
            breakdown so the enemy attack is no longer "behind the scenes."
            Every layer that touches the swing gets its own chip: base →
            amplify/reduce → flat adds → reductions → shields absorbed →
            the net that actually reaches HP / Composure. Numbers are
            concrete (not percentages) per the no-math-in-head rule — the
            chain reads as plain arithmetic, ending in the punchline. */}
        {incomingProjection && (() => {
          const p = incomingProjection;
          const chip = (key, cls, text, title) => (
            <span key={key} className={`px-1.5 py-0.5 rounded ${cls} cursor-help`} title={title}>{text}</span>
          );
          const chips = [];
          const duo = !!p.companionIncoming;
          // Leader's swing chain (absent when the leader isn't attacking —
          // e.g. it blocks while the companion still jabs).
          if (p.hasMain) {
            if (duo) chips.push(chip('main-label', 'bg-ember-900/80 text-ember-200 uppercase tracking-wide font-bold',
              p.mainName, `The leader's attack.`));
            chips.push(chip('base', 'bg-ink-700 text-parchment-100',
              p.hits > 1 ? <><Icon name="attack" /> {p.baseSwing} × {p.hits} hits</> : <><Icon name="attack" /> base {p.baseSwing}</>,
              p.hits > 1 ? `The enemy swings ${p.hits} times at ${p.baseSwing} each.` : `The enemy's base swing is ${p.baseSwing}.`));
            if (p.amplified) chips.push(chip('amp', 'bg-ember-800 text-ember-100',
              <><Icon name="bleed" /> → {p.afterMult}/swing</>, `You are Vulnerable — each swing is amplified to ${p.afterMult}.`));
            if (p.reduced) chips.push(chip('red', 'bg-moss-800 text-moss-100',
              <><Icon name="weak" /> → {p.afterMult}/swing</>, `The enemy is Weak — each swing is reduced to ${p.afterMult}.`));
            if (p.arguing > 0) chips.push(chip('arg', 'bg-iris-800 text-iris-100',
              <><Icon name="shout" /> +{p.arguing}</>, `Arguing back: each Actually— you played adds +${p.arguing} to the swing.`));
            if (p.drunken > 0) chips.push(chip('drunk', 'bg-amber-800 text-amber-100',
              `🍺 +${p.drunken}`, `Drunken Confidence: +${p.drunken} to every enemy swing while installed.`));
            if (p.annAtkRed > 0) chips.push(chip('ann', 'bg-iris-900 text-iris-100',
              <><Icon name="annotate" /> −{p.annAtkRed}</>, `Annotation scrubs ${p.annAtkRed} off the swing before shields.`));
            if (p.beetle > 0) chips.push(chip('beetle', 'bg-moss-900 text-moss-100',
              `🪲 −${p.beetle}`, `Beetle absorbs ${p.beetle} off the first hit.`));
            if (p.perSwingReduction > 0) chips.push(chip('def', 'bg-moss-900 text-moss-100',
              <><Icon name="block" />✦ −{p.perSwingReduction}/swing</>, `Defense + Long Thread shave ${p.perSwingReduction} off each swing (min 1 gets through).`));
            if (p.midnightReduction > 0) chips.push(chip('midnight', 'bg-iris-900 text-iris-100',
              <>🌙 −{p.midnightReduction}/swing</>, `Animal Midnight — your menagerie shaves ${p.midnightReduction} off each swing${p.hits > 1 ? ` (−${p.midnightReduction * p.hits} across ${p.hits} hits)` : ''}.`));
            if (p.swingReduction > 0) chips.push(chip('hb', 'bg-moss-900 text-moss-100',
              `−${p.swingReduction}/swing`, `Headbutt: −${p.swingReduction} off each swing (min 1).`));
            if (p.holdOn > 0) chips.push(chip('hold', 'bg-iris-900 text-iris-100',
              `🛑 −${p.holdOn} first`, `Hold On reduces the first swing by ${p.holdOn}.`));
            chips.push(chip('inc', 'bg-ink-600 text-parchment-50 font-bold',
              `→ ${p.totalIncoming} incoming`, `After all reductions, ${p.totalIncoming} damage arrives at your shields.`));
            if (p.blockAbsorbed > 0) chips.push(chip('blk', 'bg-iris-900 text-iris-100',
              <><Icon name="block" /> −{p.blockAbsorbed}</>, `Your Block soaks ${p.blockAbsorbed}.`));
            if (p.poiseAbsorbed > 0) chips.push(chip('poi', 'bg-moss-900 text-moss-100',
              <><Icon name="poise" /> −{p.poiseAbsorbed}</>, `Your Poise soaks ${p.poiseAbsorbed} composure damage.`));
            if (p.tempHpAbsorbed > 0) chips.push(chip('temp', 'bg-gold-900 text-gold-100',
              `🎈 −${p.tempHpAbsorbed}`, `Temp HP soaks ${p.tempHpAbsorbed} before real HP.`));
          }
          // Companion's jab — lands AFTER the leader's swings, into the
          // leftover Block/Poise (one bar for every enemy present).
          if (duo) {
            const ci = p.companionIncoming;
            chips.push(chip('comp-label', 'bg-ember-900/80 text-ember-200 uppercase tracking-wide font-bold',
              ci.name, `The companion acts right after the leader.`));
            chips.push(chip('cbase', 'bg-ink-700 text-parchment-100',
              <><Icon name="attack" /> {ci.baseSwing}</>, `${ci.name}'s swing is ${ci.baseSwing}.`));
            if (ci.amplified) chips.push(chip('camp', 'bg-ember-800 text-ember-100',
              <><Icon name="bleed" /> → {ci.afterMult}</>, `You are Vulnerable — the jab is amplified to ${ci.afterMult}.`));
            if (ci.reduced) chips.push(chip('cred', 'bg-moss-800 text-moss-100',
              <><Icon name="weak" /> → {ci.afterMult}</>, `The enemy side is Weak — the jab is reduced to ${ci.afterMult}.`));
            if (ci.blockAbsorbed > 0) chips.push(chip('cblk', 'bg-iris-900 text-iris-100',
              <><Icon name="block" /> −{ci.blockAbsorbed}</>, `Your leftover Block soaks ${ci.blockAbsorbed}.`));
            if (ci.poiseAbsorbed > 0) chips.push(chip('cpoi', 'bg-moss-900 text-moss-100',
              <><Icon name="poise" /> −{ci.poiseAbsorbed}</>, `Your leftover Poise soaks ${ci.poiseAbsorbed}.`));
            if (ci.tempHpAbsorbed > 0) chips.push(chip('ctemp', 'bg-gold-900 text-gold-100',
              `🎈 −${ci.tempHpAbsorbed}`, `Temp HP soaks ${ci.tempHpAbsorbed} before real HP.`));
          }
          // Combined punchline — what actually lands across BOTH enemies.
          const anyNet = (p.netHp || 0) > 0 || (p.netComposure || 0) > 0;
          if ((p.netHp || 0) > 0) chips.push(chip('netHp',
            'bg-ember-700 text-parchment-50 font-bold border border-ember-400',
            <><Icon name="hp" /> {p.netHp} to HP</>,
            `Total HP damage that lands after everything above${duo ? ' (both enemies)' : ''}.`));
          if ((p.netComposure || 0) > 0) chips.push(chip('netComp',
            'bg-ember-700 text-parchment-50 font-bold border border-ember-400',
            <><Icon name="composure" /> {p.netComposure} to Composure</>,
            `Total Composure damage that lands after everything above${duo ? ' (both enemies)' : ''}.`));
          if (!anyNet) chips.push(chip('net0',
            'bg-moss-800 text-moss-100 font-bold border border-moss-500',
            'fully absorbed', `Nothing reaches your HP or Composure.`));
          if (p.stagger) chips.push(chip('stag', 'bg-amber-900 text-amber-100',
            <><Icon name="stagger" /> 50% dodge</>, `Drunken Stagger: each swing has a 50% chance to miss entirely — you may take less, or nothing.`));
          if (p.maul) chips.push(chip('maul', 'bg-ember-900 text-ember-100',
            <><Icon name="maul" /> mauls</>, `If any HP leaks past Block, this attack also tears your strongest animal off the board.`));
          // Spittle Peck (Rabid Scrubjay) — the enemy's next attack reflects.
          // Surface it in the Incoming bar: 0 reaches you; the enemy eats it.
          if (redirectArmed && (enemyIntent?.kind === 'attack' || enemyIntent?.kind === 'attack-multi')) {
            chips.length = 0;
            chips.push(<span key="redir" data-testid="incoming-reflect"
              className="px-1.5 py-0.5 rounded bg-moss-900 text-moss-100 border border-moss-500"
              title="Spittle Peck: this attack turns on the enemy. You take 0 — the enemy eats it.">↩ reflects onto the enemy — 0 to you</span>);
          }
          return (
            <div className="px-3 py-2 border-t border-ember-800/60 flex flex-wrap gap-1.5 items-center"
                 title="What the enemy's attack actually does to you, step by step.">
              <span className="text-[10px] uppercase tracking-widest text-ember-300">Incoming</span>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-mono items-center">{chips}</div>
            </div>
          );
        })()}
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
              <span className="px-3 py-1.5 rounded bg-iris-700 text-parchment-50 text-sm font-bold border border-iris-400 cursor-help inline-flex items-center gap-1.5"
                title={`Enemy is Vulnerable — your Predicted damage is already amplified. Lasts ${playerDmgTurns} more turn${playerDmgTurns === 1 ? '' : 's'} (refreshes when re-applied).`}>
                <Icon name="bleed" /> ENEMY VULNERABLE
                <span className="px-1.5 py-0.5 rounded bg-iris-900 text-iris-100 text-xs font-mono">{playerDmgTurns}t</span>
              </span>
            )}
            {playerDmgMult < 1.0 && (
              <span className="px-3 py-1.5 rounded bg-ember-700 text-parchment-50 text-sm font-bold border border-ember-500 cursor-help inline-flex items-center gap-1.5"
                title={`You are Weak — your Predicted damage is already reduced. Lasts ${playerDmgTurns} more turn${playerDmgTurns === 1 ? '' : 's'}.`}>
                <Icon name="weak" /> YOU ARE WEAK
                <span className="px-1.5 py-0.5 rounded bg-ember-900 text-ember-100 text-xs font-mono">{playerDmgTurns}t</span>
              </span>
            )}
            {enemyDmgMult > 1.0 && (
              <span className="px-3 py-1.5 rounded bg-ember-700 text-parchment-50 text-sm font-bold border border-ember-500 cursor-help inline-flex items-center gap-1.5"
                title={`You are Vulnerable — the enemy's intent damage is already amplified. Lasts ${enemyDmgTurns} more turn${enemyDmgTurns === 1 ? '' : 's'}.`}>
                <Icon name="bleed" /> YOU ARE VULNERABLE
                <span className="px-1.5 py-0.5 rounded bg-ember-900 text-ember-100 text-xs font-mono">{enemyDmgTurns}t</span>
              </span>
            )}
            {enemyDmgMult < 1.0 && (
              <span className="px-3 py-1.5 rounded bg-iris-700 text-parchment-50 text-sm font-bold border border-iris-400 cursor-help inline-flex items-center gap-1.5"
                title={`Enemy is Weak — their intent damage is already reduced. Lasts ${enemyDmgTurns} more turn${enemyDmgTurns === 1 ? '' : 's'} (refreshes when re-applied, e.g. another Sap).`}>
                <Icon name="weak" /> ENEMY WEAK
                <span className="px-1.5 py-0.5 rounded bg-iris-900 text-iris-100 text-xs font-mono">{enemyDmgTurns}t</span>
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
        <div className="text-[10px] uppercase tracking-widest text-moss-300 leading-none">Player</div>
        {/* v3.5 art pass — player vitals bars mirror the enemy's. */}
        <div className="flex gap-2 items-center">
          <StatBar value={hp} max={maxHp} fillClass="bg-moss-400" label={`HP ${hp}/${maxHp}`} />
          <StatBar value={playerComposure} max={playerComposureMax} fillClass="bg-iris-400"
                   label={`Composure ${playerComposure}/${playerComposureMax}`} />
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
          <span data-testid="player-hp" data-hp={hp} title="HP — physical health. 0 = defeat." className="font-mono text-sm text-moss-300">{hp}<span className="text-[10px] text-parchment-400">/{maxHp}</span><span className="text-[9px] uppercase text-parchment-400 ml-0.5">HP</span></span>
          <span data-testid="player-composure" data-composure={playerComposure} title="Composure — verbal HP. 0 = lose your nerve." className="font-mono text-sm text-iris-200">{playerComposure}<span className="text-[10px] text-parchment-400">/{playerComposureMax}</span><span className="text-[9px] uppercase text-parchment-400 ml-0.5">Comp</span></span>
          <span data-testid="player-energy" data-energy={energy} data-energy-max={energyMax} title="Energy — refills each turn." className="font-mono text-sm text-gold-300"><Icon name="energy" className="mr-0.5" />{energy}/{energyMax}</span>
          <span data-testid="player-block" data-block={block} title={pendingMenagerieBlock > 0
                  ? `Block — absorbs physical hits, resets each turn. ${block} now + ${pendingMenagerieBlock} your menagerie braces at end of turn = ${block + pendingMenagerieBlock} against the next attack.`
                  : "Block — absorbs physical hits. Resets each turn."}
                className="font-mono text-sm text-iris-300"><Icon name="block" className="mr-0.5" />{block}{pendingMenagerieBlock > 0 && <span className="text-moss-300" data-testid="pending-menagerie-block"> +{pendingMenagerieBlock}🐾</span>}</span>
          <span title="Poise — absorbs composure hits. Resets each turn." className="font-mono text-sm text-moss-300"><Icon name="poise" className="mr-0.5" />{poise}</span>
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
          {isHandler && summonStrength > 0 && (
            <span data-testid="summon-strength" title={`Summon Strength — every one of your animals attacks for +${summonStrength} (rest of combat).`}
                  className="font-mono text-sm text-ember-300">💪{summonStrength}</span>
          )}
          {isHandler && redirectArmed && (
            <span data-testid="redirect-armed" title="Spittle Peck — the enemy's NEXT attack turns on itself. You take no damage from it; the enemy eats it."
                  className="font-mono text-sm text-moss-300 animate-pulse-soft">↩ reflect</span>
          )}
          {isHandler && silencedTurns > 0 && (
            <span data-testid="silenced" title={`Silenced — you can't play lures (no new summons) for ${silencedTurns} more turn${silencedTurns > 1 ? 's' : ''}.`}
                  className="font-mono text-sm text-iris-300">🤐{silencedTurns}</span>
          )}
          {isHandler && animalsTurned && (
            <span data-testid="animals-turned" title="Turned — your animals will attack YOUR composure at the end of this turn unless you sacrifice / spend them first."
                  className="font-mono text-sm text-rose-300 animate-pulse-soft">🔄 turned</span>
          )}
          {isHandler && betrayPending && (
            <span data-testid="betray-pending" title="Marked for recruitment — the enemy steals your strongest animal on its NEXT turn unless you sacrifice / spend it first."
                  className="font-mono text-sm text-rose-300 animate-pulse-soft">🗡 marked</span>
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
          {/* Clickable pile counts — peek at what's in the draw / discard
              pile. The draw pile view is sorted, not in draw order. */}
          <button data-testid="draw-pile-btn" onClick={() => setPileView('deck')}
                  title="Click to see what's left in your draw pile (shown sorted, not in draw order)."
                  className="font-mono text-sm text-parchment-200 hover:text-gold-300 cursor-pointer">
            ▦ Draw <span className="font-bold">{deck.length}</span>
          </button>
          <button data-testid="discard-pile-btn" onClick={() => setPileView('discard')}
                  title="Click to see the cards in your discard pile. It reshuffles into the draw pile when the draw pile empties."
                  className="font-mono text-sm text-parchment-200 hover:text-gold-300 cursor-pointer">
            🗑 Discard <span className="font-bold">{discard.length}</span>
          </button>
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
                  title={`Weak — your spell potency reduced. ${playerDmgTurns} turn${playerDmgTurns === 1 ? '' : 's'} left.`}>⛧ WEAK {playerDmgTurns}t</span>
          )}
          {playerDmgMult > 1.0 && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-moss-900 text-moss-100 cursor-help"
                  title={`Strengthened — your spell potency boosted. ${playerDmgTurns} turn${playerDmgTurns === 1 ? '' : 's'} left.`}>💫 STRONG {playerDmgTurns}t</span>
          )}
          {enemyDmgMult > 1.0 && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-ember-900 text-ember-100 cursor-help"
                  title={`Vulnerable — incoming enemy attacks deal more damage. ${enemyDmgTurns} turn${enemyDmgTurns === 1 ? '' : 's'} left.`}>🩸 VULN {enemyDmgTurns}t</span>
          )}
          {enemyDmgMult < 1.0 && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-moss-900 text-moss-100 cursor-help"
                  title={`Sapped — enemy attacks deal less damage. ${enemyDmgTurns} turn${enemyDmgTurns === 1 ? '' : 's'} left.`}>🛡 SAPPED {enemyDmgTurns}t</span>
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
        block={block}
        tempHp={tempHp}
        isJnsq={isJnsq} rollOptIn={rollOptIn} setRollOptIn={setRollOptIn}
        lastRoll={lastRoll} combatRolls={combatRolls}
        playerDmgMult={playerDmgMult} enemyDmgMult={enemyDmgMult}
        combatTurn={combatTurn}
        pauseHeldActive={pauseHeldActive} enemy={enemy}
        companion={companion} castTarget={castTarget} enemyBlock={enemyBlock}
        weaveStacks={weaveStacks} riposteCharge={riposteCharge} braceArmedDraw={braceArmedDraw}
        wordsBank={wordsBank} crescendoBuildup={crescendoBuildup} crescendoBuildupRows={crescendoBuildupRows}
        animals={animals} luresPlayedThisTurn={luresPlayedThisTurn} tutorArmed={tutorArmed}
        whistlePromptActive={whistlePromptActive} whistlePick1Slot={whistlePick1Slot} onWhistleClick={onWhistleClick}
        treatPromptActive={treatPromptActive} onTreatClick={onTreatClick}
        strengthenPromptActive={strengthenPromptActive} onStrengthenClick={onStrengthenClick}
        eatItPromptActive={eatItPromptActive} onEatItClick={onEatItClick}
        sacrificePromptActive={sacrificePromptActive} onSacrificeClick={onSacrificeClick}
        gorgePromptActive={gorgePromptActive} onGorgeClick={onGorgeClick}
        wellDrilledPromptActive={wellDrilledPromptActive} onWellDrilledClick={onWellDrilledClick}
        drilledSpecies={drilledSpecies} summonStrength={summonStrength}
        herdPromptActive={herdPromptActive} onHerdClick={onHerdClick}
        onSacrificeAnimal={onSacrificeAnimal}
        onActivateAnimal={onActivateAnimal} abilitiesUsedThisTurn={abilitiesUsedThisTurn}
        powers={powers}
        onPlayCard={onPlayCard}
        onFeedAnimal={onFeedAnimal}
        onFeedSpecies={onFeedSpecies} feedCost={feedCost} playerEnergy={energy}
        onDiscardTactic={onDiscardTactic}
        draggingFeedKey={draggingHandIdx != null ? hand?.[draggingHandIdx]?.feedKey : null}
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
      {whistlePromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-gold-400 bg-gold-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-gold-100">
            <span className="font-bold">🎶 Places, Everyone:</span> {whistlePick1Slot
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
      {strengthenPromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-gold-400 bg-gold-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-gold-100">
            <span className="font-bold">💪 Training:</span> click an animal to strengthen it — permanent buff for as long as it stays.
          </div>
          <button onClick={onCancelStrengthen}
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
      {sacrificePromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-rust-400 bg-rust-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-rust-100">
            <span className="font-bold">🔪 Last Supper:</span> click a summoned animal to cash it in — gain energy equal to its remaining turns and draw a card.
          </div>
          <button onClick={onCancelSacrifice}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}
      {gorgePromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-rust-400 bg-rust-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-rust-100">
            <span className="font-bold">🍖 Gorge:</span> click a summoned animal to extend its stay by 3 turns (and +3 attack if it was fed this turn).
          </div>
          <button onClick={onCancelGorge}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}
      {wellDrilledPromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-rust-400 bg-rust-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-rust-100">
            <span className="font-bold">🎯 Well-Drilled:</span> click a summoned animal — it and every other copy of it on the board gains +2 attack for the rest of combat.
          </div>
          <button onClick={onCancelWellDrilled}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}
      {herdPromptActive && (
        <div className="mb-2 p-3 rounded border-2 border-rust-400 bg-rust-900/40 flex items-center justify-between gap-3">
          <div className="text-sm text-rust-100">
            <span className="font-bold">🦖 They DO Move in Herds:</span> click a summoned animal — every other single-slot animal becomes that animal (turns remaining unchanged; multi-slot animals are unaffected).
          </div>
          <button onClick={onCancelHerd}
            className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm">
            Dismiss
          </button>
        </div>
      )}
      {narrowChooserOpen && (
        <div className="mb-2 p-3 rounded border-2 border-moss-400 bg-moss-900/40">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-sm text-moss-100">
              <span className="font-bold">🍂 Acquired Taste:</span> pick a lure, then the creature it should stop summoning (for the rest of combat). A lure never narrows below 2 creatures.
            </div>
            <button onClick={onCancelNarrow}
              className="px-3 py-1 bg-ink-700 text-parchment-200 rounded border border-ink-500 hover:bg-ink-600 text-sm shrink-0">
              Dismiss
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {narrowCandidates.map(cand => (
              <div key={cand.cardId} className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-parchment-200 font-semibold">{cand.cardName}:</span>
                {cand.species.map(sp => (
                  <button key={sp.id} onClick={() => onNarrowLure(cand.cardId, sp.id)}
                    className="px-2 py-1 bg-ink-700 text-parchment-100 rounded border border-moss-500 hover:bg-moss-700 text-sm">
                    {sp.icon} {sp.name} ✕
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {buffetArmed && (
        <div className="mb-2 p-3 rounded border-2 border-gold-400 bg-gold-900/40">
          <div className="text-sm text-gold-100">
            <span className="font-bold">🍽 Buffet armed:</span> your next lure will spread across every empty stage slot. It stays armed until you play a lure.
          </div>
        </div>
      )}

      <PileView
        open={pileView === 'deck'}
        onClose={() => setPileView(null)}
        title="🗂 Draw pile"
        note="These are the cards still to come. Shown sorted by cost — NOT in the order you'll draw them."
        cards={deck}
        lane={isHandler ? 'handler' : null} />
      <PileView
        open={pileView === 'discard'}
        onClose={() => setPileView(null)}
        title="🗑 Discard pile"
        note="Cards you've played or discarded this combat. They reshuffle into your draw pile when it runs out."
        cards={discard}
        lane={isHandler ? 'handler' : null} />

      <div data-testid="hand" className="flex gap-2 flex-nowrap min-h-[260px] items-stretch justify-center overflow-x-auto">
        {hand.map((card, i) => {
          // Effective cost reflects EVERY live modifier so the hand never
          // grays out a card a discount would let you afford: Amplify's
          // escalation, slot-cheaper powers, and "next card free". App owns
          // the single source of truth (effectiveCardCost) and hands it down
          // here as getEffectiveCost — don't re-derive discounts locally or
          // the pill and the playable-gate drift apart.
          const rawCost = card.cost || 0;
          const effCost = getEffectiveCost
            ? getEffectiveCost(card)
            : (card.id === 'c-amplify' ? rawCost + (amplifyPlaysThisCombat || 0) : rawCost);
          const discounted = effCost < rawCost;
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
          // Escalating-cost cards (Amplify / Sap) read as cost > base.
          const escalated = effCost > rawCost;
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
            ? (escalated ? 'bg-ember-500 text-parchment-50'
               : discounted ? 'bg-moss-500 text-ink-800'
               : 'bg-gold-500 text-ink-800')
            : 'bg-ink-500 text-parchment-300';
          const costTooltip = escalated
            ? `${card.name} costs +${effCost - rawCost} this combat (base ${rawCost}).`
            : discounted
              ? `Discounted to ${effCost} (base ${rawCost}).`
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
              data-testid="hand-card"
              data-card-id={card.id}
              data-card-uid={card.uid}
              data-eff-cost={effCost}
              data-playable={playable ? 'true' : 'false'}
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              draggable={isLure}
              onDragStart={isLure ? (e) => {
                e.dataTransfer.setData('text/plain', String(i));
                e.dataTransfer.effectAllowed = 'move';
                setDraggingHandIdx(i);
              } : undefined}
              onDragEnd={isLure ? () => { setDragOverSlot(null); setDraggingHandIdx(null); } : undefined}
              onClick={() => isFootnoteEligible ? onApplyFootnote(card.uid) : onPlayCard(i)}
              disabled={!(playable || isFootnoteEligible)}
              className={`w-[180px] h-72 shrink-0 rounded-lg border-2 p-2.5 text-left flex flex-col gap-1.5 shadow-lg transition-all ${
                isFootnoteEligible
                  ? `bg-iris-900/60 text-iris-100 border-iris-400 ring-2 ring-iris-400 hover:scale-105 hover:shadow-2xl cursor-pointer`
                : playable
                  ? `bg-parchment-50 card-face text-ink-800 ${tint} hover:scale-105 hover:-translate-y-1 hover:shadow-2xl cursor-pointer`
                  : 'bg-ink-600 text-parchment-400 border-ink-500 opacity-50 cursor-not-allowed'
              }`}>
              <CardFullBody card={displayCard} costOverride={effCost} costPillClass={costPillClass} costTooltip={costTooltip} lane={isHandler ? 'handler' : null} />
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
        <button onClick={onEndTurn} data-testid="end-turn" className="btn btn-ember text-sm px-4 py-1 ml-auto">End Turn</button>
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
                       companion = null, castTarget = 'main', enemyBlock = 0,
                       isHandler = false,
                       playerHp = 70, playerMaxHp = 70,
                       block = 0,
                       tempHp = 0,
                       isJnsq = false, rollOptIn = false, setRollOptIn = () => {},
                       lastRoll = null, combatRolls = [],
                       playerDmgMult = 1.0, enemyDmgMult = 1.0,
                       combatTurn = 1,
                       pauseHeldActive = false, enemy = null,
                       weaveStacks = 0, riposteCharge = 0, braceArmedDraw = 0,
                       wordsBank = 0, crescendoBuildup = 0, crescendoBuildupRows = [],
                       animals = {}, luresPlayedThisTurn = [], tutorArmed = false,
                       whistlePromptActive = false, whistlePick1Slot = null, onWhistleClick = () => {},
                       treatPromptActive = false, onTreatClick = () => {},
                       strengthenPromptActive = false, onStrengthenClick = () => {},
                       eatItPromptActive = false, onEatItClick = () => {},
                       sacrificePromptActive = false, onSacrificeClick = () => {},
                       gorgePromptActive = false, onGorgeClick = () => {},
                       wellDrilledPromptActive = false, onWellDrilledClick = () => {},
                       drilledSpecies = {}, summonStrength = 0,
                       herdPromptActive = false, onHerdClick = () => {},
                       onSacrificeAnimal = () => {},
                       onActivateAnimal = () => {}, abilitiesUsedThisTurn = [],
                       powers = [],
                       onPlayCard = () => {},
                       onFeedAnimal = () => {},
                       onFeedSpecies = () => {}, feedCost = 1, playerEnergy = 0,
                       onDiscardTactic = () => {},
                       draggingFeedKey = null,
                       dragOverSlot = null, setDragOverSlot = () => {} }) {
  // Handler Animal Summoner (2026-05-31, slice 1): a tray slot may hold a
  // { kind: 'lure' | 'animal' } envelope instead of a raw card. Cast preview
  // / FFT detection only treats raw cards as content; envelopes are rendered
  // separately as summon pills below.
  const isSummonEnvelope = (v) => v && (v.kind === 'lure' || v.kind === 'animal');
  // Effective per-turn attack for a staged animal, reflecting every live
  // rider so the pill never shows a stale base number ("no math in head"):
  // any slot.attackBonus (e.g. Gorge on a fed animal, or Well-Drilled's
  // per-animal +2 stamp). Flopping animals (attack ≤ 0) stay at 0.
  // Effective swing for the LEFT neighbour of a slot (what a Lyrebird copies).
  // Resolves through a multi-slot animal's `occupied` placeholder to its anchor
  // (e.g. McCloven), mirroring App.jsx copyLeftAttack. Returns 0 if there's
  // nothing/no attacker to the left.
  // Lyrebird (Alan 2026-06-09): the highest-attacking OTHER animal × copyFactor.
  // Mirrors App.jsx copyHighestAttack. Returns 0 if it's alone.
  const animalCopyHighest = (slotName, mimic) => {
    const ORDER = ['intro', 'subject', 'target'];
    let best = 0;
    for (const sn of ORDER) {
      if (sn === slotName) continue;
      let s = tray?.[sn];
      if (s?.kind === 'occupied' && s.occupiedBy) s = tray[s.occupiedBy];
      if (s?.kind !== 'animal') continue;
      const a = animals?.[s.animalId];
      if (a?.copiesHighest) continue;
      let v = a?.attack || 0;
      if (v > 0) v += (s.attackBonus || 0) + 2 * (drilledSpecies[s.animalId] || 0) + (summonStrength || 0);
      if (v > best) best = v;
    }
    return Math.round(best * (mimic?.copyFactor ?? 0.75));
  };
  // Sheepdog (any `amplifyAdjacent` animal): an animal next to an amplifier
  // deals +amplifyAdjacent (middle slot touches both). Mirrors App.jsx
  // adjacentAmplifyMult — the projected pill/strip MUST include it or the math
  // bar undercounts the Sheepdog boost (Alan, 2026-06-08).
  const adjAmpMult = (slotName) => {
    if (slotName === undefined) return 1;
    const ORDER = ['intro', 'subject', 'target'];
    const idx = ORDER.indexOf(slotName);
    let mult = 1;
    for (const ni of [idx - 1, idx + 1]) {
      if (ni < 0 || ni >= ORDER.length) continue;
      const ns = tray?.[ORDER[ni]];
      if (ns?.kind !== 'animal') continue;
      const na = animals?.[ns.animalId];
      if (na?.amplifyAdjacent > 0) mult += na.amplifyAdjacent;
    }
    return mult;
  };
  const effAnimalAttack = (animal, slotCard, slotName) => {
    // Lyrebird: its shown swing is the highest other animal × copyFactor.
    if (animal?.copiesHighest && slotName !== undefined) {
      const lv = animalCopyHighest(slotName, animal);
      if (lv > 0) return Math.round(lv * adjAmpMult(slotName));
    }
    let a = animal?.attack || 0;
    if (a <= 0) return a;
    a += (slotCard?.attackBonus || 0);
    // Well-Drilled: +2 per drill stack on this species (App animalAttackValue mirror).
    a += 2 * (drilledSpecies[slotCard?.animalId] || 0);
    // Summon Strength: flat +N to every animal (App animalAttackValue mirror).
    a += (summonStrength || 0);
    return Math.round(a * adjAmpMult(slotName));
  };
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
    const { damage: baseDamage, riders, predatorBonus, blockConsumeBonus, insultBonus, insultMatches, insultMatchedTags } = computeSpellDamage(intro, subject, target, modifiers, { playerDmgMult, enemyDmgMult, combatTurn, insultVulnerabilities: enemy?.insultVulnerabilities || [], pauseDoubled: pauseHeldActive, currentBlock: block });
    // v3.4.73 (Alan): predicted damage previously showed only the cast
    // base from computeSpellDamage — but full FFT riders fire AFTER the
    // base and can add huge amounts (Bluster-1's `bonus: 12`, pressure
    // bonus, RAGE × 2, missing-HP scaling, consume-Pressure spike, etc.).
    // Without baking these in, a player staging Bluster-1 saw "8 comp"
    // and got hit for 21. Now Predicted shows the actual delivered total.
    let damage = baseDamage;
    const damageParts = [];
    // Thorns BODY SLAM — the consumed-Block bonus is already inside baseDamage
    // (computeSpellDamage read currentBlock); surface it as a chip so the player
    // sees the detonation value BEFORE committing the wall.
    if (blockConsumeBonus > 0) damageParts.push(`+${blockConsumeBonus} (🛡 ${block} Block spent)`);
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

  // v3.5 (Alan) — adjacency-combo cue. When two neighbouring animals will
  // fire a joint combo at end of turn, BOTH pills get a dotted green
  // outline so the player sees the pair is creating something. Mirrors
  // the detection (incl. once-per-pair-type dedupe) used by the
  // projection strip below and the App.jsx end-of-turn pre-pass.
  const comboSlotInfo = {};
  {
    const order = ['intro', 'subject', 'target'];
    const comboSeen = new Set();
    for (let i = 0; i < order.length - 1; i++) {
      const sA = tray?.[order[i]];
      const sB = tray?.[order[i + 1]];
      if (!sA || sA.kind !== 'animal' || sA.eatenThisTurn) continue;
      if (!sB || sB.kind !== 'animal' || sB.eatenThisTurn) continue;
      const combo = ADJACENCY_COMBOS.find(c =>
        (c.a === sA.animalId && c.b === sB.animalId) ||
        (c.a === sB.animalId && c.b === sA.animalId));
      if (!combo) continue;
      const key = [combo.a, combo.b].sort().join('+');
      if (comboSeen.has(key)) continue;
      comboSeen.add(key);
      comboSlotInfo[order[i]] = combo;
      comboSlotInfo[order[i + 1]] = combo;
    }
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
          <span className="font-bold uppercase tracking-widest text-xs opacity-80">{isHandler ? 'available' : slotName}</span>
          {isDragOver && <span className="text-[10px] mt-1 not-italic font-mono">↓ drop here</span>}
          {isWhistlePick1 && <span className="text-[10px] mt-1 not-italic">🎶</span>}
        </div>
      );
    }
    // Handler Animal Summoner — slot can hold a lure envelope, animal
    // envelope, or an OCCUPIED placeholder (a cell mirrored from a
    // multi-slot animal anchored elsewhere — e.g. Mouse House spans two).
    if (card.kind === 'occupied') {
      const anchorAnimal = animals?.[tray?.[card.occupiedBy]?.animalId];
      const anchorName = anchorAnimal?.name || card.occupiedBy;
      return (
        <div className="px-3 py-2 rounded bg-ember-800/40 border border-ember-700 border-dashed text-parchment-100 text-xs flex flex-col items-center gap-0.5 min-w-[110px] max-w-[200px] cursor-help"
             title={`This slot is occupied by ${anchorName}, which spans more than one slot.`}>
          <span className="font-bold text-center text-base opacity-80">{anchorAnimal?.icon || '⬅'} part of {anchorName}</span>
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
                  ? 'bg-gold-900 border-2 border-gold-300 ring-2 ring-gold-400 animate-pulse-soft cursor-pointer'
                  : 'bg-gold-700 border-2 border-gold-300 ring-2 ring-gold-400 animate-pulse-soft cursor-pointer hover:bg-gold-600')
              : 'bg-moss-800 border border-moss-500 cursor-help'
          }`}>
          <span className="font-mono text-[10px] opacity-70">lure{isWhistlePick1 ? ' · 🎶' : ''}</span>
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
      // Animals are click targets for Treat, Whistle, Sacrifice, and Gorge.
      // Precedence: Treat → Whistle → Sacrifice → Gorge.
      const treatArmed = treatPromptActive;
      const strengthenArmed = strengthenPromptActive;
      const whistleArmed = whistlePromptActive;
      const sacrificeArmed = sacrificePromptActive;
      const gorgeArmed = gorgePromptActive;
      const wellDrilledArmed = wellDrilledPromptActive;
      const herdArmed = herdPromptActive;
      const isWhistlePick1 = whistleArmed && whistlePick1Slot === slotName;
      // Player-activated ability (Mime / Pigeon / Kangaroo): when NO targeting
      // prompt is armed, an animal carrying an activatedAbility is its own
      // click target. Per-turn verbs grey out once spent this turn.
      const anyPromptArmed = treatArmed || strengthenArmed || whistleArmed || sacrificeArmed || gorgeArmed || wellDrilledArmed || herdArmed;
      const ability = animal?.activatedAbility;
      const abilitySpent = ability?.cadence === 'per-turn' && abilitiesUsedThisTurn.includes(slotName);
      const activatable = !anyPromptArmed && !!ability && !abilitySpent;
      const clickHandler = treatArmed ? () => onTreatClick(slotName)
                          : strengthenArmed ? () => onStrengthenClick(slotName)
                          : whistleArmed ? () => onWhistleClick(slotName)
                          : sacrificeArmed ? () => onSacrificeClick(slotName)
                          : gorgeArmed ? () => onGorgeClick(slotName)
                          : wellDrilledArmed ? () => onWellDrilledClick(slotName)
                          : herdArmed ? () => onHerdClick(slotName)
                          : activatable ? () => onActivateAnimal(slotName)
                          : undefined;
      const armed = anyPromptArmed || activatable;
      const armedTitle = treatArmed
        ? `🍖 Click to extend ${animal?.name || 'animal'} by 1 turn.`
        : strengthenArmed
        ? `💪 Click to strengthen ${animal?.name || 'animal'} — permanent +attack and +Block/turn.`
        : whistleArmed
        ? `🎶 Click to ${whistlePick1Slot ? 'swap with ' + whistlePick1Slot : 'pick this slot'}.`
        : sacrificeArmed
        ? `🔪 Click to cash in ${animal?.name || 'animal'} for energy + a card.`
        : gorgeArmed
        ? `🍖 Click to gorge ${animal?.name || 'animal'} (+3 turns).`
        : wellDrilledArmed
        ? `🎯 Click to drill every ${animal?.name || 'animal'} (+2 attack for the rest of combat).`
        : herdArmed
        ? `🦖 Click — every other single-slot animal becomes ${animal?.name || 'this'}.`
        : activatable
        ? `⚡ ${ability.label}`
        : (() => {
            const shownDur = Math.max(0, (card.durationRemaining || 0) - 1);
            return `${animal?.name || card.animalId} — ${animal?.desc || ''} ${shownDur} turn${shownDur === 1 ? '' : 's'} left.${predatorNote}`;
          })();
      const armedLabel = treatArmed ? ' · 🍖 click to treat'
                       : strengthenArmed ? ' · 💪 click to train'
                       : whistleArmed ? (isWhistlePick1 ? ' · 🎶' : ' · 🎶 click to swap')
                       : sacrificeArmed ? ' · 🔪 click to cash in'
                       : gorgeArmed ? ' · 🍖 click to gorge'
                       : wellDrilledArmed ? ' · 🎯 click to drill'
                       : herdArmed ? ' · 🦖 click: all become this'
                       : activatable ? ' · ⚡ click to activate'
                       : '';
      // Adjacency-combo cue — dotted green outline on both halves of a
      // pair that will fire a joint combo this turn.
      const comboHere = comboSlotInfo[slotName];
      return (
        <motion.button key={card.animalId + '-' + slotName}
          layout
          initial={{ scale: 0.5, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          onClick={clickHandler}
          data-testid="board-animal"
          data-animal-id={card.animalId}
          data-combo={comboHere ? comboHere.name : undefined}
          title={comboHere ? `${armedTitle}\n\n✨ ${comboHere.name} — ${comboHere.desc}` : armedTitle}
          className={`px-3 py-2 rounded text-parchment-50 text-xs flex flex-col items-center gap-0.5 min-w-[110px] max-w-[200px] ${
            armed
              ? (isWhistlePick1
                  ? 'bg-gold-900 border-2 border-gold-300 ring-2 ring-gold-400 animate-pulse-soft cursor-pointer'
                  : 'bg-gold-700 border-2 border-gold-300 ring-2 ring-gold-400 animate-pulse-soft cursor-pointer hover:bg-gold-600')
              : 'bg-ember-800 border border-ember-500 cursor-help'
          }`}>
          {armed && (
            <span className="font-mono text-[10px] opacity-70">{armedLabel.replace(/^ · /, '')}</span>
          )}
          <span className="font-bold text-center text-base">{(card.frozenTurns || 0) > 0 ? '❄ ' : ''}{animal?.icon} {animal?.name}</span>
          <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 rounded bg-parchment-100/95 text-ink-800 text-center leading-tight">
            {(card.frozenTurns || 0) > 0
              ? `❄ frozen — can't attack (${card.frozenTurns}t)`
              : (animal?.attack || 0) > 0
              ? `${effAnimalAttack(animal, card, slotName)} dmg / turn · ${Math.max(0, (card.durationRemaining || 0) - 1)}t left`
              : `(flops) · ${Math.max(0, (card.durationRemaining || 0) - 1)}t left`}
            {predatorNote}
          </span>
          {(() => {
            // Per-turn Block grant (keepers / McCloven / trained animals) — the
            // wall, shown as its own chip so the player can build around it.
            const effBlock = (animal?.turnGrant?.block || 0) + (card.blockBonus || 0);
            const effPoise = (animal?.turnGrant?.poise || 0) + (card.poiseBonus || 0);
            const trained = (card.attackBonus || 0) > 0 || (card.blockBonus || 0) > 0 || (card.poiseBonus || 0) > 0;
            // Exit-bonus legibility (Alan, 2026-06-08): surface what this animal
            // does WHEN IT LEAVES, on the board, so exits are something you plan
            // around — not a number buried in the log.
            const ex = animal?.onExit;
            const exBits = [];
            if (ex) {
              if (ex.damage > 0)        exBits.push(`💔${ex.damage}`);
              if (ex.block > 0)         exBits.push(`🛡${ex.block}`);
              if (ex.healComp > 0)      exBits.push(`💟${ex.healComp}`);
              if (ex.healHp > 0)        exBits.push(`❤${ex.healHp}`);
              if (ex.applyWeak > 0)     exBits.push(`💢weak`);
              if (ex.applyVulnerable>0) exBits.push(`💫vuln`);
              if (ex.redirectEnemyAttack) exBits.push(`↩`);
            }
            if (effBlock <= 0 && effPoise <= 0 && !trained && exBits.length === 0) return null;
            return (
              <span className="flex flex-wrap gap-1 justify-center mt-0.5">
                {effBlock > 0 && (
                  <span className="font-mono text-[9px] px-1 rounded bg-sky-900/70 text-sky-100 border border-sky-500"
                        title={`Braces for ${effBlock} Block each turn${trained ? ' (incl. training)' : ''}. Block absorbs HP / HP mauls.`}>
                    🛡 {effBlock}/turn
                  </span>
                )}
                {effPoise > 0 && (
                  <span className="font-mono text-[9px] px-1 rounded bg-iris-900/70 text-iris-100 border border-iris-500"
                        title={`Braces for ${effPoise} Poise each turn${trained ? ' (incl. training)' : ''}. Poise absorbs Composure / composure mauls.`}>
                    🧠 {effPoise}/turn
                  </span>
                )}
                {trained && (
                  <span className="font-mono text-[9px] px-1 rounded bg-gold-900/70 text-gold-100 border border-gold-500"
                        title={`Trained: +${card.attackBonus || 0} attack, +${card.blockBonus || 0} Block/turn, +${card.poiseBonus || 0} Poise/turn (lost if this animal leaves).`}>
                    💪 trained
                  </span>
                )}
                {exBits.length > 0 && (
                  <span className="font-mono text-[9px] px-1 rounded bg-rose-950/70 text-rose-100 border border-rose-700"
                        title={`When ${animal?.name || 'this animal'} leaves play (fed), it: ${exBits.join(' ')}.`}>
                    on exit: {exBits.join(' ')}
                  </span>
                )}
              </span>
            );
          })()}
          {(() => {
            // Lifespan pip-train (Human-AI rec 2026-06-02): show remaining
            // turns as a visible countdown FROM SUMMON, not just the text or
            // the "leaves" badge on the last turn. Filled = turns left.
            const remaining = Math.max(0, (card.durationRemaining || 0) - 1);
            const summonLife = Math.max(0, (animal?.duration ?? 1) - 1);
            const total = Math.max(remaining, summonLife, 1);
            return (
              <span className="flex gap-0.5 mt-0.5" title={`${remaining} of ${total} turn${total === 1 ? '' : 's'} left.`}>
                {Array.from({ length: total }).map((_, i) => (
                  <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${
                    i < remaining ? 'bg-gold-300' : 'bg-ember-950 border border-ember-600'
                  }`} />
                ))}
              </span>
            );
          })()}
          {/* Always-available Sacrifice — gain Block = this animal's current
              attack (no exit bonus). Hidden while a targeting prompt owns the
              click. A span (not a nested <button>) with stopPropagation so it
              doesn't trigger the pill's own onClick. */}
          {!anyPromptArmed && (animal?.attack || 0) > 0 && (() => {
            // Block gained = the animal's CURRENT attack (incl. Gorge + Well-
            // Drilled), matching App.sacrificeAnimalForBlock.
            const sacBlock = effAnimalAttack(animal, card, slotName);
            // Sacrifice-engine payoff preview (Alan 2026-06-08: make the loop
            // DISCOVERABLE at the point of action). Memorial fires on any exit;
            // Palpable Sadness fires on a sacrifice — both 4 comp to all.
            const hasMemorial = (powers || []).some(p => p.installPower?.id === 'memorial');
            const hasPalpable = (powers || []).some(p => p.installPower?.id === 'palpableSadness');
            const sacAoE = (hasMemorial ? 5 : 0) + (hasPalpable ? 4 : 0);
            // v3 slice 3: sacrifice now ALSO fires the animal's own exit bonus.
            // Surface it in the pill so the player knows what they're cashing.
            const exFx = animal?.onExit;
            const exParts = [];
            if (exFx) {
              if (exFx.damage > 0)         exParts.push(`💔${exFx.damage}`);
              if (exFx.block > 0)          exParts.push(`🛡${exFx.block}`);
              if (exFx.healComp > 0)       exParts.push(`💟${exFx.healComp}`);
              if (exFx.healHp > 0)         exParts.push(`❤${exFx.healHp}`);
              if (exFx.applyWeak > 0)      exParts.push(`💢weak`);
              if (exFx.applyVulnerable > 0) exParts.push(`💫vuln`);
              if (exFx.redirectEnemyAttack) exParts.push(`↩redirect`);
            }
            const exitClause = exParts.length > 0 ? ` PLUS its exit bonus (${exParts.join(' ')})` : '';
            const aoeClause = sacAoE > 0
              ? ` AND ${sacAoE} Composure to ALL enemies (${[hasMemorial && 'Memorial', hasPalpable && 'Palpable Sadness'].filter(Boolean).join(' + ')})`
              : '';
            const title = `Sacrifice ${animal?.name || 'this animal'}: +${sacBlock} Block${aoeClause}${exitClause}.`;
            return (
              <span role="button" tabIndex={0}
                data-testid="sacrifice-animal"
                onClick={(e) => { e.stopPropagation(); onSacrificeAnimal(slotName); }}
                title={title}
                className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer border ${
                  sacAoE > 0
                    ? 'bg-rose-900/80 text-rose-100 border-rose-400 hover:bg-rose-700 animate-pulse-soft'
                    : 'bg-iris-900/80 text-iris-100 border-iris-500 hover:bg-iris-700'
                }`}>
                <Icon name="block" /> sacrifice → +{sacBlock}{sacAoE > 0 && <span className="text-rose-200"> · 💔{sacAoE} all</span>}{exParts.length > 0 && <span className="text-rose-200"> · exit {exParts.join(' ')}</span>}
              </span>
            );
          })()}
          {animal?.feedKey && (() => {
            const FEED_NAMES = { 'small-land': 'Tender Greens', 'bird': 'Birdseed', 'fish': 'Fish Food' };
            const feedLabel = FEED_NAMES[animal.feedKey] || animal.feedKey;
            const feedReceived = !!card.feedReceived;
            const dur = card.durationRemaining;
            // The badge is a "do something / be aware" signal — never a
            // confirmation. Two states only (Alan, 2026-05-31):
            //   1. dur === 2 && !feedReceived → red "feed now" urgent.
            //   2. dur === 1 → yellow "leaves end of turn" notice.
            // A previously-fed animal staying at dur=2 (e.g. via Treat
            // bumping dur 1→2) used to flip the badge back to "fed" green
            // every turn — confusing. Now no badge once fed; the player
            // knows from their action + log that the feed happened.
            // v3 FEED BUTTON (Alan, 2026-06-08): when an animal is hungry
            // (its needs-food turn, dur===2 unfed), the player clicks to feed
            // its whole SPECIES for `feedCost` energy — resetting the timer so
            // it persists. No card needed. Past the deadline (dur===1) it's
            // committed to leave: feeding can't save it, just a notice.
            if (dur === 2 && !feedReceived) {
              const canAfford = playerEnergy >= feedCost;
              return (
                <span role="button" tabIndex={0}
                  data-testid="feed-species"
                  data-animal-id={card.animalId}
                  onClick={(e) => { e.stopPropagation(); if (canAfford) onFeedSpecies(card.animalId); }}
                  title={canAfford
                    ? `Feed every ${animal.name} on the board for ${feedCost} energy — tops up its timer so it stays. Skip it and ${animal.name} leaves next turn, unfeedable.`
                    : `Not enough energy to feed (${feedCost} needed).`}
                  className={`font-mono text-[10px] mt-0.5 px-1.5 py-0.5 rounded text-center leading-tight border ${
                    canAfford
                      ? 'bg-amber-700 text-amber-50 border-amber-300 cursor-pointer hover:bg-amber-600 animate-pulse-soft'
                      : 'bg-ember-950 text-ember-300 border-ember-700 opacity-70 cursor-not-allowed'
                  }`}>
                  🍴 feed {animal.name} ({feedCost}⚡)
                </span>
              );
            }
            if (dur === 1) {
              return (
                <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 rounded text-center leading-tight bg-gold-900 text-gold-200 border border-gold-500"
                      title={`${animal.name} missed its feed — it leaves end of turn no matter what (feeding can't save it now).${feedReceived ? ' Fires its exit action.' : ''}`}>
                  📅 leaves end of turn
                </span>
              );
            }
            return null;
          })()}
          {animal?.onExit && (() => {
            // Only surface the exit bonus on the ACTUAL exit turn (Alan,
            // 2026-06-07: "exit bonuses shouldn't be shown until the exit
            // turn"). Same gate the Σ strip + engine use: durationRemaining
            // === 1 AND the feed is satisfied (no feedKey, or fed). A badge
            // shown three turns early read as block the player already had.
            const isExitTurn = card.durationRemaining === 1
              && (!animal.feedKey || card.feedReceived);
            if (!isExitTurn) return null;
            const parts = [];
            if (animal.onExit.damage > 0) parts.push(`${animal.onExit.damage} ${animal.onExit.damageType === 'physical' ? '⚔' : '🎭'}`);
            if (animal.onExit.block > 0) parts.push(`+${animal.onExit.block} 🛡`);
            if (animal.onExit.applyWeak > 0) parts.push(`Weak ${animal.onExit.applyWeak}`);
            if (parts.length === 0) return null;
            return (
              <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 rounded bg-ember-100/90 text-ember-800 text-center leading-tight"
                    title={`Leaves this turn — on exit: ${parts.join(' · ')}.`}>
                ↩ exit: {parts.join(' · ')}
              </span>
            );
          })()}
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
    // 2026-06-07 fix: was `enemy?.block || 0` — but block lives in the
    // enemyBlock STATE, never on the enemy object, so the math bar's
    // "then −🛡" pill never rendered. Now reads the real prop.
    const enemyBlockNow = enemyBlock || 0;
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
            <div className="text-[10px] uppercase tracking-widest text-iris-300 font-bold">{isHandler ? <><Icon name="paw" /> Summoning Pitch</> : <><Icon name="scroll" /> Spell Tray</>}</div>
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
                  ? <span className="text-parchment-300">Your menagerie is on the pitch. Stage more lures, defend the slots.</span>
                  : <span className="text-parchment-400">(empty pitch — play a lure to summon an animal to a slot)</span>)
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
        {/* pb-3 when a combo is boxed: the "✨ Combo" tag hangs below the
            dotted border, and this overflow-x-auto container would clip it. */}
        <div className={`flex-1 flex flex-nowrap items-stretch gap-2 overflow-x-auto ${Object.keys(comboSlotInfo).length > 0 ? 'pb-3' : ''}`}>
        {(() => {
          // v3.5 (Alan): adjacency-combo cue = ONE dotted green box around
          // BOTH halves of the pair with "COMBO" labelled beneath, instead
          // of per-pill outlines. Group consecutive slots that share the
          // same detected combo into a wrapper; everything else renders as
          // plain siblings.
          const defs = [
            ['intro',   { empty: 'border-iris-600 text-iris-400', filled: 'bg-iris-700 hover:bg-iris-600 border border-iris-400' }],
            ['subject', { empty: 'border-iris-600 text-iris-400', filled: 'bg-iris-700 hover:bg-iris-600 border border-iris-400' }],
            ['target',  { empty: isHandler ? 'border-iris-600 text-iris-400' : 'border-ember-600 text-ember-500', filled: 'bg-ember-700 hover:bg-ember-600 border border-ember-400' }],
          ];
          const out = [];
          for (let i = 0; i < defs.length; i++) {
            const [name, color] = defs[i];
            const combo = comboSlotInfo[name];
            if (combo && i + 1 < defs.length && comboSlotInfo[defs[i + 1][0]] === combo) {
              const [name2, color2] = defs[i + 1];
              out.push(
                <div key={`combo-${name}`}
                     className="relative flex flex-nowrap gap-2 p-1.5 pb-2.5 rounded-lg border-2 border-dotted border-moss-400"
                     title={`✨ ${combo.name} — ${combo.desc}`}>
                  {slotPill(tray[name], name, color)}
                  {slotPill(tray[name2], name2, color2)}
                  <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-1.5 rounded bg-ink-800 text-[9px] uppercase tracking-widest font-bold text-moss-300 whitespace-nowrap">
                    ✨ Combo
                  </div>
                </div>
              );
              i++;
            } else {
              out.push(<span key={name} className="contents">{slotPill(tray[name], name, color)}</span>);
            }
          }
          return out;
        })()}
        {isHandler ? (
          tray.tactic ? (
            <button type="button"
                 onClick={onDiscardTactic}
                 className="px-3 py-2 rounded bg-gold-800 border-2 border-gold-400 text-parchment-50 text-xs flex flex-col items-center gap-0.5 min-w-[160px] max-w-[220px] hover:bg-gold-700 hover:border-rose-400 cursor-pointer group"
                 title={`${tray.tactic.desc || tray.tactic.flavor || ''}\n\nClick to discard this tactic.`}>
              <span className="font-mono text-[10px] opacity-70 group-hover:hidden">PACK TACTIC · active</span>
              <span className="font-mono text-[10px] text-rose-300 hidden group-hover:inline">✕ discard tactic</span>
              <span className="font-bold text-center text-sm">📜 {tray.tactic.name}</span>
              <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 rounded bg-parchment-100/95 text-ink-800 text-center leading-tight">
                {tray.tactic.usesRemaining != null
                  ? `${tray.tactic.usesRemaining} lure use${tray.tactic.usesRemaining === 1 ? '' : 's'} left`
                  : 'Stays until replaced'}
              </span>
            </button>
          ) : (
            <div className="px-3 py-2 rounded border border-dashed border-gold-600 text-gold-500 text-xs italic text-center min-w-[160px] flex flex-col items-center justify-center">
              <span className="font-bold uppercase tracking-widest opacity-80">Pack Tactic</span>
              <span className="text-[10px] mt-0.5 not-italic font-mono opacity-70">play a tactic card</span>
            </div>
          )
        ) : (<>
          {modifiers.map(m => slotPill(m, 'modifier', { empty: '', filled: 'bg-gold-700 hover:bg-gold-600 border border-gold-400' }))}
          {modifiers.length < 2 && slotPill(null, modifiers.length === 0 ? 'modifier (optional)' : 'modifier 2 (optional)', { empty: 'border-gold-600 text-gold-500', filled: '' })}
        </>)}
        {/* v3: feeding is now a per-species BUTTON on the hungry animal's
            pill (🍴 feed [species]), not a drag-to-slot. The old feed drop
            slots are removed. */}
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
                      <span className="text-xs text-ember-300 ml-1" title="Predator rider — enemy is Vulnerable or Weak."><Icon name="bleed" />+{predicted.predatorBonus}</span>
                    )}
                    {predicted.insultBonus > 0 && (
                      <span className="text-xs text-iris-300 ml-1"
                        title={`Insult-hit: ${(predicted.insultMatchedTags || []).slice(0, 3).join(', ')} (${Math.min(predicted.insultMatches || 0, 3)} match${(predicted.insultMatches || 0) === 1 ? '' : 'es'} × pierce).`}>
                        <Icon name="insult" />+{predicted.insultBonus}
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
            ready ? 'btn-iris cast-armed' : 'bg-ink-600 text-parchment-400 cursor-not-allowed'
          }`}>
          <Icon name="cast" className="mr-1" />CAST
          {/* Duo fights: say WHO the cast is aimed at, right on the button. */}
          {companion && (
            <span className="text-[10px] ml-1.5 font-mono normal-case">
              → {castTarget === 'companion' ? companion.def.name : enemy?.name}
            </span>
          )}
          {castsThisTurn > 0 && <span className="text-[10px] ml-1">(#{castsThisTurn + 1} this turn)</span>}
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
      {/* Handler — end-of-turn animal damage projection. Reads tray slots
          + active tactic, computes what each animal will inflict this turn
          and the total composure / block / recoil. */}
      {isHandler && (() => {
        const slotEntries = ['intro', 'subject', 'target']
          .map(s => ({ slotName: s, slot: tray?.[s] }))
          .filter(v => v.slot?.kind === 'animal');
        const slots = slotEntries.map(e => e.slot);
        if (slotEntries.length === 0) return null;
        const tacticId = tray?.tactic?.tactic?.id;
        const isShield = tacticId === 'shield';
        const isRabid  = tacticId === 'rabid';
        const lines = [];
        let totalDmg = 0;
        let totalBlock = 0;
        let totalRecoil = 0;
        let totalDraw = 0;
        for (const { slotName, slot } of slotEntries) {
          if (slot.eatenThisTurn) continue;
          const animal = animals?.[slot.animalId];
          if (!animal) continue;
          const atkMult = slot.nextAttackMult || 1;
          // Include Gorge's per-slot attackBonus, Well-Drilled's per-species
          // bonus, Summon Strength AND the Sheepdog adjacency amplify so this
          // strip matches the board pill (effAnimalAttack) and the real tick.
          const amp = adjAmpMult(slotName);
          const baseWithBonus = (animal.attack || 0) > 0
            ? (animal.attack || 0) + (slot.attackBonus || 0) + 2 * (drilledSpecies[slot.animalId] || 0) + (summonStrength || 0)
            : (animal.attack || 0);
          let atk = Math.round(baseWithBonus * atkMult * amp);
          if (isRabid) atk = Math.round(atk * 1.5);
          const parts = [];
          if (animal.attack > 0) {
            if (isShield) {
              totalBlock += atk;
              parts.push(`+${atk} block`);
            } else {
              totalDmg += atk;
              parts.push(`${atk} dmg`);
            }
          }
          // On Three! (Alan, 2026-06-02 / amplified 2026-06-09): each armed
          // extra attack resolves on the animals' turn as a FULL amplified swing
          // — base+bonuses × Sheepdog amp (the real tick uses baseAtk × ampMult).
          // Only the one-shot nextAttackMult is spent by the natural swing above.
          const extraAttacks = slot.extraAttacks || 0;
          if (animal.attack > 0 && extraAttacks > 0) {
            let xatk = Math.round(baseWithBonus * amp);
            if (isRabid) xatk = Math.round(xatk * 1.5);
            const xTotal = xatk * extraAttacks;
            if (isShield) {
              totalBlock += xTotal;
              parts.push(`+${xTotal} block (On Three!)`);
            } else {
              totalDmg += xTotal;
              parts.push(`+${xTotal} dmg (On Three!)`);
            }
          }
          // Per-turn grants (Long Hare poise, McCloven block, Tender Greens
          // row-bonus +3 block).
          const grant = animal.turnGrant || slot.turnGrantTemp;
          if (grant) {
            if (grant.block > 0) {
              totalBlock += grant.block;
              parts.push(`+${grant.block} block`);
            }
            if (grant.poise > 0) {
              parts.push(`+${grant.poise} poise`);
            }
          }
          if (isRabid && !isShield) {
            const r = Math.max(1, Math.round(atk * 0.2));
            totalRecoil += r;
            parts.push(`-${r} self`);
          }
          if (animal.onAttack?.draw) {
            totalDraw += animal.onAttack.draw;
            parts.push(`+${animal.onAttack.draw} 📥`);
          }
          if (animal.onAttackEffect?.applyVulnerable > 0) {
            parts.push(`Vuln ${animal.onAttackEffect.applyVulnerable}`);
          }
          if (animal.onAttackEffect?.applyWeak > 0) {
            parts.push(`Weak ${animal.onAttackEffect.applyWeak}`);
          }
          // Exit-bonus preview: if this is the animal's LAST turn (duration 1
          // ticking to 0) AND it carries feedReceived (set when fed during
          // its dur=2 turn), surface the onExit damage / block / weak in the
          // per-animal line and the total.
          const willHaveFeed = !animal.feedKey || slot.feedReceived;
          if (slot.durationRemaining === 1 && willHaveFeed && animal.onExit) {
            const ex = animal.onExit;
            if (ex.damage > 0) {
              if (isShield) {
                totalBlock += ex.damage;
                parts.push(`+${ex.damage} block on exit`);
              } else {
                totalDmg += ex.damage;
                parts.push(`+${ex.damage} dmg on exit`);
              }
            }
            if (ex.block > 0) {
              totalBlock += ex.block;
              parts.push(`+${ex.block} block on exit`);
            }
            if (ex.applyWeak > 0) {
              parts.push(`Weak ${ex.applyWeak} on exit`);
            }
            if (ex.healComp > 0) {
              parts.push(`+${ex.healComp} comp on exit`);
            }
            if (ex.healHp > 0) {
              parts.push(`+${ex.healHp} HP on exit`);
            }
          }
          if (parts.length === 0) continue;
          // v3.5 (Alan): icon only — the pill on the board already names
          // the animal; repeating it here just made the strip longer.
          lines.push(`${animal.icon} ${parts.join(' · ')}${atkMult > 1 ? ` (×${atkMult})` : ''}`);
        }
        // Adjacency combos — two specific species in neighbouring slots fire a
        // joint special attack once per pair-type. Mirrors the App.jsx
        // end-of-turn pre-pass; surfaced as its own chip so the projected
        // total reflects the combo (per the no-hidden-math rule).
        const order = ['intro', 'subject', 'target'];
        const comboSeen = new Set();
        for (let i = 0; i < order.length - 1; i++) {
          const sA = tray?.[order[i]];
          const sB = tray?.[order[i + 1]];
          if (!sA || sA.kind !== 'animal' || sA.eatenThisTurn) continue;
          if (!sB || sB.kind !== 'animal' || sB.eatenThisTurn) continue;
          const combo = ADJACENCY_COMBOS.find(c =>
            (c.a === sA.animalId && c.b === sB.animalId) ||
            (c.a === sB.animalId && c.b === sA.animalId));
          if (!combo) continue;
          const key = [combo.a, combo.b].sort().join('+');
          if (comboSeen.has(key)) continue;
          comboSeen.add(key);
          const cParts = [];
          if (combo.damage > 0) {
            if (isShield) { totalBlock += combo.damage; cParts.push(`+${combo.damage} block`); }
            else { totalDmg += combo.damage; cParts.push(`${combo.damage} dmg`); }
          }
          if (combo.applyWeak > 0) cParts.push(`Weak ${combo.applyWeak}`);
          if (combo.applyVulnerable > 0) cParts.push(`Vuln ${combo.applyVulnerable}`);
          if (combo.draw > 0) { totalDraw += combo.draw; cParts.push(`+${combo.draw} 📥`); }
          if (combo.block > 0) { totalBlock += combo.block; cParts.push(`+${combo.block} block`); }
          lines.push(`✨ COMBO ${combo.name}: ${cParts.join(' · ')}`);
        }
        // Memorial (sacrifice engine) — surface the passive AoE so the player
        // SEES the engine: every animal leaving this turn deals 4 comp to all.
        // durationRemaining === 1 ticks to 0 → departs this end-of-turn.
        const hasMemorial = (powers || []).some(p => p.installPower?.id === 'memorial');
        if (hasMemorial) {
          const leaving = slots.filter(s => (s.durationRemaining || 0) === 1).length;
          if (leaving > 0) lines.push(`⚰️ Memorial: ${leaving * 5} comp to all (${leaving} leaving)`);
        }
        if (lines.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-[11px] font-mono border-b border-ink-600 pb-1 mb-0.5">
            <span className="text-[10px] uppercase tracking-widest text-moss-300 font-bold">🐾 This turn</span>
            {lines.map((l, i) => (
              <span key={i} className="text-parchment-200">{l}</span>
            ))}
            <span className="ml-auto text-[11px] text-parchment-100 font-bold">
              Σ {totalDmg > 0 && <span className="text-iris-200">{totalDmg} dmg</span>}
              {totalDmg > 0 && enemyBlock > 0 && (
                <span className="text-parchment-400 ml-1"
                      title={`Enemy Block soaks ${Math.min(enemyBlock, totalDmg)} of this before it lands.`}>
                  −<Icon name="block" />{Math.min(enemyBlock, totalDmg)}
                </span>
              )}
              {totalBlock > 0 && <span className="text-moss-200 ml-1">+{totalBlock} block</span>}
              {totalDraw > 0 && <span className="text-moss-200 ml-1">+{totalDraw} draw</span>}
              {totalRecoil > 0 && <span className="text-ember-300 ml-1">-{totalRecoil} self</span>}
              {tacticId && <span className="ml-2 text-gold-200 italic">[{tray.tactic.name}]</span>}
            </span>
          </div>
        );
      })()}
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
      {/* v3.5 — math bar rebuilt in the Incoming bar's pill language.
          Same contributions as before (v2.79 rule: every rider stays
          visible) but rendered as UNIFORM pills with the raw formula
          tucked into tooltips, instead of loose ×/+/= arithmetic soup.
          Also de-duped: enemy-eff and Vuln/Weak multipliers were shown
          twice (once from mathBreakdown, once via damageParts) — now
          damageParts is the single source since it reflects the actual
          rounding applied to the Predicted number. */}
      {mathBreakdown && (() => {
        const pill = (key, cls, text, title) => (
          <span key={key} className={`px-1.5 py-0.5 rounded ${cls} cursor-help`} title={title}>{text}</span>
        );
        const pills = [];
        pills.push(pill('cast', 'bg-ink-700 text-parchment-100',
          <><Icon name="cast" /> cast {mathBreakdown.preTier}</>,
          `${mathBreakdown.baseDmg} base + ${mathBreakdown.statTotal} stat × ${mathBreakdown.mult} target multiplier = ${mathBreakdown.preTier}.`));
        if (tierMult !== 1) pills.push(pill('tier', 'bg-iris-900 text-iris-100',
          `T${tier} ×${tierMult.toFixed(1)}`,
          `Tier ${tier} multiplier — earned by tag-cohesive intro/subject/target.`));
        if (mathBreakdown.tagBonus > 0) pills.push(pill('tag', 'bg-iris-900 text-iris-100',
          `✦ +${mathBreakdown.tagBonus}`, 'Tag-resonance bonus from matching tags in the tray.'));
        if (predicted.predatorBonus > 0) pills.push(pill('pred', 'bg-ember-800 text-ember-100',
          <><Icon name="bleed" /> +{predicted.predatorBonus}</>, 'Predator rider — the enemy is already debuffed.'));
        if (predicted.insultBonus > 0) pills.push(pill('insult', 'bg-iris-800 text-iris-100',
          <><Icon name="insult" /> +{predicted.insultBonus}</>,
          `Insult-hit: ${(predicted.insultMatchedTags || []).slice(0, 3).join(', ')} — this enemy is touchy about it.`));
        // FFT riders + eff/Vuln multipliers — already baked into Predicted.
        (predicted.damageParts || []).forEach((part, pi) => {
          pills.push(pill(`rp-${pi}`, 'bg-gold-900 text-gold-200 font-bold',
            part.startsWith('×') || part.startsWith('+') ? part : '+ ' + part,
            `Rider — ${part}. Already included in the Predicted number.`));
        });
        pills.push(pill('net', 'bg-iris-800 text-parchment-50 font-bold border border-iris-400',
          `→ ${predicted.damage}`, 'Predicted damage after everything above.'));
        // These two fire AT CAST TIME, after the Predicted number — shown
        // last so the bar doesn't imply they're already in the total.
        if (mathBreakdown.secondCastScalar !== 1) pills.push(pill('c2', 'bg-ember-900 text-ember-200',
          `then ×0.6`,
          `Cast #${castsThisTurn + 1} this turn — each cast after the first lands at 60%.`));
        if (mathBreakdown.enemyBlock > 0) pills.push(pill('blk', 'bg-ink-700 text-parchment-100',
          <>then <Icon name="block" /> −{mathBreakdown.enemyBlock}</>,
          `Enemy Block ${mathBreakdown.enemyBlock} absorbs first — what's left lands on the pool.`));
        return (
          <div className="flex flex-wrap gap-1.5 items-center text-[11px] font-mono"
               title="Where the Predicted number comes from, step by step.">
            <span className="text-[10px] uppercase tracking-widest text-iris-300">Math</span>
            {pills}
          </div>
        );
      })()}
      {enemy && (() => {
        const chips = [];
        if (enemy.phaseShifted) chips.push({ key: 'phase', label: '🕸 thinned', tone: 'text-ember-300' });
        if (enemy.annotation) chips.push({ key: 'ann', label: `📝 ${enemy.annotation.cardName || 'annotated'} (${enemy.annotation.turnsRemaining}t)`, tone: 'text-iris-300' });
        if (weaveStacks > 0) chips.push({ key: 'weave', label: `🪡 Weave ${weaveStacks}`, tone: 'text-ember-300', tooltip: `Weave debt: ${weaveStacks}. Fires for ${weaveStacks} composure damage at the end of this turn UNLESS you deal damage to the Weaver — a landed cast or an animal attack clears it harmlessly.` });
        if (riposteCharge > 0) chips.push({ key: 'rip', label: `🛡⚔ Reflexes ${riposteCharge}`, tone: 'text-iris-300' });
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
