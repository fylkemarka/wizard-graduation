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
  // Act 1 (placeholder bosses come from each path's act)
  { id: 'e1-acolyte',       act: 4, name: 'Lost Acolyte',        comp: 20, hp: 18,  tier: 'normal', atk: 4, effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 1.0, physical: 1.0 } },
  { id: 'e1-imp',           act: 4, name: 'Pact Imp',            comp: 18, hp: 999, tier: 'normal', atk: 4, effectiveness: { chutzpah: 0.7, wit: 1.0, jnsq: 1.5, physical: 1.0 } },
  { id: 'e1-shrine-rat',    act: 4, name: 'Shrine Rat Pack',     comp: 16, hp: 12,  tier: 'normal', atk: 6, effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.0, physical: 1.5 } },
  { id: 'e1-tutor',         act: 4, name: 'Stern Tutor',         comp: 32, hp: 999, tier: 'elite',  atk: 7, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 2.0, physical: 0.5 } },
  { id: 'e1-thicket',       act: 4, name: 'Living Thicket',      comp: 55, hp: 38,  tier: 'elite',  atk: 8, effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 0.5, physical: 1.0 } },
  { id: 'e1-boss-thornlord',act: 4, name: 'The Thornlord',       comp: 100,hp: 120, tier: 'boss',   atk: 9, effectiveness: { chutzpah: 0.7, wit: 1.0, jnsq: 1.5, physical: 1.0 } },
  // Act 2
  { id: 'e2-hollow-weaver', act: 1, name: 'Hollow Weaver',       comp: 18, hp: 999, tier: 'normal', atk: 4, effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.7, physical: 1.0 } },
  { id: 'e2-silk-wraith',   act: 1, name: 'Silk Wraith',         comp: 14, hp: 999, tier: 'normal', atk: 4, effectiveness: { chutzpah: 0.7, wit: 1.0, jnsq: 1.5, physical: 0.5 } },
  { id: 'e2-loom-familiar', act: 1, name: 'Loom Familiar',       comp: 20, hp: 999, tier: 'normal', atk: 4, effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 } },
  { id: 'e2-pattern-maker', act: 1, name: 'The Pattern-Maker',   comp: 28, hp: 999, tier: 'elite',  atk: 6, effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.7, physical: 1.0 } },
  { id: 'e2-silent-spinner',act: 1, name: 'The Silent Spinner',  comp: 30, hp: 999, tier: 'elite',  atk: 6, effectiveness: { chutzpah: 1.5, wit: 0.7, jnsq: 1.0, physical: 1.0 } },
  { id: 'e2-boss-tapestry', act: 1, name: 'The Tapestry Walker', comp: 44, hp: 999, tier: 'boss',   atk: 8, effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 1.0, physical: 0.5 } },
  // Act 3
  { id: 'e3-geode-crab',    act: 2, name: 'Geode Crab',          comp: 28, hp: 22,  tier: 'normal', atk: 5, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 0.7, physical: 1.0 } },
  { id: 'e3-glow-mite',     act: 2, name: 'Glow-Mite Swarm',     comp: 22, hp: 16,  tier: 'normal', atk: 5, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 1.5, physical: 1.0 } },
  { id: 'e3-crystal-beetle',act: 2, name: 'Crystal Beetle',      comp: 28, hp: 22,  tier: 'normal', atk: 5, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 0.7, physical: 1.0 } },
  { id: 'e3-quartz-sentinel',act:2, name: 'Quartz Sentinel',     comp: 35, hp: 40,  tier: 'elite',  atk: 7, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 0.7, physical: 1.0 } },
  { id: 'e3-vein-devourer', act: 2, name: 'Vein Devourer',       comp: 60, hp: 50,  tier: 'elite',  atk: 8, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 0.7, physical: 1.0 } },
  { id: 'e3-boss-anvil',    act: 2, name: 'The Anvil-Forged',    comp: 65, hp: 75,  tier: 'boss',   atk: 9, effectiveness: { chutzpah: 0.7, wit: 1.0, jnsq: 1.5, physical: 1.0 } },
  // Act 4
  { id: 'e4-apprentice-shade',act:3,name: "Apprentice's Shade",  comp: 42, hp: 999, tier: 'normal', atk: 6, effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 0.5, physical: 0.5 } },
  { id: 'e4-failed-initiate',act:3, name: 'Failed Initiate',     comp: 30, hp: 999, tier: 'normal', atk: 5, effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 1.0, physical: 0.5 } },
  { id: 'e4-test-wraith',   act: 3, name: 'Test-Day Wraith',     comp: 36, hp: 999, tier: 'normal', atk: 6, effectiveness: { chutzpah: 0.7, wit: 1.5, jnsq: 1.0, physical: 0.5 } },
  { id: 'e4-forgotten-master',act:3,name: 'Forgotten Master',    comp: 45, hp: 999, tier: 'elite',  atk: 8, effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.5, physical: 1.0 } },
  { id: 'e4-boss-headmasters-hat',act:3,name:"The Headmaster's Hat",comp:88,hp:999,tier:'boss',    atk: 11, effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.5, physical: 0.4 } },
];
const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

const ACTS = [
  { id: 1, bossId: 'e2-boss-tapestry' },
  { id: 2, bossId: 'e3-boss-anvil' },
  { id: 3, bossId: 'e4-boss-headmasters-hat' },
  { id: 4, bossId: 'e1-boss-thornlord' },
];

const ACT_NORMALS = {
  1: ['e2-hollow-weaver', 'e2-silk-wraith', 'e2-loom-familiar'],
  2: ['e3-geode-crab', 'e3-glow-mite', 'e3-crystal-beetle'],
  3: ['e4-apprentice-shade', 'e4-failed-initiate', 'e4-test-wraith'],
  4: ['e1-acolyte', 'e1-imp', 'e1-shrine-rat'],
};
const ACT_ELITES = {
  1: ['e2-pattern-maker', 'e2-silent-spinner'],
  2: ['e3-quartz-sentinel', 'e3-vein-devourer'],
  3: ['e4-forgotten-master'],
  4: ['e1-tutor', 'e1-thicket'],
};

const STARTING_MAX_HP = 70;
const STARTING_MAX_COMPOSURE = 30;
const ENERGY_PER_TURN = 3;
const HAND_SIZE = 5;
const INTER_ACT_HEAL_RATIO = 0.55;
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
  return shuffle(cards);
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
  for (let i = 0; i < state.hand.length; i++) {
    const c = state.hand[i];
    if (c.slot !== slot) continue;
    if ((c.cost || 0) > energyLeft) continue;
    const tier = c.tier || 1;
    const stat = c.stats?.[c.lane] || 0;
    if (tier > bestTier || (tier === bestTier && stat > bestStat)) {
      bestIdx = i; bestTier = tier; bestStat = stat;
    }
  }
  return bestIdx;
}

function pickBestModifier(state, energyLeft, tier, bossFight) {
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
  // Power-down: reset per-combat buffs
  state.enemyDmgMult = 1.0;
  state.playerDmgMult = 1.0;

  // Combat starts with empty hand. Draw fresh.
  state.discard = [...state.discard, ...state.hand];
  state.hand = [];
  drawCards(state, HAND_SIZE);

  let turns = 0;
  while (turns++ < MAX_COMBAT_TURNS) {
    state.energy = ENERGY_PER_TURN;
    let tray = { intro: null, subject: null, target: null, modifiers: [] };
    let cast = false;

    // AI: try to fill intro, subject, target. Then play modifier if good.
    // Multi-pass since after staging we might still have energy/options.
    let passCount = 0;
    while (passCount++ < 8) {
      let progressed = false;

      // Skill: Defend if HP/composure is low.
      if ((state.hp < 30 || state.composure < 12) && state.block < 4) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          if (c.type === 'skill' && c.id === 'c-defend' && (c.cost || 0) <= state.energy) {
            state.energy -= c.cost || 0;
            state.block += c.effects?.block || 0;
            state.discard.push(c);
            state.hand.splice(i, 1);
            progressed = true;
            break;
          }
        }
      }

      if (!tray.intro) {
        const idx = pickBestForSlot(state, 'intro', state.energy);
        if (idx >= 0) {
          tray.intro = state.hand[idx];
          state.energy -= tray.intro.cost || 0;
          state.hand.splice(idx, 1);
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
          progressed = true;
          continue;
        }
      }
      if (!tray.target) {
        const idx = pickBestForSlot(state, 'target', state.energy);
        if (idx >= 0) {
          tray.target = state.hand[idx];
          state.energy -= tray.target.cost || 0;
          state.hand.splice(idx, 1);
          progressed = true;
          continue;
        }
      }
      // After all three primary slots filled, optionally play modifier(s).
      if (tray.intro && tray.subject && tray.target && tray.modifiers.length < 2) {
        const tier = computeSpellTier(tray.intro, tray.subject, tray.target);
        const bossFight = enemy.tier === 'boss';
        const idx = pickBestModifier(state, state.energy, tier, bossFight);
        if (idx >= 0) {
          const m = state.hand[idx];
          tray.modifiers.push(m);
          state.energy -= m.cost || 0;
          state.hand.splice(idx, 1);
          progressed = true;
          continue;
        }
      }
      if (!progressed) break;
    }

    // Cast if all three slots filled.
    if (tray.intro && tray.subject && tray.target) {
      const result = computeSpellDamage(tray.intro, tray.subject, tray.target, tray.modifiers);
      let dmg = result.damage;
      const eff = tray.target.effect || {};
      const stat = eff.scaleBy || tray.target.lane || 'wit';
      const dmgType = eff.damageType || 'composure';
      const mult = (dmgType === 'physical')
        ? (enemy.effectiveness?.physical ?? 1.0)
        : (enemy.effectiveness?.[stat] ?? 1.0);
      dmg = Math.round(dmg * mult * state.playerDmgMult);

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

      // Riders affect enemy
      if (result.riders.weak)       state.enemyDmgMult = Math.max(0.5, (state.enemyDmgMult || 1) - 0.25 * result.riders.weak);
      if (result.riders.vulnerable) state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * result.riders.vulnerable);
      if (result.riders.block)      state.block += result.riders.block;

      // Side-effects
      if (result.sideEffects.drawCount) drawCards(state, result.sideEffects.drawCount);
      if (result.sideEffects.selfComposureCost) state.composure = Math.max(0, state.composure - result.sideEffects.selfComposureCost);

      // Discharge cards: intro/subject/modifiers → discard; target exiles
      // on tier-3-required failure, else discard.
      state.discard.push(tray.intro, tray.subject, ...tray.modifiers);
      if (result.sideEffects.exhaustTarget) state.exiled.push(tray.target);
      else state.discard.push(tray.target);

      cast = true;
      telemetry.castsAttempted++;
      telemetry.totalDamageDealt += dmg;
      if (result.tier === 3) telemetry.tier3Casts++;
      if (result.tier === 2) telemetry.tier2Casts++;
      if (result.tier === 1) telemetry.tier1Casts++;
    } else {
      // Fizzle: didn't cast. Stage cards still in tray go to discard.
      const fizz = [tray.intro, tray.subject, tray.target, ...tray.modifiers].filter(Boolean);
      state.discard.push(...fizz);
      telemetry.fizzles++;
    }

    // Check victory
    if (enemy.currentComp <= 0 || enemy.currentHp <= 0) return { outcome: 'won', turns, telemetry };

    // Enemy turn
    let incoming = enemy.atk;
    // Drift player buffs back toward 1.0 (0.25/turn)
    if (state.enemyDmgMult < 1.0) state.enemyDmgMult = Math.min(1.0, state.enemyDmgMult + 0.25);
    if (state.playerDmgMult > 1.0) state.playerDmgMult = Math.max(1.0, state.playerDmgMult - 0.25);
    if (state.playerDmgMult < 1.0) state.playerDmgMult = Math.min(1.0, state.playerDmgMult + 0.25);
    incoming = Math.round(incoming * (state.enemyDmgMult || 1));
    // Block absorbs
    if (state.block > 0) {
      const absorbed = Math.min(state.block, incoming);
      state.block -= absorbed; incoming -= absorbed;
    }
    // Half hits composure, half hits HP (simple model)
    const compHit = Math.ceil(incoming / 2);
    const hpHit = incoming - compHit;
    state.composure = Math.max(0, state.composure - compHit);
    state.hp = Math.max(0, state.hp - hpHit);

    // Player KO check
    if (state.hp <= 0 || state.composure <= 0) {
      return { outcome: 'lost', turns, killedBy: enemy.id, telemetry };
    }

    // End-of-turn cleanup
    state.discard.push(...state.hand);
    state.hand = [];
    state.block = 0;
    drawCards(state, HAND_SIZE);
  }

  // Stall
  return { outcome: 'stall', turns, killedBy: enemy.id, telemetry };
}

// Add a random lane-pure card to the deck on combat win
function awardReward(state) {
  const pool = LANE_POOL[state.lane];
  const commons = pool.filter(c => c.rarity === 'common');
  const uncommons = pool.filter(c => c.rarity === 'uncommon');
  const rares = pool.filter(c => c.rarity === 'rare');
  // Reward bias: 15% rare, 60% uncommon, 25% common. Pushes the player up
  // the tier curve faster than uniform commons would, so v2's "honing
  // toward higher-tier hand" loop actually plays out in a real run.
  const roll = rnd();
  let card;
  if (roll < 0.15 && rares.length) card = pickRandom(rares);
  else if (roll < 0.75 && uncommons.length) card = pickRandom(uncommons);
  else card = pickRandom(commons);
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

function simRun() {
  const lane = pickRandom(['wit', 'chutzpah', 'jnsq']);
  const state = {
    hp: STARTING_MAX_HP, maxHp: STARTING_MAX_HP,
    composure: STARTING_MAX_COMPOSURE, maxComposure: STARTING_MAX_COMPOSURE,
    block: 0, energy: 0,
    deck: buildStarterDeck(lane), hand: [], discard: [], exiled: [],
    lane, rewardsTaken: [],
    enemyDmgMult: 1.0, playerDmgMult: 1.0,
  };
  const tele = {
    castsAttempted: 0, fizzles: 0, totalDamageDealt: 0,
    tier1Casts: 0, tier2Casts: 0, tier3Casts: 0,
    combatTurns: 0, combatCount: 0,
  };
  let lastResult = null;
  let actsCleared = 0;

  for (const act of ACTS) {
    // 3 normals
    for (let i = 0; i < 3; i++) {
      const r = runCombat(state, pickRandom(ACT_NORMALS[act.id]), tele);
      tele.combatCount++;
      tele.combatTurns += r.turns;
      lastResult = { ...r, where: `act${act.id}-normal-${i}` };
      if (r.outcome !== 'won') return { lane, actsCleared, ...tele, ...lastResult, finalHp: state.hp, finalComposure: state.composure, finalDeckSize: state.deck.length + state.discard.length + state.exiled.length };
      awardReward(state);
    }
    // 1 elite
    const eliteR = runCombat(state, pickRandom(ACT_ELITES[act.id]), tele);
    tele.combatCount++; tele.combatTurns += eliteR.turns;
    lastResult = { ...eliteR, where: `act${act.id}-elite` };
    if (eliteR.outcome !== 'won') return { lane, actsCleared, ...tele, ...lastResult, finalHp: state.hp, finalComposure: state.composure, finalDeckSize: state.deck.length + state.discard.length + state.exiled.length };
    awardReward(state);
    // Boss
    const bossR = runCombat(state, act.bossId, tele);
    tele.combatCount++; tele.combatTurns += bossR.turns;
    lastResult = { ...bossR, where: `act${act.id}-boss` };
    if (bossR.outcome !== 'won') return { lane, actsCleared, ...tele, ...lastResult, finalHp: state.hp, finalComposure: state.composure, finalDeckSize: state.deck.length + state.discard.length + state.exiled.length };
    actsCleared++;
    awardReward(state);
    // Inter-act heal
    state.hp = Math.min(state.maxHp, state.hp + Math.floor(state.maxHp * INTER_ACT_HEAL_RATIO));
    state.composure = Math.min(state.maxComposure, state.composure + Math.floor(state.maxComposure * INTER_ACT_HEAL_RATIO));
  }

  const finalDeck = [...state.deck, ...state.discard, ...state.hand, ...state.exiled];
  return {
    lane, actsCleared, outcome: 'won', ...tele,
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
  return {
    N: results.length, wins, winRate: wins / results.length,
    lossesByEnemy, lossesByAct,
    laneStats,
    totalCasts: results.reduce((s, r) => s + (r.castsAttempted || 0), 0),
    totalFizzles: results.reduce((s, r) => s + (r.fizzles || 0), 0),
    tier1Casts: results.reduce((s, r) => s + (r.tier1Casts || 0), 0),
    tier2Casts: results.reduce((s, r) => s + (r.tier2Casts || 0), 0),
    tier3Casts: results.reduce((s, r) => s + (r.tier3Casts || 0), 0),
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
  lines.push(`## Cast distribution`);
  const tot = agg.tier1Casts + agg.tier2Casts + agg.tier3Casts || 1;
  lines.push(`- Total casts: ${agg.totalCasts}`);
  lines.push(`- Tier 1 (COHERENT): ${agg.tier1Casts} (${pct(agg.tier1Casts/tot)})`);
  lines.push(`- Tier 2 (RESONANT): ${agg.tier2Casts} (${pct(agg.tier2Casts/tot)})`);
  lines.push(`- Tier 3 (DEVASTATING): ${agg.tier3Casts} (${pct(agg.tier3Casts/tot)})`);
  lines.push(`- Fizzles (turn ended without cast): ${agg.totalFizzles} (${pct(agg.totalFizzles / (agg.totalCasts + agg.totalFizzles))})`);
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
  console.log(`Running ${N} v2 playtests…`);
  const results = [];
  for (let i = 0; i < N; i++) {
    results.push(simRun());
    if ((i + 1) % 25 === 0) console.log(`  …${i + 1} done`);
  }
  const agg = aggregate(results);
  const report = buildReport(agg);
  const out = path.join(__dirname, 'report-v2.md');
  fs.writeFileSync(out, report);
  console.log(`\nWrote ${out}`);
  console.log(`Win rate: ${pct(agg.winRate)}`);
  console.log(`Avg turns/combat: ${agg.avgTurnsPerCombat.toFixed(2)}`);
  console.log(`Tier distribution: T1=${agg.tier1Casts} T2=${agg.tier2Casts} T3=${agg.tier3Casts}`);
}

export { simRun, aggregate, buildReport };
