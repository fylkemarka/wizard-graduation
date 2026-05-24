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

// v2.42: each enemy carries `insultVulnerabilities` — the tag list that
// pierceVulnerableInsult targets cross-reference for bonus damage. Most
// enemies have 2-3 tags; a few (mindless / boss-of-vanity) deviate. Sim
// mirrors App.jsx tagging where it overlaps; non-overlapping enemies get
// thematic defaults (Pratchett-bureaucratic / vain / pedantic etc.).
const ENEMIES = [
  // Act 1 — Thread Path (the countryside)
  { id: 'e2-hollow-weaver', act: 1, name: 'Hollow Weaver',       comp: 44, hp: 999, tier: 'normal', atk: 8, effectiveness: { chutzpah: 1.0, wit: 1.2, jnsq: 0.7, physical: 1.0 }, insultVulnerabilities: ['dismissive', 'cutting'] },
  { id: 'e2-silk-wraith',   act: 1, name: 'Silk Wraith',         comp: 38, hp: 999, tier: 'normal', atk: 7, effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.5, physical: 0.5 }, insultVulnerabilities: ['observational', 'ironic'] },
  { id: 'e2-loom-familiar', act: 1, name: 'Loom Familiar',       comp: 46, hp: 999, tier: 'normal', atk: 7, effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 }, insultVulnerabilities: ['dismissive', 'petty'] },
  { id: 'e2-pattern-maker', act: 1, name: 'The Pattern-Maker',   comp: 70, hp: 999, tier: 'elite',  atk: 9, effectiveness: { chutzpah: 1.0, wit: 1.2, jnsq: 0.7, physical: 1.0 }, insultVulnerabilities: ['academic', 'dismissive'] },
  { id: 'e2-silent-spinner',act: 1, name: 'The Silent Spinner',  comp: 72, hp: 999, tier: 'elite',  atk: 7, effectiveness: { chutzpah: 1.5, wit: 0.7, jnsq: 1.0, physical: 1.0 }, insultVulnerabilities: ['petty', 'observational'] },
  { id: 'e2-boss-tapestry', act: 1, name: 'The Tapestry Walker', comp: 85, hp: 999, tier: 'boss',   atk: 8, effectiveness: { chutzpah: 1.0, wit: 1.2, jnsq: 1.0, physical: 0.5 }, insultVulnerabilities: ['dismissive', 'petty', 'sarcastic'] },
  { id: 'e-rogue-linenfast', act: 1, name: 'Bartholomew Linenfast', comp: 42, hp: 999, tier: 'normal', atk: 6, effectiveness: { chutzpah: 1.0, wit: 0.8, jnsq: 1.3, physical: 1.0 }, insultVulnerabilities: ['dismissive', 'observational'] },
  // Act 2 — Forge Path (the mines and caves)
  { id: 'e3-geode-crab',    act: 2, name: 'Geode Crab',          comp: 44, hp: 22,  tier: 'normal', atk: 6, effectiveness: { chutzpah: 1.5, wit: 0.7, jnsq: 0.7, physical: 1.0 }, insultVulnerabilities: [] },
  { id: 'e3-glow-mite',     act: 2, name: 'Glow-Mite Swarm',     comp: 34, hp: 16,  tier: 'normal', atk: 6, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 1.5, physical: 1.0 }, insultVulnerabilities: [] },
  { id: 'e3-crystal-beetle',act: 2, name: 'Crystal Beetle',      comp: 44, hp: 22,  tier: 'normal', atk: 6, effectiveness: { chutzpah: 0.5, wit: 1.2, jnsq: 0.7, physical: 1.0 }, insultVulnerabilities: ['petty'] },
  { id: 'e3-quartz-sentinel',act:2, name: 'Quartz Sentinel',     comp: 50, hp: 40,  tier: 'elite',  atk: 8, effectiveness: { chutzpah: 0.7, wit: 1.2, jnsq: 0.7, physical: 1.0 }, insultVulnerabilities: ['academic', 'dismissive'] },
  { id: 'e3-vein-devourer', act: 2, name: 'Vein Devourer',       comp: 80, hp: 50,  tier: 'elite',  atk: 10,effectiveness: { chutzpah: 1.5, wit: 0.7, jnsq: 0.7, physical: 1.0 }, insultVulnerabilities: [] },
  { id: 'e3-boss-anvil',    act: 2, name: 'The Anvil-Forged',    comp: 65, hp: 75,  tier: 'boss',   atk: 9, effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 0.7, physical: 1.0 }, insultVulnerabilities: ['dismissive', 'petty', 'absurd'] },
  { id: 'e-rogue-smelterson', act: 2, name: 'Smelterson, J.C.', comp: 48, hp: 26, tier: 'normal', atk: 7, effectiveness: { chutzpah: 0.6, wit: 1.1, jnsq: 1.3, physical: 1.0 }, insultVulnerabilities: ['academic', 'petty'] },
  // Act 3 — Staff Path (the deep forest, final act)
  { id: 'e1-acolyte',       act: 3, name: 'Lost Acolyte',        comp: 20, hp: 18,  tier: 'normal', atk: 4, effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 1.0, physical: 1.0 }, insultVulnerabilities: ['dismissive', 'cutting'] },
  { id: 'e1-imp',           act: 3, name: 'Pact Imp',            comp: 18, hp: 999, tier: 'normal', atk: 4, effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.5, physical: 1.0 }, insultVulnerabilities: ['dismissive', 'sarcastic'] },
  { id: 'e1-shrine-rat',    act: 3, name: 'Shrine Rat Pack',     comp: 16, hp: 12,  tier: 'normal', atk: 6, effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.0, physical: 1.5 }, insultVulnerabilities: [] },
  { id: 'e1-tutor',         act: 3, name: 'Stern Tutor',         comp: 32, hp: 999, tier: 'elite',  atk: 7, effectiveness: { chutzpah: 0.7, wit: 0.7, jnsq: 2.0, physical: 0.5 }, insultVulnerabilities: ['absurd', 'ironic'] },
  { id: 'e1-thicket',       act: 3, name: 'Living Thicket',      comp: 55, hp: 38,  tier: 'elite',  atk: 8, effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 0.7, physical: 1.0 }, insultVulnerabilities: [] },
  { id: 'e1-boss-thornlord',act: 3, name: 'The Thornlord',       comp: 95, hp: 115, tier: 'boss',   atk: 9, effectiveness: { chutzpah: 0.75, wit: 1.0, jnsq: 1.3, physical: 1.0 }, insultVulnerabilities: ['petty', 'dismissive', 'sarcastic'] },
  { id: 'e-rogue-ashweather', act: 3, name: 'Doctor Phin Ashweather', comp: 36, hp: 32, tier: 'normal', atk: 7, effectiveness: { chutzpah: 0.6, wit: 1.4, jnsq: 1.0, physical: 1.0 }, insultVulnerabilities: ['academic', 'observational'] },
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
function pickBestForSlot(state, slot, energyLeft, enemy = null) {
  let bestIdx = -1, bestTier = -1, bestStat = -1;
  // v2.29: detect if a loudScaling target ("I SAID.") is in hand. If so,
  // bias toward chutzpah cards carrying the 'demanding' tag in same-tier
  // slot picks — each demanding word adds +3 to the eventual cast for free.
  const hasLoudTarget = (slot === 'intro' || slot === 'subject' || slot === 'modifier')
    && state.hand.some(c => c.lane === 'chutzpah' && c.effect?.loudScaling);
  // v2.30: detect if a predator target ("comes apart in your hands.") is in
  // hand. If so, strongly bias toward debuff-applying word cards in this
  // slot pick — applying Vuln/Weak BEFORE the cast arms the +6 predator
  // bonus. "smells like blood in the water," is the dedicated setup subject
  // (vulnerable: 1 on stage); other intros/subjects with effects.vulnerable
  // or effects.weak also qualify.
  const hasPredatorTarget = (slot === 'intro' || slot === 'subject' || slot === 'modifier')
    && state.hand.some(c => c.lane === 'chutzpah' && (c.effect?.predator || 0) > 0);
  // v2.42: detect if a pierceVulnerableInsult wit target is in hand AND the
  // current enemy has a non-empty insultVulnerabilities list. If so, bias
  // toward cards whose tags overlap with the vulns list — each matched tag
  // adds (pierce × tag) flat damage to the eventual cast (capped at 3
  // matches). The strongest signal is multi-tag subjects ("your manner of
  // speaking," = +3 potential matches in one card).
  const enemyVulns = enemy?.insultVulnerabilities || [];
  const pierceTarget = (slot === 'intro' || slot === 'subject' || slot === 'modifier') && enemyVulns.length > 0
    ? state.hand.find(c => c.lane === 'wit' && (c.effect?.pierceVulnerableInsult || 0) > 0)
    : null;
  const pierceVal = pierceTarget?.effect?.pierceVulnerableInsult || 0;
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
    // v2.30: when a predator target is in hand, bias toward debuff-appliers
    // (vulnerable or weak) staged BEFORE the cast. The bonus is +6 flat —
    // larger than the loud-bonus per-card +3 — so the bias is stronger.
    if (hasPredatorTarget && c.lane === 'chutzpah'
        && (c.effects?.vulnerable || c.effects?.weak)) {
      effectiveStat = effectiveStat + 5;
    }
    // v2.42: when a pierce target is in hand AND the enemy has vulns, bias
    // toward cards whose tags overlap with the vulns list. Each matched tag
    // is worth ≈ pierceVal flat dmg on the eventual cast — we add half that
    // per match to the effectiveStat (so 4-pierce + 2 matches = +4 stat
    // bias). Cap stat contribution to keep this from blowing past tier
    // preference; the multi-tag subject still naturally edges its tier.
    if (pierceTarget && enemyVulns.length > 0) {
      const matched = (c.tags || []).filter(t => enemyVulns.includes(t)).length;
      if (matched > 0) {
        effectiveStat = effectiveStat + Math.min(matched * Math.ceil(pierceVal / 2), 6);
      }
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
        playerDmgMult: state.playerDmgMult || 1.0, // v2.30
        enemyDmgMult: state.enemyDmgMult || 1.0, // v2.30
        longThread: state.longThread || 0, // v2.34
        combatTurn: state._combatTurn || 1, // v2.39
        openingExtended: !!state.openingExtended, // v2.39
        insultVulnerabilities: enemy?.insultVulnerabilities || [], // v2.42
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
      // v2.33: gate loosened 1.1 → 0.8 because at 1.0 the preview excludes
      // modifiers (cast time adds them, real dmg > predicted) so all 1.0-gated
      // casts killed → 0 corner-token bills (toothless punishment side).
      // At 0.8 the AI gambles when predicted is 20% short of kill — modifiers
      // may close it, may not. Bills fire against blocker enemies and cold
      // variance. Per creator brief: "exposes the punishment side."
      if (predicted < remaining * 0.8) continue;
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
        playerDmgMult: state.playerDmgMult || 1.0, // v2.30
        enemyDmgMult: state.enemyDmgMult || 1.0, // v2.30
        longThread: state.longThread || 0, // v2.34
        combatTurn: state._combatTurn || 1, // v2.39
        openingExtended: !!state.openingExtended, // v2.39
        insultVulnerabilities: enemy?.insultVulnerabilities || [], // v2.42
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
    // v2.34: wit LONG THREAD bias — when wit-committed AND we hold a
    // threadScaling target AND the meter is already ≥ 1, prefer it. The
    // bonus damage from threadScaling is `N × longThread` flat. Even at
    // LT=1 that's +3 dmg on the cast; at LT=3 it's +9, at LT=5 it's +15.
    // This nudges the AI to cash in the build-up instead of casting a
    // baseline-stat target. Bias scales with the meter so a high LT
    // overrides higher-tier alternatives.
    if (c.effect?.threadScaling > 0 && state.lane === 'wit' && (state.longThread || 0) >= 1) {
      score += Math.min(25, (state.longThread || 0) * (c.effect.threadScaling || 0));
    }
    // v2.39: prefer openingBonus targets on turn 1 OR when openingExtended is
    // armed. The bonus is flat +N so it most usefully lifts a tier-1 target
    // into mid-tier territory; bias scales with the bonus to keep heavier
    // openers (future +6/+8 variants) ahead of lighter ones. The +15 floor
    // ensures a tier-1 opener edges out a tier-2 baseline target on turn 1
    // (tier-2 baseline = 23, opener = 12 + 15 = 27).
    if (c.effect?.openingBonus > 0 && state.lane === 'wit') {
      const firstTurn = (state._combatTurn || 1) === 1;
      const extended = !!state.openingExtended;
      if (firstTurn || extended) {
        score += Math.max(15, Math.min(25, (c.effect.openingBonus || 0) * 3));
      }
    }
    // v2.42: pierceVulnerableInsult bias. If enemy has insultVulnerabilities
    // AND any staged or in-hand WIT word/modifier has a tag overlap, prefer
    // the pierce target. Bias is proportional to the potential bonus: count
    // tag matches across (intro + subject + every in-hand word/mod), cap at
    // 3, multiply by pierce value. A baseline pierce target with 2 matched
    // tags ≈ 2 × 4 = +8 dmg expected, so +14 score gets it over a tier-2
    // baseline (=23). On a no-vuln enemy this branch is a no-op.
    if (c.effect?.pierceVulnerableInsult > 0 && state.lane === 'wit') {
      const vulns = enemy?.insultVulnerabilities || [];
      if (vulns.length > 0) {
        const staged = [tray?.intro, tray?.subject].filter(Boolean);
        const bench = state.hand.filter(h => h !== c && (h.slot === 'intro' || h.slot === 'subject' || h.slot === 'modifier'));
        let potential = 0;
        for (const card of staged) potential += (card.tags || []).filter(t => vulns.includes(t)).length;
        // bench tag-matches — count one match per card (best-case).
        for (const card of bench) {
          const m = (card.tags || []).filter(t => vulns.includes(t)).length;
          if (m > 0) potential += Math.min(m, 3);
        }
        // Cap potential at 3 since the rider caps at 3 matches.
        const capped = Math.min(potential, 3);
        if (capped > 0) {
          score += Math.min(20, capped * (c.effect.pierceVulnerableInsult || 0));
        }
      }
    }
    // v2.41: SYNERGY CAPSTONE — "is, in summary, the inescapable conclusion."
    // Boost when conditions align: turn 1 (opening bonus reads), or longThread
    // >= 2 (thread scaling reads). The card already scores high via tier 3;
    // this nudge is what makes the AI prefer it over baseline tier-3 targets
    // when the multi-rider math actually fires. delayedMisstep is the always-on
    // cost; we don't decrement for it (the spec calls it "the wit closer").
    if (c.id === 'wv2-t-in-summary' && state.lane === 'wit') {
      const firstTurn = (state._combatTurn || 1) === 1;
      if (firstTurn) score += 12;
      if ((state.longThread || 0) >= 2) score += Math.min(20, (state.longThread || 0) * 4);
    }
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
    // v2.44: speaking-of-which has no damage value of its own; its job is
    // to deepen the Tangent discard pool. Bump it just enough to be picked
    // when nothing meatier is on offer (cost 0, side payload is the value).
    if (c.id === 'jv2-m-speaking-of-which') {
      score += 2;
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
  // v2.34: wit LONG THREAD — per-combat meter + per-turn flags.
  // longThread persists across turns within a combat; resets between combats.
  // unblockedThisTurn flips to true if any HP/composure damage reaches the
  // player this turn. castWitEffectThisTurn flips to true if the player
  // cast a wit-lane target this turn. Both reset at the end of every
  // player turn AFTER the long-thread bookkeeping runs. _longThreadPeak is
  // the high-water-mark for this combat, flushed to telemetry at every
  // combat exit path via flushThreadPeak().
  state.longThread = 0;
  state.unblockedThisTurn = false;
  state.castWitEffectThisTurn = false;
  state._longThreadPeak = 0;
  const flushThreadPeak = () => {
    telemetry.longThreadPeakSum = (telemetry.longThreadPeakSum || 0) + (state._longThreadPeak || 0);
    if ((state._longThreadPeak || 0) > 0) {
      telemetry.combatsWithThread = (telemetry.combatsWithThread || 0) + 1;
    }
    state._longThreadPeak = 0;
    state.longThread = 0;
    // v2.40: PATIENCE — flush the per-combat peak into the run-level
    // `patiencePeakStacks` aggregator. Tracks the highest patience stack
    // value seen during the combat (set on every bump in the end-of-turn
    // tick AND the skill play). Mirrors the longThread peak pattern.
    if ((state._patiencePeak || 0) > (telemetry.patiencePeakStacks || 0)) {
      telemetry.patiencePeakStacks = state._patiencePeak;
    }
    state._patiencePeak = 0;
  };
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
  // v2.40: PATIENCE — wit's skip-cast-and-defend power. While installed,
  // every end-of-turn where the player did NOT cast a spell increments
  // patienceStacks. The next cast adds patienceStacks × 2 flat damage and
  // clears the counter. Reset per combat. Mirror of App.jsx's
  // patienceInstalled / patienceStacks state pair.
  state.patienceInstalled = false;
  state.patienceStacks = 0;
  // v2.33: Stubborn Block REMOVED — no install flag.
  // v2.33: NOT LISTENING refactored to a one-shot SKILL — no install flag.
  // notListeningCharges tracks pending absorbs (set by playing the
  // "Sorry — what?" skill, decremented on first enemy Weak/Vuln attempt).
  state.notListeningCharges = 0;
  // v2.36: ACTUALLY— per-combat snapshot + per-turn arguing-back counter.
  // lastCastSnapshot stores the last cast's intro/subject/target/modifiers
  // + ctx so re-fires re-compute damage from the SAME inputs. Reset to null
  // at every player-turn boundary (only THIS turn's casts qualify for
  // re-fire). arguingBackThisTurn is the +N enemy raw-damage surcharge;
  // resets each turn.
  state.lastCastSnapshot = null;
  state.arguingBackThisTurn = 0;
  // v2.37: HOLD ON — reactive interrupt. holdOnArmed flips true on play
  // of the "Hold on, hold on —" skill; holdOnValue snapshots longThread
  // at play time. Consumed by the next enemy attack (first swing). Auto-
  // clears at the start of the player's next turn if unused. Reset per
  // combat.
  state.holdOnArmed = false;
  state.holdOnValue = 0;
  // v2.38: SAYING SOMETHING WRONG — pending Misstep token queue. Each
  // entry is `{ turnsRemaining: N, selfDamage: N }`. Created when the
  // target's delayedMisstep rider fires on a successful cast. Decrement
  // every end-of-turn AFTER auto-play resolves; deliver to hand when
  // turnsRemaining hits 0. Reset per combat.
  state.pendingMissteps = [];
  // v2.39: OPENING STATEMENT — single-use bridge from the "to revisit my
  // opening point," skill. While true, the next wit target cast in this
  // combat gets the openingBonus even when combatTurn > 1. Consumed on
  // any wit-lane target cast. Reset per combat.
  state.openingExtended = false;
  // v2.44: TANGENT — counters live on `telemetry` directly (cross-combat).
  // Incremented in the tangent skill-play pass below + resolveTangentSim.
  // v2.32: enemy debuff sampler — per-turn random check that mirrors the
  // App's intent pool (real enemies in App.jsx fire Weak/Vuln intents AND
  // riders on attacks). Sim composite-atk model doesn't carry per-enemy
  // intents, so we approximate: roll a Weak attempt and a Vuln attempt per
  // enemy turn at a flat rate. notListeningCharges absorbs the first hit.
  state.enemyDebuffRolls = 0; state.enemyDebuffLanded = 0;
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
    // v2.39: surface the loop's turn counter on state so pickBest* helpers and
    // post-cast preview ctxes can read it without an extra arg. Turn 1 is the
    // first player turn (turns++ post-increments inside the while-condition).
    state._combatTurn = turns;
    // v2.29: reset saying-it-louder counter at the start of every player turn.
    state.loudCount = 0;

    // v2.38: SAYING SOMETHING WRONG — Misstep token discard pass. Pay 1
    // Energy each to harmlessly discard tokens that landed in hand last
    // turn. AI logic (v2.43 loosened to bring telemetry off-floor):
    //   - Existential: hp <= selfDamage → must discard (would KO).
    //   - Low HP: hpFrac <= 0.50 (any enemy) → discard. The 3 HP hurts
    //     at half-pool; the 1 energy is cheap insurance.
    //   - Otherwise: eat it. The +1 cast we save matters more than the 3 HP.
    // Decides BEFORE the rest of turn planning so the energy decision is
    // visible to the staging/casting loops below.
    {
      const tokIdxs = [];
      for (let i = 0; i < state.hand.length; i++) {
        if (state.hand[i]?.id === 'wv2-tok-misstep') tokIdxs.push(i);
      }
      if (tokIdxs.length > 0) {
        const hpFrac = state.hp / state.maxHp;
        for (let k = tokIdxs.length - 1; k >= 0; k--) {
          const idx = tokIdxs[k];
          const tok = state.hand[idx];
          if (!tok) continue;
          const sd = tok.selfDamage || 3;
          const existential = state.hp <= sd;
          const lowHp = hpFrac <= 0.85; // v2.43: scrub liberally — 3HP adds up
          const wantsDiscard = existential || lowHp;
          if (wantsDiscard && (tok.cost || 1) <= state.energy) {
            state.energy -= tok.cost || 1;
            state.exiled.push(tok);
            state.hand.splice(idx, 1);
            telemetry.missTepDiscards = (telemetry.missTepDiscards || 0) + 1;
          }
        }
      }
    }
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
    // installed). v2.33: only install when energy is SPARE (≥2 after the
    // 1-cost install pays). Avoids choking turn 1 staging when energy is
    // tight; the install can wait a turn without losing much value.
    if (!state.hitMeAgainInstalled) {
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if (c.id === 'cv2-p-hit-me-again' && (c.cost || 0) <= state.energy && state.energy >= 3) {
          state.energy -= c.cost || 0;
          state.hitMeAgainInstalled = true;
          telemetry.hitMeAgainInstalls = (telemetry.hitMeAgainInstalls || 0) + 1;
          state.discard.push(c);
          state.hand.splice(i, 1);
          break;
        }
      }
    }

    // v2.40: PATIENCE install pass — wit lane only. When the Patience power
    // is in hand and no Power is installed yet, install it early. Cost 1,
    // value scales with combat length (each skip-cast turn banks +1; each
    // bank pays +2 dmg on the next cast). Like Hit Me Again, prefer to
    // install only when spare energy is available (≥2 after install).
    if (state.lane === 'wit' && !state.patienceInstalled) {
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if ((c.id === 'wv2-p-patience' || c.installPower?.id === 'patience')
            && (c.cost || 0) <= state.energy && state.energy >= 3) {
          state.energy -= c.cost || 0;
          state.patienceInstalled = true;
          telemetry.patienceInstalls = (telemetry.patienceInstalls || 0) + 1;
          state.discard.push(c);
          state.hand.splice(i, 1);
          break;
        }
      }
    }

    // v2.40: I'LL LET YOU FINISH skill — wit lane only. Cost 0, only play when
    // Patience is installed AND we plan to skip casting this turn (no target
    // in hand OR can't afford the cast). Gives a stack without burning energy.
    if (state.lane === 'wit' && state.patienceInstalled) {
      const letFinishIdx = state.hand.findIndex(c => c.id === 'wv2-k-let-you-finish');
      if (letFinishIdx >= 0) {
        // Heuristic: only play if no castable target chain exists this turn.
        // Cheap check — do we have a target in hand AND can we afford the
        // intro+subject+target chain? If yes, prefer the cast over banking.
        const hasTarget = state.hand.some(c => c.slot === 'target' && c.lane === 'wit');
        const totalCost = state.hand.filter(c => c.slot === 'target' && c.lane === 'wit')
          .reduce((min, c) => Math.min(min, c.cost || 0), Infinity);
        // If can't afford even the cheapest target, OR no target in hand,
        // the bank is the better play.
        if (!hasTarget || totalCost > state.energy) {
          const c = state.hand[letFinishIdx];
          if ((c.cost || 0) <= state.energy) {
            state.energy -= c.cost || 0;
            state.patienceStacks = (state.patienceStacks || 0) + 1;
            telemetry.patienceSkillPlays = (telemetry.patienceSkillPlays || 0) + 1;
            if ((state.patienceStacks || 0) > (state._patiencePeak || 0)) {
              state._patiencePeak = state.patienceStacks;
            }
            state.discard.push(c);
            state.hand.splice(letFinishIdx, 1);
          }
        }
      }
    }

    // v2.33: Tunnel-Vision skill HOLD — chutzpah lane only. When TUNNEL VISION
    // is at 4+ (one chutzpah-card stage away from triggering RAGE), playing
    // SKILL cards this turn wastes the impending +50% damage window because
    // skills don't stage chutzpah words (no tunnel-vision bump) AND they
    // consume the turn's action economy that should be feeding the rage spike.
    // Suppresses Sorry-what specifically — defensive skills (Defend/Mend/
    // cleanse) still play through because they're hit-prevention and the
    // RAGE bonus doesn't matter if we're KO'd.
    const tvSkillHold = state.lane === 'chutzpah'
      && (state.tunnelVision || 0) >= 4
      && !state.rageActive;

    // v2.33: NOT LISTENING skill play pass. Cost-0 one-shot skill that arms
    // a pending absorb. Only play it when it's actually likely to pay off:
    //   - elite/boss fights (rich intent pools — debuffs come)
    //   - OR the player has already seen a debuff attempt this combat
    //     (enemyDebuffRolls > 0 — proven debuffer)
    // Skip on normals unless debuffs are confirmed. Don't double-arm.
    const debuffsExpected = enemy.tier === 'elite' || enemy.tier === 'boss' || (state.enemyDebuffRolls || 0) > 0;
    if (!tvSkillHold && debuffsExpected && state.notListeningCharges < 1) {
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if (c.id === 'cv2-k-sorry-what' && (c.cost || 0) <= state.energy) {
          state.energy -= c.cost || 0;
          state.notListeningCharges += (c.effects?.absorbNextDebuff || 1);
          telemetry.notListeningSkillCasts = (telemetry.notListeningSkillCasts || 0) + 1;
          state.discard.push(c);
          state.hand.splice(i, 1);
          break;
        }
      }
    }

    // v2.35: FOOTNOTE skill play pass — wit lane only. Cost 1, exhausts.
    // On play, scan hand + discard for the best wit-word card to footnote.
    // Priority: highest base-wit card in DISCARD (those are out of rotation
    // and re-surface via reshuffle, which makes them durable scaling); fall
    // back to highest base-wit in HAND if discard is empty of word cards.
    // Bias condition: only play it when a tier-2+ wit subject or intro is
    // available to attach to (the +1 wit rider is worth ~+3 dmg post-tier
    // on a single cast, and the card keeps scaling on every cast that
    // re-uses it).
    const isWitLane = state.lane === 'wit';
    if (isWitLane) {
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if (c.id !== 'wv2-k-hewn-greaves-footnotes') continue;
        if ((c.cost || 0) > state.energy) continue;
        // Find best target. A "word" is intro / subject / modifier.
        const isWord = (x) => x.slot === 'intro' || x.slot === 'subject' || x.slot === 'modifier';
        const score = (x) => (x.stats?.wit || 0) + (x.footnotes || 0)
          + (x.tier ? x.tier * 0.5 : 0);
        let bestPile = null;
        let bestIdx = -1;
        let bestScore = -1;
        for (let k = 0; k < state.discard.length; k++) {
          const d = state.discard[k];
          if (!isWord(d)) continue;
          const s = score(d) + 0.5; // discard bias (preserves agency)
          if (s > bestScore) { bestScore = s; bestPile = 'discard'; bestIdx = k; }
        }
        for (let k = 0; k < state.hand.length; k++) {
          if (k === i) continue;
          const d = state.hand[k];
          if (!isWord(d)) continue;
          const s = score(d);
          if (s > bestScore) { bestScore = s; bestPile = 'hand'; bestIdx = k; }
        }
        // Only fire when a meaningful target exists: a tier-2+ word OR
        // any word with base wit ≥ 2 (the +1 footnote turns base 2 → 3
        // for free, scaling every reuse).
        const target = bestPile === 'discard' ? state.discard[bestIdx]
                     : bestPile === 'hand'    ? state.hand[bestIdx]
                     : null;
        if (!target) break;
        const worthwhile = (target.tier || 1) >= 2 || (target.stats?.wit || 0) >= 2;
        if (!worthwhile) break;
        state.energy -= c.cost || 0;
        if (bestPile === 'discard') {
          state.discard[bestIdx] = { ...target, footnotes: (target.footnotes || 0) + 1 };
        } else {
          state.hand[bestIdx] = { ...target, footnotes: (target.footnotes || 0) + 1 };
        }
        state.exiled.push(c); // skill exhausts
        state.hand.splice(i, 1);
        telemetry.footnotesApplied = (telemetry.footnotesApplied || 0) + 1;
        break;
      }
    }

    // v2.39: OPENING STATEMENT — "to revisit my opening point," skill play
    // pass. Wit lane only. Cost 1, non-exhaust. Conditions:
    //   - turns > 1 (turn 1 already qualifies; no reason to spend the skill)
    //   - openingExtended NOT already armed (no stacking — flag is boolean)
    //   - an openingBonus target is in hand (otherwise the bridge has no
    //     payoff to bridge TO).
    // Single-use feel maintained by the flag-consume-on-cast in the post-cast
    // block above.
    if (isWitLane && (state._combatTurn || 1) > 1 && !state.openingExtended) {
      const skillIdx = state.hand.findIndex(c => c.id === 'wv2-k-revisit-opening');
      if (skillIdx >= 0) {
        const sk = state.hand[skillIdx];
        const hasOpeningTarget = state.hand.some(
          c => c.slot === 'target' && c.lane === 'wit' && (c.effect?.openingBonus || 0) > 0);
        if (hasOpeningTarget && (sk.cost || 0) <= state.energy) {
          state.energy -= sk.cost || 0;
          state.openingExtended = true;
          state.discard.push(sk);
          state.hand.splice(skillIdx, 1);
          telemetry.revisitOpeningPlays = (telemetry.revisitOpeningPlays || 0) + 1;
        }
      }
    }

    // v2.43: LONG THREAD preservation — wit-lane skip-cast heuristic.
    // When LT is already meaningful (>= 2), Patience or a threadScaling
    // target is on deck, AND this turn's cast would be a CHIP (predicted
    // damage < 30% of remaining composure, won't kill), it's better to
    // skip the cast this turn — defend, let LT carry forward, and cash in
    // a bigger cast later. Greedy AI currently casts every turn → LT
    // never grows past ~1. This heuristic gates the TARGET staging only;
    // intro/subject still stage (their applyStageEffects fire for free
    // defense/draw) and persist into next turn for a stacked cast.
    let skipCastForThread = false;
    if (state.lane === 'wit' && (state.longThread || 0) >= 2 && castsThisTurn < 1) {
      const hasThreadTarget = state.hand.some(
        c => c.slot === 'target' && c.lane === 'wit' && (c.effect?.threadScaling || 0) > 0);
      const patienceReady = !!state.patienceInstalled;
      if (hasThreadTarget || patienceReady) {
        // Predict best-case chip damage from any castable target with
        // a stubbed intro+subject pair (use the in-hand best of each).
        const introCard = state.hand.find(c => c.slot === 'intro' && c.lane === 'wit')
          || state.hand.find(c => c.slot === 'intro');
        const subjectCard = state.hand.find(c => c.slot === 'subject' && c.lane === 'wit')
          || state.hand.find(c => c.slot === 'subject');
        const targetCard = state.hand.find(
          c => c.slot === 'target' && c.lane === 'wit' && (c.cost || 0) <= state.energy);
        if (introCard && subjectCard && targetCard) {
          const preCtx = {
            discardSize: state.discard.length,
            deckSize: state.deck.length + state.hand.length + state.discard.length + state.exiled.length,
            missingHpFrac: state.maxHp > 0 ? (state.maxHp - state.hp) / state.maxHp : 0,
            stakeAmount: 0,
            loudCount: state.loudCount || 0,
            playerDmgMult: state.playerDmgMult || 1.0,
            enemyDmgMult: state.enemyDmgMult || 1.0,
            longThread: state.longThread || 0,
            combatTurn: state._combatTurn || 1,
            openingExtended: !!state.openingExtended,
            insultVulnerabilities: enemy?.insultVulnerabilities || [],
          };
          const preview = computeSpellDamage(introCard, subjectCard, targetCard, [], preCtx);
          const dmgType = targetCard.effect?.damageType || 'composure';
          const eff = enemy.effectiveness || {};
          const enemyMult = (dmgType === 'physical')
            ? (eff.physical ?? 1.0)
            : (eff[targetCard.effect?.scaleBy || targetCard.lane || 'wit'] ?? 1.0);
          const predicted = preview.damage * enemyMult * (state.playerDmgMult || 1);
          const remaining = dmgType === 'physical' ? enemy.currentHp : enemy.currentComp;
          const wouldKill = predicted >= remaining;
          const isChip = predicted < remaining * 0.30;
          if (isChip && !wouldKill) {
            skipCastForThread = true;
            telemetry.threadPreservationSkips = (telemetry.threadPreservationSkips || 0) + 1;
          }
        }
      }
    }

    // v2.44: TANGENT resolver — fires a random jnsq card from discard.
    // Mirrors resolveTangentCard in App.jsx. Words/modifiers stage (with
    // refund-on-replace); targets cast if tray complete, else fizzle.
    // The cast path defers to the main cast block by injecting the target
    // into `tray` and flagging `forceCastFromTangent` so the cast logic
    // runs even if the AI wouldn't have otherwise picked this turn.
    let forceCastFromTangent = false;
    const resolveTangentSim = (fired) => {
      if (!fired) return;
      if (fired.slot === 'intro' || fired.slot === 'subject') {
        if (tray[fired.slot]) {
          // Refund displaced word to hand for free.
          state.hand.push(tray[fired.slot]);
        }
        tray[fired.slot] = fired;
        // Apply stage side effects for free (read by `applyStageEffects`
        // closure defined below — but the simpler/cheaper path is to apply
        // them directly here using the same shape).
        const fx = fired.effects || {};
        if (fx.block)      state.block += fx.block;
        if (fx.poise)      state.poise += fx.poise;
        if (fx.draw)       drawCards(state, fx.draw);
        if (fx.weak)       state.enemyDmgMult = Math.max(0.5, (state.enemyDmgMult || 1) - 0.25 * fx.weak);
        if (fx.vulnerable) state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * fx.vulnerable);
        if (fx.hp)         state.hp = Math.min(state.maxHp, state.hp + fx.hp);
        telemetry.tangentWordsStaged = (telemetry.tangentWordsStaged || 0) + 1;
        return;
      }
      if (fired.slot === 'modifier') {
        if (tray.modifiers.length >= 2) {
          // Replace oldest; refund to hand for free.
          state.hand.push(tray.modifiers[0]);
          tray.modifiers = [...tray.modifiers.slice(1), fired];
        } else {
          tray.modifiers.push(fired);
        }
        telemetry.tangentWordsStaged = (telemetry.tangentWordsStaged || 0) + 1;
        return;
      }
      if (fired.slot === 'target' || fired.type === 'effect') {
        if (!tray.intro || !tray.subject) {
          // Fizzle — target falls back to discard (not exiled).
          state.discard.push(fired);
          telemetry.tangentFizzles = (telemetry.tangentFizzles || 0) + 1;
          return;
        }
        if (tray.target) {
          // Refund existing target to hand for free.
          state.hand.push(tray.target);
        }
        tray.target = fired;
        forceCastFromTangent = true;
        telemetry.tangentTargetsCast = (telemetry.tangentTargetsCast || 0) + 1;
        return;
      }
      // Unknown shape — slip back to discard.
      state.discard.push(fired);
    };

    // v2.45: APOLOGY skill play pass — jnsq lane. "I shouldn't have said that
    // — have you eaten?" Cost 1 skill. Effects: tray-clear (no refund),
    // hp +4, enemy vulnerable +1. AI heuristics:
    //   (a) HP <= 60% of max → the heal is meaningful, OR
    //   (b) tray has intro+subject+target staged AND the predicted spell
    //       damage is < 30% of remaining enemy composure (chip cast — the
    //       reset+heal+vuln is more valuable than a fizzle of a swing).
    // Don't play if HP is full AND tray is empty (zero-value).
    if (state.lane === 'jnsq') {
      const apologyIdx = state.hand.findIndex(c => c.id === 'jv2-k-shouldnt-said-have-you-eaten');
      if (apologyIdx >= 0) {
        const c = state.hand[apologyIdx];
        if ((c.cost || 0) <= state.energy) {
          const hpPct = state.hp / Math.max(1, state.maxHp);
          const trayFilled = !!(tray.intro && tray.subject && tray.target);
          let chipCast = false;
          if (trayFilled) {
            const preCtx = { lane: state.lane, tier3MinTier: 3, longThread: state.longThread || 0, openingExtended: state.openingExtended };
            const preview = computeSpellDamage(tray.intro, tray.subject, tray.target, tray.modifiers, preCtx);
            const eff_mult = enemy?.effectiveness?.[state.lane] ?? 1.0;
            const projected = Math.round((preview.damage || 0) * eff_mult * (state.playerDmgMult || 1));
            const remainingComp = Math.max(1, enemy.composure || 30);
            if (projected < 0.30 * remainingComp) chipCast = true;
          }
          const shouldApologize = (hpPct <= 0.60) || chipCast;
          if (shouldApologize) {
            state.energy -= c.cost || 0;
            state.hand.splice(apologyIdx, 1);
            state.discard.push(c);
            // Tray clear — push all filled slots to discard.
            const moved = [];
            if (tray.intro) moved.push(tray.intro);
            if (tray.subject) moved.push(tray.subject);
            if (tray.target) moved.push(tray.target);
            if (tray.modifiers && tray.modifiers.length) moved.push(...tray.modifiers);
            for (const m of moved) state.discard.push(m);
            tray = { intro: null, subject: null, target: null, modifiers: [] };
            // Heal.
            state.hp = Math.min(state.maxHp, state.hp + 4);
            // Enemy vulnerable +1 (player damage potency up).
            state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25);
            telemetry.apologyCasts = (telemetry.apologyCasts || 0) + 1;
            telemetry.apologyHpHealed = (telemetry.apologyHpHealed || 0) + 4;
            telemetry.apologyTrayDiscarded = (telemetry.apologyTrayDiscarded || 0) + moved.length;
          }
        }
      }
    }

    // v2.44: TANGENT skill play pass — jnsq lane only. Conditions:
    //   - in hand AND affordable
    //   - discard pile has ≥3 jnsq cards (richer pool → better outcome)
    //   - tray.intro AND tray.subject already filled (so a fired target can
    //     actually cast — otherwise we'd waste the skill on a stage that
    //     overlaps what the AI will do this turn anyway)
    // Heuristic conservative: if all conditions met, play it. The skill is
    // chaos-flavored — we don't try to predict outcomes, just open the door.
    if (state.lane === 'jnsq') {
      const tangentIdx = state.hand.findIndex(c => c.id === 'jv2-k-that-reminds-me');
      if (tangentIdx >= 0) {
        const c = state.hand[tangentIdx];
        const jnsqInDiscard = state.discard.filter(d => d.lane === 'jnsq').length;
        const traySetup = !!(tray.intro && tray.subject);
        if ((c.cost || 0) <= state.energy && jnsqInDiscard >= 3 && traySetup) {
          state.energy -= c.cost || 0;
          state.hand.splice(tangentIdx, 1);
          state.discard.push(c);
          telemetry.tangentFires = (telemetry.tangentFires || 0) + 1;
          // Step 1: discard random from draw.
          if (state.deck.length > 0) {
            const ridx = Math.floor(rnd() * state.deck.length);
            const lost = state.deck[ridx];
            state.deck.splice(ridx, 1);
            state.discard.push(lost);
          }
          // Step 2 + 3: pull random jnsq from discard and resolve.
          const jnsqIdxs = state.discard
            .map((d, i) => (d.lane === 'jnsq' ? i : -1))
            .filter(i => i >= 0);
          if (jnsqIdxs.length > 0) {
            const pick = jnsqIdxs[Math.floor(rnd() * jnsqIdxs.length)];
            const fired = state.discard[pick];
            state.discard.splice(pick, 1);
            resolveTangentSim(fired);
          }
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
          if (c.type === 'skill' && (c.id === 'c-defend' || c.id === 'c-mend') && (c.cost || 0) <= state.energy) {
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

      // v2.32: Cleanse — play "Couldn't quite catch that," when actually debuffed.
      // 0-cost so it's strictly value when player is Weak (<1.0) or Vuln (>1.0).
      const isWeak = (state.playerDmgMult || 1) < 1.0;
      const isVulnerable = (state.enemyDmgMult || 1) > 1.0;
      if (isWeak || isVulnerable) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          if (c.id === 'cv2-k-couldnt-catch-that' && (c.cost || 0) <= state.energy) {
            state.energy -= c.cost || 0;
            const fx = c.effects || {};
            if (fx.removeWeak && (state.playerDmgMult || 1) < 1.0) {
              state.playerDmgMult = Math.min(1.0, (state.playerDmgMult || 1) + 0.25 * fx.removeWeak);
            }
            if (fx.removeVulnerable && (state.enemyDmgMult || 1) > 1.0) {
              state.enemyDmgMult = Math.max(1.0, (state.enemyDmgMult || 1) - 0.25 * fx.removeVulnerable);
            }
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
        // v2.32: NOT LISTENING — removeWeak/removeVulnerable scrub stacks
        // back toward neutral. The sim models Weak via state.playerDmgMult
        // (below 1.0 means weakened); Vuln via state.enemyDmgMult applied to
        // the player (above 1.0 means more incoming dmg). Each removed stack
        // adjusts by 0.25 toward 1.0. Stays at 1.0 if already neutral.
        if (fx.removeWeak && (state.playerDmgMult || 1) < 1.0) {
          state.playerDmgMult = Math.min(1.0, (state.playerDmgMult || 1) + 0.25 * fx.removeWeak);
        }
        if (fx.removeVulnerable && (state.enemyDmgMult || 1) > 1.0) {
          state.enemyDmgMult = Math.max(1.0, (state.enemyDmgMult || 1) - 0.25 * fx.removeVulnerable);
        }
        // v2.44: SPEAKING OF WHICH — staging discards an extra random hand card
        // to deepen the Tangent pool. No-op if hand is empty.
        if (fx.discardOnPlay && state.hand.length > 0) {
          const idx = Math.floor(rnd() * state.hand.length);
          const lost = state.hand[idx];
          state.hand.splice(idx, 1);
          state.discard.push(lost);
        }
        // v2.45: oh — wait — no, sorry, intro — staging arms one absorb of
        // the next enemy debuff. Aliases onto notListeningCharges.
        if (fx.ignoreNextDebuff) {
          state.notListeningCharges = (state.notListeningCharges || 0) + fx.ignoreNextDebuff;
        }
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
        const idx = pickBestForSlot(state, 'intro', state.energy, enemy);
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
        const idx = pickBestForSlot(state, 'subject', state.energy, enemy);
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
      if (!tray.target && !skipCastForThread) {
        // v2.24: prefer Bare Knuckles (requiresRage) when RAGE is active.
        // Otherwise block it from staging entirely (mirrors App.jsx gate).
        // v2.25: also gates doubleDown targets — only pick if the cast
        // would kill (tray + enemy passed for damage prediction).
        // v2.43: skipCastForThread suppresses target staging to PRESERVE
        // Long Thread for a stacked cast next turn (see pre-loop block).
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
          // v2.41: footnoteSelfOnStage — the staged copy gains +1 footnote
          // before it enters the tray. Mirrors App.jsx modifier branch.
          const stagedM = m.effects?.footnoteSelfOnStage
            ? { ...m, footnotes: (m.footnotes || 0) + 1 }
            : m;
          tray.modifiers.push(stagedM);
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
          playerDmgMult: state.playerDmgMult || 1.0, // v2.30
          enemyDmgMult: state.enemyDmgMult || 1.0, // v2.30
          longThread: state.longThread || 0, // v2.34
          combatTurn: state._combatTurn || 1, // v2.39
          openingExtended: !!state.openingExtended, // v2.39
          insultVulnerabilities: enemy?.insultVulnerabilities || [], // v2.42
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
        playerDmgMult: state.playerDmgMult || 1.0, // v2.30
        enemyDmgMult: state.enemyDmgMult || 1.0, // v2.30
        longThread: state.longThread || 0, // v2.34
        combatTurn: state._combatTurn || 1, // v2.39
        openingExtended: !!state.openingExtended, // v2.39
        insultVulnerabilities: enemy?.insultVulnerabilities || [], // v2.42
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

      // v2.40: PATIENCE — if installed AND stacks > 0, add stacks × 2 flat
      // damage and clear. Mirrors App.jsx's castV2SentenceSpell hook.
      if (state.patienceInstalled && (state.patienceStacks || 0) > 0) {
        const patBonus = state.patienceStacks * 2;
        dmg += patBonus;
        telemetry.patienceDamageBonus = (telemetry.patienceDamageBonus || 0) + patBonus;
        telemetry.patienceCasts = (telemetry.patienceCasts || 0) + 1;
        state.patienceStacks = 0;
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
      // v2.30: telemetry for SMELL WEAKNESS predator rider. Counts every
      // cast where the bonus actually fired (enemy was Vuln/Weak at cast
      // time) and aggregates the bonus damage for averages.
      if ((result.predatorBonus || 0) > 0) {
        telemetry.predatorTriggers = (telemetry.predatorTriggers || 0) + 1;
        telemetry.predatorBonusTotal = (telemetry.predatorBonusTotal || 0) + result.predatorBonus;
      }
      // v2.34: telemetry for LONG THREAD. Any wit-lane cast marks the turn
      // as "stayed on topic" for end-of-turn bookkeeping. Threadscaling
      // bonuses are tracked separately so we can see how much damage the
      // scaling rider contributed across the sample.
      if (tray.target?.lane === 'wit') {
        state.castWitEffectThisTurn = true;
        // v2.39: wit-target casts consume the openingExtended bridge. Mirrors
        // App.jsx — the flag drops on ANY wit target, whether or not the
        // target had an openingBonus. The bridge is spent the moment you
        // bring the room back to the opening.
        if (state.openingExtended) state.openingExtended = false;
      }
      // v2.39: telemetry for OPENING STATEMENT. Counts triggers + total
      // bonus damage so the report can show "lifted N composure across
      // M casts in the sample."
      if ((result.openingBonus || 0) > 0) {
        telemetry.openingBonusTriggers = (telemetry.openingBonusTriggers || 0) + 1;
        telemetry.openingBonusDamageTotal = (telemetry.openingBonusDamageTotal || 0) + result.openingBonus;
      }
      if ((result.threadBonus || 0) > 0) {
        telemetry.threadScalingTriggers = (telemetry.threadScalingTriggers || 0) + 1;
        telemetry.threadScalingBonusTotal = (telemetry.threadScalingBonusTotal || 0) + result.threadBonus;
      }
      if (tray.target?.id === 'wv2-t-natural-conclusion') {
        telemetry.naturalConclusionCasts = (telemetry.naturalConclusionCasts || 0) + 1;
      }
      // v2.35: telemetry for FOOTNOTE-installed words contributing to the
      // cast. footnoteBonus is the pre-modifier flat damage the rider
      // added (each footnote ≈ multiplier × tierMult dmg). Counts every
      // cast where the rider contributed and sums total bonus damage.
      if ((result.footnoteBonus || 0) > 0) {
        telemetry.footnoteCastsWithBonus = (telemetry.footnoteCastsWithBonus || 0) + 1;
        telemetry.footnoteBonusDamage = (telemetry.footnoteBonusDamage || 0) + result.footnoteBonus;
      }
      // v2.42: INSULT VULNERABILITIES — count casts where the pierce rider
      // fired and aggregate match-count + bonus damage for the report.
      if ((result.insultBonus || 0) > 0) {
        telemetry.insultCasts = (telemetry.insultCasts || 0) + 1;
        telemetry.insultMatchesTotal = (telemetry.insultMatchesTotal || 0) + Math.min(result.insultMatches || 0, 3);
        telemetry.insultDamageTotal = (telemetry.insultDamageTotal || 0) + result.insultBonus;
      }
      // v2.31: SYNERGY CAPSTONE — count "AND I'M NOT DONE." casts and the
      // total damage they dealt. The card's three riders (doubleDown,
      // loudScaling, predator) tick their own telemetry above; this is the
      // dedicated counter for the capstone itself so we can see how often
      // it lands and how hard it hits relative to the other tier-3 targets.
      if (tray.target?.id === 'cv2-t-and-im-not-done') {
        telemetry.andImNotDoneCasts = (telemetry.andImNotDoneCasts || 0) + 1;
        telemetry.andImNotDoneTotalDamage = (telemetry.andImNotDoneTotalDamage || 0) + dmg;
      }
      // v2.41: wit SYNERGY CAPSTONE — "is, in summary, the inescapable
      // conclusion." Mirrors the chutzpah capstone telemetry. Counts every
      // resolved cast where the in-summary target landed plus the total
      // damage. The three riders (threadScaling, openingBonus, delayedMisstep)
      // tick their own existing telemetry (threadBonus rolled into footnote
      // / spell bonuses; missTepCasts via the delayedMisstep block below).
      if (tray.target?.id === 'wv2-t-in-summary') {
        telemetry.inSummaryCasts = (telemetry.inSummaryCasts || 0) + 1;
        telemetry.inSummaryTotalDamage = (telemetry.inSummaryTotalDamage || 0) + dmg;
      }
      // v2.36: ACTUALLY— snapshot. Stash the resolved cast's inputs +
      // multipliers so a subsequent Actually— skill can re-fire damage at
      // ×1.5. The captured `mult` here is the enemy-effectiveness multiplier
      // that was applied above (matches the App's enemyMult / physMult
      // capture). playerDmgMult and stake/loud/predator/thread/footnote
      // contributions are already baked into `result.damage`.
      state.lastCastSnapshot = {
        intro: tray.intro, subject: tray.subject, target: tray.target,
        modifiers: tray.modifiers,
        ctx: simCtx,
        dmgType, enemyMult: mult, physMult: mult,
        playerDmgMult: state.playerDmgMult || 1.0,
      };
      // v2.38: SAYING SOMETHING WRONG — queue a delayed Misstep token if
      // the cast target carried the rider. App-side fires on the SAME
      // event (resolved cast); sim mirrors. Telemetry: missTepCasts counts
      // the queue events, missTepDamageOut accumulates the cast's outgoing
      // damage so we can read the up-front payoff vs the back-end cost.
      if (tray.target?.effect?.delayedMisstep) {
        const dm = tray.target.effect.delayedMisstep;
        state.pendingMissteps.push({
          turnsRemaining: dm.delay || 2,
          selfDamage: dm.selfDamage || 3,
        });
        telemetry.missTepCasts = (telemetry.missTepCasts || 0) + 1;
        telemetry.missTepDamageOut = (telemetry.missTepDamageOut || 0) + dmg;
      }
      // Tray clears only when a cast actually fires.
      tray = { intro: null, subject: null, target: null, modifiers: [] };
    } else {
      // No cast this turn — partial stage remains in the tray. Count it
      // as a "hold" rather than a fizzle (no card discard penalty).
      telemetry.holds++;
    }

    // v2.36: ACTUALLY— post-cast skill pass. Wit-lane only. Plays AFTER the
    // tray cast resolves so the snapshot is fresh. Loops while:
    //   - any Actually— card is in hand
    //   - the player has at least 1 Energy
    //   - lastCastSnapshot exists (one was just resolved THIS turn)
    //   - predicted re-fire damage covers >20% of remaining composure
    //     (meaningfully closes the enemy — the cost side of arguing-back
    //     isn't worth eating if the swing is filler).
    // Stacks: arguingBackThisTurn ticks +1 per play, telemetry tracked.
    if (state.lane === 'wit') {
      while (state.lastCastSnapshot && state.energy >= 1) {
        const actuallyIdx = state.hand.findIndex(c => c.id === 'wv2-k-actually');
        if (actuallyIdx < 0) break;
        const snap = state.lastCastSnapshot;
        // Predict damage from the snapshot at ×1.5.
        const reResult = computeSpellDamage(
          snap.intro, snap.subject, snap.target, snap.modifiers || [], snap.ctx || {});
        const dmgTypeRe = snap.dmgType || 'composure';
        const eff = (dmgTypeRe === 'physical' ? snap.physMult : snap.enemyMult) ?? 1.0;
        let reDmg = Math.round(reResult.damage * eff);
        reDmg = Math.round(reDmg * (snap.playerDmgMult || 1.0));
        reDmg = Math.round(reDmg * 1.5);
        const remaining = dmgTypeRe === 'physical' ? enemy.currentHp : enemy.currentComp;
        // Gate: only fire when the re-fire is a meaningful chunk of what's
        // left. Boss/elite gets a smaller threshold since their pools are
        // bigger and a 20% bite still matters.
        const thresholdFrac = (enemy.tier === 'boss' || enemy.tier === 'elite') ? 0.15 : 0.20;
        if (reDmg <= 0) break;
        if (reDmg < remaining * thresholdFrac) break;
        // Pay cost, fire.
        const c = state.hand[actuallyIdx];
        state.energy -= c.cost || 0;
        // Apply through enemy block (mirrors cast-time absorption).
        let remainingDmg = reDmg;
        if (enemy.block > 0 && dmgTypeRe !== 'physical') {
          // Composure damage bypasses physical block in the App (block is
          // HP-side); the sim's block is generic. Match the App: enemy
          // block intercepts whichever pool the dmg is routed at.
          const absorbed = Math.min(enemy.block, remainingDmg);
          enemy.block -= absorbed; remainingDmg -= absorbed;
        } else if (enemy.block > 0) {
          const absorbed = Math.min(enemy.block, remainingDmg);
          enemy.block -= absorbed; remainingDmg -= absorbed;
        }
        if (dmgTypeRe === 'physical') {
          enemy.currentHp = Math.max(0, enemy.currentHp - remainingDmg);
        } else {
          enemy.currentComp = Math.max(0, enemy.currentComp - remainingDmg);
        }
        state.arguingBackThisTurn = (state.arguingBackThisTurn || 0) + 1;
        state.discard.push(c);
        state.hand.splice(actuallyIdx, 1);
        telemetry.actuallyCasts = (telemetry.actuallyCasts || 0) + 1;
        telemetry.actuallyExtraDamage = (telemetry.actuallyExtraDamage || 0) + reDmg;
        telemetry.totalDamageDealt += reDmg;
        // Early exit if the re-fire killed the enemy — no more arguing.
        if (enemy.currentComp <= 0 || enemy.currentHp <= 0) break;
      }
    }

    // v2.37: HOLD ON — wit's reactive interrupt skill. AI plays it before
    // the enemy attack lands. v2.43 widened gates aggressively:
    //   - LT >= 2 AND enemy has any attack: play preventively to PRESERVE
    //     the thread (an unblocked hit resets LT to 0; a 2+ thread is too
    //     valuable to risk for 1 energy)
    //   - LT >= 1 AND unblockedExpected >= 2: play when the interrupt
    //     would meaningfully reduce damage
    //   - LT >= 1 AND tougher AND unblockedExpected >= 4: elite/boss case
    // The greedy AI is unsophisticated: it can't see Weak/Vuln-modified
    // values precisely (those drift back during enemy turn), so we use
    // enemy.atk as a reasonable proxy.
    if (state.lane === 'wit' && !state.holdOnArmed) {
      const holdOnIdx = state.hand.findIndex(c => c.id === 'wv2-k-hold-on');
      if (holdOnIdx >= 0) {
        const c = state.hand[holdOnIdx];
        const lt = state.longThread || 0;
        const expectedSwing = enemy.atk;
        const unblockedExpected = Math.max(0, expectedSwing - (state.block || 0) - (state.poise || 0));
        const tougher = (enemy.tier === 'boss' || enemy.tier === 'elite');
        const worthPlaying = (
          (lt >= 2 && expectedSwing > 0) ||
          (lt >= 1 && unblockedExpected >= 2) ||
          (lt >= 1 && tougher && unblockedExpected >= 4)
        ) && (c.cost || 0) <= state.energy;
        if (worthPlaying) {
          state.energy -= c.cost || 0;
          state.holdOnArmed = true;
          state.holdOnValue = lt;
          state.discard.push(c);
          state.hand.splice(holdOnIdx, 1);
          telemetry.holdOnPlays = (telemetry.holdOnPlays || 0) + 1;
        }
      }
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
      flushThreadPeak();
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
        flushThreadPeak();
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
        flushThreadPeak();
        return { outcome: 'won', turns, telemetry };
      }
    }
    let incoming = enemy.atk;
    // v2.36: ACTUALLY— arguing-back surcharge. Each Actually— played this
    // turn adds +1 to enemy raw damage. Tracked for telemetry so the cost
    // side is visible in reports.
    if ((state.arguingBackThisTurn || 0) > 0) {
      const bonus = state.arguingBackThisTurn;
      incoming += bonus;
      telemetry.arguingBackEnemyBonus = (telemetry.arguingBackEnemyBonus || 0) + bonus;
    }
    // v2.10: annotation enemyAtkReduction.
    if (enemy.annotation?.effect?.enemyAtkReduction) {
      incoming = Math.max(0, incoming - enemy.annotation.effect.enemyAtkReduction);
    }
    // v2.37: HOLD ON consumes here. The sim models the enemy turn as a
    // single composite swing, so the "first swing" reduction applies to
    // the whole incoming value. The flag clears regardless of whether
    // the reduction was meaningful (no free re-cast). Telemetry tracks
    // total damage prevented across all runs.
    if (state.holdOnArmed) {
      const reduced = Math.max(0, incoming - (state.holdOnValue || 0));
      const prevented = incoming - reduced;
      incoming = reduced;
      telemetry.holdOnDamagePrevented = (telemetry.holdOnDamagePrevented || 0) + prevented;
      state.holdOnArmed = false;
      state.holdOnValue = 0;
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
    // v2.32: Enemy-debuff sampler. The App's intent pool includes Weak/Vuln
    // intents and riders on attacks; this sim's composite-atk model collapses
    // intents to a flat damage roll, so we approximate per-turn debuff
    // application with a stochastic check. Rates calibrated to roughly match
    // the App's intent distribution but kept conservative — the sim's
    // per-turn drift already pulls multipliers back toward 1.0 each turn, so
    // we don't want compounding pressure that the actual App fight wouldn't
    // produce. Higher rates on boss/elite mirror their richer intent pools.
    {
      const dbTier = (enemy.tier === 'boss' ? 1.4 : enemy.tier === 'elite' ? 1.2 : 1.0);
      const weakChance = 0.06 * dbTier;
      const vulnChance = 0.04 * dbTier;
      const weakRoll = rnd() < weakChance;
      const vulnRoll = rnd() < vulnChance;
      // Helper: try to apply one debuff stack, with NOT LISTENING absorbing the
      // first hit per combat. Tracks telemetry on both attempts and absorbs.
      const tryApply = (kind) => {
        state.enemyDebuffRolls += 1;
        if (state.notListeningCharges > 0) {
          state.notListeningCharges -= 1;
          telemetry.notListeningAbsorbs = (telemetry.notListeningAbsorbs || 0) + 1;
          return; // absorbed — no debuff applied
        }
        state.enemyDebuffLanded += 1;
        if (kind === 'weak') {
          state.playerDmgMult = Math.max(0.5, (state.playerDmgMult || 1) - 0.25);
        } else {
          state.enemyDmgMult = Math.min(1.5, (state.enemyDmgMult || 1) + 0.25);
        }
      };
      if (weakRoll) tryApply('weak');
      if (vulnRoll) tryApply('vulnerable');
    }
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
    // v2.34: LONG THREAD — record unblocked damage this turn so end-of-turn
    // bookkeeping knows the meter must reset. Block-absorbed-only hits
    // (compIncoming === 0 && hpIncoming === 0 after absorption) leave the
    // thread intact — that's the wit defender's whole point.
    if (compIncoming > 0 || hpIncoming > 0) state.unblockedThisTurn = true;

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
      flushThreadPeak();
      return { outcome: 'lost', turns, killedBy: enemy.id, telemetry };
    }

    // v2.43: SAYING SOMETHING WRONG — end-of-turn scrub pass. By turn
    // end the AI has spent its planned energy on staging/defense; if a
    // Misstep is still in hand AND we have spare energy AND HP is at
    // <= 30% of max (the 3-HP auto-play would actually hurt), spend the
    // 1 Energy to discard it. The turn-start pass (above) handles the
    // existential case; this scrub catches the "I had a leftover Energy
    // and was actually low HP" case the original logic missed.
    {
      const tokIdxs = [];
      for (let i = 0; i < state.hand.length; i++) {
        if (state.hand[i]?.id === 'wv2-tok-misstep') tokIdxs.push(i);
      }
      if (tokIdxs.length > 0 && state.energy >= 1) {
        const hpFrac = state.maxHp > 0 ? (state.hp / state.maxHp) : 1;
        if (hpFrac <= 0.50) {
          for (let k = tokIdxs.length - 1; k >= 0; k--) {
            const idx = tokIdxs[k];
            const tok = state.hand[idx];
            if (!tok) continue;
            const cost = tok.cost || 1;
            if (cost > state.energy) break;
            state.energy -= cost;
            state.exiled.push(tok);
            state.hand.splice(idx, 1);
            telemetry.missTepDiscards = (telemetry.missTepDiscards || 0) + 1;
          }
        }
      }
    }

    // v2.38: SAYING SOMETHING WRONG — auto-play any Misstep tokens still in
    // hand at end of turn. Each token = -selfDamage HP (default 3) and
    // routes to exile (NOT discard — the token leaves play). Telemetry
    // tracks per-run autoplay count + total self-damage; missTepKills
    // increments if the auto-play KOs the player here.
    {
      const inHand = state.hand.filter(c => c?.id === 'wv2-tok-misstep');
      if (inHand.length > 0) {
        let totalSelfDmg = 0;
        for (const tok of inHand) totalSelfDmg += (tok.selfDamage || 3);
        state.hp = Math.max(0, state.hp - totalSelfDmg);
        for (const tok of inHand) state.exiled.push(tok);
        state.hand = state.hand.filter(c => c?.id !== 'wv2-tok-misstep');
        telemetry.missTepAutoPlays = (telemetry.missTepAutoPlays || 0) + inHand.length;
        telemetry.missTepAutoPlayDamage = (telemetry.missTepAutoPlayDamage || 0) + totalSelfDmg;
        if (state.hp <= 0) {
          telemetry.missTepKills = (telemetry.missTepKills || 0) + 1;
          flushThreadPeak();
          return { outcome: 'lost', turns, killedBy: 'misstep', telemetry };
        }
      }
    }

    // End-of-turn cleanup
    state.discard.push(...state.hand);
    state.hand = [];
    // v2.33: Block always resets at end of turn (Stubborn Block removed).
    state.block = 0;
    state.poise = 0; // v2.9: poise fades end-of-turn like block
    // v2.24: RAGE turn ends. Roll the +0.5 potency bump back, reset meter.
    if (state.rageActive) {
      state.playerDmgMult = Math.max(0.5, (state.playerDmgMult || 1) - 0.5);
      state.tunnelVision = 0;
      state.rageActive = false;
    }
    // v2.34: LONG THREAD bookkeeping. Runs after the enemy turn so
    // unblockedThisTurn is final.
    //   - Unblocked damage landed → reset to 0 (lost the thread).
    //   - Otherwise, if a wit Effect cast this turn → +1.
    //   - Otherwise (defensive turn, no wit cast) → unchanged.
    // Track peak per combat for telemetry. Reset per-turn flags either way.
    if (state.unblockedThisTurn) {
      if ((state.longThread || 0) > 0) {
        telemetry.longThreadBreaks = (telemetry.longThreadBreaks || 0) + 1;
      }
      state.longThread = 0;
    } else if (state.castWitEffectThisTurn) {
      state.longThread = (state.longThread || 0) + 1;
      if ((state.longThread || 0) > (state._longThreadPeak || 0)) {
        state._longThreadPeak = state.longThread;
      }
    }
    state.unblockedThisTurn = false;
    state.castWitEffectThisTurn = false;
    // v2.40: PATIENCE end-of-turn tick. If installed AND no cast resolved this
    // turn, bank +1 stack. `cast` is the local-scope flag set when the tray
    // cast actually fired (see the cast-resolve branch above). Track the peak
    // stack value across the combat for telemetry.
    if (state.patienceInstalled && !cast) {
      state.patienceStacks = (state.patienceStacks || 0) + 1;
      if ((state.patienceStacks || 0) > (state._patiencePeak || 0)) {
        state._patiencePeak = state.patienceStacks;
      }
    }
    // v2.36: ACTUALLY— per-turn reset. arguingBackThisTurn cleared after the
    // enemy attack resolved (the bill came due). lastCastSnapshot nuked so
    // next turn's Actually— can only re-fire what's cast THIS turn.
    state.arguingBackThisTurn = 0;
    state.lastCastSnapshot = null;
    // v2.37: HOLD ON auto-clear. If the player armed Hold On but no enemy
    // attack consumed it (e.g. the enemy's intent was a block/buff that
    // turn), the flag clears here. Telemetry doesn't count an unused arm
    // as damage-prevented — only actual reductions count.
    if (state.holdOnArmed) {
      state.holdOnArmed = false;
      state.holdOnValue = 0;
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
    // v2.38: SAYING SOMETHING WRONG — decrement pending Misstep timers and
    // deliver any that hit zero into the freshly-drawn hand. Mirrors the
    // App's endTurn ordering: decrement runs AFTER hand reshuffle so the
    // token shows up "on top" of the new hand. uid is omitted (sim doesn't
    // use it for behavior). selfDamage rides along so future variants can
    // deliver heavier missteps without changing this code.
    if (state.pendingMissteps.length > 0) {
      const nextPending = [];
      let delivered = 0;
      for (const pm of state.pendingMissteps) {
        const next = (pm.turnsRemaining || 0) - 1;
        if (next <= 0) {
          state.hand.push({ id: 'wv2-tok-misstep', name: 'Misstep', cost: 1, type: 'skill',
                            lane: 'wit', effects: { exhaust: true, missTepDiscard: true },
                            selfDamage: pm.selfDamage || 3 });
          delivered += 1;
        } else {
          nextPending.push({ ...pm, turnsRemaining: next });
        }
      }
      state.pendingMissteps = nextPending;
      if (delivered > 0) {
        telemetry.missTepDeliveries = (telemetry.missTepDeliveries || 0) + delivered;
      }
    }
  }

  // Stall
  flushThreadPeak();
  return { outcome: 'stall', turns, killedBy: enemy.id, telemetry };
}

// v2.4: slot-weighted reward draft. The lane pools have 25 intros + 25
// subjects + 15 targets + 10 modifiers — uniform random oversamples
// intros/subjects and undersamples the targets the player actually
// needs to cast. Slot weights keep target draws healthy as deck grows.
const SLOT_WEIGHTS = { target: 35, intro: 25, subject: 25, modifier: 15, skill: 18, power: 18 };
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
  // v2.33: Power-card bias. Per creator review, the sim under-installs
  // Powers because the rarity/slot draft doesn't weight them up. If the
  // player owns ZERO Power cards (slot === 'power') AND the lane pool has
  // any, fire a ~15% draft of a Power before the normal pick. Conservative
  // value so word-card variety isn't diluted; one-and-done early in run.
  const ownsAnyPower = allCards.some(c => c.slot === 'power');
  if (!ownsAnyPower) {
    const powers = pool.filter(c => c.slot === 'power');
    if (powers.length && rnd() < 0.15) {
      const card = pickRandom(powers);
      state.discard.push({ ...card, uid: uid() });
      state.rewardsTaken.push(card.id);
      return;
    }
  }
  // v2.33: Sorry-what skill bias. ~12% per-reward draft when the player
  // owns ZERO copies — calibrated to hit ~10%+ per-run engagement without
  // eating into the engine-card slot count too aggressively.
  const ownsSorryWhat = allCards.some(c => c.id === 'cv2-k-sorry-what');
  if (!ownsSorryWhat) {
    const sw = pool.find(c => c.id === 'cv2-k-sorry-what');
    if (sw && rnd() < 0.12) {
      state.discard.push({ ...sw, uid: uid() });
      state.rewardsTaken.push(sw.id);
      return;
    }
  }
  // v2.35: Hewn-Greaves footnote skill bias — wit lane only. The skill is
  // uncommon (would naturally appear ~60% of rewards × ~10% slot weight
  // for skills); the bias punches it up so sim engagement is reliably
  // measurable. Caps at one copy so the AI doesn't hoard the prompt.
  if (state.lane === 'wit') {
    const ownsFootnoteSkill = allCards.some(c => c.id === 'wv2-k-hewn-greaves-footnotes');
    if (!ownsFootnoteSkill) {
      const fk = pool.find(c => c.id === 'wv2-k-hewn-greaves-footnotes');
      if (fk && rnd() < 0.18) {
        state.discard.push({ ...fk, uid: uid() });
        state.rewardsTaken.push(fk.id);
        return;
      }
    }
  }
  // v2.36: ACTUALLY— skill bias — wit lane only. Uncommon Skill, the same
  // ~18% bias rate as Footnote so sim engagement is comparable. Caps at
  // two copies — the spec allows multiple plays per turn for stacking
  // arguing-back, so the AI should be able to chain two re-fires.
  if (state.lane === 'wit') {
    const actuallyCount = allCards.filter(c => c.id === 'wv2-k-actually').length;
    if (actuallyCount < 2) {
      const ak = pool.find(c => c.id === 'wv2-k-actually');
      if (ak && rnd() < 0.18) {
        state.discard.push({ ...ak, uid: uid() });
        state.rewardsTaken.push(ak.id);
        return;
      }
    }
  }
  // v2.37: HOLD ON — wit lane only. ~18% bias matching Actually/Footnote
  // so engagement is reliably measurable. Caps at one copy — the spec is
  // one-and-done arming (a second copy in hand can't stack the flag, only
  // re-arm it after consumption), so two is overkill for a defensive skill.
  if (state.lane === 'wit') {
    const ownsHoldOn = allCards.some(c => c.id === 'wv2-k-hold-on');
    if (!ownsHoldOn) {
      const hk = pool.find(c => c.id === 'wv2-k-hold-on');
      if (hk && rnd() < 0.20) {
        state.discard.push({ ...hk, uid: uid() });
        state.rewardsTaken.push(hk.id);
        return;
      }
    }
  }
  // v2.38: SAYING SOMETHING WRONG — wit lane rare target bias. Higher pick
  // rate (~22%) than the skills because it's a damage-dealing target the
  // tray actively needs and the deferred cost lets the player schedule it
  // around their own hand. Caps at one copy — chaining missteps every two
  // turns is a possible build but the auto-play accumulates fast (the
  // 1-copy cap keeps the cost lifecycle legible in sim numbers; if Alan
  // wants 2-copy builds tested later we can bump it).
  if (state.lane === 'wit') {
    const ownsSsw = allCards.some(c => c.id === 'wv2-t-saying-something-wrong');
    if (!ownsSsw) {
      const sk = pool.find(c => c.id === 'wv2-t-saying-something-wrong');
      if (sk && rnd() < 0.22) {
        state.discard.push({ ...sk, uid: uid() });
        state.rewardsTaken.push(sk.id);
        return;
      }
    }
  }
  // v2.39: OPENING STATEMENT target bias — wit lane only. Common target with
  // a built-in first-turn rider. ~32% bias because it's the heart of the new
  // primitive; we want it in deck reliably so sim measures the mechanic and
  // not draft variance. Cap at TWO copies — early turn-1 casts can chain
  // through reshuffle if the deck cycles fast enough.
  if (state.lane === 'wit') {
    const openingCount = allCards.filter(c => c.id === 'wv2-t-let-me-begin').length;
    if (openingCount < 2) {
      const ok = pool.find(c => c.id === 'wv2-t-let-me-begin');
      if (ok && rnd() < 0.32) {
        state.discard.push({ ...ok, uid: uid() });
        state.rewardsTaken.push(ok.id);
        return;
      }
    }
  }
  // v2.39: REVISIT-OPENING skill bias — wit lane only. Uncommon Skill that
  // pairs with the openingBonus target; only worth picking if the player
  // already owns at least one opening target (otherwise the bridge has no
  // payoff). ~18% bias gated by the prereq. Cap at one copy — the flag
  // is boolean, two in hand stacks nothing.
  if (state.lane === 'wit') {
    const ownsOpening = allCards.some(c => c.id === 'wv2-t-let-me-begin');
    const ownsRevisit = allCards.some(c => c.id === 'wv2-k-revisit-opening');
    if (ownsOpening && !ownsRevisit) {
      const rk = pool.find(c => c.id === 'wv2-k-revisit-opening');
      if (rk && rnd() < 0.18) {
        state.discard.push({ ...rk, uid: uid() });
        state.rewardsTaken.push(rk.id);
        return;
      }
    }
  }
  // v2.40: PATIENCE power bias — wit lane only. ~25% bias on the power so
  // the sim engages reliably; cap at one copy (a second copy stacks
  // nothing). Power is uncommon-tier, cost 1.
  if (state.lane === 'wit') {
    const ownsPatience = allCards.some(c => c.id === 'wv2-p-patience');
    if (!ownsPatience) {
      const pk = pool.find(c => c.id === 'wv2-p-patience');
      if (pk && rnd() < 0.25) {
        state.discard.push({ ...pk, uid: uid() });
        state.rewardsTaken.push(pk.id);
        return;
      }
    }
  }
  // v2.40: "I'LL LET YOU FINISH," skill bias — wit lane only, only worth
  // picking if Patience is also owned (otherwise the skill does nothing).
  // ~25% bias gated by the prereq. Cap at one copy.
  if (state.lane === 'wit') {
    const ownsPatience = allCards.some(c => c.id === 'wv2-p-patience');
    const ownsLetFinish = allCards.some(c => c.id === 'wv2-k-let-you-finish');
    if (ownsPatience && !ownsLetFinish) {
      const lk = pool.find(c => c.id === 'wv2-k-let-you-finish');
      if (lk && rnd() < 0.25) {
        state.discard.push({ ...lk, uid: uid() });
        state.rewardsTaken.push(lk.id);
        return;
      }
    }
  }
  // v2.41: SYNERGY CAPSTONE bias — wit lane only. The "is, in summary,"
  // capstone is rare (would naturally appear ~15% of rewards × ~3% target
  // slot weight); bias it up so sim engages reliably. Cap at one copy —
  // the card is a finisher, two in deck dilutes the supporting tier-2/3
  // primitives that make the riders fire. ~18% rate matches the existing
  // skill biases. Paired modifier "as previously stated," picked up under
  // the normal rarity-roll path (uncommon, slot=modifier) since it's a
  // generic +1 wit + self-footnote that's useful in any wit deck.
  if (state.lane === 'wit') {
    const ownsCapstone = allCards.some(c => c.id === 'wv2-t-in-summary');
    if (!ownsCapstone) {
      const cap = pool.find(c => c.id === 'wv2-t-in-summary');
      if (cap && rnd() < 0.18) {
        state.discard.push({ ...cap, uid: uid() });
        state.rewardsTaken.push(cap.id);
        return;
      }
    }
  }
  // v2.42: INSULT VULNERABILITIES bias — wit lane only. Uncommon target +
  // uncommon multi-tag subject. ~22% bias on the target (it's the rider
  // ceiling) + ~25% on the subject (it pairs with both the target AND any
  // future pierce cards). Cap each at one copy — the rider caps at 3
  // matches, so two pierce targets is redundant; two manner-of-speaking
  // subjects is also fine for tray cycling but not necessary for sim
  // measurement. The subject bias is gated by "has any insult-vuln target"
  // to avoid pulling a payoff subject without a payoff card.
  if (state.lane === 'wit') {
    const ownsPierceTarget = allCards.some(c => c.id === 'wv2-t-cannot-bear');
    if (!ownsPierceTarget) {
      const pt = pool.find(c => c.id === 'wv2-t-cannot-bear');
      if (pt && rnd() < 0.22) {
        state.discard.push({ ...pt, uid: uid() });
        state.rewardsTaken.push(pt.id);
        return;
      }
    }
  }
  if (state.lane === 'wit') {
    const ownsMannerSubject = allCards.some(c => c.id === 'wv2-s-manner-of-speaking');
    const ownsPierceTarget = allCards.some(c => c.id === 'wv2-t-cannot-bear');
    if (!ownsMannerSubject && ownsPierceTarget) {
      const ms = pool.find(c => c.id === 'wv2-s-manner-of-speaking');
      if (ms && rnd() < 0.30) {
        state.discard.push({ ...ms, uid: uid() });
        state.rewardsTaken.push(ms.id);
        return;
      }
    }
  }
  // v2.44: TANGENT skill bias — jnsq lane only. Common skill that depends on
  // a deep jnsq discard pile to fire well. ~22% bias, cap at one copy — the
  // skill is once-per-turn-useful and a second copy in hand stacks nothing.
  if (state.lane === 'jnsq') {
    const ownsTangent = allCards.some(c => c.id === 'jv2-k-that-reminds-me');
    if (!ownsTangent) {
      const tk = pool.find(c => c.id === 'jv2-k-that-reminds-me');
      if (tk && rnd() < 0.22) {
        state.discard.push({ ...tk, uid: uid() });
        state.rewardsTaken.push(tk.id);
        return;
      }
    }
  }
  // v2.44: "speaking of which," modifier bias — jnsq lane only. Common
  // modifier that discards an extra hand card on stage, deepening the
  // Tangent pool. ~20% bias gated by Tangent ownership so we don't draft
  // the support without the payoff. Cap at one copy.
  if (state.lane === 'jnsq') {
    const ownsTangent = allCards.some(c => c.id === 'jv2-k-that-reminds-me');
    const ownsSpeakingOfWhich = allCards.some(c => c.id === 'jv2-m-speaking-of-which');
    if (ownsTangent && !ownsSpeakingOfWhich) {
      const sk = pool.find(c => c.id === 'jv2-m-speaking-of-which');
      if (sk && rnd() < 0.20) {
        state.discard.push({ ...sk, uid: uid() });
        state.rewardsTaken.push(sk.id);
        return;
      }
    }
  }
  // v2.45: APOLOGY skill bias — jnsq lane only. Reset-and-heal common skill.
  // ~22% bias, cap at one copy (the apology is once-per-tray-state useful;
  // a second in hand can't trigger before the first resolves the tray).
  if (state.lane === 'jnsq') {
    const ownsApology = allCards.some(c => c.id === 'jv2-k-shouldnt-said-have-you-eaten');
    if (!ownsApology) {
      const ak = pool.find(c => c.id === 'jv2-k-shouldnt-said-have-you-eaten');
      if (ak && rnd() < 0.22) {
        state.discard.push({ ...ak, uid: uid() });
        state.rewardsTaken.push(ak.id);
        return;
      }
    }
  }
  // v2.45: "oh — wait — no, sorry," intro bias — jnsq lane only. Common
  // intro with ignoreNextDebuff rider. ~18% bias, ungated (it stands on its
  // own as a debuff absorber even without the Apology skill). Cap at one.
  if (state.lane === 'jnsq') {
    const ownsSorryIntro = allCards.some(c => c.id === 'jv2-i-oh-wait-no-sorry');
    if (!ownsSorryIntro) {
      const sk = pool.find(c => c.id === 'jv2-i-oh-wait-no-sorry');
      if (sk && rnd() < 0.18) {
        state.discard.push({ ...sk, uid: uid() });
        state.rewardsTaken.push(sk.id);
        return;
      }
    }
  }
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
    // v2.33: stubborn-block REMOVED.
    // v2.29: chutzpah saying-it-louder telemetry. iSaidCasts counts the
    // number of "I SAID." casts; loudCountSum accumulates the loudCount
    // observed on each such cast so we can compute mean stack-size.
    iSaidCasts: 0, loudCountSum: 0, loudBonusSum: 0,
    // v2.30: chutzpah smell-weakness telemetry. predatorTriggers counts
    // casts where the +N bonus actually fired (enemy was Vuln/Weak at cast),
    // predatorBonusTotal aggregates the +damage across the run.
    predatorTriggers: 0, predatorBonusTotal: 0,
    // v2.31: synergy capstone — AND-IM-NOT-DONE casts + total damage. Rare-
    // tier so the per-run count is expected to be 0-2 most runs.
    andImNotDoneCasts: 0, andImNotDoneTotalDamage: 0,
    // v2.41: wit SYNERGY CAPSTONE casts + total damage. Mirrors chutzpah cap.
    inSummaryCasts: 0, inSummaryTotalDamage: 0,
    // v2.33: NOT LISTENING refactored to a SKILL. notListeningSkillCasts =
    // how many times the "Sorry — what?" skill was played; notListeningAbsorbs
    // = enemy debuff attempts that were absorbed by an armed token.
    notListeningSkillCasts: 0, notListeningAbsorbs: 0,
    // v2.34: wit LONG THREAD telemetry. longThreadPeakSum = sum of peak
    // longThread across all combats in this run. combatsWithThread = how
    // many combats reached longThread ≥ 1 at any point. longThreadBreaks =
    // count of "unblocked hit reset a non-zero meter" events. threadScaling*
    // = number of casts where the rider fired + total flat damage from it.
    longThreadPeakSum: 0, combatsWithThread: 0, longThreadBreaks: 0,
    threadScalingTriggers: 0, threadScalingBonusTotal: 0,
    naturalConclusionCasts: 0,
    // v2.43: thread-preservation skip-cast counter.
    threadPreservationSkips: 0,
    // v2.35: FOOTNOTE telemetry. footnotesApplied = number of times the
    // Hewn-Greaves footnote skill resolved (incremented in the sim AI's
    // play branch). footnoteCastsWithBonus = casts where the +footnote
    // stat rider contributed >0 damage. footnoteBonusDamage = pre-modifier
    // flat damage delta the riders carried in total.
    footnotesApplied: 0,
    footnoteCastsWithBonus: 0,
    footnoteBonusDamage: 0,
    // v2.36: ACTUALLY— telemetry. actuallyCasts = number of re-fires that
    // resolved; actuallyExtraDamage = total damage delivered by re-fires
    // (pre-block-absorb); arguingBackEnemyBonus = total +damage the enemy
    // dealt thanks to arguing-back stacks. The cost-vs-payoff ratio
    // shows whether the mechanic is paying its own bill.
    actuallyCasts: 0,
    actuallyExtraDamage: 0,
    arguingBackEnemyBonus: 0,
    // v2.37: HOLD ON telemetry. holdOnPlays = number of times the skill
    // was played; holdOnDamagePrevented = sum of incoming damage reduced
    // across all consumed arms (excludes unused arms — auto-cleared ones
    // don't count toward the impact metric).
    holdOnPlays: 0,
    holdOnDamagePrevented: 0,
    // v2.38: SAYING SOMETHING WRONG telemetry. missTepCasts = queued; deliveries
    // = landed in hand; discards = paid 1 Energy; autoPlays = ate -3; kills =
    // KO'd by auto-play; damageOut = the up-front cast damage from the target.
    missTepCasts: 0,
    missTepDeliveries: 0,
    missTepDiscards: 0,
    missTepAutoPlays: 0,
    missTepAutoPlayDamage: 0,
    missTepKills: 0,
    missTepDamageOut: 0,
    // v2.39: OPENING STATEMENT telemetry. openingBonusTriggers = casts where
    // the +N rider actually fired (turn 1 OR openingExtended armed);
    // openingBonusDamageTotal = sum of flat bonus damage across the sample;
    // revisitOpeningPlays = times the "to revisit my opening point," skill
    // was played AND consumed for a target cast.
    openingBonusTriggers: 0,
    openingBonusDamageTotal: 0,
    revisitOpeningPlays: 0,
    // v2.40: PATIENCE telemetry. patienceInstalls = number of combats where
    // the power was installed; patiencePeakStacks = run-level peak across
    // all combats; patienceDamageBonus = total flat damage delivered by
    // patience-spend across all casts; patienceCasts = casts that consumed
    // the bank (count); patienceSkillPlays = "I'll let you finish," skill
    // plays that banked a stack.
    patienceInstalls: 0,
    patiencePeakStacks: 0,
    patienceDamageBonus: 0,
    patienceCasts: 0,
    patienceSkillPlays: 0,
    // v2.42: INSULT VULNERABILITIES telemetry. insultMatchesTotal = sum of
    // CAPPED match counts (caps at 3/cast) across all casts where the rider
    // ran; insultDamageTotal = total flat bonus damage from the rider;
    // insultCasts = number of resolved casts where the bonus actually fired.
    insultMatchesTotal: 0,
    insultDamageTotal: 0,
    insultCasts: 0,
    // v2.44: TANGENT telemetry — jnsq detour mechanic. fires = skill plays;
    // targetsCast = fired card was a target AND tray was complete;
    // wordsStaged = fired card was intro/subject/modifier; fizzles = fired
    // target landed against an incomplete tray.
    tangentFires: 0,
    tangentTargetsCast: 0,
    tangentWordsStaged: 0,
    tangentFizzles: 0,
    // v2.45: APOLOGY telemetry — reset-and-heal jnsq skill.
    apologyCasts: 0,
    apologyHpHealed: 0,
    apologyTrayDiscarded: 0,
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
    // v2.33: stubborn-block REMOVED — no metrics.
    // v2.29: saying-it-louder metrics.
    iSaidCasts: results.reduce((s, r) => s + (r.iSaidCasts || 0), 0),
    iSaidRuns: results.filter(r => (r.iSaidCasts || 0) > 0).length,
    loudCountSum: results.reduce((s, r) => s + (r.loudCountSum || 0), 0),
    loudBonusSum: results.reduce((s, r) => s + (r.loudBonusSum || 0), 0),
    // v2.30: smell-weakness / predator metrics.
    predatorTriggers: results.reduce((s, r) => s + (r.predatorTriggers || 0), 0),
    predatorBonusTotal: results.reduce((s, r) => s + (r.predatorBonusTotal || 0), 0),
    predatorRuns: results.filter(r => (r.predatorTriggers || 0) > 0).length,
    // v2.31: synergy-capstone metrics.
    andImNotDoneCasts: results.reduce((s, r) => s + (r.andImNotDoneCasts || 0), 0),
    andImNotDoneTotalDamage: results.reduce((s, r) => s + (r.andImNotDoneTotalDamage || 0), 0),
    andImNotDoneRuns: results.filter(r => (r.andImNotDoneCasts || 0) > 0).length,
    // v2.41: wit synergy-capstone metrics.
    inSummaryCasts: results.reduce((s, r) => s + (r.inSummaryCasts || 0), 0),
    inSummaryTotalDamage: results.reduce((s, r) => s + (r.inSummaryTotalDamage || 0), 0),
    inSummaryRuns: results.filter(r => (r.inSummaryCasts || 0) > 0).length,
    // v2.33: not-listening skill metrics.
    notListeningSkillCasts: results.reduce((s, r) => s + (r.notListeningSkillCasts || 0), 0),
    notListeningSkillRuns: results.filter(r => (r.notListeningSkillCasts || 0) > 0).length,
    notListeningAbsorbs: results.reduce((s, r) => s + (r.notListeningAbsorbs || 0), 0),
    // v2.34: wit LONG THREAD metrics.
    longThreadPeakSum: results.reduce((s, r) => s + (r.longThreadPeakSum || 0), 0),
    combatsWithThread: results.reduce((s, r) => s + (r.combatsWithThread || 0), 0),
    longThreadBreaks: results.reduce((s, r) => s + (r.longThreadBreaks || 0), 0),
    threadScalingTriggers: results.reduce((s, r) => s + (r.threadScalingTriggers || 0), 0),
    threadScalingBonusTotal: results.reduce((s, r) => s + (r.threadScalingBonusTotal || 0), 0),
    naturalConclusionCasts: results.reduce((s, r) => s + (r.naturalConclusionCasts || 0), 0),
    threadRuns: results.filter(r => (r.combatsWithThread || 0) > 0).length,
    // v2.43: thread-preservation skip-cast metric.
    threadPreservationSkips: results.reduce((s, r) => s + (r.threadPreservationSkips || 0), 0),
    // v2.35: FOOTNOTE metrics.
    footnotesApplied: results.reduce((s, r) => s + (r.footnotesApplied || 0), 0),
    footnoteCastsWithBonus: results.reduce((s, r) => s + (r.footnoteCastsWithBonus || 0), 0),
    footnoteBonusDamage: results.reduce((s, r) => s + (r.footnoteBonusDamage || 0), 0),
    footnoteRuns: results.filter(r => (r.footnotesApplied || 0) > 0).length,
    // v2.36: ACTUALLY— metrics.
    actuallyCasts: results.reduce((s, r) => s + (r.actuallyCasts || 0), 0),
    actuallyExtraDamage: results.reduce((s, r) => s + (r.actuallyExtraDamage || 0), 0),
    arguingBackEnemyBonus: results.reduce((s, r) => s + (r.arguingBackEnemyBonus || 0), 0),
    actuallyRuns: results.filter(r => (r.actuallyCasts || 0) > 0).length,
    // v2.37: HOLD ON aggregate.
    holdOnPlays: results.reduce((s, r) => s + (r.holdOnPlays || 0), 0),
    holdOnDamagePrevented: results.reduce((s, r) => s + (r.holdOnDamagePrevented || 0), 0),
    holdOnRuns: results.filter(r => (r.holdOnPlays || 0) > 0).length,
    // v2.38: SAYING SOMETHING WRONG aggregate. missTepCasts = number of
    // times the cast resolved AND queued a token. missTepDeliveries =
    // number of tokens that actually landed in hand. missTepDiscards =
    // tokens paid off for 1 Energy. missTepAutoPlays = tokens eaten by
    // auto-play. missTepKills = runs where the auto-play KO'd the player.
    missTepCasts: results.reduce((s, r) => s + (r.missTepCasts || 0), 0),
    missTepDeliveries: results.reduce((s, r) => s + (r.missTepDeliveries || 0), 0),
    missTepDiscards: results.reduce((s, r) => s + (r.missTepDiscards || 0), 0),
    missTepAutoPlays: results.reduce((s, r) => s + (r.missTepAutoPlays || 0), 0),
    missTepAutoPlayDamage: results.reduce((s, r) => s + (r.missTepAutoPlayDamage || 0), 0),
    missTepKills: results.reduce((s, r) => s + (r.missTepKills || 0), 0),
    missTepDamageOut: results.reduce((s, r) => s + (r.missTepDamageOut || 0), 0),
    missTepRuns: results.filter(r => (r.missTepCasts || 0) > 0).length,
    // v2.39: OPENING STATEMENT aggregate. openingBonusTriggers = per-cast
    // firings of the +N rider; openingBonusDamageTotal = total flat damage
    // delivered by it; revisitOpeningPlays = times the bridge skill was
    // played; openingBonusRuns = runs that hit at least one trigger.
    openingBonusTriggers: results.reduce((s, r) => s + (r.openingBonusTriggers || 0), 0),
    openingBonusDamageTotal: results.reduce((s, r) => s + (r.openingBonusDamageTotal || 0), 0),
    revisitOpeningPlays: results.reduce((s, r) => s + (r.revisitOpeningPlays || 0), 0),
    openingBonusRuns: results.filter(r => (r.openingBonusTriggers || 0) > 0).length,
    // v2.40: PATIENCE aggregate. patienceInstalls = number of runs with at
    // least one install; patiencePeakStacksMax = highest run-level peak;
    // patienceDamageBonus = sum total of damage delivered by patience spend;
    // patienceCasts = sum of casts that consumed the bank; patienceInstallRuns
    // = runs that hit at least one install.
    patienceInstalls: results.reduce((s, r) => s + (r.patienceInstalls || 0), 0),
    patienceInstallRuns: results.filter(r => (r.patienceInstalls || 0) > 0).length,
    patiencePeakStacksMax: results.reduce((m, r) => Math.max(m, r.patiencePeakStacks || 0), 0),
    patiencePeakStacksMean: mean(results.map(r => r.patiencePeakStacks || 0)),
    patienceDamageBonus: results.reduce((s, r) => s + (r.patienceDamageBonus || 0), 0),
    patienceCasts: results.reduce((s, r) => s + (r.patienceCasts || 0), 0),
    patienceSkillPlays: results.reduce((s, r) => s + (r.patienceSkillPlays || 0), 0),
    // v2.42: INSULT VULNERABILITIES aggregate. insultMatchesTotal = sum of
    // CAPPED matches across casts; insultDamageTotal = total flat damage;
    // insultCasts = number of casts that fired the rider;
    // insultRuns = runs that hit at least one rider trigger.
    insultMatchesTotal: results.reduce((s, r) => s + (r.insultMatchesTotal || 0), 0),
    insultDamageTotal: results.reduce((s, r) => s + (r.insultDamageTotal || 0), 0),
    insultCasts: results.reduce((s, r) => s + (r.insultCasts || 0), 0),
    insultRuns: results.filter(r => (r.insultCasts || 0) > 0).length,
    // v2.44: TANGENT aggregate. fires = total skill plays; targetsCast =
    // detours that resolved as casts; wordsStaged = detours that staged into
    // tray slots; fizzles = detour targets that missed an empty tray; runs =
    // runs with at least one fire.
    tangentFires: results.reduce((s, r) => s + (r.tangentFires || 0), 0),
    tangentTargetsCast: results.reduce((s, r) => s + (r.tangentTargetsCast || 0), 0),
    tangentWordsStaged: results.reduce((s, r) => s + (r.tangentWordsStaged || 0), 0),
    tangentFizzles: results.reduce((s, r) => s + (r.tangentFizzles || 0), 0),
    tangentRuns: results.filter(r => (r.tangentFires || 0) > 0).length,
    // v2.45: APOLOGY aggregate.
    apologyCasts: results.reduce((s, r) => s + (r.apologyCasts || 0), 0),
    apologyHpHealed: results.reduce((s, r) => s + (r.apologyHpHealed || 0), 0),
    apologyTrayDiscarded: results.reduce((s, r) => s + (r.apologyTrayDiscarded || 0), 0),
    apologyRuns: results.filter(r => (r.apologyCasts || 0) > 0).length,
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
  lines.push(`## Chutzpah SAYING IT LOUDER (v2.29)`);
  lines.push(`- "I SAID." casts: ${agg.iSaidCasts} (runs: ${agg.iSaidRuns} / ${agg.N}, ${pct(agg.iSaidRuns / agg.N)})`);
  lines.push(`- Avg loudCount per cast: ${agg.iSaidCasts > 0 ? (agg.loudCountSum / agg.iSaidCasts).toFixed(2) : '0.00'}`);
  lines.push(`- Avg bonus damage per cast: ${agg.iSaidCasts > 0 ? (agg.loudBonusSum / agg.iSaidCasts).toFixed(2) : '0.00'}`);
  lines.push(`- Total bonus damage from louder: ${agg.loudBonusSum}`);
  lines.push('');
  lines.push(`## Chutzpah SMELL WEAKNESS (v2.30)`);
  lines.push(`- Predator triggers (cast hit while enemy debuffed): ${agg.predatorTriggers} (runs: ${agg.predatorRuns} / ${agg.N}, ${pct(agg.predatorRuns / agg.N)})`);
  lines.push(`- Total bonus damage from predator: ${agg.predatorBonusTotal}`);
  lines.push(`- Avg bonus per trigger: ${agg.predatorTriggers > 0 ? (agg.predatorBonusTotal / agg.predatorTriggers).toFixed(2) : '0.00'}`);
  lines.push('');
  lines.push(`## Chutzpah SYNERGY CAPSTONE — "AND I'M NOT DONE." (v2.31)`);
  lines.push(`- Capstone casts: ${agg.andImNotDoneCasts} (runs: ${agg.andImNotDoneRuns} / ${agg.N}, ${pct(agg.andImNotDoneRuns / agg.N)})`);
  lines.push(`- Total capstone damage: ${agg.andImNotDoneTotalDamage}`);
  lines.push(`- Avg damage per capstone cast: ${agg.andImNotDoneCasts > 0 ? (agg.andImNotDoneTotalDamage / agg.andImNotDoneCasts).toFixed(2) : '0.00'}`);
  lines.push('');
  lines.push(`## Chutzpah NOT LISTENING — "Sorry — what?" SKILL (v2.33)`);
  lines.push(`- Skill casts: ${agg.notListeningSkillCasts} (runs: ${agg.notListeningSkillRuns} / ${agg.N}, ${pct(agg.notListeningSkillRuns / agg.N)})`);
  lines.push(`- Total debuff absorbs: ${agg.notListeningAbsorbs}`);
  lines.push(`- Avg absorbs per skill cast: ${agg.notListeningSkillCasts > 0 ? (agg.notListeningAbsorbs / agg.notListeningSkillCasts).toFixed(2) : '0.00'}`);
  lines.push('');
  lines.push(`## Wit LONG THREAD (v2.34)`);
  lines.push(`- Combats reaching LT ≥ 1: ${agg.combatsWithThread} (runs: ${agg.threadRuns} / ${agg.N}, ${pct(agg.threadRuns / agg.N)})`);
  lines.push(`- Avg peak LT per run (across all combats): ${(agg.longThreadPeakSum / agg.N).toFixed(2)}`);
  lines.push(`- Avg peak LT per threaded combat: ${agg.combatsWithThread > 0 ? (agg.longThreadPeakSum / agg.combatsWithThread).toFixed(2) : '0.00'}`);
  lines.push(`- Thread breaks (unblocked hit reset a non-zero meter): ${agg.longThreadBreaks}`);
  lines.push(`- Thread-scaling rider triggers: ${agg.threadScalingTriggers}`);
  lines.push(`- Total bonus damage from thread scaling: ${agg.threadScalingBonusTotal}`);
  lines.push(`- "natural conclusion." target casts: ${agg.naturalConclusionCasts}`);
  lines.push(`- v2.43 thread-preservation skip-casts: ${agg.threadPreservationSkips || 0}`);
  lines.push('');
  lines.push(`## Wit FOOTNOTE (v2.35)`);
  lines.push(`- Footnotes applied: ${agg.footnotesApplied} (runs: ${agg.footnoteRuns} / ${agg.N}, ${pct(agg.footnoteRuns / agg.N)})`);
  lines.push(`- Casts contributing footnote bonus: ${agg.footnoteCastsWithBonus}`);
  lines.push(`- Total footnote bonus damage: ${agg.footnoteBonusDamage}`);
  lines.push(`- Avg bonus per footnoted cast: ${agg.footnoteCastsWithBonus > 0 ? (agg.footnoteBonusDamage / agg.footnoteCastsWithBonus).toFixed(2) : '0.00'}`);
  lines.push('');
  lines.push(`## Wit ACTUALLY— (v2.36)`);
  lines.push(`- Re-fires resolved: ${agg.actuallyCasts} (runs: ${agg.actuallyRuns} / ${agg.N}, ${pct(agg.actuallyRuns / agg.N)})`);
  lines.push(`- Total re-fire damage: ${agg.actuallyExtraDamage}`);
  lines.push(`- Avg damage / re-fire: ${agg.actuallyCasts > 0 ? (agg.actuallyExtraDamage / agg.actuallyCasts).toFixed(2) : '0.00'}`);
  lines.push(`- Enemy bonus from arguing-back: ${agg.arguingBackEnemyBonus} (cost side fired)`);
  lines.push('');
  lines.push(`## Wit HOLD ON — (v2.37)`);
  lines.push(`- Plays: ${agg.holdOnPlays} (runs: ${agg.holdOnRuns} / ${agg.N}, ${pct(agg.holdOnRuns / agg.N)})`);
  lines.push(`- Total damage prevented: ${agg.holdOnDamagePrevented}`);
  lines.push(`- Avg prevention / play: ${agg.holdOnPlays > 0 ? (agg.holdOnDamagePrevented / agg.holdOnPlays).toFixed(2) : '0.00'}`);
  lines.push('');
  lines.push(`## Wit SAYING SOMETHING WRONG (v2.38)`);
  lines.push(`- Casts that queued a Misstep: ${agg.missTepCasts} (runs: ${agg.missTepRuns} / ${agg.N}, ${pct(agg.missTepRuns / agg.N)})`);
  lines.push(`- Up-front damage dealt by those casts: ${agg.missTepDamageOut}`);
  lines.push(`- Tokens delivered to hand: ${agg.missTepDeliveries}`);
  lines.push(`- Discarded (1 Energy paid): ${agg.missTepDiscards}`);
  lines.push(`- Auto-played (-3 HP eaten): ${agg.missTepAutoPlays} (total damage: ${agg.missTepAutoPlayDamage})`);
  lines.push(`- KOs by Misstep auto-play: ${agg.missTepKills}`);
  const avgDmgPerCast = agg.missTepCasts > 0 ? (agg.missTepDamageOut / agg.missTepCasts).toFixed(2) : '0.00';
  lines.push(`- Avg up-front damage / cast: ${avgDmgPerCast}`);
  lines.push('');
  lines.push(`## Wit OPENING STATEMENT (v2.39)`);
  lines.push(`- Bonus triggers: ${agg.openingBonusTriggers} (runs: ${agg.openingBonusRuns} / ${agg.N}, ${pct(agg.openingBonusRuns / agg.N)})`);
  lines.push(`- Total bonus damage: ${agg.openingBonusDamageTotal}`);
  lines.push(`- Avg bonus / trigger: ${agg.openingBonusTriggers > 0 ? (agg.openingBonusDamageTotal / agg.openingBonusTriggers).toFixed(2) : '0.00'}`);
  lines.push(`- Revisit-opening skill plays: ${agg.revisitOpeningPlays}`);
  lines.push('');
  lines.push(`## Wit PATIENCE (v2.40)`);
  lines.push(`- Installs: ${agg.patienceInstalls} (runs: ${agg.patienceInstallRuns} / ${agg.N}, ${pct(agg.patienceInstallRuns / agg.N)})`);
  lines.push(`- Peak stacks — max: ${agg.patiencePeakStacksMax}, mean: ${agg.patiencePeakStacksMean.toFixed(2)}`);
  lines.push(`- Total damage from patience-spend: ${agg.patienceDamageBonus}`);
  lines.push(`- Casts that consumed bank: ${agg.patienceCasts}`);
  lines.push(`- "I'll let you finish," skill plays: ${agg.patienceSkillPlays}`);
  lines.push(`- Avg damage / spend: ${agg.patienceCasts > 0 ? (agg.patienceDamageBonus / agg.patienceCasts).toFixed(2) : '0.00'}`);
  lines.push('');
  lines.push(`## Wit SYNERGY CAPSTONE (v2.41)`);
  lines.push(`- "in summary," casts: ${agg.inSummaryCasts} (runs: ${agg.inSummaryRuns} / ${agg.N}, ${pct(agg.inSummaryRuns / agg.N)})`);
  lines.push(`- Total capstone damage: ${agg.inSummaryTotalDamage}`);
  lines.push(`- Avg damage per cast: ${agg.inSummaryCasts > 0 ? (agg.inSummaryTotalDamage / agg.inSummaryCasts).toFixed(2) : '0.00'}`);
  lines.push('');
  lines.push(`## Wit INSULT VULNERABILITIES (v2.42)`);
  lines.push(`- Casts that hit the rider: ${agg.insultCasts} (runs: ${agg.insultRuns} / ${agg.N}, ${pct(agg.insultRuns / agg.N)})`);
  lines.push(`- Total matched tags (capped 3/cast): ${agg.insultMatchesTotal}`);
  lines.push(`- Total bonus damage: ${agg.insultDamageTotal}`);
  lines.push(`- Avg bonus per cast: ${agg.insultCasts > 0 ? (agg.insultDamageTotal / agg.insultCasts).toFixed(2) : '0.00'}`);
  lines.push('');
  lines.push(`## Jnsq TANGENT (v2.44)`);
  lines.push(`- "That reminds me," skill plays: ${agg.tangentFires} (runs: ${agg.tangentRuns} / ${agg.N}, ${pct(agg.tangentRuns / agg.N)})`);
  lines.push(`- Detours that cast a target: ${agg.tangentTargetsCast}`);
  lines.push(`- Detours that staged a word/modifier: ${agg.tangentWordsStaged}`);
  lines.push(`- Detours that fizzled (target hit incomplete tray): ${agg.tangentFizzles}`);
  lines.push(`- Outcome ratio: cast / staged / fizzle: ${agg.tangentTargetsCast} / ${agg.tangentWordsStaged} / ${agg.tangentFizzles}`);
  lines.push('');
  lines.push(`## Jnsq APOLOGY (v2.45)`);
  lines.push(`- "I shouldn't have said that —" plays: ${agg.apologyCasts} (runs: ${agg.apologyRuns} / ${agg.N}, ${pct(agg.apologyRuns / agg.N)})`);
  lines.push(`- Total HP healed: ${agg.apologyHpHealed}`);
  lines.push(`- Total tray cards discarded by reset: ${agg.apologyTrayDiscarded}`);
  lines.push(`- Avg tray cards / cast: ${agg.apologyCasts > 0 ? (agg.apologyTrayDiscarded / agg.apologyCasts).toFixed(2) : '0.00'}`);
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
