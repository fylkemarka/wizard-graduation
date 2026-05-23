// Wizard Graduation — v2 sentence-engine sim.
//
// Greedy AI: each turn, drain hand → fill intro / subject / target /
// modifier slots → cast when all three primary slots are filled. Uses the
// real shared.js damage formula so sim damage matches what the in-browser
// game produces.
//
// Run: node sim/playSimV2.js [n]
// Output: sim/report-v2.md

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WIT_V2, WIT_V2_BY_SLOT } from '../src/cards/wit-v2.js';
import { CHUTZPAH_V2, CHUTZPAH_V2_BY_SLOT } from '../src/cards/chutzpah-v2.js';
import { JNSQ_V2, JNSQ_V2_BY_SLOT } from '../src/cards/jnsq-v2.js';
import { TIER_MULTIPLIER, computeSpellTier, computeSpellDamage } from '../src/cards/shared.js';

// =============================================================================
// 1. ENEMY DATA — light subset copied from playSim.js. Composure / hp /
// effectiveness / a single average attack-power per enemy is enough for the
// v2 sim to measure combat outcomes.
// =============================================================================

const ENEMIES = [
  // Act 1 — Thread Path (the countryside)
  { id: 'e2-hollow-weaver', act: 1, name: 'Hollow Weaver',       comp: 44, hp: 999, tier: 'normal', atk: 8, effectiveness: { chutzpah: 1.0, wit: 1.2, jnsq: 0.7, physical: 1.0 } },
  { id: 'e2-silk-wraith',   act: 1, name: 'Silk Wraith',         comp: 38, hp: 999, tier: 'normal', atk: 7, effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.5, physical: 0.5 } },
  { id: 'e2-loom-familiar', act: 1, name: 'Loom Familiar',       comp: 46, hp: 999, tier: 'normal', atk: 7, effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 } },
  { id: 'e2-pattern-maker', act: 1, name: 'The Pattern-Maker',   comp: 70, hp: 999, tier: 'elite',  atk: 9, effectiveness: { chutzpah: 1.0, wit: 1.2, jnsq: 0.7, physical: 1.0 } },
  { id: 'e2-silent-spinner',act: 1, name: 'The Silent Spinner',  comp: 72, hp: 999, tier: 'elite',  atk: 7, effectiveness: { chutzpah: 1.5, wit: 0.7, jnsq: 1.0, physical: 1.0 } },
  { id: 'e2-boss-tapestry', act: 1, name: 'The Tapestry Walker', comp: 85, hp: 999, tier: 'boss',   atk: 8, effectiveness: { chutzpah: 1.0, wit: 1.2, jnsq: 1.0, physical: 0.5 } },
  { id: 'e-rogue-linenfast', act: 1, name: 'Bartholomew Linenfast', comp: 42, hp: 999, tier: 'normal', atk: 6, effectiveness: { chutzpah: 1.0, wit: 0.8, jnsq: 1.3, physical: 1.0 } },
  // Act 2 — Forge Path (the mines and caves)
  { id: 'e3-geode-crab',    act: 2, name: 'Geode Crab',          comp: 44, hp: 22,  tier: 'normal', atk: 6, effectiveness: { chutzpah: 1.5, wit: 0.7, jnsq: 0.7, physical: 1.0 } },
  { id: 'e3-glow-mite',     act: 2, name: 'Glow-Mite Swarm',     comp: 34, hp: 16,  tier: 'normal', atk: 6, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 1.5, physical: 1.0 } },
  { id: 'e3-crystal-beetle',act: 2, name: 'Crystal Beetle',      comp: 44, hp: 22,  tier: 'normal', atk: 6, effectiveness: { chutzpah: 0.5, wit: 1.2, jnsq: 0.7, physical: 1.0 } },
  { id: 'e3-quartz-sentinel',act:2, name: 'Quartz Sentinel',     comp: 50, hp: 40,  tier: 'elite',  atk: 8, effectiveness: { chutzpah: 0.7, wit: 1.2, jnsq: 0.7, physical: 1.0 } },
  { id: 'e3-vein-devourer', act: 2, name: 'Vein Devourer',       comp: 80, hp: 50,  tier: 'elite',  atk: 10,effectiveness: { chutzpah: 1.5, wit: 0.7, jnsq: 0.7, physical: 1.0 } },
  { id: 'e3-boss-anvil',    act: 2, name: 'The Anvil-Forged',    comp: 65, hp: 75,  tier: 'boss',   atk: 9, effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 0.7, physical: 1.0 } },
  { id: 'e-rogue-smelterson', act: 2, name: 'Smelterson, J.C.', comp: 48, hp: 26, tier: 'normal', atk: 7, effectiveness: { chutzpah: 0.6, wit: 1.1, jnsq: 1.3, physical: 1.0 } },
  // Act 3 — Staff Path (the deep forest, final act)
  { id: 'e1-acolyte',       act: 3, name: 'Lost Acolyte',        comp: 20, hp: 18,  tier: 'normal', atk: 4, effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 1.0, physical: 1.0 } },
  { id: 'e1-imp',           act: 3, name: 'Pact Imp',            comp: 18, hp: 999, tier: 'normal', atk: 4, effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.5, physical: 1.0 } },
  { id: 'e1-shrine-rat',    act: 3, name: 'Shrine Rat Pack',     comp: 16, hp: 12,  tier: 'normal', atk: 6, effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.0, physical: 1.5 } },
  { id: 'e1-tutor',         act: 3, name: 'Stern Tutor',         comp: 32, hp: 999, tier: 'elite',  atk: 7, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 2.0, physical: 0.5 } },
  { id: 'e1-thicket',       act: 3, name: 'Living Thicket',      comp: 55, hp: 38,  tier: 'elite',  atk: 8, effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 0.7, physical: 1.0 } },
  { id: 'e1-boss-thornlord',act: 3, name: 'The Thornlord',       comp: 95, hp: 115, tier: 'boss',   atk: 9, effectiveness: { chutzpah: 0.75, wit: 1.0, jnsq: 1.3, physical: 1.0 } },
  { id: 'e-rogue-ashweather', act: 3, name: 'Doctor Phin Ashweather', comp: 36, hp: 32, tier: 'normal', atk: 7, effectiveness: { chutzpah: 0.6, wit: 1.4, jnsq: 1.0, physical: 1.0 } },
];
const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

const ACTS = [
  { id: 1, bossId: 'e2-boss-tapestry' },
  { id: 2, bossId: 'e3-boss-anvil' },
  { id: 3, bossId: 'e1-boss-thornlord' },
];

const ACT_NORMALS = {
  1: ['e2-hollow-weaver', 'e2-silk-wraith', 'e2-loom-familiar'],
  2: ['e3-geode-crab', 'e3-glow-mite', 'e3-crystal-beetle'],
  3: ['e1-acolyte', 'e1-imp', 'e1-shrine-rat'],
};
const ACT_ELITES = {
  1: ['e2-pattern-maker', 'e2-silent-spinner'],
  2: ['e3-quartz-sentinel', 'e3-vein-devourer'],
  3: ['e1-tutor', 'e1-thicket'],
};

const STARTING_MAX_HP = 70;
const STARTING_MAX_COMPOSURE = 30;
const ENERGY_PER_TURN = 3;
const HAND_SIZE = 5;
const INTER_ACT_HEAL_RATIO = 0.35; // v2.22: 0.55 → 0.35 (live-play attrition fix)
const MAX_COMBAT_TURNS = 30;  // safety net

const LANE_POOL = { wit: WIT_V2, chutzpah: CHUTZPAH_V2, jnsq: JNSQ_V2 };
const LANE_POOL_BY_SLOT = { wit: WIT_V2_BY_SLOT, chutzpah: CHUTZPAH_V2_BY_SLOT, jnsq: JNSQ_V2_BY_SLOT };

// =============================================================================
// 2. HELPERS
// =============================================================================

let _uid = 1;
function uid() { return _uid++; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rnd() { return Math.random(); }
function pickRandom(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildStarterDeck(lane) {
  const pool = LANE_POOL_BY_SLOT[lane];
  const basics = (arr) => arr.filter(c => c.rarity === 'basic');
  const firstNCommons = (arr, n) => arr.filter(c => c.rarity === 'common').slice(0, n);
  const ids = [
    ...basics(pool.intro).slice(0, 3).map(c => c.id),
    ...basics(pool.subject).slice(0, 3).map(c => c.id),
    ...firstNCommons(pool.target, 3).map(c => c.id),
  ];
  // Inline c-defend equivalent — block-5 skill the sim implements directly.
  const cards = ids.map(id => {
    const tmpl = LANE_POOL[lane].find(c => c.id === id);
    return tmpl ? { ...tmpl, uid: uid() } : null;
  }).filter(Boolean);
  cards.push({ id: 'c-defend', type: 'skill', cost: 1, effects: { block: 5 }, name: 'Defend', uid: uid() });
  cards.push({ id: 'c-compose', type: 'skill', cost: 1, effects: { poise: 5 }, name: 'Compose Yourself', uid: uid() }); // v2.9: poise shield
  // NOTE: Wit's starter annotation is NOT modeled in the sim. The sim's
  // greedy AI doesn't use annotations effectively (it can't reason about
  // the 3-turn payback window vs spending energy on cast NOW). Live play
  // is the right harness for annotation balance.
  return shuffle(cards);
}

// v2.12: jnsq CHAOS DICE outcomes (mirror of App.jsx).
const CHAOS_OUTCOMES = {
  1: { dmgMult: 0.5,  hpDelta: -3, draw: 0, energyNext: 0, vuln: 0, discardRandom: 0 },
  2: { dmgMult: 1.0,  hpDelta: 0,  draw: 0, energyNext: 0, vuln: 0, discardRandom: 1 },
  3: { dmgMult: 0.75, hpDelta: 0,  draw: 0, energyNext: 1, vuln: 0, discardRandom: 0 },
  4: { dmgMult: 1.0,  hpDelta: 0,  draw: 1, energyNext: 0, vuln: 0, discardRandom: 0 },
  5: { dmgMult: 1.25, hpDelta: 0,  draw: 1, energyNext: 0, vuln: 0, discardRandom: 0 },
  6: { dmgMult: 1.75, hpDelta: 0,  draw: 2, energyNext: 0, vuln: 1, discardRandom: 0 },
};
function rollChaosSim(intro, modifiers) {
  let r = 1 + Math.floor(rnd() * 6);
  const shift = (modifiers || []).reduce((s, m) => s + (m?.modifierEffect?.diceShift || 0), 0);
  r = Math.min(6, Math.max(1, r + shift));
  if (r <= 2 && intro?.diceReroll?.onResults?.includes(r)) {
    r = Math.min(6, Math.max(1, (1 + Math.floor(rnd() * 6)) + shift));
  }
  return r;
}

// =============================================================================
// 3. COMBAT
// =============================================================================

function drawCards(state, n) {
  for (let i = 0; i < n; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) return;
      state.deck = shuffle(state.discard);
      state.discard = [];
    }
    state.hand.push(state.deck.pop());
  }
}

// Greedy AI pick: from a slot pool in hand, prefer the highest-tier card
// the player can afford this turn. Returns hand index or -1.
function pickBestForSlot(state, slot, energyLeft) {
  let bestIdx = -1, bestTier = -1, bestStat = -1;
  // v2.29: detect if a loudScaling target ("I SAID.") is in hand. If so,
  // bias toward chutzpah cards carrying the 'demanding' tag in same-tier
  // slot picks — each demanding word adds +3 to the eventual cast for free.
  const hasLoudTarget = (slot === 'intro' || slot === 'subject' || slot === 'modifier')
    && state.hand.some(c => c.lane === 'chutzpah' && c.effect?.loudScaling);
  for (let i = 0; i < state.hand.length; i++) {
    const c = state.hand[i];
    if (c.slot !== slot) continue;
    if ((c.cost || 0) > energyLeft) continue;
    // v2.24: prefer chutzpah-lane cards when the rage meter is climbing.
    // Skip cards that require rage when rage isn't active (gates Bare Knuckles).
    if (c.effect?.requiresRage) continue;
    const tier = c.tier || 1;
    const stat = c.stats?.[c.lane] || 0;
    // v2.24: bias toward tunnel-vision-pumping cards while meter is low,
    // and toward chutzpah cards in general while we're close to 5.
    let score = tier * 10 + stat;
    if (state.lane === 'chutzpah') {
      if (c.effects?.tunnelVision && (state.tunnelVision || 0) < 5) score += 5;
      if (c.lane === 'chutzpah' && (state.tunnelVision || 0) >= 4 && (state.tunnelVision || 0) < 5) score += 4;
    }
    // v2.29: when an I SAID. finisher is in hand, demanding-tagged chutzpah
    // words break ties WITHIN tier. Keep the cmp against bestTier*10+bestStat
    // so this doesn't override the existing tier-first preference.
    let effectiveStat = stat;
    if (hasLoudTarget && c.lane === 'chutzpah' && (c.tags || []).includes('demanding')) {
      effectiveStat = stat + 3;
    }
    if (tier * 10 + effectiveStat > bestTier * 10 + bestStat) {
      bestIdx = i; bestTier = tier; bestStat = effectiveStat;
    }
  }
  return bestIdx;
}

// v2.24: target-slot variant. Like pickBestForSlot but lets requiresRage
// targets through ONLY when state.rageActive is true. Also prioritizes
// Bare Knuckles when rage IS active (it's the rage payoff card).
// v2.25: also gates DOUBLE DOWN targets by predicted-kill — only pick a
// doubleDown target when the predicted damage would clear the enemy's
// remaining composure (with a 10% buffer for variance). If the cast
// wouldn't kill, the corner-token bill is real and the AI should pass.
function pickBestForSlotRageAware(state, slot, energyLeft, rageActive, tray, enemy) {
  let bestIdx = -1, bestScore = -Infinity;
  for (let i = 0; i < state.hand.length; i++) {
    const c = state.hand[i];
    if (c.slot !== slot) continue;
    if ((c.cost || 0) > energyLeft) continue;
    const needsRage = !!c.effect?.requiresRage;
    if (needsRage && !rageActive) continue;
    // v2.25: doubleDown gate — only pick if predicted damage kills.
    const doubleDown = !!c.effect?.doubleDown;
    if (doubleDown && tray && enemy) {
      // Predict cast damage with this target staged. Mirrors the sim's
      // own cast pipeline: base + statSum × multiplier, × tierMult, × enemy
      // effectiveness, × playerDmgMult. Conservative — modifiers excluded.
      const preCtx = {
        discardSize: state.discard.length,
        deckSize: state.deck.length + state.hand.length + state.discard.length + state.exiled.length,
        missingHpFrac: state.maxHp > 0 ? (state.maxHp - state.hp) / state.maxHp : 0,
        stakeAmount: 0,
        loudCount: state.loudCount || 0, // v2.29
      };
      // Reuse the shared formula via computeSpellDamage if intro+subject
      // are staged. Off-stage we can't compute reliably; default-pass
      // (treat as if cast wouldn't kill → skip).
      if (!tray.intro || !tray.subject) continue;
      const preview = computeSpellDamage(tray.intro, tray.subject, c, [], preCtx);
      const dmgType = c.effect?.damageType || 'composure';
      const eff = enemy.effectiveness || {};
      const enemyMult = (dmgType === 'physical') ? (eff.physical ?? 1.0) : (eff[c.effect?.scaleBy || c.lane || 'chutzpah'] ?? 1.0);
      const predicted = preview.damage * enemyMult * (state.playerDmgMult || 1);
      const remaining = dmgType === 'physical' ? enemy.currentHp : enemy.currentComp;
      // 10% buffer per spec — predicted must exceed remaining × 1.1.
      if (predicted < remaining * 1.1) continue;
    }
    // v2.26: STORM OUT gate — only pick when this would be the last cast
    // possible this turn (no other castable targets after this one would
    // matter — the per-turn cap is 1), AND remaining energy after this
    // card's cost is ≥ 2 (so the bonusPerEnergy actually pays off), AND
    // predicted damage > 0.6 × remaining composure (it's a finisher).
    const stormOut = !!c.effect?.stormOut;
    if (stormOut && tray && enemy) {
      // Need intro + subject staged to project damage; otherwise pass.
      if (!tray.intro || !tray.subject) continue;
      const energyAfterStage = energyLeft - (c.cost || 0);
      if (energyAfterStage < 2) continue;
      const preCtx = {
        discardSize: state.discard.length,
        deckSize: state.deck.length + state.hand.length + state.discard.length + state.exiled.length,
        missingHpFrac: state.maxHp > 0 ? (state.maxHp - state.hp) / state.maxHp : 0,
        stakeAmount: 0,
        loudCount: state.loudCount || 0, // v2.29
      };
      const preview = computeSpellDamage(tray.intro, tray.subject, c, [], preCtx);
      const dmgType = c.effect?.damageType || 'composure';
      const eff = enemy.effectiveness || {};
      const enemyMult = (dmgType === 'physical') ? (eff.physical ?? 1.0) : (eff[c.effect?.scaleBy || c.lane || 'chutzpah'] ?? 1.0);
      // bonusPerEnergy is paid out from energy LEFT at cast time. After this
      // target stages (cost paid), the cast burns `energyAfterStage` energy.
      const bonus = energyAfterStage * (c.effect?.bonusPerEnergy || 0);
      const predicted = (preview.damage + bonus) * enemyMult * (state.playerDmgMult || 1);
      const remaining = dmgType === 'physical' ? enemy.currentHp : enemy.currentComp;
      if (predicted <= 0) continue;
      // Finisher heuristic: only fire when we're swinging at a meaningful
      // chunk of the enemy's remaining bar.
      if (predicted < remaining * 0.6) continue;
    }
    const tier = c.tier || 1;
    const stat = c.stats?.[c.lane] || 0;
    let score = tier * 10 + stat;
    if (needsRage && rageActive) score += 30; // strongly prefer Bare Knuckles in RAGE
    if (doubleDown) score += 15; // prefer doubleDown when it WILL kill (gate already passed)
    if (stormOut) score += 20;   // prefer stormOut when the finisher conditions matched
    if (score > bestScore) { bestIdx = i; bestScore = score; }
  }
  return bestIdx;
}

function pickBestModifier(state, energyLeft, tier, bossFight, loudTargetStaged = false) {
  let bestIdx = -1, bestScore = -1;
  for (let i = 0; i < state.hand.length; i++) {
    const c = state.hand[i];
    if (c.slot !== 'modifier') continue;
    if ((c.cost || 0) > energyLeft) continue;
    let score = 0;
    const me = c.modifierEffect || {};
    if (me.damageMult) score += me.damageMult * 10;
    if (me.conditionalMult?.tier2Plus && tier >= 2) score += 8;
    if (me.tier3Payoff && tier === 3) score += 25;
    if (me.rider?.block) score += me.rider.block * 0.3; // light pref
    if (me.rider?.weak)  score += me.rider.weak * 2;
    if (me.rider?.vulnerable) score += me.rider.vulnerable * 3;
    if (me.stripEnemyBlock && bossFight) score += me.stripEnemyBlock * 2;
    // v2.29: if a loudScaling target is already staged AND this modifier is
    // chutzpah-lane with the 'demanding' tag, stacking it adds +3 to the
    // pending cast (more than a small damageMult, less than a tier3Payoff).
    if (loudTargetStaged && c.lane === 'chutzpah' && (c.tags || []).includes('demanding')) {
      score += 5;
    }
    score -= (c.cost || 0); // prefer cheap mods
    if (score > bestScore) { bestIdx = i; bestScore = score; }
  }
  return bestIdx;
}

function runCombat(state, enemyId, telemetry) {
  const tmpl = ENEMIES_BY_ID[enemyId];
  if (!tmpl) throw new Error(`Unknown enemy ${enemyId}`);
  const enemy = { ...tmpl, currentComp: tmpl.comp, currentHp: tmpl.hp, block: 0 };
  state.block = 0;
  state.poise = 0; // v2.9: composure-shield
  state.combatRolls = []; // v2.12: track chaos rolls this combat
  // v2.24: chutzpah TUNNEL VISION + RAGE state — per combat.
  state.tunnelVision = 0;
  state.rageActive = false;
  // v2.25: chutzpah DOUBLING DOWN — per-turn corner-token counter.
  // Bumped on cast when target has `doubleDown: true`. Bills 2 unblocked
  // HP per token at end of turn if the enemy is still alive. Resets each
  // turn either way (after billing).
  state.cornerTokens = 0;
  // v2.29: chutzpah SAYING IT LOUDER — per-turn counter of demanding-tagged
  // chutzpah words staged this turn. Read by loudScaling targets for +3
  // dmg per louder say. Reset per turn (below) and per combat (here).
  state.loudCount = 0;
  // v2.26: STORMING OUT — hidden-intent flag. Sim AI doesn't peek at intents
  // (it reacts to enemy.atk directly), so this flag is purely telemetric:
  // we track that the player stormed out and what the next intent would have
  // been hidden against. Reset per combat.
  state.intentHidden = false;
  // v2.27: HIT ME AGAIN — per-combat install flag + recoil charges. While
  // installed, the enemy eats `charges` self-damage at the start of every
  // attack (sim models each enemy turn as one composite swing, so charges
  // arm +1 per landed turn). Recoil bypasses enemy block. Charges never
  // reset within a combat. Mirrors hitMeAgainInstalled/Charges in App.jsx.
  state.hitMeAgainInstalled = false;
  state.hitMeAgainCharges = 0;
  // v2.28: STUBBORN BLOCK — per-combat install flag. While installed,
  // end-of-player-turn converts remaining energy × 2 → Block and the normal
  // start-of-turn block reset is skipped (block carries over).
  state.stubbornBlockInstalled = false;
  // v2.9: familiar start-of-combat bonuses.
  const fb = state.familiarBonus || {};
  if (fb.startCombatBlock)  state.block += fb.startCombatBlock;
  if (fb.startCombatPoise)  state.poise += fb.startCombatPoise; // Rabbit
  if (fb.startCombatEnergy) state.energy += fb.startCombatEnergy; // applied alongside ENERGY_PER_TURN in loop
  if (fb.startCombatVuln)   state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * fb.startCombatVuln);
  // Beetle: tracks a per-combat first-hit absorber.
  state.beetleAbsorb = fb.firstHitReduction || 0;
  // Power-down: reset per-combat buffs
  state.enemyDmgMult = 1.0;
  state.playerDmgMult = 1.0;

  // Combat starts with empty hand. Draw fresh.
  state.discard = [...state.discard, ...state.hand];
  state.hand = [];
  const jnsqBonus = state.lane === 'jnsq' ? 1 : 0;
  drawCards(state, HAND_SIZE + (fb.startCombatDraw || 0) + jnsqBonus);

  // v2.1: tray persists across turns. Cards staged but not cast last turn
  // remain in their slots; the player can refine the spell over multiple
  // turns. Cleared only on combat end (return statements below) or when
  // the cast fires.
  let tray = { intro: null, subject: null, target: null, modifiers: [] };
  let turns = 0;
  while (turns++ < MAX_COMBAT_TURNS) {
    state.energy = ENERGY_PER_TURN + (turns === 1 && fb.startCombatEnergy ? fb.startCombatEnergy : 0);
    // v2.29: reset saying-it-louder counter at the start of every player turn.
    state.loudCount = 0;
    // v2.9: start-of-turn block from familiar (e.g. Hedgehog).
    if (fb.startOfTurnBlock) state.block += fb.startOfTurnBlock;
    // v2.24: chutzpah RAGE entry check. If TUNNEL VISION >= 5, this turn
    // is a RAGE turn — +50% potency bonus applied to playerDmgMult, with
    // a track flag so end-of-turn knows to roll it back.
    if (!state.rageActive && (state.tunnelVision || 0) >= 5) {
      state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.5);
      state.rageActive = true;
      telemetry.rageTriggers = (telemetry.rageTriggers || 0) + 1;
    }
    // v2.10: annotation start-of-turn effects.
    if (enemy.annotation?.effect) {
      const annE = enemy.annotation.effect;
      if (annE.damageOnTurnStart) {
        enemy.currentComp = Math.max(0, enemy.currentComp - annE.damageOnTurnStart);
      }
      if (annE.energyOnTurnStart) state.energy += annE.energyOnTurnStart;
    }
    // Tick down duration AFTER the start-of-turn effect fires.
    if (enemy.annotation) {
      enemy.annotation.turnsRemaining--;
      if (enemy.annotation.turnsRemaining <= 0) enemy.annotation = null;
    }
    let cast = false;
    // v2.9: cast cap = 1 per turn.
    let castsThisTurn = 0;
    // v2.10: AI plays an annotation only when it has spare energy AND
    // an early opportunity (turn 1-3, against elites/bosses). Without
    // this gate, annotation steals turn-1 energy from defense + cast
    // and the lane regresses. Annotation pays back over 3-4 turns so
    // it's best laid early but only when energy permits.
    const annotationWorthIt = (
      !enemy.annotation &&
      state.energy >= 4 &&            // enough for annotation + at least one card
      turns <= 4 &&                   // payoff window
      (enemy.tier === 'elite' || enemy.tier === 'boss') // tougher fights only
    );
    if (annotationWorthIt) {
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if (c.slot === 'annotation' && (c.cost || 0) <= state.energy) {
          state.energy -= c.cost || 0;
          enemy.annotation = {
            id: c.id, name: c.name,
            effect: c.annotationEffect || {},
            turnsRemaining: c.duration || 3,
          };
          state.discard.push(c);
          state.hand.splice(i, 1);
          break;
        }
      }
    }

    // v2.27: HIT ME AGAIN install pass. If the power card is in hand and
    // not yet installed, install it on the cheapest turn possible — the
    // recoil engine values early installs (charges only accumulate while
    // installed). Cost 1, so the AI hangs on to it through a turn-1 fight
    // start and plays it once energy is spare.
    if (!state.hitMeAgainInstalled) {
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if (c.id === 'cv2-p-hit-me-again' && (c.cost || 0) <= state.energy) {
          state.energy -= c.cost || 0;
          state.hitMeAgainInstalled = true;
          telemetry.hitMeAgainInstalls = (telemetry.hitMeAgainInstalls || 0) + 1;
          state.discard.push(c);
          state.hand.splice(i, 1);
          break;
        }
      }
    }

    // v2.28: STUBBORN BLOCK install pass. Same shape as hit-me-again —
    // install when affordable. The power pays off ONLY for chutzpah players
    // (it's chutzpah-only by design + draft pool), so the gate is just
    // affordability and not-yet-installed. Early install matters because
    // every turn the converter fires from then on; cost 1.
    if (!state.stubbornBlockInstalled) {
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if (c.id === 'cv2-p-stubborn-block' && (c.cost || 0) <= state.energy) {
          state.energy -= c.cost || 0;
          state.stubbornBlockInstalled = true;
          telemetry.stubbornBlockInstalls = (telemetry.stubbornBlockInstalls || 0) + 1;
          state.discard.push(c);
          state.hand.splice(i, 1);
          break;
        }
      }
    }

    // AI: try to fill intro, subject, target. Then play modifier if good.
    // Multi-pass since after staging we might still have energy/options.
    let passCount = 0;
    while (passCount++ < 8) {
      let progressed = false;

      // v2.9: Defenders react to anticipated damage. The dual-shield system
      // forces the AI to keep BOTH pools covered, not just HP. Thresholds
      // are tuned for a competent (not optimal) human: defend whenever the
      // next enemy hit could threaten a pool.
      //   Block / Defend → HP-pool defense. Threshold: hp < 60% AND block < expected hit.
      //   Poise / Compose → composure defense. Tighter threshold since
      //     composure pool is smaller (30 vs 70 HP).
      const expectedHit = enemy.atk;
      const expectedHpHit = Math.ceil(expectedHit / 2);
      const expectedCompHit = Math.ceil(expectedHit / 2);
      // Play Defend / Mend if expected unblocked HP damage > 0.
      if (state.block < expectedHpHit) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          // v2.28: include "Frankly, no." (cv2-k-frankly-no) — 0-cost +4 Block.
          // Always playable, and frees energy to feed Stubborn Block.
          if (c.type === 'skill' && (c.id === 'c-defend' || c.id === 'c-mend' || c.id === 'cv2-k-frankly-no') && (c.cost || 0) <= state.energy) {
            state.energy -= c.cost || 0;
            state.block += c.effects?.block || 0;
            state.discard.push(c);
            state.hand.splice(i, 1);
            progressed = true;
            break;
          }
        }
      }
      // Play Compose / Steady if expected unblocked composure damage > 0.
      if (state.poise < expectedCompHit) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          if (c.type === 'skill' && (c.id === 'c-compose' || c.id === 'c-steady') && (c.cost || 0) <= state.energy) {
            state.energy -= c.cost || 0;
            state.poise += c.effects?.poise || 0;
            state.discard.push(c);
            state.hand.splice(i, 1);
            progressed = true;
            break;
          }
        }
      }

      // Apply on-stage side effects from word cards (draw/block/weak/vulnerable).
      // Mirrors applySideEffects in App.jsx.
      const applyStageEffects = (card) => {
        const fx = card.effects || {};
        if (fx.block)      state.block += fx.block;
        if (fx.poise)      state.poise += fx.poise;
        if (fx.draw)       drawCards(state, fx.draw);
        if (fx.weak)       state.enemyDmgMult = Math.max(0.5, (state.enemyDmgMult || 1) - 0.25 * fx.weak);
        if (fx.vulnerable) state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * fx.vulnerable);
        if (fx.energy)     state.energy += fx.energy;
        if (fx.hp)         state.hp = Math.min(state.maxHp, state.hp + fx.hp);
        if (fx.loseHp)     state.hp = Math.max(0, state.hp - fx.loseHp);
        // v2.24: tunnel-vision pump (Foaming at the mouth, and any future card).
        if (fx.tunnelVision) state.tunnelVision = (state.tunnelVision || 0) + fx.tunnelVision;
      };
      // v2.24: bumps the chutzpah RAGE meter when a chutzpah-lane card
      // commits to a slot. Mirrors bumpTunnelVisionIfChutzpah() in App.jsx.
      // v2.29: also bumps the saying-it-louder counter when a chutzpah
      // word card (intro/subject/modifier) with the 'demanding' tag stages.
      const bumpTunnelOnStage = (card) => {
        if (card?.lane === 'chutzpah') state.tunnelVision = (state.tunnelVision || 0) + 1;
        if (card?.lane === 'chutzpah'
            && (card.slot === 'intro' || card.slot === 'subject' || card.slot === 'modifier')
            && (card.tags || []).includes('demanding')) {
          state.loudCount = (state.loudCount || 0) + 1;
        }
      };
      if (!tray.intro) {
        const idx = pickBestForSlot(state, 'intro', state.energy);
        if (idx >= 0) {
          tray.intro = state.hand[idx];
          state.energy -= tray.intro.cost || 0;
          state.hand.splice(idx, 1);
          applyStageEffects(tray.intro);
          bumpTunnelOnStage(tray.intro);
          progressed = true;
          continue;
        }
      }
      if (!tray.subject) {
        const idx = pickBestForSlot(state, 'subject', state.energy);
        if (idx >= 0) {
          tray.subject = state.hand[idx];
          state.energy -= tray.subject.cost || 0;
          state.hand.splice(idx, 1);
          applyStageEffects(tray.subject);
          bumpTunnelOnStage(tray.subject);
          progressed = true;
          continue;
        }
      }
      if (!tray.target) {
        // v2.24: prefer Bare Knuckles (requiresRage) when RAGE is active.
        // Otherwise block it from staging entirely (mirrors App.jsx gate).
        // v2.25: also gates doubleDown targets — only pick if the cast
        // would kill (tray + enemy passed for damage prediction).
        const idx = pickBestForSlotRageAware(state, 'target', state.energy, state.rageActive, tray, enemy);
        if (idx >= 0) {
          tray.target = state.hand[idx];
          state.energy -= tray.target.cost || 0;
          state.hand.splice(idx, 1);
          bumpTunnelOnStage(tray.target);
          progressed = true;
          continue;
        }
      }
      // After all three primary slots filled, optionally play modifier(s).
      if (tray.intro && tray.subject && tray.target && tray.modifiers.length < 2) {
        const tier = computeSpellTier(tray.intro, tray.subject, tray.target);
        const bossFight = enemy.tier === 'boss';
        const idx = pickBestModifier(state, state.energy, tier, bossFight, !!tray.target?.effect?.loudScaling);
        if (idx >= 0) {
          const m = state.hand[idx];
          tray.modifiers.push(m);
          state.energy -= m.cost || 0;
          state.hand.splice(idx, 1);
          // v2.29: modifier staging also bumps loud-count + tunnel-vision.
          // (Was missing — only intro/subject/target called bumpTunnelOnStage.)
          bumpTunnelOnStage(m);
          progressed = true;
          continue;
        }
      }
      if (!progressed) break;
    }

    // Cast if all three slots filled. v2.9: hard cap 1 cast per turn.
    if (tray.intro && tray.subject && tray.target && castsThisTurn < 1) {
      castsThisTurn++;
      // v2.11: chutzpah ALL IN heuristic. Stake to close the kill when
      // affordable; never stake at low HP or for overkill.
      let stake = 0;
      if (state.lane === 'chutzpah' && state.hp >= 30) {
        // Pre-roll the spell damage WITHOUT stake to estimate gap.
        const preCtx = {
          discardSize: state.discard.length,
          deckSize: state.deck.length + state.hand.length + state.discard.length + state.exiled.length,
          missingHpFrac: state.maxHp > 0 ? (state.maxHp - state.hp) / state.maxHp : 0,
          stakeAmount: 0,
          loudCount: state.loudCount || 0, // v2.29
        };
        const preview = computeSpellDamage(tray.intro, tray.subject, tray.target, tray.modifiers, preCtx);
        const preMult = (tray.target.effect?.damageType === 'physical')
          ? (enemy.effectiveness?.physical ?? 1.0)
          : (enemy.effectiveness?.[tray.target.effect?.scaleBy || tray.target.lane || 'wit'] ?? 1.0);
        const previewDmg = preview.damage * preMult * state.playerDmgMult;
        const gap = enemy.currentComp - previewDmg;
        // Required by target?
        const required = tray.target.effect?.requiresStake || 0;
        const max = Math.floor(state.hp / 4); // v2.13: tighter cap
        if (gap > 0 && gap <= 20) {
          // Default 1:1 stake multiplier; chutzpah staking is best on
          // bigger gaps where the +damage actually closes the kill.
          stake = Math.min(Math.ceil(gap), max);
        }
        if (required > 0) stake = Math.max(stake, required);
        if (stake > max) stake = 0; // can't afford the requirement
      }
      // Apply stake HP cost up-front
      if (stake > 0) state.hp = Math.max(1, state.hp - stake);
      // v2.12: jnsq CHAOS DICE — roll if jnsq AND (not too low HP) OR if
      // staged cards force it. Greedy: jnsq always rolls when affordable.
      let chaosRoll = null;
      let chaosOutcome = null;
      const forceRoll = (tray.modifiers || []).some(m => m?.modifierEffect?.forceRoll) ||
                        tray.target.effect?.alwaysRolls === true;
      const willRoll = forceRoll || (state.lane === 'jnsq' && state.hp >= 15);
      // Gate by requiresPriorRoll
      const requiredRoll = tray.target.effect?.requiresPriorRoll || 0;
      if (requiredRoll > 0 && !state.combatRolls.includes(requiredRoll)) {
        // Cast still happens — the sim doesn't gate here; the App does.
        // We model gate as "the AI wouldn't pick this target", but skip.
      }
      if (willRoll) {
        chaosRoll = rollChaosSim(tray.intro, tray.modifiers);
        chaosOutcome = CHAOS_OUTCOMES[chaosRoll];
        state.combatRolls.push(chaosRoll);
        // v2.13: intro diceDraw bonus.
        const diceDraw = tray.intro?.diceDraw || 0;
        if (diceDraw > 0) drawCards(state, diceDraw);
      }
      const simCtx = {
        discardSize: state.discard.length,
        deckSize: state.deck.length + state.hand.length + state.discard.length + state.exiled.length,
        missingHpFrac: state.maxHp > 0 ? (state.maxHp - state.hp) / state.maxHp : 0,
        stakeAmount: stake, // v2.11
        loudCount: state.loudCount || 0, // v2.29
      };
      const result = computeSpellDamage(tray.intro, tray.subject, tray.target, tray.modifiers, simCtx);
      let dmg = result.damage;
      const eff = tray.target.effect || {};
      const stat = eff.scaleBy || tray.target.lane || 'wit';
      const dmgType = eff.damageType || 'composure';
      const mult = (dmgType === 'physical')
        ? (enemy.effectiveness?.physical ?? 1.0)
        : (enemy.effectiveness?.[stat] ?? 1.0);
      dmg = Math.round(dmg * mult * state.playerDmgMult);
      // v2.12: chaos dice damage multiplier.
      if (chaosOutcome) {
        const scale = tray.target.effect?.rollDamageScale || 1.0;
        const effectiveMult = 1.0 + (chaosOutcome.dmgMult - 1.0) * scale;
        dmg = Math.round(dmg * effectiveMult);
      }
      // v2.10: annotation bonusSpellDamage (flat).
      if (enemy.annotation?.effect?.bonusSpellDamage) {
        dmg += enemy.annotation.effect.bonusSpellDamage;
      }
      // v2.15: wit BURST — cashInAnnotation exiles attached annotation
      // for damage = turns × N.
      const cashIn = tray.target.effect?.cashInAnnotation;
      let cashedTurns = 0;
      if (cashIn && enemy.annotation) {
        cashedTurns = enemy.annotation.turnsRemaining || 0;
        dmg += cashedTurns * (cashIn.damagePerTurn || 0);
      }
      // v2.24: RAGE-only target safety net. If a requiresRage target made
      // it to cast time without RAGE active, half-damage + exile. The AI
      // shouldn't normally arrive here because pickBestForSlotRageAware
      // refuses to stage it off-rage; defensive only.
      const rageMissing = !!tray.target.effect?.requiresRage && !state.rageActive;
      if (rageMissing) dmg = Math.round(dmg * 0.5);
      // v2.26: STORM OUT — energy at cast time converts to flat damage,
      // then burns to zero. Energy was already spent staging this target
      // (cost paid up-front), so `state.energy` here represents what's left
      // AFTER the card was committed — exactly the "remaining energy" the
      // spec calls for.
      const stormOut = !!tray.target.effect?.stormOut;
      const stormOutBonusPerEnergy = tray.target.effect?.bonusPerEnergy || 0;
      const stormOutEnergySpent = stormOut ? state.energy : 0;
      if (stormOut && stormOutBonusPerEnergy > 0 && stormOutEnergySpent > 0) {
        // Energy bonus is flat — not multiplied by enemy effectiveness or
        // playerDmgMult. Keeps the math predictable: each point of energy
        // is a clean +N damage at cast time.
        dmg += stormOutEnergySpent * stormOutBonusPerEnergy;
      }

      // Strip enemy block from modifier
      if (result.sideEffects.stripBlock) {
        enemy.block = Math.max(0, enemy.block - result.sideEffects.stripBlock);
      }
      // Apply damage absorbed by enemy block first
      let remaining = dmg;
      if (enemy.block > 0) {
        const absorbed = Math.min(enemy.block, remaining);
        enemy.block -= absorbed; remaining -= absorbed;
      }
      if (dmgType === 'physical') enemy.currentHp = Math.max(0, enemy.currentHp - remaining);
      else                        enemy.currentComp = Math.max(0, enemy.currentComp - remaining);
      // v2.15: BURST exiles cashed-in annotation; wit auto-attach stub
      // for casual casts that lacked one.
      if (cashedTurns > 0) {
        enemy.annotation = null;
      } else if (state.lane === 'wit' && dmg > 0 && !enemy.annotation) {
        enemy.annotation = {
          id: 'wv2-ann-cited', name: 'Cited in passing',
          effect: { damageOnTurnEnd: 1 },
          turnsRemaining: 2, stub: true,
        };
      }
      // v2.11: stake half-refund on hit (from "and I mean it." target).
      if (result.sideEffects.stakeRefundHalf && stake > 0 && remaining > 0) {
        const refund = Math.floor(stake / 2);
        if (refund > 0) state.hp = Math.min(state.maxHp, state.hp + refund);
      }
      // Track stake usage for telemetry
      if (stake > 0) {
        telemetry.stakesUsed = (telemetry.stakesUsed || 0) + 1;
        telemetry.stakeHpSpent = (telemetry.stakeHpSpent || 0) + stake;
      }
      // v2.12: apply chaos side effects.
      if (chaosOutcome) {
        if (chaosOutcome.hpDelta < 0) state.hp = Math.max(1, state.hp + chaosOutcome.hpDelta);
        if (chaosOutcome.draw > 0) drawCards(state, chaosOutcome.draw);
        if (chaosOutcome.energyNext > 0) state.energy += chaosOutcome.energyNext;
        if (chaosOutcome.vuln > 0) state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * chaosOutcome.vuln);
        if (chaosOutcome.discardRandom > 0 && state.hand.length > 0) {
          const idx = Math.floor(rnd() * state.hand.length);
          const lost = state.hand[idx];
          state.hand.splice(idx, 1);
          state.discard.push(lost);
        }
        telemetry.chaosRolls = (telemetry.chaosRolls || 0) + 1;
        telemetry[`chaosRoll${chaosRoll}`] = (telemetry[`chaosRoll${chaosRoll}`] || 0) + 1;
      }

      // Riders affect enemy
      if (result.riders.weak)       state.enemyDmgMult = Math.max(0.5, (state.enemyDmgMult || 1) - 0.25 * result.riders.weak);
      if (result.riders.vulnerable) state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * result.riders.vulnerable);
      if (result.riders.block)      state.block += result.riders.block;

      // Side-effects
      if (result.sideEffects.drawCount) drawCards(state, result.sideEffects.drawCount);
      if (result.sideEffects.selfComposureCost) state.composure = Math.max(0, state.composure - result.sideEffects.selfComposureCost);
      if (result.sideEffects.selfHpCost) state.hp = Math.max(0, state.hp - result.sideEffects.selfHpCost);

      // v2.25: DOUBLING DOWN — bank a corner token when a chutzpah
      // doubleDown target resolved a cast. The bill comes due at end of
      // turn if the enemy is still alive.
      if (tray.target.effect?.doubleDown) {
        state.cornerTokens = (state.cornerTokens || 0) + 1;
        telemetry.doubleDownCasts = (telemetry.doubleDownCasts || 0) + 1;
      }
      // v2.26: STORM OUT — record the cast, burn all remaining energy,
      // flag the next intent as hidden. Telemetry captures the energy
      // spent so we can sanity-check the heuristic gate (avg energy at
      // cast should be ≥ 2). Setting energy to 0 + the per-turn cast cap
      // already incremented means no further actions can fire this turn.
      if (stormOut) {
        telemetry.stormOutCasts = (telemetry.stormOutCasts || 0) + 1;
        telemetry.stormOutEnergySpent = (telemetry.stormOutEnergySpent || 0) + stormOutEnergySpent;
        state.energy = 0;
        state.intentHidden = true;
        // Sentinel: this end-of-turn carries the hidden-intent flag INTO the
        // next player turn; do not clear it on this turn's wrap.
        state.stormOutJustFired = true;
      }

      // Discharge cards: intro/subject/modifiers → discard; target exiles
      // on tier-3-required failure (or v2.24 rage-missing), else discard.
      state.discard.push(tray.intro, tray.subject, ...tray.modifiers);
      if (result.sideEffects.exhaustTarget || rageMissing) state.exiled.push(tray.target);
      else state.discard.push(tray.target);

      cast = true;
      telemetry.castsAttempted++;
      telemetry.totalDamageDealt += dmg;
      if (result.tier === 3) telemetry.tier3Casts++;
      if (result.tier === 2) telemetry.tier2Casts++;
      if (result.tier === 1) telemetry.tier1Casts++;
      // v2.24: telemetry for Bare Knuckles / RAGE casts.
      if (tray.target?.id === 'cv2-t-bare-knuckles') {
        telemetry.bareKnucklesCasts = (telemetry.bareKnucklesCasts || 0) + 1;
        if (rageMissing) telemetry.bareKnucklesMisfires = (telemetry.bareKnucklesMisfires || 0) + 1;
      }
      // v2.29: telemetry for SAYING IT LOUDER. Counts every cast that read
      // loudCount for a bonus, plus aggregate loudCount and bonus damage
      // for averages in the report.
      if (tray.target?.effect?.loudScaling) {
        telemetry.iSaidCasts = (telemetry.iSaidCasts || 0) + 1;
        telemetry.loudCountSum = (telemetry.loudCountSum || 0) + (state.loudCount || 0);
        telemetry.loudBonusSum = (telemetry.loudBonusSum || 0) + (result.loudBonus || 0);
      }
      // v2.29: the cast consumes the loud build-up. Reset to 0 either way
      // (the per-turn cap is 1, so this is mainly defensive).
      if (tray.target?.effect?.loudScaling) state.loudCount = 0;
      // Tray clears only when a cast actually fires.
      tray = { intro: null, subject: null, target: null, modifiers: [] };
    } else {
      // No cast this turn — partial stage remains in the tray. Count it
      // as a "hold" rather than a fizzle (no card discard penalty).
      telemetry.holds++;
    }

    // v2.10: annotation damageOnTurnEnd + damageOnDraw (after the player
    // has played their full turn). damageOnDraw fires per card drawn this
    // turn; the sim doesn't track per-call draws, so it fires at end of
    // turn based on hand size as a simplification.
    if (enemy.annotation?.effect) {
      const annE = enemy.annotation.effect;
      if (annE.damageOnTurnEnd) {
        enemy.currentComp = Math.max(0, enemy.currentComp - annE.damageOnTurnEnd);
      }
    }

    // Check victory
    if (enemy.currentComp <= 0 || enemy.currentHp <= 0) {
      // v2.9: onKillHeal (Crow).
      if (fb.onKillHeal) state.hp = Math.min(state.maxHp, state.hp + fb.onKillHeal);
      // v2.25: enemy died this turn — corner tokens DON'T bill. The kill
      // covers the bravado. Reset for sanity, although combat is over.
      state.cornerTokens = 0;
      return { outcome: 'won', turns, telemetry };
    }

    // v2.25: DOUBLING DOWN billing. Enemy survived → corner tokens bill
    // unblocked HP (2 per token). Resets to 0 either way. Fires BEFORE the
    // enemy turn so the player can be killed by an enemy attack that
    // lands on top of the self-inflicted bill.
    if ((state.cornerTokens || 0) > 0) {
      const dmg = state.cornerTokens * 2;
      state.hp = Math.max(0, state.hp - dmg);
      telemetry.cornerTokenDamage = (telemetry.cornerTokenDamage || 0) + dmg;
      telemetry.cornerTokenBills = (telemetry.cornerTokenBills || 0) + 1;
      state.cornerTokens = 0;
      if (state.hp <= 0) {
        return { outcome: 'lost', turns, killedBy: 'cornerTokens', telemetry };
      }
    }

    // Enemy turn
    // v2.27: HIT ME AGAIN recoil fires BEFORE the enemy's swing damage.
    // The sim models each enemy turn as one composite attack (no per-swing
    // model), so charges arm +1 per landed turn — a lower bound vs the
    // App's per-swing accrual on attack-multi. Recoil bypasses enemy block.
    // Pool routing: HP first if it's a real pool, fall back to composure
    // for hp:999 sentinels.
    if (state.hitMeAgainInstalled && state.hitMeAgainCharges > 0) {
      const recoil = state.hitMeAgainCharges;
      const enemyHpIsReal = enemy.hp < 900;
      if (enemyHpIsReal && enemy.currentHp > 0) {
        enemy.currentHp = Math.max(0, enemy.currentHp - recoil);
      } else {
        enemy.currentComp = Math.max(0, enemy.currentComp - recoil);
      }
      telemetry.hitMeAgainRecoilTotal = (telemetry.hitMeAgainRecoilTotal || 0) + recoil;
      // Check kill — if the enemy's own swing killed itself, end combat.
      if (enemy.currentComp <= 0 || (enemyHpIsReal && enemy.currentHp <= 0)) {
        telemetry.hitMeAgainKills = (telemetry.hitMeAgainKills || 0) + 1;
        return { outcome: 'won', turns, telemetry };
      }
    }
    let incoming = enemy.atk;
    // v2.10: annotation enemyAtkReduction.
    if (enemy.annotation?.effect?.enemyAtkReduction) {
      incoming = Math.max(0, incoming - enemy.annotation.effect.enemyAtkReduction);
    }
    // v2.9: Beetle's first-hit absorb consumes once per combat.
    if (state.beetleAbsorb > 0 && incoming > 0) {
      const absorbed = Math.min(state.beetleAbsorb, incoming);
      incoming = Math.max(0, incoming - absorbed);
      state.beetleAbsorb = 0;
    }
    // Drift player buffs back toward 1.0 (0.25/turn)
    if (state.enemyDmgMult < 1.0) state.enemyDmgMult = Math.min(1.0, state.enemyDmgMult + 0.25);
    if (state.playerDmgMult > 1.0) state.playerDmgMult = Math.max(1.0, state.playerDmgMult - 0.25);
    if (state.playerDmgMult < 1.0) state.playerDmgMult = Math.min(1.0, state.playerDmgMult + 0.25);
    incoming = Math.round(incoming * (state.enemyDmgMult || 1));
    // v2.9: dual-shield routing. Half the incoming is composure (mental
    // attacks), half is physical. Each is absorbed by its own shield —
    // a player who built only physical block has zero defense against
    // the composure half, and vice versa. Forces dual management.
    let compIncoming = Math.ceil(incoming / 2);
    let hpIncoming = incoming - compIncoming;
    // Poise absorbs composure half.
    if (state.poise > 0) {
      const absorbed = Math.min(state.poise, compIncoming);
      state.poise -= absorbed; compIncoming -= absorbed;
    }
    // Block absorbs HP half.
    if (state.block > 0) {
      const absorbed = Math.min(state.block, hpIncoming);
      state.block -= absorbed; hpIncoming -= absorbed;
    }
    state.composure = Math.max(0, state.composure - compIncoming);
    state.hp = Math.max(0, state.hp - hpIncoming);

    // v2.27: HIT ME AGAIN — arm a charge for next turn if ANY damage made
    // it through this turn (block-absorbed counts per spec). Sim composite
    // model: +1 per landed enemy turn. Charges never reset within combat.
    if (state.hitMeAgainInstalled && incoming > 0) {
      state.hitMeAgainCharges = (state.hitMeAgainCharges || 0) + 1;
    }

    // v2.10: annotation damageOnEnemyAttack (reactive).
    if (enemy.annotation?.effect?.damageOnEnemyAttack && (compIncoming + hpIncoming) > 0) {
      enemy.currentComp = Math.max(0, enemy.currentComp - enemy.annotation.effect.damageOnEnemyAttack);
    }

    // Player KO check
    if (state.hp <= 0 || state.composure <= 0) {
      return { outcome: 'lost', turns, killedBy: enemy.id, telemetry };
    }

    // End-of-turn cleanup
    state.discard.push(...state.hand);
    state.hand = [];
    // v2.28: STUBBORN BLOCK conversion. If the power is installed, each
    // unspent energy at end of turn converts to +2 Block AND the normal
    // block reset is skipped (block carries over to next turn). Without
    // the power, block resets to 0 as usual.
    if (state.stubbornBlockInstalled) {
      const converted = Math.max(0, state.energy) * 2;
      if (converted > 0) {
        state.block += converted;
        telemetry.stubbornBlockConverted = (telemetry.stubbornBlockConverted || 0) + converted;
      }
      // Skip the block-reset — stubbornness DOESN'T move.
    } else {
      state.block = 0;
    }
    state.poise = 0; // v2.9: poise fades end-of-turn like block
    // v2.24: RAGE turn ends. Roll the +0.5 potency bump back, reset meter.
    if (state.rageActive) {
      state.playerDmgMult = Math.max(0.5, (state.playerDmgMult || 1) - 0.5);
      state.tunnelVision = 0;
      state.rageActive = false;
    }
    // v2.26: STORM OUT — intentHidden persists through ONE upcoming player
    // turn. The flag was set when the storm-out cast resolved THIS turn;
    // the next player turn renders the hidden intent; the turn after that
    // clears it. Two-step lifecycle mirrors App.jsx's stormOutFiredRef.
    if (state.intentHidden) {
      if (state.stormOutJustFired) {
        // The hidden-intent turn the player is about to play. Keep the flag
        // up but consume the "just fired" sentinel.
        state.stormOutJustFired = false;
      } else {
        state.intentHidden = false;
      }
    }
    drawCards(state, HAND_SIZE);
  }

  // Stall
  return { outcome: 'stall', turns, killedBy: enemy.id, telemetry };
}

// v2.4: slot-weighted reward draft. The lane pools have 25 intros + 25
// subjects + 15 targets + 10 modifiers — uniform random oversamples
// intros/subjects and undersamples the targets the player actually
// needs to cast. Slot weights keep target draws healthy as deck grows.
const SLOT_WEIGHTS = { target: 35, intro: 25, subject: 25, modifier: 15 };
function pickSlotWeighted(cards) {
  if (cards.length === 0) return null;
  const total = cards.reduce((s, c) => s + (SLOT_WEIGHTS[c.slot] || 10), 0);
  let r = rnd() * total;
  for (const c of cards) {
    r -= (SLOT_WEIGHTS[c.slot] || 10);
    if (r <= 0) return c;
  }
  return cards[cards.length - 1];
}
// Add a random lane-pure card to the deck on combat win.
// v2.9: defensive skill cards a smart player would pick from rewards when
// available. The sim models this by sometimes substituting a defense skill
// for a v2 card reward — proportional to how "underdefended" the player
// currently is. Without this, the deck dilutes defense over time and elites
// are unwinnable, which doesn't match real play where players actively
// pursue defense.
const DEFENSE_REWARDS = [
  { id: 'c-mend',   type: 'skill', cost: 1, effects: { block: 7 }, name: 'Mend' },
  { id: 'c-steady', type: 'skill', cost: 1, effects: { poise: 7 }, name: 'Steady Breath' },
];

function awardReward(state) {
  // Count defense cards in current deck.
  const allCards = [...state.deck, ...state.hand, ...state.discard, ...state.exiled];
  const blockCount = allCards.filter(c => c.id === 'c-defend' || c.id === 'c-mend').length;
  const poiseCount = allCards.filter(c => c.id === 'c-compose' || c.id === 'c-steady').length;
  // If a defense type is below 2 cards AND coinflip, grant that defender.
  if ((blockCount < 2 || poiseCount < 2) && rnd() < 0.4) {
    // Pick whichever shield is weaker; tie → coinflip.
    const needBlock = blockCount < poiseCount || (blockCount === poiseCount && rnd() < 0.5);
    const def = needBlock ? DEFENSE_REWARDS[0] : DEFENSE_REWARDS[1];
    state.discard.push({ ...def, uid: uid() });
    state.rewardsTaken.push(def.id);
    return;
  }
  const pool = LANE_POOL[state.lane];
  const commons = pool.filter(c => c.rarity === 'common');
  const uncommons = pool.filter(c => c.rarity === 'uncommon');
  const rares = pool.filter(c => c.rarity === 'rare');
  // Rarity roll: 15% rare, 60% uncommon, 25% common. Then within the
  // chosen rarity bucket, pick weighted by slot.
  const roll = rnd();
  let bucket;
  if (roll < 0.15 && rares.length) bucket = rares;
  else if (roll < 0.75 && uncommons.length) bucket = uncommons;
  else bucket = commons;
  const card = pickSlotWeighted(bucket);
  if (!card) return;
  state.discard.push({ ...card, uid: uid() });
  state.rewardsTaken.push(card.id);
}

function classifyArchetype(deck) {
  const counts = { intro: 0, subject: 0, target: 0, modifier: 0 };
  const tiers = { 1: 0, 2: 0, 3: 0 };
  for (const c of deck) {
    if (c.slot) counts[c.slot]++;
    if (c.tier) tiers[c.tier]++;
  }
  const total = counts.intro + counts.subject + counts.target + counts.modifier;
  const t3Frac = total ? tiers[3] / total : 0;
  if (t3Frac > 0.4) return 'honed-t3';
  if (tiers[2] + tiers[3] > total * 0.5) return 'mid-t2t3';
  return 'low-tier';
}

// v2.9: familiar variety in sim. Apply the bonus at run start; track in
// telemetry. Mirrors the App's FAMILIARS table — only the bonuses that
// shift balance are encoded here (maxHp, damageReduction, startBlock,
// extraDraw, startEnergy, startOfTurnBlock).
// v2.14 familiar values mirrored from App.jsx — see balance commit notes.
const SIM_FAMILIARS = [
  { id: 'fam-raven',    name: 'Raven',     bonus: { startCombatDraw: 1 } },
  { id: 'fam-cat',      name: 'Cat',       bonus: { startCombatBlock: 4, startCombatDraw: 1 } }, // v2.16: 5 → 4+draw
  { id: 'fam-toad',     name: 'Toad',      bonus: { combatEndHeal: 3 } },
  { id: 'fam-mouse',    name: 'Mouse',     bonus: { startCombatEnergy: 1 } },
  { id: 'fam-owl',      name: 'Owl',       bonus: { maxHpBonus: 8, combatEndHeal: 2 } }, // v2.16: + heal
  { id: 'fam-beetle',   name: 'Beetle',    bonus: { maxHpBonus: 6, firstHitReduction: 3 } },
  { id: 'fam-hedgehog', name: 'Hedgehog',  bonus: { startOfTurnBlock: 1 } }, // v2.14: 2 → 1
  { id: 'fam-crow',     name: 'Crow',      bonus: { onKillHeal: 2 } },
  { id: 'fam-snake',    name: 'Snake',     bonus: { maxHpBonus: 5, startCombatVuln: 2 } }, // v2.14: + maxHp
  { id: 'fam-rabbit',   name: 'Rabbit',    bonus: { startCombatPoise: 2 } }, // v2.14: 3 → 2
];

function simRun(forcedLane = null) {
  const lane = forcedLane || pickRandom(['wit', 'chutzpah', 'jnsq']);
  const familiar = pickRandom(SIM_FAMILIARS);
  const fb = familiar.bonus || {};
  const maxHp = STARTING_MAX_HP + (fb.maxHpBonus || 0);
  const state = {
    hp: maxHp, maxHp,
    composure: STARTING_MAX_COMPOSURE, maxComposure: STARTING_MAX_COMPOSURE,
    block: 0, poise: 0, energy: 0,
    deck: buildStarterDeck(lane), hand: [], discard: [], exiled: [],
    lane, rewardsTaken: [],
    enemyDmgMult: 1.0, playerDmgMult: 1.0,
    familiar: familiar.id, familiarName: familiar.name, familiarBonus: fb,
  };
  const tele = {
    castsAttempted: 0, fizzles: 0, holds: 0, totalDamageDealt: 0,
    tier1Casts: 0, tier2Casts: 0, tier3Casts: 0,
    combatTurns: 0, combatCount: 0,
    // v2.24: chutzpah tunnel-vision / rage telemetry.
    rageTriggers: 0, bareKnucklesCasts: 0, bareKnucklesMisfires: 0,
    // v2.25: chutzpah doubling-down telemetry.
    doubleDownCasts: 0, cornerTokenBills: 0, cornerTokenDamage: 0,
    // v2.26: chutzpah storm-out telemetry.
    stormOutCasts: 0, stormOutEnergySpent: 0,
    // v2.27: chutzpah hit-me-again telemetry.
    hitMeAgainInstalls: 0, hitMeAgainRecoilTotal: 0, hitMeAgainKills: 0,
    // v2.28: chutzpah stubborn-block telemetry.
    stubbornBlockInstalls: 0, stubbornBlockConverted: 0,
    // v2.29: chutzpah saying-it-louder telemetry. iSaidCasts counts the
    // number of "I SAID." casts; loudCountSum accumulates the loudCount
    // observed on each such cast so we can compute mean stack-size.
    iSaidCasts: 0, loudCountSum: 0, loudBonusSum: 0,
  };
  let lastResult = null;
  let actsCleared = 0;

  // v2.22: post-combat heal nerfed 15% → 4% (live-play attrition fix;
  // user hovered 50-70 HP through whole act 1).
  const POST_COMBAT_HEAL_RATIO = 0.04;
  const postCombatHeal = () => {
    state.hp = Math.min(state.maxHp, state.hp + Math.floor(state.maxHp * POST_COMBAT_HEAL_RATIO));
    state.composure = Math.min(state.maxComposure, state.composure + Math.floor(state.maxComposure * POST_COMBAT_HEAL_RATIO));
    // v2.9: familiar combat-end heal (Owl, Toad).
    if (state.familiarBonus?.combatEndHeal) {
      state.hp = Math.min(state.maxHp, state.hp + state.familiarBonus.combatEndHeal);
    }
  };

  for (const act of ACTS) {
    // 3 normals
    for (let i = 0; i < 3; i++) {
      const r = runCombat(state, pickRandom(ACT_NORMALS[act.id]), tele);
      tele.combatCount++;
      tele.combatTurns += r.turns;
      lastResult = { ...r, where: `act${act.id}-normal-${i}` };
      if (r.outcome !== 'won') return { lane, familiar: state.familiar, actsCleared, ...tele, ...lastResult, finalHp: state.hp, finalComposure: state.composure, finalDeckSize: state.deck.length + state.discard.length + state.exiled.length };
      awardReward(state);
      postCombatHeal();
    }
    // 1 elite
    const eliteR = runCombat(state, pickRandom(ACT_ELITES[act.id]), tele);
    tele.combatCount++; tele.combatTurns += eliteR.turns;
    lastResult = { ...eliteR, where: `act${act.id}-elite` };
    if (eliteR.outcome !== 'won') return { lane, familiar: state.familiar, actsCleared, ...tele, ...lastResult, finalHp: state.hp, finalComposure: state.composure, finalDeckSize: state.deck.length + state.discard.length + state.exiled.length };
    awardReward(state);
    postCombatHeal();
    // Boss
    const bossR = runCombat(state, act.bossId, tele);
    tele.combatCount++; tele.combatTurns += bossR.turns;
    lastResult = { ...bossR, where: `act${act.id}-boss` };
    if (bossR.outcome !== 'won') return { lane, familiar: state.familiar, actsCleared, ...tele, ...lastResult, finalHp: state.hp, finalComposure: state.composure, finalDeckSize: state.deck.length + state.discard.length + state.exiled.length };
    actsCleared++;
    awardReward(state);
    // Inter-act heal (in addition to post-combat heal) — bigger swing
    // when crossing acts.
    state.hp = Math.min(state.maxHp, state.hp + Math.floor(state.maxHp * INTER_ACT_HEAL_RATIO));
    state.composure = Math.min(state.maxComposure, state.composure + Math.floor(state.maxComposure * INTER_ACT_HEAL_RATIO));
  }

  const finalDeck = [...state.deck, ...state.discard, ...state.hand, ...state.exiled];
  return {
    lane, familiar: state.familiar, actsCleared, outcome: 'won', ...tele,
    finalHp: state.hp, finalComposure: state.composure, finalDeckSize: finalDeck.length,
    archetype: classifyArchetype(finalDeck),
  };
}

// =============================================================================
// 4. REPORTING
// =============================================================================

function mean(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }
function pct(x) { return (x * 100).toFixed(1) + '%'; }

function aggregate(results) {
  const wins = results.filter(r => r.outcome === 'won').length;
  const lossesByEnemy = {};
  const lossesByAct = [0, 0, 0, 0, 0];
  for (const r of results) {
    if (r.outcome !== 'won') {
      const e = r.killedBy || 'unknown';
      lossesByEnemy[e] = (lossesByEnemy[e] || 0) + 1;
      lossesByAct[r.actsCleared || 0]++;
    }
  }
  const byLane = { wit: [], chutzpah: [], jnsq: [] };
  for (const r of results) byLane[r.lane].push(r);
  const laneStats = {};
  for (const lane of Object.keys(byLane)) {
    const arr = byLane[lane];
    const w = arr.filter(r => r.outcome === 'won').length;
    laneStats[lane] = { n: arr.length, wins: w, winRate: arr.length ? w / arr.length : 0 };
  }
  // v2.9: per-familiar win rates.
  const byFam = {};
  for (const r of results) {
    const k = r.familiar || 'unknown';
    if (!byFam[k]) byFam[k] = [];
    byFam[k].push(r);
  }
  const famStats = {};
  for (const fam of Object.keys(byFam)) {
    const arr = byFam[fam];
    const w = arr.filter(r => r.outcome === 'won').length;
    famStats[fam] = { n: arr.length, wins: w, winRate: arr.length ? w / arr.length : 0 };
  }
  return {
    N: results.length, wins, winRate: wins / results.length,
    lossesByEnemy, lossesByAct,
    laneStats, famStats,
    totalCasts: results.reduce((s, r) => s + (r.castsAttempted || 0), 0),
    totalFizzles: results.reduce((s, r) => s + (r.fizzles || 0), 0),
    totalHolds: results.reduce((s, r) => s + (r.holds || 0), 0),
    tier1Casts: results.reduce((s, r) => s + (r.tier1Casts || 0), 0),
    tier2Casts: results.reduce((s, r) => s + (r.tier2Casts || 0), 0),
    tier3Casts: results.reduce((s, r) => s + (r.tier3Casts || 0), 0),
    // v2.24: tunnel-vision / rage metrics.
    rageTriggers: results.reduce((s, r) => s + (r.rageTriggers || 0), 0),
    rageTriggerRuns: results.filter(r => (r.rageTriggers || 0) > 0).length,
    bareKnucklesCasts: results.reduce((s, r) => s + (r.bareKnucklesCasts || 0), 0),
    bareKnucklesMisfires: results.reduce((s, r) => s + (r.bareKnucklesMisfires || 0), 0),
    // v2.25: doubling-down metrics.
    doubleDownCasts: results.reduce((s, r) => s + (r.doubleDownCasts || 0), 0),
    doubleDownRuns: results.filter(r => (r.doubleDownCasts || 0) > 0).length,
    cornerTokenBills: results.reduce((s, r) => s + (r.cornerTokenBills || 0), 0),
    cornerTokenDamage: results.reduce((s, r) => s + (r.cornerTokenDamage || 0), 0),
    cornerTokenKOs: results.filter(r => r.killedBy === 'cornerTokens').length,
    // v2.26: storm-out metrics.
    stormOutCasts: results.reduce((s, r) => s + (r.stormOutCasts || 0), 0),
    stormOutRuns: results.filter(r => (r.stormOutCasts || 0) > 0).length,
    stormOutEnergySpent: results.reduce((s, r) => s + (r.stormOutEnergySpent || 0), 0),
    // v2.27: hit-me-again metrics.
    hitMeAgainInstalls: results.reduce((s, r) => s + (r.hitMeAgainInstalls || 0), 0),
    hitMeAgainInstallRuns: results.filter(r => (r.hitMeAgainInstalls || 0) > 0).length,
    hitMeAgainRecoilTotal: results.reduce((s, r) => s + (r.hitMeAgainRecoilTotal || 0), 0),
    hitMeAgainKills: results.reduce((s, r) => s + (r.hitMeAgainKills || 0), 0),
    // v2.28: stubborn-block metrics.
    stubbornBlockInstalls: results.reduce((s, r) => s + (r.stubbornBlockInstalls || 0), 0),
    stubbornBlockInstallRuns: results.filter(r => (r.stubbornBlockInstalls || 0) > 0).length,
    stubbornBlockConverted: results.reduce((s, r) => s + (r.stubbornBlockConverted || 0), 0),
    // v2.29: saying-it-louder metrics.
    iSaidCasts: results.reduce((s, r) => s + (r.iSaidCasts || 0), 0),
    iSaidRuns: results.filter(r => (r.iSaidCasts || 0) > 0).length,
    loudCountSum: results.reduce((s, r) => s + (r.loudCountSum || 0), 0),
    loudBonusSum: results.reduce((s, r) => s + (r.loudBonusSum || 0), 0),
    avgTurnsPerCombat: results.length ? mean(results.map(r => (r.combatTurns || 0) / Math.max(1, r.combatCount || 1))) : 0,
    avgDamageDealt: mean(results.map(r => r.totalDamageDealt || 0)),
    finalDeckSizeMean: mean(results.map(r => r.finalDeckSize || 0)),
    archetypeCounts: results.filter(r => r.outcome === 'won').reduce((m, r) => { m[r.archetype || 'unknown'] = (m[r.archetype || 'unknown'] || 0) + 1; return m; }, {}),
  };
}

function buildReport(agg) {
  const lines = [];
  lines.push(`# Wizard Graduation v2 — Playtest Report`);
  lines.push('');
  lines.push(`N = **${agg.N}** runs simulated with a greedy v2 AI.`);
  lines.push('');
  lines.push(`## Win rate`);
  lines.push(`- **${agg.wins} wins / ${agg.N}** = **${pct(agg.winRate)}**`);
  lines.push(`- Losses by acts-cleared: 0=${agg.lossesByAct[0]} · 1=${agg.lossesByAct[1]} · 2=${agg.lossesByAct[2]} · 3=${agg.lossesByAct[3]}`);
  lines.push('');
  lines.push(`## Lane outcomes`);
  for (const [lane, s] of Object.entries(agg.laneStats)) {
    lines.push(`- **${lane}**: ${s.n} runs · ${s.wins} wins (${pct(s.winRate)})`);
  }
  lines.push('');
  lines.push(`## Familiar outcomes (v2.9)`);
  const famSorted = Object.entries(agg.famStats).sort((a, b) => b[1].winRate - a[1].winRate);
  for (const [fam, s] of famSorted) {
    lines.push(`- **${fam}**: ${s.n} runs · ${s.wins} wins (${pct(s.winRate)})`);
  }
  lines.push('');
  lines.push(`## Cast distribution`);
  const tot = agg.tier1Casts + agg.tier2Casts + agg.tier3Casts || 1;
  lines.push(`- Total casts: ${agg.totalCasts}`);
  lines.push(`- Tier 1 (COHERENT): ${agg.tier1Casts} (${pct(agg.tier1Casts/tot)})`);
  lines.push(`- Tier 2 (RESONANT): ${agg.tier2Casts} (${pct(agg.tier2Casts/tot)})`);
  lines.push(`- Tier 3 (DEVASTATING): ${agg.tier3Casts} (${pct(agg.tier3Casts/tot)})`);
  lines.push(`- Holds (turn ended without cast — tray persists): ${agg.totalHolds} (${pct(agg.totalHolds / (agg.totalCasts + agg.totalHolds))})`);
  lines.push('');
  lines.push(`## Chutzpah TUNNEL VISION (v2.24)`);
  lines.push(`- Total RAGE triggers: ${agg.rageTriggers}`);
  lines.push(`- Runs with at least one RAGE turn: ${agg.rageTriggerRuns} / ${agg.N} (${pct(agg.rageTriggerRuns / agg.N)})`);
  lines.push(`- Bare Knuckles casts: ${agg.bareKnucklesCasts} (misfires: ${agg.bareKnucklesMisfires})`);
  lines.push('');
  lines.push(`## Chutzpah DOUBLING DOWN (v2.25)`);
  lines.push(`- Total double-down casts: ${agg.doubleDownCasts}`);
  lines.push(`- Runs with at least one double-down cast: ${agg.doubleDownRuns} / ${agg.N} (${pct(agg.doubleDownRuns / agg.N)})`);
  lines.push(`- Corner-token bills (enemy survived → -HP): ${agg.cornerTokenBills}`);
  lines.push(`- HP lost to corner-tokens: ${agg.cornerTokenDamage}`);
  lines.push(`- Runs KO'd by corner-tokens: ${agg.cornerTokenKOs}`);
  lines.push('');
  lines.push(`## Chutzpah STORMING OUT (v2.26)`);
  lines.push(`- Storm Out casts: ${agg.stormOutCasts} (avg energy spent: ${agg.stormOutCasts > 0 ? (agg.stormOutEnergySpent / agg.stormOutCasts).toFixed(2) : '0.00'})`);
  lines.push(`- Runs with at least one Storm Out: ${agg.stormOutRuns} / ${agg.N} (${pct(agg.stormOutRuns / agg.N)})`);
  lines.push('');
  lines.push(`## Chutzpah HIT ME AGAIN (v2.27)`);
  lines.push(`- Hit Me Again installs: ${agg.hitMeAgainInstalls} (runs: ${agg.hitMeAgainInstallRuns} / ${agg.N}, ${pct(agg.hitMeAgainInstallRuns / agg.N)})`);
  lines.push(`- Total recoil damage to enemies: ${agg.hitMeAgainRecoilTotal}`);
  lines.push(`- Enemies killed by their own recoil: ${agg.hitMeAgainKills}`);
  lines.push(`- Avg recoil per install: ${agg.hitMeAgainInstalls > 0 ? (agg.hitMeAgainRecoilTotal / agg.hitMeAgainInstalls).toFixed(1) : '0.0'}`);
  lines.push('');
  lines.push(`## Chutzpah STUBBORN BLOCK (v2.28)`);
  lines.push(`- Stubborn Block installs: ${agg.stubbornBlockInstalls} (runs: ${agg.stubbornBlockInstallRuns} / ${agg.N}, ${pct(agg.stubbornBlockInstallRuns / agg.N)})`);
  lines.push(`- Total Block converted from unspent Energy: ${agg.stubbornBlockConverted}`);
  lines.push(`- Avg converted per install: ${agg.stubbornBlockInstalls > 0 ? (agg.stubbornBlockConverted / agg.stubbornBlockInstalls).toFixed(1) : '0.0'}`);
  lines.push('');
  lines.push(`## Chutzpah SAYING IT LOUDER (v2.29)`);
  lines.push(`- "I SAID." casts: ${agg.iSaidCasts} (runs: ${agg.iSaidRuns} / ${agg.N}, ${pct(agg.iSaidRuns / agg.N)})`);
  lines.push(`- Avg loudCount per cast: ${agg.iSaidCasts > 0 ? (agg.loudCountSum / agg.iSaidCasts).toFixed(2) : '0.00'}`);
  lines.push(`- Avg bonus damage per cast: ${agg.iSaidCasts > 0 ? (agg.loudBonusSum / agg.iSaidCasts).toFixed(2) : '0.00'}`);
  lines.push(`- Total bonus damage from louder: ${agg.loudBonusSum}`);
  lines.push('');
  lines.push(`## Combat pacing`);
  lines.push(`- Avg turns / combat: ${agg.avgTurnsPerCombat.toFixed(2)}`);
  lines.push(`- Avg damage / run: ${agg.avgDamageDealt.toFixed(0)}`);
  lines.push(`- Mean final deck size: ${agg.finalDeckSizeMean.toFixed(1)}`);
  lines.push('');
  lines.push(`## Archetype of winning decks`);
  for (const [arch, count] of Object.entries(agg.archetypeCounts)) {
    lines.push(`- ${arch}: ${count}`);
  }
  lines.push('');
  lines.push(`## Top killer enemies`);
  const ranked = Object.entries(agg.lossesByEnemy).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [id, count] of ranked) {
    const e = ENEMIES_BY_ID[id];
    lines.push(`- ${id}${e ? ` (${e.name})` : ''}: ${count}`);
  }
  return lines.join('\n');
}

// =============================================================================
// 5. DRIVER
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isMain = (typeof process !== 'undefined' && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]);
if (isMain) {
  const N = parseInt(process.argv[2] || '50', 10);
  // v2.12: optional lane filter as 3rd arg (--lane=wit or just `wit`).
  const laneArg = (process.argv[3] || '').replace(/^--lane=/, '').toLowerCase();
  const forcedLane = ['wit', 'chutzpah', 'jnsq'].includes(laneArg) ? laneArg : null;
  console.log(`Running ${N} v2 playtests${forcedLane ? ` (lane=${forcedLane})` : ''}…`);
  const results = [];
  for (let i = 0; i < N; i++) {
    results.push(simRun(forcedLane));
    if ((i + 1) % 50 === 0) console.log(`  …${i + 1} done`);
  }
  const agg = aggregate(results);
  const report = buildReport(agg);
  const suffix = forcedLane ? `-${forcedLane}` : '';
  const out = path.join(__dirname, `report-v2${suffix}.md`);
  fs.writeFileSync(out, report);
  console.log(`\nWrote ${out}`);
  console.log(`Win rate: ${pct(agg.winRate)}`);
  console.log(`Avg turns/combat: ${agg.avgTurnsPerCombat.toFixed(2)}`);
  console.log(`Tier distribution: T1=${agg.tier1Casts} T2=${agg.tier2Casts} T3=${agg.tier3Casts}`);
}

export { simRun, aggregate, buildReport };
