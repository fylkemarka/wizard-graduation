// Wizard Graduation — STS-inspired single-player roguelike deckbuilder.
//
// Single-file App for early iteration; will split when systems stabilize.
// Sections in order:
//   1. DATA — cards, enemies, starter deck, acts (stubbed for MVP1)
//   2. HELPERS — shuffle, clamp, uid, intent rolling
//   3. App component — state + combat loop + card UI

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// 1. DATA
// =============================================================================

// Cards are the only stat-bearing unit in MVP1. Each carries an `effects`
// payload that the combat loop's applyEffects() dispatcher reads.
// Effect keys supported in MVP1:
//   attack    — deal N damage to the active enemy (after Block)
//   block     — gain N temporary Block (resets at start of next turn)
//   draw      — draw N cards from your deck (auto-reshuffle from discard)
//   vulnerable— stack N Vulnerable on the enemy (takes +50% next attack)
//   weak      — stack N Weak on the enemy (deals -25% on next attack)
//   energy    — gain N energy this turn
//   exhaust   — the card is exiled (single-use) after play
//
// Rarities: basic (in starter deck) / common / uncommon / rare. Reward picks
// roll weighted toward common in early acts.
const CARDS = [
  // ---- BASIC STARTER CARDS ----
  { id: 'c-strike',   name: 'Strike',   cost: 1, type: 'attack', rarity: 'basic',
    effects: { attack: 6 }, desc: 'Deal 6 damage.' },
  { id: 'c-defend',   name: 'Defend',   cost: 1, type: 'skill',  rarity: 'basic',
    effects: { block: 5 }, desc: 'Gain 5 Block.' },
  { id: 'c-spark',    name: 'Spark',    cost: 0, type: 'attack', rarity: 'basic',
    effects: { attack: 3 }, desc: 'Deal 3 damage. (Free)' },

  // ---- COMMON POOL (card rewards from combat) ----
  { id: 'c-arc-bolt', name: 'Arc Bolt', cost: 1, type: 'attack', rarity: 'common',
    effects: { attack: 4, weak: 1 }, desc: 'Deal 4 damage. Apply 1 Weak.' },
  { id: 'c-hex-lance',name: 'Hex Lance',cost: 2, type: 'attack', rarity: 'common',
    effects: { attack: 9 }, desc: 'Deal 9 damage.' },
  { id: 'c-mend',     name: 'Mend',     cost: 1, type: 'skill',  rarity: 'common',
    effects: { block: 7 }, desc: 'Gain 7 Block.' },
  { id: 'c-acuity',   name: 'Acuity',   cost: 1, type: 'skill',  rarity: 'common',
    effects: { draw: 2 }, desc: 'Draw 2 cards.' },
  { id: 'c-piercing', name: 'Piercing', cost: 1, type: 'attack', rarity: 'common',
    effects: { attack: 5, vulnerable: 1 }, desc: 'Deal 5 damage. Apply 1 Vulnerable.' },

  // ---- UNCOMMON POOL ----
  { id: 'c-fireball', name: 'Fireball', cost: 2, type: 'attack', rarity: 'uncommon',
    effects: { attack: 14 }, desc: 'Deal 14 damage.' },
  { id: 'c-bulwark',  name: 'Bulwark',  cost: 1, type: 'skill',  rarity: 'uncommon',
    effects: { block: 10 }, desc: 'Gain 10 Block.' },
  { id: 'c-meditate', name: 'Meditate', cost: 0, type: 'skill',  rarity: 'uncommon',
    effects: { energy: 1, draw: 1, exhaust: true }, desc: 'Gain 1 Energy. Draw 1. Exhaust.' },
  { id: 'c-warding',  name: 'Warding Glyph', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 4, vulnerable: 1 }, desc: 'Gain 4 Block. Apply 1 Vulnerable.' },

  // ---- RARE POOL ----
  { id: 'c-arcane-pulse', name: 'Arcane Pulse', cost: 2, type: 'attack', rarity: 'rare',
    effects: { attack: 12, weak: 2 }, desc: 'Deal 12 damage. Apply 2 Weak.' },
  { id: 'c-immolate',     name: 'Immolate',     cost: 2, type: 'attack', rarity: 'rare',
    effects: { attack: 18, exhaust: true }, desc: 'Deal 18 damage. Exhaust.' },
];

const CARDS_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

const STARTER_DECK = [
  'c-strike', 'c-strike', 'c-strike', 'c-strike',
  'c-defend', 'c-defend', 'c-defend',
  'c-spark', 'c-spark',
];

// Enemies for MVP1. Each carries `behaviors` — a list of possible turn-actions
// the AI rolls from. `intent` is set at the start of every enemy turn so the
// player sees what's coming next. Behavior keys mirror the card effect keys
// where relevant (attack, block) plus enemy-specific (debuff_strength etc.).
const ENEMIES = [
  { id: 'e-acolyte',  name: 'Lost Acolyte', maxHp: 22, behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
    ] },
  { id: 'e-tutor',    name: 'Stern Tutor',  maxHp: 30, behaviors: [
      { kind: 'attack', value: 7, weight: 3, telegraph: '⚔ 7' },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 6, weight: 1, telegraph: '🛡 6' },
    ] },
  { id: 'e-imp',      name: 'Pact Imp',     maxHp: 18, behaviors: [
      { kind: 'attack', value: 4, weight: 3, telegraph: '⚔ 4' },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '🌀 Weak 1' },
    ] },
  // Boss for Act 1 — placeholder until acts are wired up.
  { id: 'e-boss-thornlord', name: 'The Thornlord', maxHp: 50, isBoss: true, behaviors: [
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11' },
      { kind: 'attack-multi', value: 4, count: 3, weight: 2, telegraph: '⚔ 4×3' },
      { kind: 'block',  value: 12, weight: 1, telegraph: '🛡 12' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🌀 Vulnerable 2' },
    ] },
];

const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

// MVP1 placeholder — just a sequence of 3 normal fights then the boss.
// Real act/path/DAG comes in MVP2.
const MVP_FIGHT_QUEUE = [
  'e-acolyte', 'e-imp', 'e-tutor', 'e-boss-thornlord',
];

// =============================================================================
// 2. HELPERS
// =============================================================================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
let _uid = 0;
const uid = () => `u${++_uid}`;

// Roll the next intent for an enemy based on weighted behavior list.
function rollIntent(enemy) {
  const total = enemy.behaviors.reduce((s, b) => s + (b.weight || 1), 0);
  let roll = Math.random() * total;
  for (const b of enemy.behaviors) {
    roll -= (b.weight || 1);
    if (roll <= 0) return { ...b };
  }
  return { ...enemy.behaviors[0] };
}

function buildStartingDeck() {
  return shuffle(STARTER_DECK.map(id => ({ ...CARDS_BY_ID[id], uid: uid() })));
}

// =============================================================================
// 3. App
// =============================================================================

const MAX_HP = 60;
const ENERGY_PER_TURN = 3;
const HAND_SIZE = 5;

export default function App() {
  // Run-level state
  const [stage, setStage] = useState('menu'); // 'menu' | 'combat' | 'reward' | 'victory' | 'defeat'
  const [fightIdx, setFightIdx] = useState(0);

  // Player state (resets on new run)
  const [hp, setHp] = useState(MAX_HP);
  const [block, setBlock] = useState(0);
  const [energy, setEnergy] = useState(ENERGY_PER_TURN);
  const [deck, setDeck] = useState([]);
  const [hand, setHand] = useState([]);
  const [discard, setDiscard] = useState([]);
  const [exiled, setExiled] = useState([]);

  // Combat state
  const [enemy, setEnemy] = useState(null);
  const [enemyHp, setEnemyHp] = useState(0);
  const [enemyBlock, setEnemyBlock] = useState(0);
  const [enemyIntent, setEnemyIntent] = useState(null);
  const [enemyVulnerable, setEnemyVulnerable] = useState(0); // takes +50% next attack
  const [enemyWeak, setEnemyWeak] = useState(0); // -25% to its next attack

  // Reward state
  const [rewardChoices, setRewardChoices] = useState([]);

  // Log lines for the player
  const [log, setLog] = useState([]);
  const pushLog = (s) => setLog(prev => [...prev.slice(-20), s]);

  // ---------- RUN LIFECYCLE ----------
  function startRun() {
    const startDeck = buildStartingDeck();
    setHp(MAX_HP);
    setEnergy(ENERGY_PER_TURN);
    setBlock(0);
    setDeck(startDeck);
    setHand([]);
    setDiscard([]);
    setExiled([]);
    setFightIdx(0);
    setLog([]);
    enterFight(0, startDeck);
  }

  function enterFight(idx, deckArg) {
    const enemyTemplate = ENEMIES_BY_ID[MVP_FIGHT_QUEUE[idx]];
    if (!enemyTemplate) { setStage('victory'); return; }
    const e = { ...enemyTemplate };
    setEnemy(e);
    setEnemyHp(e.maxHp);
    setEnemyBlock(0);
    setEnemyVulnerable(0);
    setEnemyWeak(0);
    setEnemyIntent(rollIntent(e));
    // Start of combat: reset block, full energy, draw a fresh hand.
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    const drawn = drawFromPiles(deckArg, [], HAND_SIZE);
    setDeck(drawn.deck);
    setHand(drawn.hand);
    setDiscard([]);
    setStage('combat');
    pushLog(`⚔ Combat begins — ${e.name} (HP ${e.maxHp}).`);
  }

  // Draw N cards from a deck/discard pair. Returns the new deck/discard/hand
  // arrays. Reshuffles discard into deck when deck runs out.
  function drawFromPiles(deckIn, discardIn, n, handIn = []) {
    let deck = [...deckIn];
    let discard = [...discardIn];
    let hand = [...handIn];
    for (let i = 0; i < n; i++) {
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck = shuffle(discard);
        discard = [];
      }
      const c = deck.shift();
      hand.push({ ...c, uid: uid() });
    }
    return { deck, discard, hand };
  }

  // ---------- CARD PLAY ----------
  function playCard(handIdx) {
    if (stage !== 'combat') return;
    const card = hand[handIdx];
    if (!card) return;
    if (card.cost > energy) {
      pushLog(`Not enough energy for ${card.name}.`);
      return;
    }
    const fx = card.effects || {};

    // Pay energy first.
    setEnergy(e => e - card.cost);

    // Apply effects in order.
    let logBits = [card.name];

    if (fx.attack) {
      const damage = computeAttackDamage(fx.attack);
      const after = applyDamageToEnemy(damage);
      logBits.push(`⚔ ${damage} → ${after} HP`);
    }
    if (fx.block) {
      setBlock(b => b + fx.block);
      logBits.push(`🛡 +${fx.block}`);
    }
    if (fx.vulnerable) {
      setEnemyVulnerable(v => v + fx.vulnerable);
      logBits.push(`🌀 +${fx.vulnerable} Vulnerable`);
    }
    if (fx.weak) {
      setEnemyWeak(w => w + fx.weak);
      logBits.push(`🌀 +${fx.weak} Weak`);
    }
    if (fx.energy) {
      setEnergy(e => e + fx.energy);
      logBits.push(`+${fx.energy} Energy`);
    }
    if (fx.draw) {
      setTimeout(() => {
        // Read latest piles via setters
        setDeck(d => {
          let deckNext = d;
          let discardNext = null;
          let handNext = null;
          setDiscard(disc => {
            setHand(h => {
              const r = drawFromPiles(deckNext, disc, fx.draw, h);
              deckNext = r.deck;
              discardNext = r.discard;
              handNext = r.hand;
              return r.hand;
            });
            return discardNext ?? disc;
          });
          return deckNext;
        });
      }, 0);
      logBits.push(`+${fx.draw} draw`);
    }

    // Remove from hand; route to discard or exiled.
    setHand(h => h.filter((_, i) => i !== handIdx));
    if (fx.exhaust) {
      setExiled(ex => [...ex, card]);
    } else {
      setDiscard(d => [...d, card]);
    }

    pushLog(logBits.join(' · '));
  }

  // Compute attack damage with Weak modifier (player's debuff TO enemy doesn't
  // affect player's damage out; only enemy's outgoing attacks are affected by
  // Weak. Here Vulnerable on enemy boosts our incoming damage to it.)
  function computeAttackDamage(base) {
    let dmg = base;
    if (enemyVulnerable > 0) dmg = Math.ceil(dmg * 1.5);
    return dmg;
  }

  // Apply damage through enemy Block to HP. Returns the resulting HP for log.
  function applyDamageToEnemy(damage) {
    let remaining = damage;
    let newBlock = enemyBlock;
    let newHp = enemyHp;
    if (newBlock > 0) {
      const absorbed = Math.min(newBlock, remaining);
      newBlock -= absorbed;
      remaining -= absorbed;
    }
    newHp = Math.max(0, newHp - remaining);
    setEnemyBlock(newBlock);
    setEnemyHp(newHp);
    if (newHp <= 0) {
      setTimeout(() => onEnemyDefeated(), 200);
    }
    return newHp;
  }

  // ---------- END TURN ----------
  function endTurn() {
    if (stage !== 'combat') return;
    // Resolve enemy intent.
    const intent = enemyIntent;
    if (intent) {
      applyEnemyIntent(intent);
    }
    if (hp <= 0) return; // KO already handled

    // End-of-turn cleanup: decrement debuffs on enemy.
    setEnemyVulnerable(v => Math.max(0, v - 1));
    setEnemyWeak(w => Math.max(0, w - 1));

    // Discard remaining hand.
    setDiscard(d => [...d, ...hand]);
    setHand([]);

    // Reset block for new turn.
    setBlock(0);

    // Refill energy.
    setEnergy(ENERGY_PER_TURN);

    // Draw a fresh hand.
    setTimeout(() => {
      setDeck(d => {
        let result;
        setDiscard(disc => {
          result = drawFromPiles(d, disc, HAND_SIZE);
          return result.discard;
        });
        setHand(result.hand);
        return result.deck;
      });
    }, 0);

    // Roll new intent for next enemy turn.
    if (enemy) setEnemyIntent(rollIntent(enemy));
  }

  function applyEnemyIntent(intent) {
    const e = enemy;
    if (!e) return;
    if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
      const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
      let raw = intent.value;
      if (enemyWeak > 0) raw = Math.floor(raw * 0.75);
      for (let i = 0; i < hits; i++) {
        applyDamageToPlayer(raw);
      }
      pushLog(`👹 ${e.name}: ${intent.telegraph} → ${raw * hits} raw`);
    } else if (intent.kind === 'block') {
      setEnemyBlock(b => b + intent.value);
      pushLog(`👹 ${e.name}: 🛡 +${intent.value}`);
    } else if (intent.kind === 'vulnerable') {
      pushLog(`👹 ${e.name}: 🌀 Vulnerable +${intent.value} (player)`);
    } else if (intent.kind === 'weak') {
      pushLog(`👹 ${e.name}: 🌀 Weak +${intent.value} (player)`);
    }
  }

  function applyDamageToPlayer(damage) {
    let remaining = damage;
    let newBlock = block;
    let newHp = hp;
    if (newBlock > 0) {
      const absorbed = Math.min(newBlock, remaining);
      newBlock -= absorbed;
      remaining -= absorbed;
    }
    newHp = Math.max(0, newHp - remaining);
    setBlock(newBlock);
    setHp(newHp);
    if (newHp <= 0) {
      setTimeout(() => setStage('defeat'), 200);
    }
  }

  // ---------- POST-COMBAT ----------
  function onEnemyDefeated() {
    pushLog(`✓ ${enemy.name} defeated.`);
    // Roll 3 card-reward picks weighted toward common.
    const isBoss = !!enemy.isBoss;
    if (isBoss) {
      // Boss — for now, advance straight to next fight or victory.
      pushLog(`👑 You overcame ${enemy.name}!`);
      if (fightIdx + 1 >= MVP_FIGHT_QUEUE.length) {
        setStage('victory');
      } else {
        setFightIdx(i => i + 1);
        // Next fight after a brief pause
        setTimeout(() => enterFight(fightIdx + 1, deck.concat(hand, discard)), 500);
      }
      return;
    }
    const pool = CARDS.filter(c => c.rarity === 'common' || c.rarity === 'uncommon');
    const weights = { common: 4, uncommon: 1 };
    // Sample 3 distinct cards
    const choices = [];
    const remaining = [...pool];
    while (choices.length < 3 && remaining.length > 0) {
      const total = remaining.reduce((s, c) => s + weights[c.rarity], 0);
      let r = Math.random() * total;
      for (let i = 0; i < remaining.length; i++) {
        r -= weights[remaining[i].rarity];
        if (r <= 0) {
          choices.push(remaining[i]);
          remaining.splice(i, 1);
          break;
        }
      }
    }
    setRewardChoices(choices);
    setStage('reward');
  }

  function pickReward(cardOrSkip) {
    let newDeck = [...deck, ...hand, ...discard, ...(exiled || [])];
    // Combat-end: exiled cards return to deck for next fight (MVP1 simplification).
    if (cardOrSkip) {
      newDeck.push({ ...cardOrSkip, uid: uid() });
      pushLog(`+ ${cardOrSkip.name} added to deck.`);
    } else {
      pushLog(`Skipped reward.`);
    }
    setRewardChoices([]);
    setFightIdx(i => i + 1);
    setTimeout(() => enterFight(fightIdx + 1, shuffle(newDeck)), 300);
  }

  // ---------- RENDER ----------
  if (stage === 'menu') {
    return <MenuScreen onStart={startRun} />;
  }
  if (stage === 'defeat') {
    return <EndScreen win={false} onRetry={startRun} />;
  }
  if (stage === 'victory') {
    return <EndScreen win={true} onRetry={startRun} />;
  }
  if (stage === 'reward') {
    return <RewardScreen choices={rewardChoices} onPick={pickReward} />;
  }

  // Combat UI
  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-6xl mx-auto">
      {/* Top bar */}
      <div className="flex justify-between items-center parchment-card px-4 py-2">
        <h1 className="font-display text-2xl text-gold-300 tracking-wide">Wizard Graduation</h1>
        <div className="text-xs text-parchment-300">
          Fight {fightIdx + 1} / {MVP_FIGHT_QUEUE.length}
        </div>
      </div>

      {/* Enemy panel */}
      {enemy && (
        <div className="parchment-card-strong p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-display text-2xl text-ember-300">{enemy.name}</div>
              <div className="text-xs text-parchment-300 italic">
                {enemy.isBoss ? 'Boss' : 'Enemy'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-mono text-ember-400">{enemyHp} <span className="text-sm text-parchment-300">/ {enemy.maxHp}</span></div>
              <div className="text-sm">🛡 {enemyBlock}</div>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <div className="px-3 py-2 bg-ember-900 bg-opacity-60 rounded border border-ember-700">
              <div className="text-[10px] uppercase text-ember-300 tracking-widest">Intent</div>
              <div className="text-lg text-parchment-50">{enemyIntent?.telegraph || '...'}</div>
            </div>
            {enemyVulnerable > 0 && <span className="px-2 py-1 bg-iris-700 text-parchment-50 rounded text-xs">🌀 Vulnerable {enemyVulnerable}</span>}
            {enemyWeak > 0 && <span className="px-2 py-1 bg-iris-700 text-parchment-50 rounded text-xs">🌀 Weak {enemyWeak}</span>}
          </div>
        </div>
      )}

      {/* Player stats */}
      <div className="parchment-card p-3 flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <div>
            <div className="text-[10px] uppercase text-parchment-300">HP</div>
            <div className="text-xl font-mono text-moss-300">{hp} <span className="text-xs text-parchment-300">/ {MAX_HP}</span></div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-parchment-300">Block</div>
            <div className="text-xl font-mono text-iris-300">🛡 {block}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-parchment-300">Energy</div>
            <div className="text-xl font-mono text-gold-300">⚡ {energy} / {ENERGY_PER_TURN}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-parchment-300">Deck</div>
            <div className="text-sm font-mono text-parchment-200">{deck.length} ▸ {discard.length}</div>
          </div>
        </div>
        <button onClick={endTurn} className="btn btn-ember">End Turn</button>
      </div>

      {/* Hand */}
      <div className="flex gap-2 flex-wrap min-h-[160px] items-center justify-center">
        {hand.map((card, i) => {
          const playable = card.cost <= energy;
          return (
            <motion.button
              key={card.uid}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={() => playCard(i)}
              disabled={!playable}
              className={`w-36 h-48 rounded-lg border-2 p-2 text-left flex flex-col gap-1 shadow-lg transition-all ${
                playable
                  ? 'bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl cursor-pointer'
                  : 'bg-ink-600 text-parchment-400 border-ink-500 opacity-50 cursor-not-allowed'
              }`}>
              <div className="flex justify-between items-center">
                <div className="font-display text-sm">{card.name}</div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm ${playable ? 'bg-gold-500 text-ink-800' : 'bg-ink-500 text-parchment-300'}`}>
                  {card.cost}
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">{card.type}</div>
              <div className="text-xs flex-1 font-quill">{card.desc}</div>
              {card.effects?.exhaust && (
                <div className="text-[10px] italic text-ember-700">Exhaust</div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Log */}
      <div className="parchment-card p-3 max-h-32 overflow-y-auto text-xs font-quill text-parchment-200 space-y-0.5">
        {log.slice(-10).map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-screens
// =============================================================================

function MenuScreen({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="font-display text-6xl text-gold-300 tracking-widest text-center">Wizard Graduation</h1>
      <p className="font-quill text-parchment-200 italic max-w-xl text-center">
        The school has taught you what it can. To graduate, you must walk the
        Path of Mastery — gather your staff, robes, gem, and ring, each from
        a trial worthier than the last. Every step forward sharpens the
        opposition; every step back leaves you wanting.
      </p>
      <button onClick={onStart} className="btn btn-gold text-lg px-8 py-3">Begin the Path</button>
      <p className="text-xs text-parchment-400">MVP 1 — single combat chain. Map and acts come next.</p>
    </div>
  );
}

function RewardScreen({ choices, onPick }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-3xl mx-auto">
      <h2 className="font-display text-3xl text-gold-300">Card Reward</h2>
      <p className="text-sm text-parchment-300 italic">Choose one card to add to your deck — or skip.</p>
      <div className="flex gap-4 flex-wrap justify-center">
        {choices.map((card, i) => (
          <button key={i} onClick={() => onPick(card)}
            className="w-44 h-60 rounded-lg border-2 p-3 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl transition">
            <div className="flex justify-between items-center">
              <div className="font-display text-base">{card.name}</div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">
                {card.cost}
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400">{card.type} · {card.rarity}</div>
            <div className="text-xs flex-1 font-quill">{card.desc}</div>
          </button>
        ))}
      </div>
      <button onClick={() => onPick(null)} className="btn btn-ink mt-4">Skip</button>
    </div>
  );
}

function EndScreen({ win, onRetry }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h2 className={`font-display text-5xl ${win ? 'text-moss-300' : 'text-ember-400'}`}>
        {win ? 'Graduation Achieved' : 'The Path Ends Here'}
      </h2>
      <p className="font-quill italic text-parchment-300 max-w-xl text-center">
        {win
          ? 'You return to the school, hands full of trophies. The robes settle on your shoulders. The staff knows your weight. You have graduated.'
          : 'Your story ends in failure — for now. The school will receive another apprentice tomorrow. Begin again?'}
      </p>
      <button onClick={onRetry} className="btn btn-gold text-lg px-8 py-3">
        {win ? 'Walk the Path Again' : 'Try Again'}
      </button>
    </div>
  );
}
