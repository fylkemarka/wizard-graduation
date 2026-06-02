// Witch Mountain Bridge — v2 sentence-engine sim.
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
import { WIT_ROWS, WIT_SAME_SCHOOL_BONUSES, WIT_PARTIAL_ROW_BONUSES, WIT_ROW_BY_ID, detectFFT } from '../src/cards/wit-v2-rows.js';
import { HANDLER_V2, HANDLER_V2_BY_SLOT } from '../src/cards/handler-v2.js';
import { JNSQ_V2, JNSQ_V2_BY_SLOT } from '../src/cards/jnsq-v2.js';
import { TIER_MULTIPLIER, computeSpellTier, computeSpellDamage } from '../src/cards/shared.js';
import { ENEMIES as SHARED_ENEMIES } from '../src/data/enemies.js';
import { ANIMALS, ADJACENCY_COMBOS } from '../src/data/animals.js';

// =============================================================================
// 1. ENEMY DATA — imported from the SHARED canonical roster (src/data/enemies.js,
// extracted from App.jsx 2026-06-01). App.jsx imports the same module, so enemy
// stats + behaviors CANNOT drift between game and sim. Edit enemies there.
//
// The shared shape uses { composureMax, hpMax, behaviors, softSpot,
// insultVulnerabilities? }. The sim historically keyed combat off comp/hp/atk
// scalars; the adapter below maps the shared shape onto that while preserving
// the full `behaviors` list so the intent engine can roll the same weighted,
// telegraphed intents the live game does. `atk` is a derived weighted-average
// attack value — retained only as an AI planning fallback; real per-turn damage
// now comes from the rolled intent (see the enemy-turn block in runCombat).
//
// EFFECTIVENESS NOTE (2026-06-01): static per-stat enemy effectiveness was
// removed game-wide on 2026-05-31. The shared roster carries NO effectiveness
// field; the game reads `enemy?.effectiveness?.[lane] ?? 1.0`, so every enemy is
// baseline 1.0 unless a Sway card mutates it mid-combat. The sim therefore
// initializes `enemy.effectiveness = {}` (all reads default to 1.0) — faithful
// to the live build. The old baked per-enemy resistance matrix was deleted.
// =============================================================================

// Weighted-average attack value across an enemy's attack / attack-multi
// behaviors. AI planning fallback only; intents drive actual damage.
function avgAttack(behaviors) {
  const atks = (behaviors || []).filter(b => b.kind === 'attack' || b.kind === 'attack-multi');
  if (atks.length === 0) return 0;
  let wsum = 0, vsum = 0;
  for (const b of atks) {
    const w = b.weight || 1;
    const v = (b.value || 0) * (b.kind === 'attack-multi' ? (b.count || 1) : 1);
    wsum += w; vsum += v * w;
  }
  return Math.round(vsum / Math.max(1, wsum));
}

const ENEMIES = SHARED_ENEMIES.map(e => ({
  id: e.id,
  act: e.act,
  name: e.name,
  tier: e.tier,
  comp: e.composureMax || 0,
  hp: (e.hpMax == null) ? 999 : e.hpMax,
  atk: avgAttack(e.behaviors),
  behaviors: (e.behaviors || []).map(b => ({ ...b })),
  insultVulnerabilities: e.insultVulnerabilities || [],
  softSpot: e.softSpot,
}));
const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

// Weighted intent roll, mirroring App.jsx rollIntent (anti-repeat via
// excludeKinds; falls back to the full pool if filtering empties it).
function rollIntent(enemy, excludeKinds = []) {
  const behaviors = enemy.behaviors || [];
  const filtered = behaviors.filter(b => !excludeKinds.includes(b.kind));
  const pool = filtered.length > 0 ? filtered : behaviors;
  if (pool.length === 0) return null;
  const total = pool.reduce((s, b) => s + (b.weight || 1), 0);
  let roll = Math.random() * total;
  for (const b of pool) {
    roll -= (b.weight || 1);
    if (roll <= 0) return { ...b };
  }
  return { ...pool[0] };
}

// Expected unblocked damage the CURRENT rolled intent will deal, split by pool.
// Used by the greedy AI to plan block/poise. Non-attack intents deal 0.
function expectedIntentDamage(state, enemy) {
  const it = state.enemyIntent;
  if (!it || (it.kind !== 'attack' && it.kind !== 'attack-multi')) return { hp: 0, comp: 0 };
  const hits = it.kind === 'attack-multi' ? (it.count || 1) : 1;
  const raw = Math.round((it.value || 0) * hits * (state.enemyDmgMult || 1));
  return (it.pool === 'composure') ? { hp: 0, comp: raw } : { hp: raw, comp: 0 };
}

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
const STARTING_MAX_COMPOSURE = 35;
const ENERGY_PER_TURN = 3;
const HAND_SIZE = 6;
const INTER_ACT_HEAL_RATIO = 0.35; // v2.22: 0.55 → 0.35 (live-play attrition fix)
const MAX_COMBAT_TURNS = 30;  // safety net

const LANE_POOL = { wit: WIT_V2, handler: HANDLER_V2, jnsq: JNSQ_V2 };
const LANE_POOL_BY_SLOT = { wit: WIT_V2_BY_SLOT, handler: HANDLER_V2_BY_SLOT, jnsq: JNSQ_V2_BY_SLOT };

// =============================================================================
// 1c. HANDLER (Animal Summoner) CARD DATA. Lures come from the shared
// HANDLER_V2 module (drift-proof); tactics / utility / handler-skills are the
// sim-AI's card pool, mirroring src/App.jsx's handler deck. Animal stats read
// from the shared src/data/animals.js ANIMALS table — never inline them here.
// =============================================================================
const HANDLER_TACTIC_UTIL = [
  { id: 'c-tactic-shield',  name: 'Summoned Shield',  cost: 1, type: 'tactic', rarity: 'common',   tactic: { id: 'shield' } },
  { id: 'c-tactic-rabid',   name: 'Rabid',            cost: 1, type: 'tactic', rarity: 'uncommon', tactic: { id: 'rabid' } },
  { id: 'c-tactic-youth',   name: 'Fountain of Youth',cost: 1, type: 'tactic', rarity: 'common',   tactic: { id: 'youth' } },
  { id: 'c-tactic-nurture', name: 'Nurture',          cost: 2, type: 'tactic', rarity: 'uncommon', tactic: { id: 'nurture' } },
  { id: 'c-tactic-feather', name: 'Birds of a Feather',cost: 1, type: 'tactic', rarity: 'common',  tactic: { id: 'feather', requiresExactlyOneAnimal: true } },
  { id: 'c-shoo',        name: 'Shoo!',     cost: 1, type: 'handler-util', rarity: 'basic',    util: 'shoo' },
  { id: 'c-pack-tactics',name: 'On Three!', cost: 2, type: 'handler-util', rarity: 'uncommon', util: 'onThree', exhaust: true },
  { id: 'c-just-eat-it', name: 'Just Eat It',cost: 0, type: 'handler-util', rarity: 'common',  util: 'eatNow', exhaust: true },
  { id: 'c-buffet',      name: 'Buffet',    cost: 2, type: 'handler-util', rarity: 'uncommon', util: 'buffet', exhaust: true },
  { id: 'c-treat',       name: 'Treat',     cost: 1, type: 'handler-util', rarity: 'common',   util: 'treat' },
  { id: 'c-defend-handler', name: 'Step Back', cost: 1, type: 'handler-skill', rarity: 'basic', effects: { block: 6 } },
  { id: 'c-compose',     name: 'Compose Yourself', cost: 1, type: 'handler-skill', rarity: 'basic', effects: { poise: 7, removeWeak: 1 } },
  { id: 'c-sharp-aside', name: 'Sharp Whistle', cost: 1, type: 'handler-skill', rarity: 'uncommon', effects: { compDmg: 4 } },
  // ---- BOOSTER / BUFF cards (2026-06-01). Mirror src/App.jsx CARDS. Powers
  // install onto state.powers; the engine reads them via hasHandlerPower().
  // The new effect-key skills are routed in playHandlerCard / applyHandlerSkill.
  { id: 'c-house-rules',   name: 'House Rules',     cost: 2, type: 'power', rarity: 'uncommon', installPower: { id: 'houseRules' } },
  { id: 'c-well-drilled',  name: 'Well-Drilled',    cost: 2, type: 'power', rarity: 'uncommon', installPower: { id: 'wellDrilled' } },
  { id: 'c-whisperer',     name: 'The Whisperer',   cost: 2, type: 'power', rarity: 'rare',     installPower: { id: 'whisperer' } },
  { id: 'c-open-door',     name: 'Open Door Policy', cost: 2, type: 'power', rarity: 'rare',    installPower: { id: 'openDoor' } },
  { id: 'c-pecking-order', name: 'Pecking Order',    cost: 1, type: 'power', rarity: 'uncommon', installPower: { id: 'peckingOrder' } },
  { id: 'c-full-pockets',  name: 'Full Pockets',    cost: 2, type: 'power', rarity: 'common',   installPower: { id: 'fullPockets' } },
  { id: 'c-last-supper',   name: 'Last Supper',     cost: 1, type: 'handler-skill', rarity: 'uncommon', effects: { sacrificeForValue: true } },
  { id: 'c-make-it-count', name: 'Make It Count',   cost: 2, type: 'handler-skill', rarity: 'rare',     effects: { sacrificeAllForBurst: true, exhaust: true } },
  { id: 'c-murmuration',   name: 'Murmuration',     cost: 1, type: 'handler-skill', rarity: 'uncommon', effects: { compDmgPerBird: 3 } },
  { id: 'c-stampede',      name: 'Stampede',        cost: 1, type: 'handler-skill', rarity: 'uncommon', effects: { smallLandAttackAgain: true, exhaust: true } },
  { id: 'c-gorge',         name: 'Gorge',           cost: 2, type: 'handler-skill', rarity: 'uncommon', effects: { gorge: true } },
  { id: 'c-snack',         name: 'Treat',           cost: 1, type: 'handler-skill', rarity: 'basic', token: true, effects: { treatExtend: 1 } },
  { id: 'c-narrow',        name: 'Acquired Taste',  cost: 1, type: 'handler-skill', rarity: 'common', effects: { narrowLure: true, exhaust: true } },
];
const HANDLER_CARDS = [...HANDLER_V2, ...HANDLER_TACTIC_UTIL];
const HANDLER_CARDS_BY_ID = Object.fromEntries(HANDLER_CARDS.map(c => [c.id, c]));
const COMBINE_BY_SPECIES = { 'field-mouse': 'mouse-house', 'rabbit': 'long-hare', 'young-buck': 'mccloven' };
const HANDLER_STARTER = [
  'c-defend-handler', 'c-defend-handler', 'c-compose',
  'cv2-l-tender-greens', 'cv2-l-tender-greens',
  'c-pack-tactics', 'c-buffet', 'c-tactic-shield',
];
const HANDLER_REWARD_POOL = [
  'cv2-l-fish-food', 'cv2-l-birdseed', 'cv2-l-tender-greens',
  'c-tactic-rabid', 'c-tactic-youth', 'c-tactic-nurture', 'c-tactic-feather', 'c-tactic-shield',
  'c-pack-tactics', 'c-just-eat-it', 'c-buffet', 'c-treat', 'c-sharp-aside',
  'c-house-rules', 'c-well-drilled', 'c-whisperer', 'c-open-door', 'c-full-pockets',
  'c-last-supper', 'c-make-it-count', 'c-murmuration', 'c-stampede', 'c-gorge',
  'c-shoo', 'c-narrow',
];

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
  // Handler (Animal Summoner) opens with the lure/tactic/utility starter —
  // no word-pool, no verbal effect cards. Mirrors App.jsx handler starter.
  if (lane === 'handler') {
    return shuffle(HANDLER_STARTER.map(id => ({ ...HANDLER_CARDS_BY_ID[id], uid: uid() })));
  }
  const pool = LANE_POOL_BY_SLOT[lane];
  const basics = (arr) => arr.filter(c => c.rarity === 'basic');
  // v2.95: starter shape mirrors App.jsx — 1 intro + 1 subject + 1 effect
  // + 2 lane-specific starter cards (basic skills/gestures) + 3 c-defend
  // + 1 c-compose. Basic intros/subjects now carry stats: 1 (down from 2);
  // basic targets carry mult 2 (down from common's 3). The reward draft
  // gap between starter and picked-common is now visible.
  const laneStarters = [
    ...basics(pool.skill || []),
    ...basics(pool.gesture || []),
  ].map(c => c.id);
  // v3.2: WIT-only — seed the starter with one COMPLETE FFT row
  // (Atelier-4, "The Bouclé Suggestion") so the player can trigger
  // Fully Formed Thought in their first combat. Mirrors App.jsx.
  let introIds, subjectId, targetId;
  if (lane === 'wit') {
    // v3.4.10 (Alan): dropped the cross-row second intro. Sim mirror.
    introIds = ['wv2-i-frankly'];
    subjectId = 'wv2-s-boucle-starter';
    targetId  = 'wv2-t-fabric-starter';
  } else {
    introIds = [basics(pool.intro)[0]?.id, basics(pool.intro)[1]?.id];
    subjectId = basics(pool.subject)[0]?.id;
    targetId  = basics(pool.target)[0]?.id;
  }
  const ids = [
    introIds[0],
    introIds[1],
    subjectId,
    targetId,
    ...laneStarters,
  ].filter(Boolean);
  const cards = ids.map(id => {
    const tmpl = LANE_POOL[lane].find(c => c.id === id);
    return tmpl ? { ...tmpl, uid: uid() } : null;
  }).filter(Boolean);
  cards.push({ id: 'c-defend', type: 'skill', cost: 1, effects: { block: 5 }, name: 'Defend', uid: uid() });
  cards.push({ id: 'c-compose', type: 'skill', cost: 1, effects: { poise: 5 }, name: 'Compose Yourself', uid: uid() });
  // v3.4.10: c-rebut — one-shot, non-exhausting damage card for wit only.
  // Mirrors App.jsx; replaces the cross-row second intro.
  if (lane === 'wit') {
    cards.push({ id: 'c-rebut', type: 'skill', cost: 1, effects: { compDmg: 4 }, name: 'Rebut', uid: uid() });
  }
  // NOTE: Wit's starter annotation is NOT modeled in the sim. The sim's
  // greedy AI doesn't use annotations effectively (it can't reason about
  // the 3-turn payback window vs spending energy on cast NOW). Live play
  // is the right harness for annotation balance.
  return shuffle(cards);
}

// v2.92: PASSING THOUGHTS — minimal sim mirror of the App.jsx const.
// Only the IDs + cost + effects + rarity fields are modeled; flavor &
// desc aren't relevant to combat resolution. Used by the rest-equivalent
// grant pass (~20% per non-boss combat) and the play-any-colorless skill
// pass in runCombat.
// v2.93 redesign: 12 of the original 20 replaced with creative new mechanics
// (6 defense + 6 offense). Flag-based mechanics (Talking Over Them, Bracing,
// Settle the Score, Precedent, etc.) are partially modeled in the sim —
// state flags get set, and the most-impactful triggers are wired (skip-attack,
// damage-doubles, cast-mult). Some triggers (debuff reflection, hit-type
// conversion, hp-snapshot bracing) are noted as sim-no-ops since their
// strategic impact requires real-play decisions the greedy AI doesn't model.
const PASSING_THOUGHTS_SIM = [
  // ---- DEFENSE (6, v2.93 redesign) ----
  { id: 'pt-talking-over',          cost: 1, effects: { enemySkipNextAttack: true, exhaust: true } },
  { id: 'pt-glancing-blow',         cost: 1, effects: { swapNextHitToComp: true, exhaust: true } },
  { id: 'pt-settle-score',          cost: 1, effects: { reflectNextHitAsComp: true, exhaust: true } },
  { id: 'pt-bracing',               cost: 1, effects: { bracingArmed: true, exhaust: true } },
  { id: 'pt-measured-response',     cost: 1, effects: { blockFromComposure: true, exhaust: true } },
  { id: 'pt-speaking-experience',   cost: 0, effects: { composure: -5, block: 10, exhaust: true } },
  // ---- OFFENSE (6, v2.93 redesign) ----
  { id: 'pt-precedent',             cost: 1, effects: { nextCastBonusEqualsLast: true, exhaust: true } },
  { id: 'pt-about-that-time',       cost: 1, effects: { reflectNextDebuff: 1, exhaust: true } },
  { id: 'pt-pile-on',               cost: 1, effects: { compDmgFromEnemyMissing: 0.33, exhaust: true } },
  { id: 'pt-find-seam',             cost: 1, effects: { nextCastBypassEff: true, exhaust: true } },
  { id: 'pt-insult-injury',         cost: 1, effects: { nextCastDamageMult: 1.5, exhaust: true } },
  { id: 'pt-doubletake',            cost: 2, effects: { nextCastDoubles: true, exhaust: true } },
  // ---- TEMPO / DRAW (5, unchanged from v2.92) ----
  { id: 'pt-what-if-however',       cost: 1, effects: { draw: 2, exhaust: true } },
  { id: 'pt-where-was-i',           cost: 0, effects: { discardRandom: 1, draw: 2, exhaust: true } },
  { id: 'pt-reconsideration',       cost: 1, effects: { returnDiscardToHand: 1, exhaust: true } },
  { id: 'pt-removing-glasses',      cost: 0, effects: { draw: 1, energy: 1, exhaust: true } },
  { id: 'pt-drawing-conclusions',   cost: 1, effects: { draw: 3, exhaust: true } },
  // ---- UTILITY (3, unchanged from v2.92) ----
  { id: 'pt-embarrassed-silence',   cost: 1, effects: { stripBlock: 6, exhaust: true } },
  { id: 'pt-misapplied-compliment', cost: 1, effects: { hp: 3, composure: 3, exhaust: true } },
  { id: 'pt-decisively-inconclusive', cost: 2, effects: { discardHand: true, draw: 5, exhaust: true } },
];
const PASSING_THOUGHT_IDS = new Set(PASSING_THOUGHTS_SIM.map(c => c.id));

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
function pickBestForSlot(state, slot, energyLeft, enemy = null, tray = null) {
  let bestIdx = -1, bestTier = -1, bestStat = -1;
  // v3.4.8 Delta 3 — FFT-CHAIN STAGING. When the tray has already
  // committed to a setId (intro/subject has setId), bias the next-slot
  // pick toward a card that completes that row. Same effect for schoolId
  // (a same-school cast triggers the tier sub-bonus). Lets the AI build
  // toward an FFT layer across turns instead of staging whichever card
  // happens to score highest by tier/stat.
  let trayCommitSetId = null;
  let trayCommitTierId = null;
  if (tray) {
    const slots = [tray.intro, tray.subject, tray.target].filter(Boolean);
    for (const c of slots) {
      if (c.setId && !trayCommitSetId) trayCommitSetId = c.setId;
      if (c.schoolId && !trayCommitTierId) trayCommitTierId = c.schoolId;
    }
  }
  // v2.29: detect if a loudScaling target ("I SAID.") is in hand. If so,
  // bias toward handler cards carrying the 'demanding' tag in same-school
  // slot picks — each demanding word adds +3 to the eventual cast for free.
  const hasLoudTarget = (slot === 'intro' || slot === 'subject' || slot === 'modifier')
    && state.hand.some(c => c.lane === 'handler' && c.effect?.loudScaling);
  // v2.30: detect if a predator target ("comes apart in your hands.") is in
  // hand. If so, strongly bias toward debuff-applying word cards in this
  // slot pick — applying Vuln/Weak BEFORE the cast arms the +6 predator
  // bonus. "smells like blood in the water," is the dedicated setup subject
  // (vulnerable: 1 on stage); other intros/subjects with effects.vulnerable
  // or effects.weak also qualify.
  const hasPredatorTarget = (slot === 'intro' || slot === 'subject' || slot === 'modifier')
    && state.hand.some(c => c.lane === 'handler' && (c.effect?.predator || 0) > 0);
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
    // v2.24: prefer handler-lane cards when the rage meter is climbing.
    // Skip cards that require rage when rage isn't active (gates Bare Knuckles).
    if (c.effect?.requiresRage) continue;
    const tier = c.tier || 1;
    const stat = c.stats?.[c.lane] || 0;
    // v2.24: bias toward tunnel-vision-pumping cards while meter is low,
    // and toward handler cards in general while we're close to 5.
    let score = tier * 10 + stat;
    if (state.lane === 'handler') {
      if (c.effects?.tunnelVision && (state.tunnelVision || 0) < 5) score += 5;
      if (c.lane === 'handler' && (state.tunnelVision || 0) >= 4 && (state.tunnelVision || 0) < 5) score += 4;
    }
    // v2.29: when an I SAID. finisher is in hand, demanding-tagged handler
    // words break ties WITHIN tier. Keep the cmp against bestTier*10+bestStat
    // so this doesn't override the existing tier-first preference.
    // v2.53: bumped from +3 to +7 so demanding-tagged words ALSO outscore
    // adjacent non-demanding picks across the tier boundary in close cases.
    // Previously the +3 only broke same-school ties; the report showed avg
    // loudCount per cast = 0.51, meaning the AI was almost always missing
    // the stack on cast. +7 lifts demanding tier-1 words above non-demanding
    // tier-2 baselines when an I SAID. target is in hand and committed.
    let effectiveStat = stat;
    if (hasLoudTarget && c.lane === 'handler' && (c.tags || []).includes('demanding')) {
      effectiveStat = stat + 7;
    }
    // v2.30: when a predator target is in hand, bias toward debuff-appliers
    // (vulnerable or weak) staged BEFORE the cast. The bonus is +6 flat —
    // larger than the loud-bonus per-card +3 — so the bias is stronger.
    if (hasPredatorTarget && c.lane === 'handler'
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
    // v3.4.8 Delta 3 — FFT-chain staging bias. If tray has committed to
    // an FFT row, strongly prefer the card that completes it; otherwise
    // mildly prefer same-school (tier bonus). Magnitudes:
    //   Row match (full FFT path):  +20 to effectiveStat
    //   Tier match (tier sub path): +4
    if (trayCommitSetId && c.setId === trayCommitSetId) {
      effectiveStat = effectiveStat + 20;
    } else if (trayCommitTierId && c.schoolId === trayCommitTierId) {
      effectiveStat = effectiveStat + 4;
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
        insultVulnerabilities: enemy?.insultVulnerabilities || [], // v2.42
      };
      // Reuse the shared formula via computeSpellDamage if intro+subject
      // are staged. Off-stage we can't compute reliably; default-pass
      // (treat as if cast wouldn't kill → skip).
      if (!tray.intro || !tray.subject) continue;
      const preview = computeSpellDamage(tray.intro, tray.subject, c, [], preCtx);
      const dmgType = c.effect?.damageType || 'composure';
      const eff = enemy.effectiveness || {};
      const enemyMult = (dmgType === 'physical') ? (eff.physical ?? 1.0) : (eff[c.effect?.scaleBy || c.lane || 'handler'] ?? 1.0);
      const predicted = preview.damage * enemyMult * (state.playerDmgMult || 1);
      const remaining = dmgType === 'physical' ? enemy.currentHp : enemy.currentComp;
      // v2.33: gate loosened 1.1 → 0.8 because at 1.0 the preview excludes
      // modifiers (cast time adds them, real dmg > predicted) so all 1.0-gated
      // casts killed → 0 corner-token bills (toothless punishment side).
      // v2.53: loosened further 0.8 → 0.65.
      // v3.0 cycle 3: on RAGE turns, drop the gate to 0.40 — RAGE itself
      // adds +0.5× damage (so preview understates) AND RAGE is the "going
      // in" moment of handler identity. Doubling Down should fire here
      // even when not certain to kill — that IS the commit. Pairs with
      // creator-agent's note about the Hit Me Again / RAGE monoculture:
      // binding doubleDown to RAGE gives handler a second decision tree.
      const dDownGate = rageActive ? 0.40 : 0.65;
      if (predicted < remaining * dDownGate) continue;
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
        insultVulnerabilities: enemy?.insultVulnerabilities || [], // v2.42
      };
      const preview = computeSpellDamage(tray.intro, tray.subject, c, [], preCtx);
      const dmgType = c.effect?.damageType || 'composure';
      const eff = enemy.effectiveness || {};
      const enemyMult = (dmgType === 'physical') ? (eff.physical ?? 1.0) : (eff[c.effect?.scaleBy || c.lane || 'handler'] ?? 1.0);
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
    // v2.46: WON'T SHUT UP gate — only stage the soup target if the hand
    // contains another jnsq-lane card (excluding this one) that the player
    // could play AFTER cast to clear the commitment flag. Cost-affordable
    // after the target's own stage cost is paid. If no follow-up exists,
    // skip — the cast would land but the -3 HP end-of-turn bill comes due.
    const mustFollowUp = !!c.effect?.mustPlayAnotherJnsq;
    if (mustFollowUp) {
      const energyAfterStage = energyLeft - (c.cost || 0);
      const hasFollowUp = state.hand.some((other, j) =>
        j !== i
        && other.lane === 'jnsq'
        && (other.cost || 0) <= energyAfterStage
      );
      if (!hasFollowUp) continue;
    }
    const tier = c.tier || 1;
    const stat = c.stats?.[c.lane] || 0;
    let score = tier * 10 + stat;
    if (needsRage && rageActive) score += 30; // strongly prefer Bare Knuckles in RAGE
    if (doubleDown) score += 15; // prefer doubleDown when it WILL kill (gate already passed)
    if (stormOut) score += 20;   // prefer stormOut when the finisher conditions matched
    if (mustFollowUp) score += 5; // mild preference when the gate passed — stays competitive with rare targets, doesn't dominate
    // v2.78: "favorite target" bias (HUMAN_PLAY_PROFILE snapshot 3).
    // Real players who pick up a non-starter target use it for ~50% of
    // their casts. The sim AI was equally weighting all available
    // targets, which made starter targets compete with picked rewards
    // unfairly. If the card is non-starter (rarity >= uncommon OR not
    // in the build-time starter set), bump its score so it's preferred
    // over starter-tier basics + commons. Magnitude tuned to lift
    // uncommon scoring above a baseline common by ~6 points.
    // v3.4.8 Delta 3 — FFT-chain staging bias for targets. Same as
    // pickBestForSlot: if the tray's intro/subject committed to a setId,
    // strongly prefer the target that completes it.
    let trayCommitSetId = null;
    let trayCommitTierId = null;
    if (tray) {
      const slots = [tray.intro, tray.subject].filter(Boolean);
      for (const sc of slots) {
        if (sc.setId && !trayCommitSetId) trayCommitSetId = sc.setId;
        if (sc.schoolId && !trayCommitTierId) trayCommitTierId = sc.schoolId;
      }
    }
    if (trayCommitSetId && c.setId === trayCommitSetId) score += 25;
    else if (trayCommitTierId && c.schoolId === trayCommitTierId) score += 5;
    if (slot === 'target' && (c.rarity === 'uncommon' || c.rarity === 'rare')) {
      score += 6;
    }
    // v3.4.37 cycle 5 — Thorns target value: only score above zero when
    // a defensive build is actually warranted. Otherwise the greedy AI was
    // over-staging Thorns and the team-fight clock ran out (offense > shield).
    if (slot === 'target' && c.effect?.damageType === 'block' && state.lane === 'wit') {
      const hpFrac = state.maxHp > 0 ? state.hp / state.maxHp : 1;
      const willAttack = enemy?.behaviors?.some(b => b.kind === 'attack' || b.kind === 'attack-multi');
      // Skip Thorns entirely when offensive opportunity is clearly stronger.
      const enemyHpFrac = enemy && enemy.startComp ? enemy.currentComp / enemy.startComp : 1;
      const offenseFavored = enemyHpFrac < 0.35; // boss almost dead, finish it
      let blockScore = 0;
      if (!offenseFavored) {
        const projectedBlock = (c.effect?.base || 0) + ((c.effect?.multiplier || 1) * 6);
        blockScore = projectedBlock * 0.5;
        if (hpFrac < 0.5) blockScore *= 1 + (0.5 - hpFrac) * 3;
        if (willAttack) blockScore += 6;
        // Cross-school: if we already staged a Slow Burn card this tray,
        // Thorns target unlocks the mixed-school combo. WORTH it.
        if (state.tray && state.tray.some(t => t && t.schoolId === 'slowburn')) {
          blockScore += 10;
        }
        // Reflect riders deal damage — score the per-turn reflect like DoT.
        if (c.rider?.selfThornsPerTurn) {
          blockScore += (c.rider.selfThornsPerTurn.amount || 0) * (c.rider.selfThornsPerTurn.turns || 0);
        }
        if (Array.isArray(c.rider?.selfThornsSchedule)) {
          blockScore += c.rider.selfThornsSchedule.reduce((s, v) => s + (v || 0), 0);
        }
      }
      score += Math.round(blockScore);
    }
    // v2.53: tier-3 boss/elite finisher bias. Lane rares (tier-3 targets) are
    // explicitly designed as finishers but the AI's baseline score (tier*10 +
    // stat = ~33) often loses to a tier-2 baseline with a strong rider
    // (~23 + 8 from rider). When the enemy has substantial remaining
    // composure/HP (≥ 50%) AND it's a boss/elite, bump tier-3 cards another
    // +8 so they actually edge ahead. On near-dead enemies, the bias drops
    // off — a finisher's value collapses to a baseline target when the bar
    // is already 15% remaining.
    if (slot === 'target' && tier === 3 && enemy && (enemy.tier === 'boss' || enemy.tier === 'elite')) {
      const dmgType = c.effect?.damageType || 'composure';
      const pool = dmgType === 'physical'
        ? (enemy.currentHp || 0) / Math.max(1, enemy.hp || 999)
        : (enemy.currentComp || 0) / Math.max(1, enemy.comp || 99);
      if (pool >= 0.5) score += 8;
      else if (pool >= 0.25) score += 4;
    }
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
    // v2.51: jnsq SYNERGY CAPSTONE — "universe sideways." Boost when (a) the
    // tray's intro+subject already carry ≥2 chaotic/absurd/mystical-tagged
    // staged cards (perTagBonus rider will pay out) AND (b) the existing
    // mustFollowUp gate above already passed (i.e. a jnsq follow-up exists in
    // hand). The +3-per-tag rider on a fully-themed tray (4-6 matching tags
    // available across intro+subject+target+modifiers) is meaningful at
    // tier-3 multiplier; this nudge biases the AI toward draft AND cast when
    // the synergy is actually live, instead of falling back to a baseline
    // tier-3 target.
    if (c.id === 'jv2-t-universe-sideways' && state.lane === 'jnsq') {
      const staged = [tray?.intro, tray?.subject].filter(Boolean);
      const themeTags = ['chaotic', 'absurd', 'mystical'];
      let themeCount = 0;
      for (const s of staged) themeCount += (s.tags || []).filter(t => themeTags.includes(t)).length;
      // Also count the target's own tags (the capstone carries all three).
      themeCount += (c.tags || []).filter(t => themeTags.includes(t)).length;
      if (themeCount >= 5) score += 22;
      else if (themeCount >= 4) score += 16;
      else if (themeCount >= 3) score += 10;
    }
    // v2.53: when Babbling is installed AND we're picking a target for the
    // FIRST cast AND the rare "Getting Away" is in hand AND another target
    // exists, hold the rare for the 2nd cast (where doubleOnSecondCast
    // doubles damage). The 2nd-cast restage will prefer the rare specifically
    // (see ~line 1919). Without this, the rare gets cast first and Babbling's
    // 2nd-cast restage uses a baseline target at the 0.6× scalar.
    if (slot === 'target' && state.babblingInstalled
        && c.id === 'jv2-t-getting-away-from-me') {
      const otherTargetExists = state.hand.some((other, j) =>
        j !== i && other.slot === 'target' && other.lane === 'jnsq'
        && (other.cost || 0) <= energyLeft);
      if (otherTargetExists) score -= 25;
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
    // handler-lane with the 'demanding' tag, stacking it adds +3 to the
    // pending cast (more than a small damageMult, less than a tier3Payoff).
    if (loudTargetStaged && c.lane === 'handler' && (c.tags || []).includes('demanding')) {
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

// =============================================================================
// 3b. HANDLER (Animal Summoner) COMBAT ENGINE
//     Faithful port of the App.jsx end-of-turn menagerie tick + a handler AI
//     that stages lures, engages tactics (with a VARIETY preference — the
//     thing this whole engine exists to let the sim model), feeds animals on
//     their make-or-break turn, and spikes with On Three!. Animal damage is
//     RAW composure (enemy block absorbs); enemy block/poise pools as live.
//     Ported from the retired sim/playSim.js 2026-06-01; ANIMALS come from
//     the shared src/data/animals.js so they cannot drift from the game.
// =============================================================================
function handlerDealComposure(combat, amount) {
  let remaining = amount;
  if (combat.enemyBlock > 0) { const a = Math.min(combat.enemyBlock, remaining); combat.enemyBlock -= a; remaining -= a; }
  combat.enemyComposure = Math.max(0, combat.enemyComposure - remaining);
}
function handlerDealHp(combat, amount) {
  let remaining = amount;
  if (combat.enemyBlock > 0) { const a = Math.min(combat.enemyBlock, remaining); combat.enemyBlock -= a; remaining -= a; }
  combat.enemyHp = Math.max(0, combat.enemyHp - remaining);
}
// Handler powers (2026-06-01) install onto state.powers, mirroring App.jsx.
function hasHandlerPower(state, id) { return (state.powers || []).some(p => p.installPower?.id === id); }
function makeAnimalSlot(animalId, youthBonus, summonSet, durBonus) {
  const a = ANIMALS[animalId];
  return {
    kind: 'animal', animalId,
    durationRemaining: (a?.duration || 3) + (youthBonus || 0) + (durBonus || 0),
    predatorProgress: 0, adjacentSpawnProgress: 0, adjacentSpawned: false,
    summonSet: summonSet || null, feedReceived: false, fedThisTurn: false, nextAttackMult: 1,
    attackBonus: 0,
  };
}
function resolveLureSpecies(lure, combat) {
  if (combat.tactic === 'feather') {
    const existing = ['intro', 'subject', 'target'].map(x => combat.htray[x]).find(v => v?.kind === 'animal');
    if (existing) return existing.animalId;
  }
  const s = lure.summon || lure;
  // Acquired Taste narrowing — drop excluded species from the pool, floor 2.
  const cardId = lure.cardId || lure.id;
  let pool = s.animalIds;
  if (pool && pool.length && combat.lureNarrowing && combat.lureNarrowing[cardId]) {
    const excluded = combat.lureNarrowing[cardId];
    const kept = pool.filter(x => !excluded.includes(x));
    if (kept.length >= 2) pool = kept;
  }
  let id = (pool && pool.length) ? pool[Math.floor(Math.random() * pool.length)] : s.animalId;
  const base = ANIMALS[id];
  if (base?.elite && Math.random() < 0.035) id = base.elite;
  return id;
}
function handlerAnimalAttack(state, combat, slot, animal, baseMult) {
  // Effective base attack reflects every live rider (mirrors App.jsx
  // animalAttackValue): any slot.attackBonus from Gorge or Well-Drilled.
  let base = animal.attack;
  if (base > 0) { base += (slot.attackBonus || 0); }
  let atk = Math.round(base * (baseMult || 1) * (slot.nextAttackMult || 1));
  slot.nextAttackMult = 1;
  const isShield = combat.tactic === 'shield';
  const isRabid  = combat.tactic === 'rabid';
  if (isRabid) atk = Math.round(atk * 1.5);
  if (isShield) {
    state.block += atk; state.poise += atk; combat.menagerieBlock += atk;
  } else {
    handlerDealComposure(combat, atk);
    combat.menagerieComposure += atk;
    combat.totalDamageDealt += atk;
    if (isRabid) state.composure = Math.max(0, state.composure - Math.max(1, Math.round(atk * 0.1)));
  }
  if (animal.onAttack?.draw) drawCards(state, animal.onAttack.draw);
  if (animal.onAttackEffect?.applyVulnerable > 0) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * animal.onAttackEffect.applyVulnerable);
  if (animal.onAttackEffect?.applyWeak > 0)       combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * animal.onAttackEffect.applyWeak);
}
function clearHandlerSlot(next, slot, slotName) {
  if (slot.spans && slot.spans.length) { for (const s of slot.spans) next[s] = null; }
  else next[slotName] = null;
}
function tacticSituationalValue(id, animals, haveLure, compPct, isBoss, canCombine) {
  switch (id) {
    case 'rabid':
      // Cheaper (cost 1) and lower recoil (10%) as of cycle 1 — safe to engage
      // at lower composure, and a stronger aggressive contender vs nurture.
      if (animals < 1) return 0;
      return (isBoss ? compPct > 0.25 : compPct > 0.4) ? 6 + animals + (isBoss ? 2 : 0) : 0;
    case 'nurture': return haveLure ? (isBoss ? 10 : 7) : 0;
    case 'youth':   return haveLure ? 5 : 1;
    // Feather is the combine ENABLER: with exactly 1 combine-eligible animal,
    // it forces matching summons toward a three-of-a-kind, which now detonates
    // (cycle 2). Card-neutral since cycle 3. Value the combine-setup path high.
    case 'feather': return animals === 1 ? (canCombine ? (isBoss ? 12 : 9) : (isBoss ? 7 : 4)) : 0;
    case 'shield':  return 0;
    default:        return 0;
  }
}
function pickHandlerTactic(state, combat, needDefense) {
  const SLOT = ['intro', 'subject', 'target'];
  const animals = SLOT.filter(s => combat.htray[s]?.kind === 'animal').length;
  const haveLure = state.hand.some(h => h.type === 'lure');
  const compPct = state.composure / (state.maxComposure || 1);
  const isBoss = combat.enemy?.tier === 'boss';
  const canCombine = SLOT.some(s => {
    const sl = combat.htray[s];
    return sl?.kind === 'animal' && !!COMBINE_BY_SPECIES[sl.animalId];
  });
  let best = -1, bestVal = -Infinity, bestId = null, bestEngaged = Infinity;
  for (let i = 0; i < state.hand.length; i++) {
    const c = state.hand[i];
    if (c.type !== 'tactic' || c.cost > state.energy) continue;
    const id = c.tactic.id;
    if (id === combat.tactic) continue;
    if (id === 'shield' && !needDefense) continue;
    if (c.tactic.requiresExactlyOneAnimal && animals !== 1) continue;
    const val = id === 'shield' ? 100 : tacticSituationalValue(id, animals, haveLure, compPct, isBoss, canCombine);
    if (val <= 0) continue;
    const engaged = combat.tacticsEngaged[id] || 0;
    if (val > bestVal || (val === bestVal && engaged < bestEngaged)) {
      bestVal = val; best = i; bestId = id; bestEngaged = engaged;
    }
  }
  if (best < 0) return -1;
  // Anti-churn inertia (cycle 1, human-AI calibration): the real player commits
  // to a tactic rather than toggling mid-combat (sim was switching ~1.36×/combat
  // vs the human's ~0). Once a non-shield tactic is set, only switch off it for a
  // decisively better option (+5), not a marginal one.
  if (combat.tactic && combat.tactic !== 'shield' && bestId !== 'shield') {
    const curVal = tacticSituationalValue(combat.tactic, animals, haveLure, compPct, isBoss, canCombine);
    if (bestVal <= curVal + 5) return -1;
  }
  return best;
}
function stageHandlerLure(state, combat, lure) {
  const SLOT = ['intro', 'subject', 'target'];
  const empties = SLOT.filter(s => combat.htray[s] == null);
  if (empties.length === 0) { state.discard.push(lure); return; }
  const youthBonus = (combat.tactic === 'youth' && combat.youthUses > 0) ? 1 : 0;
  const nurture = combat.tactic === 'nurture';
  // Buffet + a predator-chain lure (Fish Food → Salmon → Bear) spreads to the
  // two END slots only, never the middle, so salmon land non-adjacent. Mirrors
  // App.jsx. (Alan, 2026-06-01.)
  const summonIds = lure.summon.animalIds || (lure.summon.animalId ? [lure.summon.animalId] : []);
  const isChainLure = summonIds.some(id => ANIMALS[id]?.predatorChain);
  let targets;
  if (combat.buffetArmed && isChainLure) {
    const ends = [SLOT[0], SLOT[2]].filter(s => combat.htray[s] == null);
    targets = ends.length > 0 ? ends : [empties[0]];
  } else if (combat.buffetArmed) {
    targets = empties;
  } else {
    targets = [empties[0]];
  }
  targets.forEach((s, idx) => {
    const withCard = idx === 0;
    if (nurture) {
      const animalId = resolveLureSpecies(lure, combat);
      combat.htray[s] = makeAnimalSlot(animalId, youthBonus, lure.summon.summonSet);
      combat.summons++;
      if (withCard) state.discard.push(lure);
    } else {
      combat.htray[s] = {
        kind: 'lure', card: withCard ? { ...lure } : null,
        animalIds: lure.summon.animalIds, animalId: lure.summon.animalId,
        summonSet: lure.summon.summonSet || null,
        turnsRemaining: lure.summon.turnsToArrive, youthBonus,
      };
    }
  });
  combat.buffetArmed = false;
  if (youthBonus) combat.youthUses = Math.max(0, combat.youthUses - 1);
}
function applyHandlerUtil(state, combat, card) {
  const SLOT = ['intro', 'subject', 'target'];
  if (card.util === 'buffet') { combat.buffetArmed = true; return; }
  if (card.util === 'onThree') {
    // Arm an extra attack on every animal — resolves on the animals' turn
    // (end-of-turn loop), not at play time. Mirrors App.jsx packTactics.
    for (const s of SLOT) {
      const slot = combat.htray[s];
      if (slot?.kind !== 'animal') continue;
      const a = ANIMALS[slot.animalId];
      if (a && a.attack > 0) slot.extraAttacks = (slot.extraAttacks || 0) + 1;
    }
    return;
  }
  if (card.util === 'eatNow') {
    const s = SLOT.find(x => combat.htray[x]?.kind === 'lure');
    if (s) {
      const lure = combat.htray[s];
      const animalId = resolveLureSpecies(lure, combat);
      if (lure.card) state.discard.push({ ...lure.card });
      combat.htray[s] = makeAnimalSlot(animalId, lure.youthBonus || 0, lure.summonSet);
      combat.summons++;
    }
    return;
  }
  if (card.util === 'treat') {
    let bestS = null, bestAtk = -1;
    for (const s of SLOT) { const sl = combat.htray[s]; if (sl?.kind !== 'animal') continue; const a = ANIMALS[sl.animalId]; if ((a?.attack || 0) > bestAtk) { bestAtk = a.attack; bestS = s; } }
    if (bestS) { combat.htray[bestS].durationRemaining += 1; combat.htray[bestS].feedReceived = true; combat.htray[bestS].fedThisTurn = true; }
  }
  // 'shoo' intentionally unused by the AI — situational, no greedy value.
}
// Whisperer exit-note shared by the end-of-turn tick and instant-play exits
// (Last Supper / Make It Count). Banks a draw for next turn.
function noteHandlerExit(state, combat, n = 1) {
  if (hasHandlerPower(state, 'whisperer')) combat.whisperPending = (combat.whisperPending || 0) + n;
}
// Booster skill effect resolution (2026-06-01). Mirrors App.jsx applySideEffects
// handlers + the click-target prompt resolvers (sacrifice/gorge auto-target here
// since the sim has no UI). Returns nothing; mutates state/combat.
function applyHandlerSkill(state, combat, card) {
  const SLOT = ['intro', 'subject', 'target'];
  const animals = () => SLOT.map(s => ({ s, slot: combat.htray[s] }))
    .filter(x => x.slot?.kind === 'animal');
  const fx = card.effects || {};
  if (fx.block) state.block += fx.block;
  if (fx.poise) state.poise += fx.poise;
  if (fx.compDmg) { handlerDealComposure(combat, fx.compDmg); combat.totalDamageDealt += fx.compDmg; }
  // Murmuration — 3 composure per bird in play.
  if (fx.compDmgPerBird) {
    const birds = animals().filter(x => ANIMALS[x.slot.animalId]?.feedKey === 'bird').length;
    const dmg = fx.compDmgPerBird * birds;
    if (dmg > 0) { handlerDealComposure(combat, dmg); combat.totalDamageDealt += dmg; }
  }
  // Stampede — arm an extra attack on every small-land animal; resolves on
  // the animals' turn (end-of-turn loop). Mirrors App.jsx smallLandAttackAgain.
  if (fx.smallLandAttackAgain) {
    for (const { slot } of animals()) {
      const a = ANIMALS[slot.animalId];
      if (a?.feedKey === 'small-land' && a.attack > 0) slot.extraAttacks = (slot.extraAttacks || 0) + 1;
    }
  }
  // Last Supper — cash in one animal: energy = max(1, remaining-1), draw 1.
  // Auto-target the lowest-attack animal with the most remaining turns.
  if (fx.sacrificeForValue) {
    const list = animals();
    if (list.length) {
      list.sort((p, q) => {
        const ap = ANIMALS[p.slot.animalId]?.attack || 0, aq = ANIMALS[q.slot.animalId]?.attack || 0;
        if (ap !== aq) return ap - aq;
        return (q.slot.durationRemaining || 0) - (p.slot.durationRemaining || 0);
      });
      const tgt = list[0];
      const turnsLeft = Math.max(1, (tgt.slot.durationRemaining || 1) - 1);
      state.energy += turnsLeft;
      drawCards(state, 1);
      noteHandlerExit(state, combat);
      clearHandlerSlot(combat.htray, tgt.slot, tgt.s);
    }
  }
  // Make It Count — every animal attacks for double, then leaves play.
  if (fx.sacrificeAllForBurst) {
    let departed = 0;
    for (const { s, slot } of animals()) {
      const a = ANIMALS[slot.animalId];
      if (a?.attack > 0) handlerAnimalAttack(state, combat, slot, a, 2);
      clearHandlerSlot(combat.htray, slot, s);
      departed++;
    }
    if (departed) noteHandlerExit(state, combat, departed);
  }
  // Gorge — pick a fed animal: +3 turns, +3 permanent attack if fed this turn.
  if (fx.gorge) {
    const list = animals();
    if (list.length) {
      const fed = list.filter(x => x.slot.fedThisTurn);
      const pool = fed.length ? fed : list;
      pool.sort((p, q) => (ANIMALS[q.slot.animalId]?.attack || 0) - (ANIMALS[p.slot.animalId]?.attack || 0));
      const tgt = pool[0];
      tgt.slot.durationRemaining += 3;
      if (tgt.slot.fedThisTurn) tgt.slot.attackBonus = (tgt.slot.attackBonus || 0) + 3;
    }
  }
  // Acquired Taste — narrow a variable lure toward an adjacency combo. AI:
  // find a narrowable lure (pool ≥3 after current exclusions) whose pool
  // contains both halves of an ADJACENCY_COMBOS pair, then exclude a species
  // OUTSIDE that pair so the combo species become more likely. Floor of 2.
  if (fx.narrowLure) {
    const seen = new Set();
    const lures = [...state.deck, ...state.hand, ...state.discard]
      .filter(c => c?.type === 'lure' && c.summon?.animalIds && c.summon.animalIds.length >= 3);
    let done = false;
    for (const c of lures) {
      if (done || seen.has(c.id)) continue;
      seen.add(c.id);
      const excluded = combat.lureNarrowing[c.id] || [];
      const kept = c.summon.animalIds.filter(id => !excluded.includes(id));
      if (kept.length < 3) continue;
      const combo = ADJACENCY_COMBOS.find(cb => kept.includes(cb.a) && kept.includes(cb.b));
      if (!combo) continue;
      const dropTarget = kept.find(id => id !== combo.a && id !== combo.b);
      if (!dropTarget) continue;
      combat.lureNarrowing[c.id] = [...excluded, dropTarget];
      done = true;
    }
  }
  // Snack — treat-like: extend the lowest-duration animal by 1.
  if (fx.treatExtend) {
    const list = animals();
    if (list.length) {
      list.sort((p, q) => (p.slot.durationRemaining || 0) - (q.slot.durationRemaining || 0));
      const tgt = list[0];
      tgt.slot.durationRemaining += fx.treatExtend;
      tgt.slot.feedReceived = true;
      tgt.slot.fedThisTurn = true;
    }
  }
}
function playHandlerCard(state, combat, idx) {
  const card = state.hand[idx];
  state.hand.splice(idx, 1);
  // Open Door Policy: first lure each turn costs 0. Mirrors App.jsx
  // effectiveCardCost + firstLureUsedThisTurn.
  const isLure = card.type === 'lure';
  const openDoorFree = isLure && hasHandlerPower(state, 'openDoor') && !combat.firstLureUsedThisTurn;
  state.energy -= openDoorFree ? 0 : (card.cost || 0);
  if (isLure) combat.firstLureUsedThisTurn = true;
  if (card.type === 'power') {
    // Powers install onto state.powers (once per combat — can't re-install
    // the same power that combat). The card itself is NOT consumed for the
    // run: at combat end its object is folded back into discard so it's
    // re-drawable next combat. Mirrors App.jsx (powers fold into fullDeck).
    if (card.installPower && !hasHandlerPower(state, card.installPower.id)) state.powers.push({ ...card });
    combat.powersInstalled = (combat.powersInstalled || 0) + 1;
    // Full Pockets — one-time Treat token into hand on install (no per-turn mint).
    if (card.installPower?.id === 'fullPockets') {
      const treat = HANDLER_CARDS_BY_ID['c-snack'];
      if (treat) state.hand.push({ ...treat, uid: uid() });
    }
    // Well-Drilled — pick a species on the board and stamp +2 attack onto it
    // and every copy of it (no targeting prompt in the sim; mirror the App's
    // per-animal slot.attackBonus stamp). Buffs current copies only.
    if (card.installPower?.id === 'wellDrilled') {
      const wdSlots = ['intro', 'subject', 'target'];
      const counts = {};
      for (const s of wdSlots) { const sl = combat.htray[s]; if (sl?.kind === 'animal') counts[sl.animalId] = (counts[sl.animalId] || 0) + 1; }
      let pick = null, pickN = 0;
      for (const id in counts) if (counts[id] > pickN) { pickN = counts[id]; pick = id; }
      if (pick) for (const s of wdSlots) { const sl = combat.htray[s]; if (sl?.kind === 'animal' && sl.animalId === pick) sl.attackBonus = (sl.attackBonus || 0) + 2; }
    }
    // House Rules — pick the most-common species on the board and stamp +2
    // duration onto it and every copy. Mirrors App.jsx pick-an-animal shape
    // (Alan, 2026-06-02). No targeting prompt in the sim.
    if (card.installPower?.id === 'houseRules') {
      const hrSlots = ['intro', 'subject', 'target'];
      const counts = {};
      for (const s of hrSlots) { const sl = combat.htray[s]; if (sl?.kind === 'animal') counts[sl.animalId] = (counts[sl.animalId] || 0) + 1; }
      let pick = null, pickN = 0;
      for (const id in counts) if (counts[id] > pickN) { pickN = counts[id]; pick = id; }
      if (pick) for (const s of hrSlots) { const sl = combat.htray[s]; if (sl?.kind === 'animal' && sl.animalId === pick) sl.durationRemaining = (sl.durationRemaining || 0) + 2; }
    }
    return;
  }
  if (card.type === 'tactic') {
    if (combat.tactic !== card.tactic.id) combat.tacticChanges++;
    combat.tactic = card.tactic.id;
    combat.tacticsEngaged[card.tactic.id] = (combat.tacticsEngaged[card.tactic.id] || 0) + 1;
    if (card.tactic.id === 'youth') combat.youthUses = 3;
    // Feather draws 1 on play (cycle 3) — card-neutral combine setup. Mirrors App.jsx.
    if (card.tactic.id === 'feather') drawCards(state, 1);
    state.discard.push(card);
    return;
  }
  if (card.type === 'lure') { stageHandlerLure(state, combat, card); return; }
  if (card.type === 'handler-skill') {
    applyHandlerSkill(state, combat, card);
    // Disposition mirrors App.jsx: exhaust→exiled, else→discard, regardless
    // of token. The Snack token cycles to discard so it can reshuffle/redraw
    // within the combat; the combat-start token scrub purges it before the
    // next fight so it never persists into the run deck.
    if (card.effects?.exhaust) state.exiled.push(card);
    else state.discard.push(card);
    return;
  }
  if (card.type === 'handler-util') {
    applyHandlerUtil(state, combat, card);
    if (card.exhaust) state.exiled.push(card); else state.discard.push(card);
    return;
  }
  state.discard.push(card);
}
function tryHandlerFeed(state, combat) {
  const SLOT = ['intro', 'subject', 'target'];
  for (const s of SLOT) {
    const slot = combat.htray[s];
    if (slot?.kind !== 'animal') continue;
    const a = ANIMALS[slot.animalId];
    if (!a?.feedKey || slot.feedReceived || slot.durationRemaining !== 2) continue;
    const li = state.hand.findIndex(c => c.type === 'lure' && c.feedKey === a.feedKey && c.cost <= state.energy);
    if (li < 0) continue;
    const lure = state.hand[li];
    state.hand.splice(li, 1);
    state.energy -= (lure.cost || 0);
    slot.feedReceived = true;
    slot.fedThisTurn = true;
    combat.feeds++;
    state.discard.push(lure);
    return true;
  }
  return false;
}
function pickBestLure(state, combat) {
  const SLOT = ['intro', 'subject', 'target'];
  const boardSpeciesCounts = {};
  for (const s of SLOT) {
    const sl = combat.htray[s];
    if (sl?.kind === 'animal' && COMBINE_BY_SPECIES[sl.animalId]) {
      boardSpeciesCounts[sl.animalId] = (boardSpeciesCounts[sl.animalId] || 0) + 1;
    }
  }
  const wantCombine = Object.values(boardSpeciesCounts).some(n => n >= 1);
  let bestIdx = -1, bestPriority = -1;
  for (let i = 0; i < state.hand.length; i++) {
    const c = state.hand[i];
    if (c.type !== 'lure' || c.cost > state.energy) continue;
    let priority = 0;
    if (c.summon?.summonSet === 'tender-greens' && wantCombine) priority = 3;
    else if (c.summon?.summonSet === 'tender-greens') priority = 1;
    else priority = 2;
    if (priority > bestPriority) { bestPriority = priority; bestIdx = i; }
  }
  return bestIdx;
}
function handlerAdjustIncoming(combat, raw) {
  if (raw === 0) return 0;
  return Math.round(raw * combat.enemyDmgMult);
}
function aiTurnHandler(state, combat) {
  combat.turn++;
  state.energy = ENERGY_PER_TURN + (combat.turn === 1 && combat.fb.startCombatEnergy ? combat.fb.startCombatEnergy : 0);
  state.block = 0;
  state.poise = 0;
  if (combat.turn === 1) {
    if (combat.fb.startCombatBlock) state.block += combat.fb.startCombatBlock;
    if (combat.fb.startCombatPoise) state.poise += combat.fb.startCombatPoise;
  }
  combat.firstLureUsedThisTurn = false;
  const whisperDraw = combat.whisperPending || 0;
  combat.whisperPending = 0;
  drawCards(state, HAND_SIZE + whisperDraw + (combat.turn === 1 ? (combat.fb.startCombatDraw || 0) : 0));

  const SLOT = ['intro', 'subject', 'target'];
  const emptyCount = () => SLOT.filter(s => combat.htray[s] == null).length;
  const animalCount = () => SLOT.filter(s => combat.htray[s]?.kind === 'animal').length;
  const isBoss = combat.enemy?.tier === 'boss';

  // Hollow Weaver — snapshot cumulative damage so the end-of-turn weave check
  // can tell whether the player struck the enemy this turn (cast skills like
  // Tap the Glass + the animal tick both bump totalDamageDealt). Mirrors
  // App.jsx damagedEnemyThisTurnRef.
  combat.dmgDealtAtTurnStart = combat.totalDamageDealt;

  let safety = 30;
  while (safety-- > 0) {
    const intent = combat.enemyIntent;
    const incoming = (intent?.kind === 'attack' || intent?.kind === 'attack-multi') ? intent.value * (intent.count || 1) : 0;
    if (incoming > 0) {
      const targetsComp = intent.pool === 'composure';
      const expected = handlerAdjustIncoming(combat, incoming);
      const pool = targetsComp ? state.poise : state.block;
      if (expected > pool + 1) {
        const di = state.hand.findIndex(c => c.type === 'handler-skill' && c.cost <= state.energy && (targetsComp ? c.effects?.poise : c.effects?.block));
        if (di >= 0) { playHandlerCard(state, combat, di); continue; }
      }
    }
    if (tryHandlerFeed(state, combat)) continue;
    // BOOSTER cards (2026-06-01). Effective per-animal attack reflects
    // slot.attackBonus (Gorge / Well-Drilled), mirroring the engine.
    const effAtk = (slot) => {
      const a = ANIMALS[slot.animalId]; let v = a?.attack || 0;
      if (v > 0) { v += (slot.attackBonus || 0); }
      return v;
    };
    const liveAnimals = () => SLOT.map(s => combat.htray[s]).filter(sl => sl?.kind === 'animal');
    // Powers — install eagerly (snowball axis), but turn 1 on an empty board
    // prefer dropping a lure first so a body is on its way. Well-Drilled stamps
    // +2 onto an animal already on the board, so it's worthless until a body
    // exists — hold it until there's something to drill.
    const pi = state.hand.findIndex(c => c.type === 'power' && c.installPower
      && !hasHandlerPower(state, c.installPower.id) && c.cost <= state.energy
      && !(c.installPower.id === 'wellDrilled' && animalCount() === 0));
    if (pi >= 0) {
      const wantLureFirst = combat.turn === 1 && animalCount() === 0
        && state.hand.some(c => c.type === 'lure' && c.cost <= state.energy)
        && state.energy < (state.hand[pi].cost || 0) + 1;
      if (!wantLureFirst) { playHandlerCard(state, combat, pi); continue; }
    }
    // Make It Count — burst finisher: fire when doubled board attack clears
    // the enemy's remaining composure (it exhausts and empties the board).
    const burstIdx = state.hand.findIndex(c => c.effects?.sacrificeAllForBurst && c.cost <= state.energy);
    if (burstIdx >= 0) {
      const dbl = liveAnimals().reduce((sum, sl) => sum + 2 * effAtk(sl), 0);
      if (dbl > 0 && dbl >= combat.enemyComposure - combat.enemyBlock) { playHandlerCard(state, combat, burstIdx); continue; }
    }
    // Snack (token, costs 1) — extend the lowest-duration animal when one exists.
    const snackIdx = state.hand.findIndex(c => c.token && c.effects?.treatExtend && c.cost <= state.energy);
    if (snackIdx >= 0 && liveAnimals().length > 0) { playHandlerCard(state, combat, snackIdx); continue; }
    // Murmuration — worth it with 2+ birds in play.
    const birds = liveAnimals().filter(sl => ANIMALS[sl.animalId]?.feedKey === 'bird').length;
    if (birds >= 2) {
      const mi = state.hand.findIndex(c => c.effects?.compDmgPerBird && c.cost <= state.energy);
      if (mi >= 0) { playHandlerCard(state, combat, mi); continue; }
    }
    // Stampede — worth it with 2+ small-land animals in play.
    const smallLand = liveAnimals().filter(sl => ANIMALS[sl.animalId]?.feedKey === 'small-land').length;
    if (smallLand >= 2) {
      const stIdx = state.hand.findIndex(c => c.effects?.smallLandAttackAgain && c.cost <= state.energy);
      if (stIdx >= 0) { playHandlerCard(state, combat, stIdx); continue; }
    }
    // Gorge — overfeed a fed, attacking animal for +3 turns / +3 attack.
    const gorgeIdx = state.hand.findIndex(c => c.effects?.gorge && c.cost <= state.energy);
    if (gorgeIdx >= 0 && liveAnimals().some(sl => sl.fedThisTurn && effAtk(sl) > 0)) {
      playHandlerCard(state, combat, gorgeIdx); continue;
    }
    // Acquired Taste — narrow a variable lure toward an adjacency combo, but
    // only when a 3-species lure with a reachable combo pair still exists.
    const narrowIdx = state.hand.findIndex(c => c.effects?.narrowLure && c.cost <= state.energy);
    if (narrowIdx >= 0) {
      const seenN = new Set();
      const canNarrow = [...state.deck, ...state.hand, ...state.discard].some(c => {
        if (c?.type !== 'lure' || !c.summon?.animalIds || c.summon.animalIds.length < 3 || seenN.has(c.id)) return false;
        seenN.add(c.id);
        const excluded = combat.lureNarrowing[c.id] || [];
        const kept = c.summon.animalIds.filter(id => !excluded.includes(id));
        if (kept.length < 3) return false;
        const combo = ADJACENCY_COMBOS.find(cb => kept.includes(cb.a) && kept.includes(cb.b));
        return !!(combo && kept.find(id => id !== combo.a && id !== combo.b));
      });
      if (canNarrow) { playHandlerCard(state, combat, narrowIdx); continue; }
    }
    if (state.energy >= 1) {
      let needDefense = false;
      if (incoming > 0) {
        const targetsComp = intent.pool === 'composure';
        const expected = handlerAdjustIncoming(combat, incoming);
        const pool = targetsComp ? state.poise : state.block;
        const haveSkill = state.hand.some(c => c.type === 'handler-skill' && c.cost <= state.energy && (targetsComp ? c.effects?.poise : c.effects?.block));
        const uncovered = Math.max(0, expected - pool);
        const damagePct = targetsComp
          ? uncovered / Math.max(1, state.composure)
          : uncovered / Math.max(1, state.hp);
        needDefense = uncovered > 0 && damagePct > 0.3 && !haveSkill;
      }
      const ti = pickHandlerTactic(state, combat, needDefense);
      if (ti >= 0) { playHandlerCard(state, combat, ti); continue; }
    }
    if (isBoss && SLOT.some(s => combat.htray[s]?.kind === 'lure')) {
      const ei = state.hand.findIndex(c => c.util === 'eatNow' && c.cost <= state.energy);
      if (ei >= 0) { playHandlerCard(state, combat, ei); continue; }
    }
    const featherActive = combat.tactic === 'feather';
    const luresInHand = state.hand.filter(c => c.type === 'lure' && c.cost <= state.energy).length;
    const shouldBuffet = !combat.buffetArmed && emptyCount() >= 2 && luresInHand >= 1;
    const featherBuffetPriority = featherActive && luresInHand >= 2 && emptyCount() >= 2 && !combat.buffetArmed;
    if (featherBuffetPriority || shouldBuffet) {
      const bi = state.hand.findIndex(c => c.util === 'buffet' && c.cost <= state.energy);
      if (bi >= 0) { playHandlerCard(state, combat, bi); continue; }
    }
    const animalCnt = animalCount();
    const featherInHand = state.hand.some(c => c.type === 'tactic' && c.tactic?.id === 'feather' && c.cost <= state.energy);
    const lureInHand = state.hand.filter(c => c.type === 'lure' && c.cost <= state.energy).length;
    const holdForFeather = animalCnt === 1 && featherInHand && lureInHand >= 2 && combat.tactic !== 'feather';
    if (emptyCount() > 0 && !holdForFeather) {
      const li = pickBestLure(state, combat);
      if (li >= 0) { playHandlerCard(state, combat, li); continue; }
    }
    const totalBoardAtk = SLOT.reduce((sum, s) => {
      const sl = combat.htray[s];
      if (sl?.kind !== 'animal') return sum;
      const a = ANIMALS[sl.animalId];
      return sum + (a?.attack || 0);
    }, 0);
    const onThreeWorthIt = isBoss ? totalBoardAtk >= 10 : animalCount() >= 2;
    if (onThreeWorthIt) {
      const oi = state.hand.findIndex(c => c.util === 'onThree' && c.cost <= state.energy);
      if (oi >= 0) { playHandlerCard(state, combat, oi); continue; }
    }
    const si = state.hand.findIndex(c => c.effects?.compDmg && c.cost <= state.energy);
    if (si >= 0) { playHandlerCard(state, combat, si); continue; }
    // Last Supper — cash an animal in for energy + a card when a lure is
    // stuck in hand for want of energy and there's a body to spare (dur ≥ 2).
    const lsIdx = state.hand.findIndex(c => c.effects?.sacrificeForValue && c.cost <= state.energy);
    if (lsIdx >= 0) {
      const stuckLure = state.hand.some(c => c.type === 'lure' && c.cost > state.energy);
      const spare = liveAnimals().some(sl => (sl.durationRemaining || 0) >= 2);
      if (stuckLure && spare) { playHandlerCard(state, combat, lsIdx); continue; }
    }
    break;
  }

  // Maul (Alan, 2026-06-02): which slots held an animal DURING the player's
  // turn, before the tick transforms staged lures. Only these are maul-
  // eligible — a lure that becomes an animal on this tick isn't "out" until
  // next turn. Mirrors App.jsx preTickAnimalSlots.
  combat.maulEligibleSlots = new Set(['intro', 'subject', 'target']
    .filter(s => combat.htray[s]?.kind === 'animal'));
  handlerEndOfTurnTick(state, combat);
  if (combat.tactic) combat.tacticTurns[combat.tactic] = (combat.tacticTurns[combat.tactic] || 0) + 1;

  // Hollow Weaver — Weave fires now unless the player damaged the enemy this
  // turn (cast or animal attack). Lane-agnostic; mirrors App.jsx endTurn.
  if ((combat.weaveStacks || 0) > 0) {
    const damaged = combat.totalDamageDealt > combat.dmgDealtAtTurnStart;
    if (!damaged) {
      const dmg = combat.weaveStacks;
      state.composure = Math.max(0, state.composure - dmg);
      combat.weaveDamage = (combat.weaveDamage || 0) + dmg;
    }
    combat.weaveStacks = 0;
  }

  // Tokens (Full Pockets' Snack) vanish at end of turn — never to discard/deck.
  for (const c of state.hand) if (!c.token) state.discard.push(c);
  state.hand = [];

  if (combat.enemyComposure > 0 && combat.enemyHp > 0) {
    combat.enemyBlock = 0;
    handlerApplyIntent(state, combat, combat.enemyIntent);
    combat.enemyDmgMult  = combat.enemyDmgMult  > 1 ? Math.max(1, combat.enemyDmgMult  - 0.5) : combat.enemyDmgMult  < 1 ? Math.min(1, combat.enemyDmgMult  + 0.5) : combat.enemyDmgMult;
    combat.playerDmgMult = combat.playerDmgMult > 1 ? Math.max(1, combat.playerDmgMult - 0.5) : combat.playerDmgMult < 1 ? Math.min(1, combat.playerDmgMult + 0.5) : combat.playerDmgMult;
    combat.lastIntentKinds.push(combat.enemyIntent?.kind);
    if (combat.lastIntentKinds.length > 2) combat.lastIntentKinds.shift();
    const exclude = (combat.lastIntentKinds.length >= 2 && combat.lastIntentKinds[0] === combat.lastIntentKinds[1]) ? [combat.lastIntentKinds[0]] : [];
    combat.enemyIntent = rollIntent(combat.enemy, exclude);
  }
}
function handlerApplyIntent(state, combat, intent) {
  if (!intent) return;
  if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
    const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
    // Spittle Peck (Rabid Scrubjay onExit): redirect the whole attack onto the
    // enemy's composure; the player takes no hit. Mirrors App.jsx. Armed during
    // handlerEndOfTurnTick, which runs before this on the same end-of-turn.
    if (state.redirectEnemyAttack) {
      state.redirectEnemyAttack = false;
      const returned = Math.max(0, Math.round(intent.value * combat.enemyDmgMult) * hits);
      if (returned > 0) {
        combat.enemyComposure = Math.max(0, combat.enemyComposure - returned);
        combat.totalDamageDealt += returned;
      }
      return;
    }
    const targetsComposure = intent.pool === 'composure';
    let raw = Math.round(intent.value * combat.enemyDmgMult);
    const hpBefore = state.hp;
    let wBlock = state.block, wPoise = state.poise || 0, wHp = state.hp, wComp = state.composure;
    for (let i = 0; i < hits; i++) {
      let remaining = raw;
      if (targetsComposure) {
        if (wPoise > 0) { const a = Math.min(wPoise, remaining); wPoise -= a; remaining -= a; }
      } else if (wBlock > 0) {
        const a = Math.min(wBlock, remaining); wBlock -= a; remaining -= a;
      }
      if (targetsComposure) wComp = Math.max(0, wComp - remaining);
      else                  wHp   = Math.max(0, wHp   - remaining);
      combat.totalDamageTaken += remaining;
      if (wHp <= 0 || wComp <= 0) break;
    }
    state.block = wBlock; state.poise = wPoise; state.hp = wHp; state.composure = wComp;
    // Maul: any HP leaked past block also tears the strongest animal off the
    // board. Mirrors App.jsx maulStrongestAnimal. No exit payoff — killed.
    if (intent.maul && wHp < hpBefore) {
      const SLOT = ['intro', 'subject', 'target'];
      const eligible = combat.maulEligibleSlots || new Set();
      // Pecking Order redirects the maul to the weakest animal. Mirrors App.jsx.
      const redirect = hasHandlerPower(state, 'peckingOrder');
      let best = null, bestAtk = redirect ? Infinity : -1;
      for (const s of SLOT) {
        if (!eligible.has(s)) continue;
        const slot = combat.htray[s];
        if (slot?.kind !== 'animal') continue;
        const a = ANIMALS[slot.animalId]; let atk = a?.attack || 0;
        if (atk > 0) { atk += (slot.attackBonus || 0); }
        if (redirect ? atk < bestAtk : atk > bestAtk) { bestAtk = atk; best = s; }
      }
      if (best) {
        const slot = combat.htray[best];
        if (Array.isArray(slot.spans)) for (const s of slot.spans) combat.htray[s] = null;
        else combat.htray[best] = null;
        combat.mauls = (combat.mauls || 0) + 1;
        if (typeof globalThis.__maulCount === 'number') globalThis.__maulCount++;
        if (hasHandlerPower(state, 'whisperer')) combat.whisperPending = (combat.whisperPending || 0) + 1;
      }
    }
  } else if (intent.kind === 'block') {
    combat.enemyBlock += intent.value;
  } else if (intent.kind === 'vulnerable') {
    combat.enemyDmgMult = Math.min(1.5, combat.enemyDmgMult + 0.25 * intent.value);
  } else if (intent.kind === 'weak') {
    combat.playerDmgMult = Math.max(0.5, combat.playerDmgMult - 0.25 * intent.value);
  } else if (intent.kind === 'weave') {
    // Hollow Weaver — accrue stacks; they fire at the end of the next player
    // turn unless the player damaged the enemy. Mirrors App.jsx.
    combat.weaveStacks = (combat.weaveStacks || 0) + (intent.value || 1);
  }
  if (intent.riders) {
    const r = intent.riders;
    if (r.weak)       combat.playerDmgMult = Math.max(0.5, combat.playerDmgMult - 0.25 * r.weak);
    if (r.vulnerable) combat.enemyDmgMult  = Math.min(1.5, combat.enemyDmgMult  + 0.25 * r.vulnerable);
    if (r.block)      combat.enemyBlock += r.block;
  }
}
function handlerEndOfTurnTick(state, combat) {
  combat.handlerTicks++;
  const SLOT = ['intro', 'subject', 'target'];
  const work = { intro: combat.htray.intro, subject: combat.htray.subject, target: combat.htray.target };

  // The Whisperer: any animal leaving play banks a draw for next turn.
  const whispererInstalled = hasHandlerPower(state, 'whisperer');
  const noteExit = () => { if (whispererInstalled) combat.whisperPending = (combat.whisperPending || 0) + 1; };

  const onExit = (animal) => {
    const fx = animal?.onExit; if (!fx) return;
    if (fx.damage > 0) {
      if (fx.damageType === 'physical') handlerDealHp(combat, fx.damage);
      else { handlerDealComposure(combat, fx.damage); combat.menagerieComposure += fx.damage; }
      combat.totalDamageDealt += fx.damage;
    }
    if (fx.block > 0)     { state.block += fx.block; combat.menagerieBlock += fx.block; }
    if (fx.applyWeak > 0) combat.enemyDmgMult = Math.max(0.5, combat.enemyDmgMult - 0.25 * fx.applyWeak);
    if (fx.healComp > 0)  state.composure = Math.min(state.maxComposure, state.composure + fx.healComp);
    if (fx.healHp > 0)    state.hp = Math.min(state.maxHp, state.hp + fx.healHp);
    // Spittle Peck (Rabid Scrubjay): arm the redirect; consumed when the enemy
    // next attacks. Mirrors App.jsx redirectEnemyAttackRef.
    if (fx.redirectEnemyAttack) state.redirectEnemyAttack = true;
  };

  // PRE-PASS: cannibalism (lure adjacent to same-species animal).
  for (let i = 0; i < SLOT.length; i++) {
    const lureSlot = work[SLOT[i]];
    if (!lureSlot || lureSlot.kind !== 'lure') continue;
    for (const ni of [i - 1, i + 1].filter(n => n >= 0 && n < SLOT.length)) {
      const nb = work[SLOT[ni]];
      if (!nb || nb.kind !== 'animal' || nb.animalId !== lureSlot.animalId) continue;
      if (lureSlot.card) state.discard.push({ ...lureSlot.card });
      work[SLOT[i]] = { ...nb, eatenThisTurn: true };
      work[SLOT[ni]] = null;
      break;
    }
  }
  // PRE-PASS: raptor swoop (5% per field-mouse; Hawk 65% / Owl 35%). Mirrors
  // App.jsx. The eaten animal forfeits this turn (eatenThisTurn); the raptor
  // takes the slot at full duration and acts next turn. Salmon is no longer
  // eligible — it attracts predators via its own predatorRoll (Alan, 2026-06-02).
  for (const s of SLOT) {
    const slot = work[s];
    if (!slot || slot.kind !== 'animal') continue;
    if (slot.animalId !== 'field-mouse') continue;
    if (Math.random() >= 0.05) continue;
    const raptorId = Math.random() < 0.65 ? 'hawk' : 'owl';
    const h = makeAnimalSlot(raptorId, 0, slot.summonSet); h.eatenThisTurn = true;
    work[s] = h;
  }
  // PRE-PASS: three-of-a-kind combine.
  const first = work[SLOT[0]];
  const matched = (first?.kind === 'animal' && COMBINE_BY_SPECIES[first.animalId]) ? first.animalId : null;
  if (matched && SLOT.every(s => work[s]?.kind === 'animal' && work[s].animalId === matched)) {
    const combineId = COMBINE_BY_SPECIES[matched];
    const ca = ANIMALS[combineId];
    work.intro = {
      kind: 'animal', animalId: combineId, durationRemaining: ca?.duration || 2,
      predatorProgress: 0, adjacentSpawnProgress: 0, adjacentSpawned: false,
      summonSet: matched === 'field-mouse' ? 'tender-greens' : null,
      spans: ['intro', 'subject'], justCombined: true, feedReceived: true, nextAttackMult: 1,
    };
    work.subject = { kind: 'occupied', occupiedBy: 'intro' };
    work.target = null;
    combat.combines++;
    // COMBINE DETONATION (cycle 2): one-time burst the turn it forms. Mirrors App.jsx.
    const onForm = ca?.onForm;
    if (onForm) {
      if (onForm.damage > 0) {
        if (onForm.pool === 'composure') { handlerDealComposure(combat, onForm.damage); combat.menagerieComposure += onForm.damage; }
        else handlerDealHp(combat, onForm.damage);
        combat.totalDamageDealt += onForm.damage;
      }
      if (onForm.applyVulnerable > 0) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * onForm.applyVulnerable);
      if (onForm.applyWeak > 0) combat.enemyDmgMult = Math.max(0.5, combat.enemyDmgMult - 0.25 * onForm.applyWeak);
    }
  }
  // PRE-PASS: tender-greens row bonus (×1.5 next attack + +3 block/turn, once).
  const entries = SLOT.map(s => work[s]);
  const allTG = entries.every(s => s && s.kind === 'animal' && s.summonSet === 'tender-greens');
  if (allTG && !entries.every(s => s.tgFired)) {
    for (const s of SLOT) {
      const sl = work[s];
      work[s] = { ...sl, nextAttackMult: 1.5, turnGrantTemp: { block: ((sl.turnGrantTemp?.block) || 0) + 3 }, tgFired: true };
    }
  }

  // PRE-PASS: raptor eats adjacent prey on its EXIT turn (durationRemaining===1)
  // to move into that square and stay one more turn — once only. Mirrors
  // App.jsx (Alan, 2026-06-02).
  for (const slotName of SLOT) {
    const rs = work[slotName];
    if (!rs || rs.kind !== 'animal') continue;
    const ra = ANIMALS[rs.animalId];
    const prey = ra?.eatsAdjacent;
    if (!prey || !prey.length) continue;
    if (rs.durationRemaining !== 1 || rs.ateAdjacentOnce) continue;
    const hi = SLOT.indexOf(slotName);
    for (const ni of [hi - 1, hi + 1]) {
      if (ni < 0 || ni >= SLOT.length) continue;
      const ns = SLOT[ni];
      const nb = work[ns];
      if (nb && nb.kind === 'animal' && prey.includes(nb.animalId)) {
        work[ns] = { ...rs, durationRemaining: 2, ateAdjacentOnce: true };
        work[slotName] = null;
        break;
      }
    }
  }

  // PRE-PASS: Owl Vulnerable (Alan, 2026-06-02). A standing Owl applies its
  // Vulnerable to the enemy before any animal attacks. Mirrors App.jsx. Skips
  // an Owl still in its swoop-forfeit turn (eatenThisTurn).
  for (const slotName of SLOT) {
    const slot = work[slotName];
    if (!slot || slot.kind !== 'animal' || slot.eatenThisTurn) continue;
    const a = ANIMALS[slot.animalId];
    if (!a?.prePassVulnerable) continue;
    combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * a.prePassVulnerable);
  }

  // PRE-PASS: Raven Bird Theft (2026-06-02). On the turn a Raven is set to
  // exit (durationRemaining === 1, its last attack happens this tick), strip
  // `birdTheft` Block from the enemy BEFORE any animal attacks. Mirrors
  // App.jsx. Unfed ravens short-stay and never reach their payoff turn.
  for (const slotName of SLOT) {
    const s = work[slotName];
    if (!s || s.kind !== 'animal') continue;
    const a = ANIMALS[s.animalId];
    if (!a?.birdTheft || s.durationRemaining !== 1) continue;
    if (a.feedKey && !s.feedReceived) continue;
    combat.enemyBlock = Math.max(0, combat.enemyBlock - a.birdTheft);
  }

  // PRE-PASS: ADJACENCY COMBOS (Alan, 2026-06-02). Two specific species in
  // adjacent slots fire a joint special attack once per pair-type per turn.
  // Mirrors App.jsx end-of-turn pre-pass. Fires before the per-animal loop so
  // a combo's debuff lands ahead of the swarm's swings.
  {
    const comboFired = new Set();
    for (let i = 0; i < SLOT.length - 1; i++) {
      const sA = work[SLOT[i]];
      const sB = work[SLOT[i + 1]];
      if (!sA || sA.kind !== 'animal' || sA.eatenThisTurn) continue;
      if (!sB || sB.kind !== 'animal' || sB.eatenThisTurn) continue;
      const combo = ADJACENCY_COMBOS.find(c =>
        (c.a === sA.animalId && c.b === sB.animalId) ||
        (c.a === sB.animalId && c.b === sA.animalId));
      if (!combo) continue;
      const key = [combo.a, combo.b].sort().join('+');
      if (comboFired.has(key)) continue;
      comboFired.add(key);
      if (combo.damage > 0) {
        if (combo.pool === 'composure') { handlerDealComposure(combat, combo.damage); combat.menagerieComposure += combo.damage; }
        else handlerDealHp(combat, combo.damage);
        combat.totalDamageDealt += combo.damage;
      }
      if (combo.applyWeak > 0) combat.enemyDmgMult = Math.max(0.5, combat.enemyDmgMult - 0.25 * combo.applyWeak);
      if (combo.applyVulnerable > 0) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * combo.applyVulnerable);
      if (combo.draw > 0) drawCards(state, combo.draw);
      if (combo.block > 0) { state.block += combo.block; combat.menagerieBlock += combo.block; }
      combat.combos = (combat.combos || 0) + 1;
    }
  }

  // MAIN LOOP.
  const next = {};
  const isUnfed = (slot, animal) => animal?.feedKey && !slot.feedReceived;
  for (const slotName of SLOT) {
    const slot = work[slotName];
    if (!slot) { next[slotName] = null; continue; }
    if (slot.kind === 'occupied') { if (next[slotName] === undefined) next[slotName] = slot; continue; }
    if (slot.kind === 'lure') {
      const nt = slot.turnsRemaining - 1;
      if (nt <= 0) {
        const animalId = resolveLureSpecies(slot, combat);
        if (slot.card) state.discard.push({ ...slot.card });
        combat.summons++;
        next[slotName] = makeAnimalSlot(animalId, slot.youthBonus || 0, slot.summonSet);
      } else next[slotName] = { ...slot, turnsRemaining: nt };
      continue;
    }
    const animal = ANIMALS[slot.animalId];
    if (!animal) { next[slotName] = null; continue; }
    if (!slot.eatenThisTurn && animal.attack > 0) {
      handlerAnimalAttack(state, combat, slot, animal, 1);
      // Deferred re-attacks armed this turn by On Three! / Stampede. The
      // one-shot nextAttackMult was spent by the natural swing above, so the
      // extra attacks use base attack (baseMult 1). Gated behind eatenThisTurn
      // like the natural swing. Mirrors App.jsx end-of-turn extraAttacks loop.
      for (let e = 0; e < (slot.extraAttacks || 0); e++) {
        handlerAnimalAttack(state, combat, slot, animal, 1);
      }
    }
    const grant = animal.turnGrant || slot.turnGrantTemp;
    if (grant) { if (grant.block > 0) { state.block += grant.block; combat.menagerieBlock += grant.block; } if (grant.poise > 0) state.poise += grant.poise; }

    let nextDur = slot.justCombined ? slot.durationRemaining : slot.durationRemaining - 1;
    const nextPred = (slot.predatorProgress || 0) + 1;
    const nextAdj = (slot.adjacentSpawnProgress || 0) + 1;

    // FEED GATE (Alan, 2026-06-01): the predator chain is the PAYOFF for
    // feeding. An unfed animal never summons its predator — it just slips
    // away on its short-stay turn. TERRITORIAL: the chain target only spawns
    // if no animal of that species is already on the projected board.
    // Predator ROLL (Salmon, 2026-06-02): probabilistic no-feed gamble.
    // Mirrors App.jsx — each tick rolls predatorRoll.chance to transform in
    // place into a weighted pick from the table (uniform within ids).
    if (animal.predatorRoll && rnd() < animal.predatorRoll.chance) {
      const table = animal.predatorRoll.table || [];
      const totalW = table.reduce((s, e) => s + (e.weight || 0), 0);
      let r = rnd() * totalW;
      let chosen = table[0];
      for (const e of table) { if ((r -= (e.weight || 0)) < 0) { chosen = e; break; } }
      const ids = (chosen && chosen.ids) || [];
      if (ids.length > 0) {
        const rollTargetId = ids[Math.floor(rnd() * ids.length)];
        next[slotName] = makeAnimalSlot(rollTargetId, 0, slot.summonSet);
        combat.summons++;
        continue;
      }
    }
    const chainReady = animal.predatorChain && !isUnfed(slot, animal) && nextPred >= animal.predatorChain.turnsToTrigger;
    const chainTargetId = animal.predatorChain && animal.predatorChain.animalId;
    // TERRITORIAL CAP: up to 2 of the chain species (bears) at once. Mirrors App.jsx.
    const MAX_CHAIN_TARGET = 2;
    const chainTargetCount = chainReady ? SLOT.reduce((n, s) => {
      if (s === slotName) return n;
      const proj = (next[s] !== undefined) ? next[s] : work[s];
      return n + ((proj && proj.kind === 'animal' && proj.animalId === chainTargetId) ? 1 : 0);
    }, 0) : 0;
    if (chainReady && chainTargetCount < MAX_CHAIN_TARGET) {
      next[slotName] = makeAnimalSlot(animal.predatorChain.animalId, 0, slot.summonSet);
      continue;
    }
    const sidx = SLOT.indexOf(slotName);
    const hasEmptyNb = [sidx - 1, sidx + 1].some(n => {
      if (n < 0 || n >= SLOT.length) return false;
      const ns = SLOT[n];
      const proj = (next[ns] !== undefined) ? next[ns] : work[ns];
      return proj == null;
    });
    if (animal.adjacentSpawn && !slot.adjacentSpawned && nextAdj >= animal.adjacentSpawn.turnsToTrigger && !isUnfed(slot, animal) && hasEmptyNb) {
      for (const n of [sidx - 1, sidx + 1]) {
        if (n < 0 || n >= SLOT.length) continue;
        const ns = SLOT[n];
        const proj = (next[ns] !== undefined) ? next[ns] : work[ns];
        if (proj == null) { const child = makeAnimalSlot(animal.adjacentSpawn.animalId, 0, slot.summonSet); child.adjacentSpawned = true; next[ns] = child; combat.summons++; }
      }
      nextDur = (slot.durationRemaining - 1) + (animal.adjacentSpawn.extendSelfTurns || 0);
      if (nextDur <= 0) { if (!isUnfed(slot, animal)) onExit(animal); noteExit(); clearHandlerSlot(next, slot, slotName); }
      // FEED RETRIGGER (mirrors App.jsx): an extension to 2+ turns is a fresh
      // feed cycle — clear stale fed status so the animal must be fed again
      // before its next make-or-break. Preserved at nextDur===1 so the dur-2
      // feed still carries the last turn + exit bonus.
      else next[slotName] = { ...slot, durationRemaining: nextDur, predatorProgress: nextPred, adjacentSpawnProgress: 0, adjacentSpawned: true, nextAttackMult: 1, extraAttacks: 0, eatenThisTurn: false, fedThisTurn: false, feedReceived: nextDur >= 2 ? false : slot.feedReceived };
      continue;
    }
    if (nextDur <= 0) { if (!isUnfed(slot, animal)) onExit(animal); noteExit(); clearHandlerSlot(next, slot, slotName); }
    else if (nextDur === 1 && isUnfed(slot, animal)) { combat.shortStays++; noteExit(); clearHandlerSlot(next, slot, slotName); }
    else next[slotName] = { ...slot, durationRemaining: nextDur, predatorProgress: nextPred, adjacentSpawnProgress: nextAdj, nextAttackMult: 1, extraAttacks: 0, eatenThisTurn: false, justCombined: false, fedThisTurn: false, feedReceived: nextDur >= 2 ? false : slot.feedReceived };
  }

  // Birds of a Feather self-exhaust at three-of-a-kind.
  if (combat.tactic === 'feather') {
    const counts = {};
    for (const s of SLOT) { const sl = next[s]; if (sl?.kind === 'animal') counts[sl.animalId] = (counts[sl.animalId] || 0) + 1; }
    if (Object.values(counts).some(n => n >= 3)) combat.tactic = null;
  }
  combat.htray = { intro: next.intro ?? null, subject: next.subject ?? null, target: next.target ?? null };
}
function flushStagedLures(state, combat) {
  for (const s of ['intro', 'subject', 'target']) {
    const slot = combat.htray[s];
    if (slot?.kind === 'lure' && slot.card) state.discard.push({ ...slot.card });
  }
}
// Run a whole handler combat to completion. Returns the V2 runCombat contract:
// { outcome, turns, telemetry, killedBy? }. Stall = 5 turns no damage dealt.
function runHandlerCombat(state, enemy, telemetry) {
  const fb = state.familiarBonus || {};
  if (fb.startCombatVuln) state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * fb.startCombatVuln);
  // Fresh hand each combat (discard whatever lingered, then aiTurnHandler draws).
  // Scrub tokens (Snack) so they never seed a fresh combat's deck. Installed
  // powers from the prior combat fold back into discard so the card is
  // re-drawable (mirrors App.jsx folding `...powers` into fullDeck) — then the
  // active install state clears so each combat re-installs from a fresh draw.
  state.discard = [...state.discard, ...state.hand, ...(state.powers || [])].filter(c => !c.token);
  state.deck = (state.deck || []).filter(c => !c.token);
  state.hand = [];
  state.powers = [];
  const combat = {
    enemy, fb,
    enemyComposure: enemy.currentComp, enemyHp: enemy.currentHp, enemyBlock: 0,
    enemyDmgMult: 1.0, playerDmgMult: 1.0,
    enemyIntent: rollIntent(enemy), lastIntentKinds: [],
    htray: { intro: null, subject: null, target: null },
    tactic: null, youthUses: 0, buffetArmed: false,
    lureNarrowing: {},
    turn: 0, handlerTicks: 0, tacticChanges: 0,
    tacticsEngaged: {}, tacticTurns: {},
    summons: 0, feeds: 0, shortStays: 0, combines: 0,
    menagerieComposure: 0, menagerieBlock: 0,
    totalDamageDealt: 0, totalDamageTaken: 0,
    whisperPending: 0, firstLureUsedThisTurn: false, powersInstalled: 0,
    weaveStacks: 0, dmgDealtAtTurnStart: 0, weaveDamage: 0,
  };

  const flushTelemetry = (outcome) => {
    telemetry.handlerCombats = (telemetry.handlerCombats || 0) + 1;
    telemetry.handlerTicks += combat.handlerTicks;
    telemetry.handlerSummons += combat.summons;
    telemetry.handlerFeeds += combat.feeds;
    telemetry.handlerShortStays += combat.shortStays;
    telemetry.handlerCombines += combat.combines;
    telemetry.handlerMenagerieComposure += combat.menagerieComposure;
    telemetry.handlerMenagerieBlock += combat.menagerieBlock;
    telemetry.handlerTacticChanges += combat.tacticChanges;
    telemetry.handlerTacticVarietySum += Object.keys(combat.tacticsEngaged).length;
    for (const id of Object.keys(combat.tacticsEngaged)) {
      telemetry.handlerTacticEngaged[id] = (telemetry.handlerTacticEngaged[id] || 0) + combat.tacticsEngaged[id];
    }
    telemetry.totalDamageDealt += combat.totalDamageDealt;
    telemetry.weaveDamage = (telemetry.weaveDamage || 0) + (combat.weaveDamage || 0);
  };

  let safety = MAX_COMBAT_TURNS;
  let prevDamage = 0, zeroStreak = 0;
  while (safety-- > 0) {
    if (state.hp <= 0 || state.composure <= 0) { if (typeof globalThis.__deathCause==='object'){const k=state.hp<=0?'hp':'composure';globalThis.__deathCause[k]=(globalThis.__deathCause[k]||0)+1;} flushStagedLures(state, combat); flushTelemetry('lost'); return { outcome: 'lost', turns: combat.turn, telemetry, killedBy: enemy.id }; }
    if (combat.enemyComposure <= 0 || combat.enemyHp <= 0) { flushStagedLures(state, combat); flushTelemetry('won'); return { outcome: 'won', turns: combat.turn, telemetry }; }
    aiTurnHandler(state, combat);
    if (combat.totalDamageDealt === prevDamage) {
      if (++zeroStreak >= 5) { flushStagedLures(state, combat); flushTelemetry('stall'); return { outcome: 'stall', turns: combat.turn, telemetry, killedBy: enemy.id }; }
    } else { zeroStreak = 0; prevDamage = combat.totalDamageDealt; }
  }
  flushStagedLures(state, combat);
  const won = combat.enemyComposure <= 0 || combat.enemyHp <= 0;
  flushTelemetry(won ? 'won' : 'lost');
  return { outcome: won ? 'won' : 'lost', turns: combat.turn, telemetry, killedBy: won ? undefined : enemy.id };
}

function runCombat(state, enemyId, telemetry) {
  const tmpl = ENEMIES_BY_ID[enemyId];
  if (!tmpl) throw new Error(`Unknown enemy ${enemyId}`);
  // v3.4.44 — match App.jsx DIFFICULTY_MULT (1.25). Sim enemy comp/hp +
  // per-behavior attack values scaled to mirror enterFight() in App.jsx
  // (only attack / attack-multi values scale; block / debuff values do not).
  const DIFFICULTY_MULT = 1.25;
  const scaledComp = Math.round((tmpl.comp || 0) * DIFFICULTY_MULT);
  const scaledHp = (tmpl.hp >= 900) ? tmpl.hp : Math.round((tmpl.hp || 0) * DIFFICULTY_MULT);
  const scaledBehaviors = (tmpl.behaviors || []).map(b => {
    if (b.kind === 'attack' || b.kind === 'attack-multi') {
      return { ...b, value: Math.max(1, Math.round((b.value || 0) * DIFFICULTY_MULT)) };
    }
    return { ...b };
  });
  const scaledAtk = Math.max(1, avgAttack(scaledBehaviors));
  const enemy = { ...tmpl, atk: scaledAtk, comp: scaledComp, hp: scaledHp, behaviors: scaledBehaviors,
    startComp: scaledComp, currentComp: scaledComp, currentHp: scaledHp, block: 0,
    // Effectiveness starts empty: all `eff[lane] ?? 1.0` reads default to 1.0
    // (matches the live game; only a Sway card would write here — unmodeled).
    effectiveness: {} };
  // Handler (Animal Summoner) runs use a wholly separate combat engine —
  // lures → animals → tactics, no verbal tray. Branch out before any of the
  // verbal per-combat state is initialized. enemy is already DIFFICULTY_MULT-
  // scaled above, so the handler engine inherits the same difficulty.
  if (state.lane === 'handler') return runHandlerCombat(state, enemy, telemetry);
  // Roll the opening intent (the player "sees" it before their first turn,
  // exactly as App.jsx does via setEnemyIntent(rollIntent(e)) in enterFight).
  state.enemyIntent = rollIntent(enemy);
  state.lastIntentKinds = [];
  state.weaveStacks = 0; // v2.96: Hollow Weaver weave debt (wit/jnsq).
  state.loomStole = false; // Loom Familiar: one card-steal per combat, total.
  state.redirectEnemyAttack = false; // Spittle Peck: cleared per combat.
  state.castedThisTurn = false; // set at end of each player turn; weave reads it.
  state.block = 0;
  state.poise = 0; // v2.9: composure-shield
  state.combatRolls = []; // v2.12: track chaos rolls this combat
  state.backfireStreak = 0; // v2.90: consecutive 1s, for the backfire smoother
  // v2.93: Passing Thought flag resets per combat.
  state.enemySkipNextAttack = false;
  state.swapNextHitToComp = false;
  state.reflectNextHitAsComp = false;
  state.bracingArmed = false;
  state.reflectNextDebuff = 0;
  state.nextCastBonusEqualsLast = false;
  state.nextCastBypassEff = false;
  state.nextCastDamageMult = 1.0;
  state.nextCastDoubles = false;
  state.lastCastDamage = 0;
  // v2.24: handler TUNNEL VISION + RAGE state — per combat.
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
  // v2.25: handler DOUBLING DOWN — per-turn corner-token counter.
  // Bumped on cast when target has `doubleDown: true`. Bills 2 unblocked
  // HP per token at end of turn if the enemy is still alive. Resets each
  // turn either way (after billing).
  state.cornerTokens = 0;
  // v2.29: handler SAYING IT LOUDER — per-turn counter of demanding-tagged
  // handler words staged this turn. Read by loudScaling targets for +3
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
  // v2.47: DRUNKEN CONFIDENCE — jnsq damage-trade power. While installed,
  // +50% scaling on every cast AND +2 raw damage on every enemy attack.
  // Per-combat reset; explicit removal via "sober second thought," skill.
  state.drunkenInstalled = false;
  // v2.49: BABBLING — jnsq Power that lifts the per-turn cast cap from 1
  // to 2 (2nd cast scales 0.6×). Per-combat reset.
  state.babblingInstalled = false;
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
  // v2.46: WON'T SHUT UP — commitment-chain flag. Armed when the soup
  // target resolves a cast; cleared by any subsequent jnsq play or by
  // end-of-turn billing (-3 HP). Per-combat reset; per-turn clear lives
  // in the end-of-turn billing block.
  state.wontShutUpArmed = false;
  // v2.48: AWKWARD PAUSE — jnsq tray-hold mechanic. pauseHeld is set on
  // the skill play and graduates to pauseHeldActive at end of turn (the
  // doubling-pending bank for the NEXT cast). pauseHeldActive doubles
  // every staged-card stat contribution on the next cast. Cleared on
  // cast. If no cast fires, the active flag carries forward (multi-turn
  // buildup). Both reset per combat.
  state.pauseHeld = false;
  state.pauseHeldActive = false;
  // v2.52: DRUNKEN STAGGER — jnsq defensive flag. Armed by the "sorry, I lost
  // my balance for a second," skill; cleared at end of turn AFTER the enemy
  // attack roll-block has had its chance to roll. One-turn defensive window.
  state.staggerActive = false;
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
    // v2.93 D-6 (Bracing for Impact): snapshot HP at turn start so the
    // end-of-turn bracing check can compare. Armed flag is set when the
    // card is played; the check fires (and consumes the flag) once HP
    // drops below this snapshot.
    state.hpAtTurnStart = state.hp;

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
            state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
            state.exiled.push(tok);
            state.hand.splice(idx, 1);
            telemetry.missTepDiscards = (telemetry.missTepDiscards || 0) + 1;
          }
        }
      }
    }
    // v2.9: start-of-turn block from familiar (e.g. Hedgehog).
    if (fb.startOfTurnBlock) state.block += fb.startOfTurnBlock;
    // v2.24: handler RAGE entry check. If TUNNEL VISION >= 5, this turn
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
    state.tutorFiredThisTurn = false;
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
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.patienceInstalled = true;
          telemetry.patienceInstalls = (telemetry.patienceInstalls || 0) + 1;
          state.discard.push(c);
          state.hand.splice(i, 1);
          break;
        }
      }
    }

    // v2.47: DRUNKEN CONFIDENCE install pass — jnsq lane only. While in
    // hand AND no drunken-confidence power already installed, install when
    // spare energy is available. Heuristic: the +50% cast bonus pays for the
    // +2 incoming chunk over the long arc, so the AI installs eagerly. Cost 1.
    if (state.lane === 'jnsq' && !state.drunkenInstalled) {
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if ((c.id === 'jv2-p-hold-my-drink' || c.installPower?.id === 'drunken-confidence')
            && (c.cost || 0) <= state.energy && state.energy >= 2) {
          state.energy -= c.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.drunkenInstalled = true;
          telemetry.drunkenInstalls = (telemetry.drunkenInstalls || 0) + 1;
          state.discard.push(c);
          state.hand.splice(i, 1);
          break;
        }
      }
    }

    // v2.49: BABBLING install pass — jnsq lane only. When the power is in
    // hand AND not yet installed AND spare energy is available (≥2 after the
    // 1-cost install pays), install. Cost 1. The 2nd-cast cap is dead value
    // until the player has the depth to actually stage twice, but a jnsq
    // committed run usually has the deck for it — install eagerly mirrors
    // drunken's heuristic.
    if (state.lane === 'jnsq' && !state.babblingInstalled) {
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if ((c.id === 'jv2-p-wait-and-another-thing' || c.installPower?.id === 'babbling')
            && (c.cost || 0) <= state.energy && state.energy >= 2) {
          state.energy -= c.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.babblingInstalled = true;
          telemetry.babblingInstalls = (telemetry.babblingInstalls || 0) + 1;
          state.discard.push(c);
          state.hand.splice(i, 1);
          break;
        }
      }
    }

    // v2.47: SOBER SECOND THOUGHT skill — jnsq lane only. Cost 0. Played
    // when the +2 incoming is actively threatening to KO us — guarded by
    // HP <= 20% of max. At that pool depth the +50% cast bonus isn't
    // worth eating another +2 chunk. Idempotent: if no drunken power is
    // installed, the skill no-ops (still discarded — keeps the simulation
    // simple). The AI only plays it when it would actually do work.
    if (state.lane === 'jnsq' && state.drunkenInstalled) {
      const hpFrac = state.maxHp > 0 ? state.hp / state.maxHp : 1;
      if (hpFrac <= 0.20) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          if (c.id === 'jv2-k-sober-second-thought' && (c.cost || 0) <= state.energy) {
            state.energy -= c.cost || 0;
            state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
            state.drunkenInstalled = false;
            telemetry.drunkenUninstalls = (telemetry.drunkenUninstalls || 0) + 1;
            state.discard.push(c);
            state.hand.splice(i, 1);
            break;
          }
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
            state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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

    // v2.33: Tunnel-Vision skill HOLD — handler lane only. When TUNNEL VISION
    // is at 4+ (one handler-card stage away from triggering RAGE), playing
    // SKILL cards this turn wastes the impending +50% damage window because
    // skills don't stage handler words (no tunnel-vision bump) AND they
    // consume the turn's action economy that should be feeding the rage spike.
    // Suppresses Sorry-what specifically — defensive skills (Defend/Mend/
    // cleanse) still play through because they're hit-prevention and the
    // RAGE bonus doesn't matter if we're KO'd.
    const tvSkillHold = state.lane === 'handler'
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
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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
        state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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
    // v2.67: HUMAN_PLAY_PROFILE — skip-cast generalized across all lanes.
    // Real-play telemetry shows 2.47 casts/combat (humans skip-cast on
    // chip turns). Wit-only logic below stays — wit has special
    // long-thread/patience reasons to skip. The general gate ("don't
    // cast for trivial damage") applies to all lanes when predicted
    // damage is sub-chip and the player isn't pressured. See
    // sim/HUMAN_PLAY_PROFILE.md.
    let skipCastForThread = false;
    let skipChipCast = false;
    if (castsThisTurn < 1) {
      // Predict the best-case cast THIS turn from available cards.
      const introCard = state.hand.find(c => c.slot === 'intro' && c.lane === state.lane)
        || state.hand.find(c => c.slot === 'intro');
      const subjectCard = state.hand.find(c => c.slot === 'subject' && c.lane === state.lane)
        || state.hand.find(c => c.slot === 'subject');
      const targetCard = state.hand.find(
        c => c.slot === 'target' && c.lane === state.lane && (c.cost || 0) <= state.energy);
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
          : (eff[targetCard.effect?.scaleBy || targetCard.lane || state.lane] ?? 1.0);
        const predicted = preview.damage * enemyMult * (state.playerDmgMult || 1);
        const remaining = dmgType === 'physical' ? enemy.currentHp : enemy.currentComp;
        const wouldKill = predicted >= remaining;
        // v3.0 (cycle 2): chip threshold 25% → 15% of remaining pool.
        // v3.4.8 Delta 2 (HUMAN_PLAY_PROFILE snap 10): real cadence is
        // 0.62 casts/turn vs sim 0.22-0.34. Chip-skip was still too
        // aggressive — Alan casts every turn even on small chip damage.
        // Tightened further: 15% → 7%. AND override the skip when the
        // staged cards form an FFT layer match (full or partial row, or
        // same-school across all three slots) — those casts are worth
        // taking even at chip damage because they fire school riders.
        const isChip = predicted < remaining * 0.07;
        // FFT-chain check: if the three staged-or-in-hand cards would
        // trigger an FFT layer (full row, partial row, or tier match),
        // we don't skip — that cast has school-rider value beyond the
        // raw composure damage.
        let triggersFftLayer = false;
        if (introCard && subjectCard && targetCard) {
          const sId = introCard.setId;
          const tId = introCard.schoolId;
          // Full row match.
          if (sId && subjectCard.setId === sId && targetCard.setId === sId) {
            triggersFftLayer = true;
          }
          // Partial row (any 2 share setId).
          else if (sId && (sId === subjectCard.setId || sId === targetCard.setId)) {
            triggersFftLayer = true;
          }
          else if (subjectCard.setId && subjectCard.setId === targetCard.setId) {
            triggersFftLayer = true;
          }
          // All-tier match.
          else if (tId && subjectCard.schoolId === tId && targetCard.schoolId === tId) {
            triggersFftLayer = true;
          }
        }
        const hpRatio = state.maxHp > 0 ? state.hp / state.maxHp : 1;
        const eidSwing = expectedIntentDamage(state, enemy);
        const expectedSwing = eidSwing.hp + eidSwing.comp;
        const unblockedExpected = Math.max(0, eidSwing.hp - (state.block || 0)) + Math.max(0, eidSwing.comp - (state.poise || 0));
        // v3.0: also require defense to be ACTUALLY THIN. Real humans
        // skip-chip only when defense is tight too (per-snapshot signal);
        // sim was skipping whenever the cast was small, regardless of
        // whether defense was needed.
        const defenseTight = unblockedExpected > 2;
        const wouldSurvive = state.hp - unblockedExpected > 5;
        // Don't skip on the LAST act's boss (commit to the kill).
        const isFinalActBoss = enemy.tier === 'boss' && (state.actIdx || 0) >= 2;
        if (isChip && !wouldKill && hpRatio > 0.4 && wouldSurvive && defenseTight && !isFinalActBoss && !triggersFftLayer) {
          skipChipCast = true;
          telemetry.chipCastSkips = (telemetry.chipCastSkips || 0) + 1;
        }
      }
    }
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
            state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
            state.hand.splice(apologyIdx, 1);
            state.discard.push(c);
            // v3.0 cycle 4: tray REFUND TO HAND (was discard). Apology is
            // now a tempo reset, not a deck-thinner.
            const moved = [];
            if (tray.intro) moved.push(tray.intro);
            if (tray.subject) moved.push(tray.subject);
            if (tray.target) moved.push(tray.target);
            if (tray.modifiers && tray.modifiers.length) moved.push(...tray.modifiers);
            for (const m of moved) state.hand.push(m);
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
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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
    // v3.0 cycle 5 EXPERIMENT (REVERTED): tried a two-pass planner that
    // reserved cast-cost energy before defensive plays. Per the human-
    // divergence agent's call ("expected to lift casts/turn from 0.38 →
    // 0.7"). Empirically NET NEGATIVE: wit 2%→0%, handler 14%→7%,
    // jnsq 0%→4%. Lifting cast cadence at the cost of defense made the
    // sim die to HP attrition before its spells landed. The agent's
    // theory ("cast cadence is the limiter") was wrong for THIS sim AI
    // — defensive plays are doing more work than cast-tempo here. Kept
    // `budgetForOther()` as a thin wrapper that simply returns
    // state.energy (no reservation) — keeps the call sites stable in
    // case a future cycle wants to try a softer reservation (e.g. only
    // partial cost, or only when HP > 60%).
    const budgetForOther = () => state.energy;

    // v3.4.9 — Hoist staging helpers outside the pass loop (used to be
    // re-defined every pass; semantically identical). Lets the staging
    // blocks move ABOVE the defense/utility blocks for cadence — see
    // snapshot 11 follow-up.
    const applyStageEffects = (card) => {
      // v3.4.19 — solo staging bonus per slot. Mirrors App.jsx
      // STAGE_SLOT_BONUS. Intros add Block, targets add comp chip.
      // Subjects unchanged.
      const slot = card?.slot;
      const SIM_STAGE_BONUS = slot === 'intro'  ? { block: 2 }
                            : slot === 'target' ? { compDmg: 2 }
                            : {};
      const fx = { ...SIM_STAGE_BONUS, ...(card.effects || {}) };
      if (fx.compDmg)    enemy.currentComp = Math.max(0, enemy.currentComp - fx.compDmg);
      if (fx.block)      state.block += fx.block;
      if (fx.poise)      state.poise += fx.poise;
      if (fx.draw)       drawCards(state, fx.draw);
      if (fx.weak)       state.enemyDmgMult = Math.max(0.5, (state.enemyDmgMult || 1) - 0.25 * fx.weak);
      if (fx.vulnerable) state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * fx.vulnerable);
      if (fx.energy)     state.energy += fx.energy;
      if (fx.hp)         state.hp = Math.min(state.maxHp, state.hp + fx.hp);
      if (fx.loseHp)     state.hp = Math.max(0, state.hp - fx.loseHp);
      if (fx.tunnelVision) state.tunnelVision = (state.tunnelVision || 0) + fx.tunnelVision;
      if (fx.removeWeak && (state.playerDmgMult || 1) < 1.0) {
        state.playerDmgMult = Math.min(1.0, (state.playerDmgMult || 1) + 0.25 * fx.removeWeak);
      }
      if (fx.removeVulnerable && (state.enemyDmgMult || 1) > 1.0) {
        state.enemyDmgMult = Math.max(1.0, (state.enemyDmgMult || 1) - 0.25 * fx.removeVulnerable);
      }
      if (fx.discardOnPlay && state.hand.length > 0) {
        const idx = Math.floor(rnd() * state.hand.length);
        const lost = state.hand[idx];
        state.hand.splice(idx, 1);
        state.discard.push(lost);
      }
      if (fx.ignoreNextDebuff) {
        state.notListeningCharges = (state.notListeningCharges || 0) + fx.ignoreNextDebuff;
      }
    };
    const bumpTunnelOnStage = (card) => {
      if (card?.lane === 'handler') state.tunnelVision = (state.tunnelVision || 0) + 1;
      if (card?.lane === 'handler'
          && (card.slot === 'intro' || card.slot === 'subject' || card.slot === 'modifier')
          && (card.tags || []).includes('demanding')) {
        state.loudCount = (state.loudCount || 0) + 1;
      }
    };

    let passCount = 0;
    while (passCount++ < 8) {
      let progressed = false;

      // v3.4.9 — Per-turn play order reordered. STAGING happens BEFORE
      // defense and utility, so spell tray gets the energy first.
      // Previous order was defense-first → energy consumed → tray
      // assembles slowly → hold rate 78-83% in sim vs ~38% in human play.
      // Emergency defense (HP <30% AND big hit incoming) still fires
      // before staging, so the sim doesn't suicide-stage when in danger.
      // v3.5: plan emergency defense against the actual telegraphed intent.
      // expectedIntentDamage already applies enemyDmgMult and routes by pool,
      // so emergencyHpHit is the HP-pool damage the next intent will deal (0 if
      // the intent is a composure attack / block / debuff).
      const emergencyHpHit = expectedIntentDamage(state, enemy).hp;
      const hpFracForEmergency = state.hp / Math.max(1, state.maxHp);
      const emergencyDefenseNeeded = !state.enemySkipNextAttack
        && hpFracForEmergency < 0.3
        && state.block < emergencyHpHit;
      if (emergencyDefenseNeeded) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          if (c.type !== 'skill') continue;
          const fx = c.effects || {};
          if (!fx.block) continue;
          if ((c.cost || 0) > state.energy) continue;
          const hpCost = fx.loseHp || 0;
          if (hpCost > 0 && state.hp <= hpCost + 2) continue;
          state.energy -= c.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.block += fx.block || 0;
          if (fx.poise) state.poise += fx.poise;
          if (fx.draw) drawCards(state, fx.draw);
          if (hpCost) state.hp = Math.max(0, state.hp - hpCost);
          if (fx.exhaust) state.exiled.push(c);
          else            state.discard.push(c);
          state.hand.splice(i, 1);
          progressed = true;
          break;
        }
        if (progressed) continue;
      }

      // STAGING — first priority. Stage intro/subject/target if hand
      // has them AND a slot is open. Tray persists across turns; even
      // staging 1-2 cards per pass builds toward an FFT cast within
      // 2-3 turns.
      if (!tray.intro) {
        const idx = pickBestForSlot(state, 'intro', state.energy, enemy, tray);
        if (idx >= 0) {
          tray.intro = state.hand[idx];
          state.energy -= tray.intro.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.hand.splice(idx, 1);
          applyStageEffects(tray.intro);
          bumpTunnelOnStage(tray.intro);
          progressed = true;
          continue;
        }
      }
      if (!tray.subject) {
        const idx = pickBestForSlot(state, 'subject', state.energy, enemy, tray);
        if (idx >= 0) {
          tray.subject = state.hand[idx];
          state.energy -= tray.subject.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.hand.splice(idx, 1);
          applyStageEffects(tray.subject);
          bumpTunnelOnStage(tray.subject);
          progressed = true;
          continue;
        }
      }
      // v3.4.57 (Alan) — Auto partial-row tutor REMOVED from sim mirror.
      // Now only the opt-in The Tutor card (effect: tutorArmNextSentence)
      // can trigger this pull, and only on an intro+subject same-row
      // stage. Sim AI does not currently play The Tutor; left as a
      // no-op until AI heuristics are updated.
      // Will compute these defense need vars below; stub them here so
      // the target gate can read skipChipCast (which was computed
      // earlier in the function, before the pass loop).
      if (!tray.target && !skipCastForThread && !skipChipCast) {
        const idx = pickBestForSlotRageAware(state, 'target', state.energy, state.rageActive, tray, enemy);
        if (idx >= 0) {
          tray.target = state.hand[idx];
          state.energy -= tray.target.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.hand.splice(idx, 1);
          // v3.4.19 — target stage bonus (compDmg chip). Mirrors App.jsx.
          applyStageEffects(tray.target);
          bumpTunnelOnStage(tray.target);
          progressed = true;
          continue;
        }
      }
      if (tray.intro && tray.subject && tray.target && tray.modifiers.length < 2) {
        const tier = computeSpellTier(tray.intro, tray.subject, tray.target);
        const bossFight = enemy.tier === 'boss';
        const idx = pickBestModifier(state, state.energy, tier, bossFight, !!tray.target?.effect?.loudScaling);
        if (idx >= 0) {
          const m = state.hand[idx];
          const stagedM = m.effects?.footnoteSelfOnStage
            ? { ...m, footnotes: (m.footnotes || 0) + 1 }
            : m;
          tray.modifiers.push(stagedM);
          state.energy -= m.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.hand.splice(idx, 1);
          bumpTunnelOnStage(m);
          progressed = true;
          continue;
        }
      }

      // v2.9: Defenders react to anticipated damage. The dual-shield system
      // forces the AI to keep BOTH pools covered, not just HP. Thresholds
      // are tuned for a competent (not optimal) human: defend whenever the
      // next enemy hit could threaten a pool.
      //   Block / Defend → HP-pool defense. Threshold: hp < 60% AND block < expected hit.
      //   Poise / Compose → composure defense. Tighter threshold since
      //     composure pool is smaller (30 vs 70 HP).
      // v3.5: defend against the actual telegraphed intent. expectedIntentDamage
      // applies enemyDmgMult (Vulnerable amplification) and routes by pool, so
      // exactly one of hp/comp is non-zero for an attack intent and both are 0
      // for block / debuff / weave / discard intents — the AI no longer wastes
      // defense on turns with no incoming swing.
      const eid = expectedIntentDamage(state, enemy);
      const expectedHpHit = eid.hp;
      const expectedCompHit = eid.comp;
      // v2.95: if enemy attack is being skipped this turn (Talking Over Them),
      // skip all defensive plays — they'd be wasted.
      const incomingThisTurn = state.enemySkipNextAttack ? 0 : expectedHpHit;
      const incomingCompThisTurn = state.enemySkipNextAttack ? 0 : expectedCompHit;
      // Play any BLOCK-providing skill if expected unblocked HP damage > 0.
      // v2.95: generalized from c-defend/c-mend-only → any skill with
      // effects.block > 0 (covers Page-Mark, Square Up, c-defend, c-mend,
      // future block skills). HP-trade skills (loseHp > 0) gated by HP > 5
      // to avoid sim KO from a defensive play.
      if (state.block < incomingThisTurn) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          if (c.type !== 'skill') continue;
          const fx = c.effects || {};
          if (!fx.block) continue;
          // v3.0 cycle 5: respect cast reserve (two-pass planner).
          if ((c.cost || 0) > budgetForOther()) continue;
          // HP-trade safety: don't play if it would KO us.
          const hpCost = fx.loseHp || 0;
          if (hpCost > 0 && state.hp <= hpCost + 2) continue;
          // Pay cost + apply effects.
          state.energy -= c.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.block += fx.block || 0;
          if (fx.poise) state.poise += fx.poise;
          if (fx.draw) drawCards(state, fx.draw);
          if (hpCost) state.hp = Math.max(0, state.hp - hpCost);
          // Exhaust on play if the card declares it.
          if (fx.exhaust) state.exiled.push(c);
          else            state.discard.push(c);
          state.hand.splice(i, 1);
          progressed = true;
          break;
        }
      }
      // v2.92: Play any PASSING THOUGHT in hand when affordable. Lane-
      // agnostic one-shots; the AI plays them eagerly since they exhaust
      // after a single use anyway. Applies all 7 new fx keys + the
      // existing block/poise/hp/draw/energy/vulnerable/weak/composure
      // handlers via the inline dispatcher below.
      for (let i = 0; i < state.hand.length; i++) {
        const c = state.hand[i];
        if (!PASSING_THOUGHT_IDS.has(c.id)) continue;
        // v3.0 cycle 5: respect cast reserve.
        if ((c.cost || 0) > budgetForOther()) continue;
        const fx = c.effects || {};
        // Cheap context gates so the AI doesn't always burn cards:
        const hpFrac = state.hp / Math.max(1, state.maxHp);
        const compFrac = state.composure / Math.max(1, state.maxComposure);
        // Heal cards: skip if HP > 90% (waste).
        if ((fx.hp && !fx.block && !fx.composure) && hpFrac > 0.9) continue;
        // Pure composure heal: skip if comp > 90%.
        if ((fx.composure && !fx.hp) && compFrac > 0.9) continue;
        // Block: skip if no incoming hit projected.
        if ((fx.block && !fx.hp) && expectedHpHit === 0) continue;
        // Poise: skip if no incoming comp hit projected.
        if ((fx.poise && !fx.draw) && expectedCompHit === 0) continue;
        // Draw-N: skip if hand already large (≥ 6).
        if (fx.draw && !fx.energy && !fx.discardRandom && !fx.discardHand && state.hand.length >= 6) continue;
        // Discard hand + draw 5: only when hand is small and we're not about to cast.
        if (fx.discardHand && state.hand.length >= 4) continue;
        // OK, play it.
        state.energy -= c.cost || 0;
        state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
        if (fx.block)               state.block += fx.block;
        if (fx.poise)               state.poise += fx.poise;
        if (fx.hp)                  state.hp = Math.min(state.maxHp, state.hp + fx.hp);
        if (fx.composure)           state.composure = Math.min(state.maxComposure, state.composure + fx.composure);
        if (fx.energy)              state.energy += fx.energy;
        if (fx.draw)                drawCards(state, fx.draw);
        if (fx.weak)                state.enemyDmgMult = Math.max(0.5, (state.enemyDmgMult || 1) - 0.25 * fx.weak);
        if (fx.vulnerable)          state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * fx.vulnerable);
        if (fx.compDmg)             enemy.currentComp = Math.max(0, enemy.currentComp - fx.compDmg);
        if (fx.physDmg)             enemy.currentHp = Math.max(0, enemy.currentHp - fx.physDmg);
        if (fx.stripBlock)          enemy.block = Math.max(0, (enemy.block || 0) - fx.stripBlock);
        if (fx.discardRandom && state.hand.length > 0) {
          const n = Math.min(fx.discardRandom, state.hand.length);
          for (let k = 0; k < n; k++) {
            const idx = Math.floor(rnd() * state.hand.length);
            state.discard.push(state.hand[idx]);
            state.hand.splice(idx, 1);
          }
        }
        if (fx.discardHand && state.hand.length > 0) {
          // Note: hand index `i` is now stale post-discard, so we exit the
          // for loop right after this branch.
          state.discard.push(...state.hand.filter((_, k) => k !== i));
          // The Passing Thought itself goes to exile (exhaust), not back to discard.
          state.hand = [];
        }
        if (fx.returnDiscardToHand && state.discard.length > 0) {
          const n = Math.min(fx.returnDiscardToHand, state.discard.length);
          for (let k = 0; k < n; k++) {
            const idx = Math.floor(rnd() * state.discard.length);
            state.hand.push(state.discard[idx]);
            state.discard.splice(idx, 1);
          }
        }
        // v2.93: flag-based PT mechanics. Set the state flags; the cast /
        // attack hooks below consume them. Some are real-play-decision-
        // dependent and behave as no-ops in sim (Glancing Blow, Bracing,
        // Settle the Score) — noted in their handling sites.
        if (fx.enemySkipNextAttack) state.enemySkipNextAttack = true;
        if (fx.swapNextHitToComp)   state.swapNextHitToComp = true;
        if (fx.reflectNextHitAsComp) state.reflectNextHitAsComp = true;
        if (fx.bracingArmed)        state.bracingArmed = true;
        if (fx.reflectNextDebuff)   state.reflectNextDebuff = (state.reflectNextDebuff || 0) + fx.reflectNextDebuff;
        if (fx.nextCastBonusEqualsLast) state.nextCastBonusEqualsLast = true;
        if (fx.nextCastBypassEff)   state.nextCastBypassEff = true;
        if (fx.nextCastDamageMult)  state.nextCastDamageMult = fx.nextCastDamageMult;
        if (fx.nextCastDoubles)     state.nextCastDoubles = true;
        if (fx.blockFromComposure) {
          const bonus = Math.floor((state.composure || 0) / 3);
          if (bonus > 0) state.block += bonus;
        }
        if (fx.compDmgFromEnemyMissing) {
          const missing = Math.max(0, (enemy.comp || 0) - enemy.currentComp);
          const dmg = Math.floor(missing * fx.compDmgFromEnemyMissing);
          if (dmg > 0) enemy.currentComp = Math.max(0, enemy.currentComp - dmg);
        }
        // Card exhausts (Passing Thoughts all carry exhaust: true).
        state.exiled.push(c);
        if (!fx.discardHand) state.hand.splice(i, 1);
        telemetry.passingThoughtPlays = (telemetry.passingThoughtPlays || 0) + 1;
        progressed = true;
        break;
      }
      // Play any POISE-providing skill if expected unblocked composure damage > 0.
      // v2.95: generalized from c-compose/c-steady-only → any skill with
      // effects.poise > 0 (covers An Aside, c-compose, c-steady).
      if (state.poise < incomingCompThisTurn) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          if (c.type !== 'skill') continue;
          const fx = c.effects || {};
          if (!fx.poise) continue;
          // v3.0 cycle 5: respect cast reserve.
          if ((c.cost || 0) > budgetForOther()) continue;
          const hpCost = fx.loseHp || 0;
          if (hpCost > 0 && state.hp <= hpCost + 2) continue;
          state.energy -= c.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          state.poise += fx.poise || 0;
          if (fx.block) state.block += fx.block;
          if (fx.draw) drawCards(state, fx.draw);
          if (hpCost) state.hp = Math.max(0, state.hp - hpCost);
          if (fx.exhaust) state.exiled.push(c);
          else            state.discard.push(c);
          state.hand.splice(i, 1);
          progressed = true;
          break;
        }
      }
      // v2.95: cycle pass — play draw-2+ exhaust skills (like Rhubarb) when
      // hand is small AND HP can absorb any loseHp cost. Drawing 2 mid-turn
      // often unlocks a cast that wasn't reachable otherwise.
      if (state.hand.length <= 3) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          if (c.type !== 'skill') continue;
          const fx = c.effects || {};
          if ((fx.draw || 0) < 2) continue;
          if (fx.block || fx.poise) continue; // handled by defensive passes above
          // v3.0 cycle 5: respect cast reserve.
          if ((c.cost || 0) > budgetForOther()) continue;
          const hpCost = fx.loseHp || 0;
          if (hpCost > 0 && state.hp <= hpCost + 4) continue;
          state.energy -= c.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          drawCards(state, fx.draw);
          if (hpCost) state.hp = Math.max(0, state.hp - hpCost);
          if (fx.exhaust) state.exiled.push(c);
          else            state.discard.push(c);
          state.hand.splice(i, 1);
          progressed = true;
          break;
        }
      }

      // v2.95: gesture-play pass. Gestures bypass the spell tray and fire
      // immediately on play. Crucial when a complete spell can't form this
      // turn (e.g. missing intro/subject/target in hand). The sim previously
      // ignored gestures entirely; with the 1-of-each-slot starter, that
      // costs the player 30-50% of their turns. Plays any gesture if:
      //   - energy >= cost
      //   - tray can't form a spell this turn (missing slot in hand)
      //   - OR the gesture has exhaust:true AND we won't form a spell
      const canFormSpell = tray.intro && tray.subject ||
        (state.hand.some(c => c.slot === 'intro') && state.hand.some(c => c.slot === 'subject') && state.hand.some(c => c.slot === 'target' && (c.cost || 0) <= state.energy));
      if (!canFormSpell || (state.energy >= 2 && enemy.currentComp <= 12)) {
        for (let i = 0; i < state.hand.length; i++) {
          const c = state.hand[i];
          if (c.slot !== 'gesture') continue;
          // v3.0 cycle 5: gestures can't pay if a cast is reserved (unless
          // we already determined we can't form a spell — then no reserve).
          if ((c.cost || 0) > budgetForOther()) continue;
          const ge = c.gestureEffect || {};
          const dmg = ge.damage || 0;
          if (dmg <= 0) continue;
          // Skip if no relevant pool to damage (physical immune w/ phys gesture).
          const dmgType = ge.damageType || 'composure';
          const eff = enemy.effectiveness || {};
          const enemyMult = dmgType === 'physical' ? (eff.physical ?? 1) : (eff[state.lane] ?? 1);
          if (enemyMult <= 0) continue;
          const finalDmg = Math.round(dmg * enemyMult * (state.playerDmgMult || 1));
          if (finalDmg <= 0) continue;
          state.energy -= c.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
          if (dmgType === 'physical') enemy.currentHp = Math.max(0, enemy.currentHp - finalDmg);
          else                        enemy.currentComp = Math.max(0, enemy.currentComp - finalDmg);
          if (ge.stripEnemyBlock) enemy.block = Math.max(0, (enemy.block || 0) - ge.stripEnemyBlock);
          if (ge.draw) drawCards(state, ge.draw);
          if (ge.exhaust) state.exiled.push(c);
          else            state.discard.push(c);
          state.hand.splice(i, 1);
          telemetry.gesturePlays = (telemetry.gesturePlays || 0) + 1;
          progressed = true;
          break;
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
            state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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

      // v3.4.9 — staging block moved ABOVE defense/utility (see top of
      // this pass loop). All staging logic now fires first; defense and
      // utility blocks run on whatever energy remains.
      if (!progressed) break;
    }

    // v2.48: AWKWARD PAUSE skill play pass — jnsq lane only. Fires AFTER
    // staging so we know the full tray state. Conditions:
    //   - in hand (cost 0 so affordability is free)
    //   - tray.intro AND tray.subject staged (no point doubling an empty tray)
    //   - NOT already pauseHeld or pauseHeldActive (no double-arming)
    //   - the predicted damage of casting THIS turn (with full tray) would be
    //     < 0.4 × remaining enemy pool — i.e., not about to kill. If we're
    //     chambered to kill, cast now; only skip on chip turns.
    //   - the held-turn enemy swing isn't lethal (we need to be alive next
    //     turn to cash in the doubled cast).
    // Heuristic: skip without traySetup will rarely fire because the loop
    // above filled both intro+subject for any decent hand. The intent is
    // "you have a sentence; the cast won't kill; hold for double."
    if (state.lane === 'jnsq' && !state.pauseHeld && !state.pauseHeldActive) {
      const pauseIdx = state.hand.findIndex(c => c.id === 'jv2-k-go-on-im-listening');
      if (pauseIdx >= 0) {
        const c = state.hand[pauseIdx];
        const traySetup = !!(tray.intro && tray.subject);
        if ((c.cost || 0) <= state.energy && traySetup) {
          let castNowKills = false;
          let predictedNow = 0;
          const targetCard = tray.target;
          if (targetCard) {
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
              pauseDoubled: false,
            };
            const preview = computeSpellDamage(tray.intro, tray.subject, targetCard, tray.modifiers || [], preCtx);
            const dmgType = targetCard.effect?.damageType || 'composure';
            const eff = enemy.effectiveness || {};
            const enemyMult = (dmgType === 'physical')
              ? (eff.physical ?? 1.0)
              : (eff[targetCard.effect?.scaleBy || targetCard.lane || 'jnsq'] ?? 1.0);
            predictedNow = preview.damage * enemyMult * (state.playerDmgMult || 1);
            const remaining = dmgType === 'physical' ? enemy.currentHp : enemy.currentComp;
            castNowKills = predictedNow >= remaining;
          }
          const remainingPool = enemy.currentComp || enemy.currentHp || 1;
          // Without a target staged the cast threshold is the cast-pool itself
          // — we still skip if we don't have a cast queued, the doubling next
          // turn is the whole reason to pause.
          const lowDamage = !targetCard || predictedNow < 0.4 * remainingPool;
          const eidSwing = expectedIntentDamage(state, enemy);
          const expectedSwing = eidSwing.hp + eidSwing.comp;
          const unblockedExpected = Math.max(0, eidSwing.hp - (state.block || 0)) + Math.max(0, eidSwing.comp - (state.poise || 0));
          const wouldSurvive = state.hp - unblockedExpected > 0;
          if (!castNowKills && lowDamage && wouldSurvive) {
            state.energy -= c.cost || 0;
            state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
            state.hand.splice(pauseIdx, 1);
            state.discard.push(c);
            state.pauseHeld = true;
            telemetry.awkwardPauses = (telemetry.awkwardPauses || 0) + 1;
          }
        }
      }
    }

    // v2.52: DRUNKEN STAGGER skill play pass — jnsq lane only. Fires AFTER
    // staging so the tray is known. Conditions:
    //   - in hand AND affordable (cost 1)
    //   - NOT already staggerActive (no double-arming)
    //   - expected swing is meaningful: >= 5 unblocked OR raw atk >= 12
    //     (the spec line for chip-vs-burst — don't waste on trivial damage)
    // Heuristic: spec says "play when next enemy intent is attack/multi and
    // value is meaningful." Sim doesn't expose intent kind (composite swing
    // model), so we proxy with the unblocked-incoming projection.
    if (state.lane === 'jnsq' && !state.staggerActive) {
      const stagIdx = state.hand.findIndex(c => c.id === 'jv2-k-sorry-lost-balance');
      if (stagIdx >= 0) {
        const c = state.hand[stagIdx];
        if ((c.cost || 0) <= state.energy) {
          const eidSwing = expectedIntentDamage(state, enemy);
          const expectedSwing = eidSwing.hp + eidSwing.comp;
          const unblockedExpected = Math.max(0, eidSwing.hp - (state.block || 0)) + Math.max(0, eidSwing.comp - (state.poise || 0));
          const isMeaningful = unblockedExpected >= 5 || expectedSwing >= 12;
          if (isMeaningful) {
            state.energy -= c.cost || 0;
            state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
            state.hand.splice(stagIdx, 1);
            state.discard.push(c);
            state.staggerActive = true;
            telemetry.staggerPlays = (telemetry.staggerPlays || 0) + 1;
          }
        }
      }
    }

    // Cast if all three slots filled. v2.9: hard cap 1 cast per turn.
    // v2.49: BABBLING lifts the cap to 2 (the 2nd cast applies a 0.6×
    // scalar to the final damage; see the babbling block below).
    const maxCastsThisTurn = state.babblingInstalled ? 2 : 1;
    if (tray.intro && tray.subject && tray.target && castsThisTurn < maxCastsThisTurn) {
      const isSecondCast = castsThisTurn === 1; // v2.49: babbling 2nd cast flag
      castsThisTurn++;
      // v2.11: handler ALL IN heuristic. Stake to close the kill when
      // affordable; never stake at low HP or for overkill.
      let stake = 0;
      if (state.lane === 'handler' && state.hp >= 30) {
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
          // Default 1:1 stake multiplier; handler staking is best on
          // bigger gaps where the +damage actually closes the kill.
          stake = Math.min(Math.ceil(gap), max);
        }
        if (required > 0) stake = Math.max(stake, required);
        if (stake > max) stake = 0; // can't afford the requirement
      }
      // Apply stake HP cost up-front
      if (stake > 0) state.hp = Math.max(1, state.hp - stake);
      // v2.12: jnsq CHAOS DICE — roll if jnsq AND (not too low HP) OR if
      // staged cards force it.
      // v3.0 jnsq tuning: dropped opt-in rate from always-when-HP≥15
      // (~100%) to a context-aware ~70% per snapshot 5 ("Real jnsq
      // players gamble aggressively. Sim's ~100% is too eager."). Heuristic:
      //   - Always roll if a forceRoll modifier is staged (no choice)
      //   - Always roll if cast wouldn't kill anyway (chip-cast: variance
      //     is upside; backfire is acceptable cost)
      //   - Skip roll if cast would kill clean (no need to gamble)
      //   - At low HP (< 25%), skip roll — backfire is too dangerous
      //   - Else 70% opt-in (matches human snapshot 5)
      let chaosRoll = null;
      let chaosOutcome = null;
      const forceRoll = (tray.modifiers || []).some(m => m?.modifierEffect?.forceRoll) ||
                        tray.target.effect?.alwaysRolls === true;
      let willRoll = forceRoll;
      if (!willRoll && state.lane === 'jnsq') {
        // Predict pre-roll damage to decide whether to gamble.
        const preCtx = {
          stakeAmount: stake,
          loudCount: state.loudCount || 0,
          playerDmgMult: state.playerDmgMult || 1.0,
          enemyDmgMult: state.enemyDmgMult || 1.0,
          longThread: state.longThread || 0,
          combatTurn: state._combatTurn || 1,
          openingExtended: !!state.openingExtended,
          insultVulnerabilities: enemy?.insultVulnerabilities || [],
        };
        const preview = computeSpellDamage(tray.intro, tray.subject, tray.target, tray.modifiers, preCtx);
        const targetDmgType = tray.target.effect?.damageType || 'composure';
        const remaining = targetDmgType === 'physical' ? enemy.currentHp : enemy.currentComp;
        const wouldKill = preview.damage >= remaining;
        const hpFrac = state.maxHp > 0 ? state.hp / state.maxHp : 1;
        if (wouldKill) willRoll = false;            // don't gamble a kill
        else if (hpFrac < 0.25) willRoll = false;   // too risky at low HP
        else willRoll = rnd() < 0.70;               // 70% otherwise (human-aligned)
      }
      // Gate by requiresPriorRoll
      const requiredRoll = tray.target.effect?.requiresPriorRoll || 0;
      if (requiredRoll > 0 && !state.combatRolls.includes(requiredRoll)) {
        // Cast still happens — the sim doesn't gate here; the App does.
        // We model gate as "the AI wouldn't pick this target", but skip.
      }
      if (willRoll) {
        chaosRoll = rollChaosSim(tray.intro, tray.modifiers);
        // v2.90: backfire smoother — mirror of App.jsx. Third consecutive
        // 1 nudges to 2 (SPILLED IT). Telemetry: smoothedBackfires count.
        if (chaosRoll === 1 && (state.backfireStreak || 0) >= 2) {
          chaosRoll = 2;
          telemetry.smoothedBackfires = (telemetry.smoothedBackfires || 0) + 1;
        }
        state.backfireStreak = chaosRoll === 1 ? (state.backfireStreak || 0) + 1 : 0;
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
        insultVulnerabilities: enemy?.insultVulnerabilities || [], // v2.42
        pauseDoubled: !!state.pauseHeldActive, // v2.48
        isSecondCast, // v2.50: doubleOnSecondCast rider reads this flag
      };
      const result = computeSpellDamage(tray.intro, tray.subject, tray.target, tray.modifiers, simCtx);
      let dmg = result.damage;
      // v2.48: AWKWARD PAUSE — compute the doubling delta for telemetry by
      // re-running the formula WITHOUT the doubling. Single-use; clear the
      // flag once we've computed the bonus. Telemetry: doubledCasts and
      // doubledExtraDamage (raw damage delta, pre-enemy-effectiveness so
      // it's comparable across enemies).
      if (state.pauseHeldActive) {
        const singleResult = computeSpellDamage(tray.intro, tray.subject, tray.target, tray.modifiers, { ...simCtx, pauseDoubled: false });
        const pauseDelta = Math.max(0, result.damage - singleResult.damage);
        telemetry.doubledCasts = (telemetry.doubledCasts || 0) + 1;
        telemetry.doubledExtraDamage = (telemetry.doubledExtraDamage || 0) + pauseDelta;
        state.pauseHeldActive = false;
      }
      const eff = tray.target.effect || {};
      const stat = eff.scaleBy || tray.target.lane || 'wit';
      const dmgType = eff.damageType || 'composure';
      // v2.93: O-4 (Find the Seam) — ignore enemy effectiveness for one cast.
      const baseMult = (dmgType === 'physical')
        ? (enemy.effectiveness?.physical ?? 1.0)
        : (enemy.effectiveness?.[stat] ?? 1.0);
      const seamBypass = !!state.nextCastBypassEff;
      if (seamBypass) {
        state.nextCastBypassEff = false;
        telemetry.passingThoughtSeamFires = (telemetry.passingThoughtSeamFires || 0) + 1;
      }
      const mult = seamBypass ? 1.0 : baseMult;
      dmg = Math.round(dmg * mult * state.playerDmgMult);
      // v2.93: O-1 (Precedent) — add lastCastDamage as bonus.
      if (state.nextCastBonusEqualsLast) {
        dmg += (state.lastCastDamage || 0);
        state.nextCastBonusEqualsLast = false;
        telemetry.passingThoughtPrecedentFires = (telemetry.passingThoughtPrecedentFires || 0) + 1;
      }
      // v2.93: O-5 (Adding Insult to Injury) — next cast ×1.5.
      if (state.nextCastDamageMult && state.nextCastDamageMult !== 1.0) {
        dmg = Math.round(dmg * state.nextCastDamageMult);
        state.nextCastDamageMult = 1.0;
        telemetry.passingThoughtInsultFires = (telemetry.passingThoughtInsultFires || 0) + 1;
      }
      // v2.47: DRUNKEN CONFIDENCE — +50% on every Effect/Spell cast while
      // installed. Applied AFTER playerDmgMult so it composes with Vuln/Weak.
      if (state.drunkenInstalled) {
        const preDrunk = dmg;
        // v3.1.4: 1.5 → 1.35 to match App-side nerf.
        dmg = Math.round(dmg * 1.35);
        telemetry.drunkenCastBonus = (telemetry.drunkenCastBonus || 0) + (dmg - preDrunk);
        telemetry.drunkenCasts = (telemetry.drunkenCasts || 0) + 1;
      }
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
        const patBonus = state.patienceStacks * 4; // v3.0 cycle 3: 2 → 4
        dmg += patBonus;
        telemetry.patienceDamageBonus = (telemetry.patienceDamageBonus || 0) + patBonus;
        telemetry.patienceCasts = (telemetry.patienceCasts || 0) + 1;
        state.patienceStacks = 0;
      }

      // v2.49: BABBLING — 2nd cast scales final damage by 0.6×. Applied
      // last so it composes after all bonuses (drunken, patience, riders,
      // chaos, opening). Telemetry captures the post-scale damage value.
      if (isSecondCast) {
        // v3.0 cycle 4: Babbling Power installed → 0.85× instead of 0.6×.
        const babblingActive = state.powers?.some(p => p.installPower?.id === 'babbling' || p.id === 'jv2-p-wait-and-another-thing');
        dmg = Math.round(dmg * (babblingActive ? 0.85 : 0.6));
        telemetry.babblingSecondCasts = (telemetry.babblingSecondCasts || 0) + 1;
        telemetry.babblingSecondCastDamage = (telemetry.babblingSecondCastDamage || 0) + dmg;
        // v2.50: getting-away-from-me — count the cast AND the doubled fire.
        if (tray.target?.id === 'jv2-t-getting-away-from-me') {
          telemetry.gettingAwayCasts = (telemetry.gettingAwayCasts || 0) + 1;
          if (tray.target.effect?.doubleOnSecondCast) {
            telemetry.gettingAwayDoubled = (telemetry.gettingAwayDoubled || 0) + 1;
          }
        }
      } else if (tray.target?.id === 'jv2-t-getting-away-from-me') {
        // v2.50: cast as 1st cast — no double, but still track the cast count.
        telemetry.gettingAwayCasts = (telemetry.gettingAwayCasts || 0) + 1;
      }
      // Strip enemy block from modifier
      if (result.sideEffects.stripBlock) {
        enemy.block = Math.max(0, enemy.block - result.sideEffects.stripBlock);
      }
      // v3.2: FULLY FORMED THOUGHT mirror — see castV2SentenceSpell in App.jsx.
      // Damage-mutating rider keys (damageMult, bonus) apply BEFORE the block
      // pass; state-setting keys apply after damage routing below.
      const fftResult = detectFFT(tray.intro, tray.subject, tray.target);
      if (fftResult.fft) {
        const rider = fftResult.fft.rider || {};
        if (rider.damageMult) dmg = Math.round(dmg * rider.damageMult);
        if (rider.bonus)      dmg += rider.bonus;
        // v3.3 Crescendo consumeBank — applies pre-damage. (Legacy key,
        // retained for safety; new design uses consumeBankFlat below.)
        if (rider.consumeBank && (state.wordsBank || 0) > 0) {
          dmg += state.wordsBank * rider.consumeBank;
          state.wordsBank = 0;
        }
        // v3.4.42 — Crescendo consumeBankFlat: consume entire bank for
        // Bank × N flat damage. Applied as bonus damage (will route
        // through normal damage type / block handling).
        if (rider.consumeBankFlat && (state.wordsBank || 0) > 0) {
          dmg += state.wordsBank * rider.consumeBankFlat;
          telemetry.crescendoFlatDamage = (telemetry.crescendoFlatDamage || 0) + state.wordsBank * rider.consumeBankFlat;
          state.wordsBank = 0;
        }
        // v3.4.42 — Crescendo doubleBankNow (Delivered): immediate ×2.
        if (rider.doubleBankNow) {
          state.wordsBank = Math.min(40, (state.wordsBank || 0) * 2);
        }
        telemetry.fftCasts = (telemetry.fftCasts || 0) + 1;
        telemetry.fftDamage = (telemetry.fftDamage || 0) + dmg;
      } else if (fftResult.partialRow) {
        telemetry.fftPartialCasts = (telemetry.fftPartialCasts || 0) + 1;
      } else if (fftResult.schoolId) {
        telemetry.fftSameSchoolCasts = (telemetry.fftSameSchoolCasts || 0) + 1;
      }
      // v2.93: O-1 support — capture this cast's pre-block damage as
      // lastCastDamage so the NEXT Precedent cast has something to mirror.
      // v3.4.x — Slow Burn targets DEPOSIT DoT (mirror App.jsx).
      // No upfront damage; cast pushes per-turn × turns into enemy.dot.
      if (tray.target.schoolId === 'slowburn') {
        const statWit = (tray.intro?.stats?.wit || 0) + (tray.subject?.stats?.wit || 0);
        const perTurn = Math.max(1, (tray.target.effect?.base || 0) + statWit);
        const turns = tray.target.effect?.multiplier || 1;
        if (!enemy.dot) enemy.dot = { damage: 0, turnsRemaining: 0 };
        enemy.dot.damage += perTurn;
        enemy.dot.turnsRemaining += turns;
        telemetry.fftDotDepositDamage = (telemetry.fftDotDepositDamage || 0) + (perTurn * turns);
        dmg = 0; // suppress direct damage application
      }
      state.lastCastDamage = dmg;
      // v3.4.34 cycle 1 — Thorns school casts (damageType: 'block') route the
      // cast number to player block, not enemy damage. Mirrors App.jsx.
      if (dmgType === 'block') {
        state.block = (state.block || 0) + dmg;
        telemetry.thornsCastBlockGranted = (telemetry.thornsCastBlockGranted || 0) + dmg;
      } else {
        let remaining = dmg;
        if (enemy.block > 0) {
          const absorbed = Math.min(enemy.block, remaining);
          enemy.block -= absorbed; remaining -= absorbed;
        }
        if (dmgType === 'physical') enemy.currentHp = Math.max(0, enemy.currentHp - remaining);
        else                        enemy.currentComp = Math.max(0, enemy.currentComp - remaining);
      }
      // v2.93: O-6 (The Doubletake) — apply the same damage a second time.
      // Block was consumed on the first pass, so the doubled hit is mostly
      // full damage. Flag is one-shot.
      if (state.nextCastDoubles && dmg > 0) {
        state.nextCastDoubles = false;
        let r2 = dmg;
        if (enemy.block > 0) {
          const absorbed2 = Math.min(enemy.block, r2);
          enemy.block -= absorbed2; r2 -= absorbed2;
        }
        if (dmgType === 'physical') enemy.currentHp = Math.max(0, enemy.currentHp - r2);
        else                        enemy.currentComp = Math.max(0, enemy.currentComp - r2);
        telemetry.passingThoughtDoubletakeFires = (telemetry.passingThoughtDoubletakeFires || 0) + 1;
      }
      // v3.2/v3.3: post-damage FFT/partial/tier rider state effects.
      // Mirrors App.jsx applyRider — unified scheduled-effects queue.
      const applyRiderSim = (rider) => {
        if (!rider) return;
        if (rider.longThreadPerm) state.longThread = (state.longThread || 0) + rider.longThreadPerm;
        if (rider.composure)      state.composure = Math.min(state.composureMax || 30, (state.composure || 0) + rider.composure);
        if (rider.block)          state.block = (state.block || 0) + rider.block;
        if (rider.energy)         state.energy = (state.energy || 0) + rider.energy;
        if (rider.draw)           drawCards(state, rider.draw);
        if (rider.poise)          state.poise = (state.poise || 0) + rider.poise;
        if (!state.scheduledEffects) state.scheduledEffects = [];
        // v3.4.18 (Alan): DoT spells STACK additively onto existing DoT.
        // Wave-and-sum onto enemy.dot.schedule; dot.damage = schedule[0].
        const addDotWaveSim = (wave) => {
          if (!wave || wave.length === 0) return;
          const cur = enemy.dot;
          const existing = (cur && Array.isArray(cur.schedule))
            ? cur.schedule.slice()
            : (cur && (cur.damage || 0) > 0 && (cur.turnsRemaining || 0) > 0)
              ? new Array(cur.turnsRemaining).fill(cur.damage)
              : [];
          const len = Math.max(existing.length, wave.length);
          const merged = new Array(len);
          for (let i = 0; i < len; i++) merged[i] = (existing[i] || 0) + (wave[i] || 0);
          while (merged.length > 0 && (merged[merged.length - 1] || 0) <= 0) merged.pop();
          if (merged.length === 0) { enemy.dot = null; return; }
          enemy.dot = { damage: merged[0], turnsRemaining: merged.length, schedule: merged };
        };
        if (rider.setDotMinDamage && rider.setDotMinTurns) {
          addDotWaveSim(new Array(rider.setDotMinTurns).fill(rider.setDotMinDamage));
        } else if (rider.setDotMinDamage) {
          addDotWaveSim([rider.setDotMinDamage]);
        }
        if (Array.isArray(rider.setDotSchedule) && rider.setDotSchedule.length > 0) {
          addDotWaveSim(rider.setDotSchedule.slice());
        }
        if (rider.addDotDamage && enemy.dot) {
          enemy.dot.damage = (enemy.dot.damage || 0) + rider.addDotDamage;
          if (Array.isArray(enemy.dot.schedule)) {
            enemy.dot.schedule = enemy.dot.schedule.map(v => (v || 0) + rider.addDotDamage);
          }
          if (enemy.dot.turnsRemaining < 1) enemy.dot.turnsRemaining = 1;
        }
        if (rider.addDotTurns && enemy.dot) {
          if (Array.isArray(enemy.dot.schedule)) {
            const fill = enemy.dot.schedule[enemy.dot.schedule.length - 1] || enemy.dot.damage || 0;
            enemy.dot.schedule = [...enemy.dot.schedule, ...new Array(rider.addDotTurns).fill(fill)];
          }
          enemy.dot.turnsRemaining += rider.addDotTurns;
        }
        if (rider.dotMultiply && enemy.dot) {
          enemy.dot.damage = Math.round((enemy.dot.damage || 0) * rider.dotMultiply);
          if (Array.isArray(enemy.dot.schedule)) {
            enemy.dot.schedule = enemy.dot.schedule.map(v => Math.round((v || 0) * rider.dotMultiply));
          }
        }
        if (rider.dotConsumeBig && enemy.dot && enemy.dot.turnsRemaining > 0) {
          const total = Array.isArray(enemy.dot.schedule)
            ? enemy.dot.schedule.reduce((s, v) => s + (v || 0), 0)
            : (enemy.dot.damage || 0) * enemy.dot.turnsRemaining;
          enemy.currentComp = Math.max(0, enemy.currentComp - total);
          enemy.dot = null;
          telemetry.fftDotConsumeBigDamage = (telemetry.fftDotConsumeBigDamage || 0) + total;
        }
        if (rider.enemyWeakPerTurn) state.scheduledEffects.push({ trigger: 'enemy-turn-start', kind: 'weak',   amount: rider.enemyWeakPerTurn.amount, turnsRemaining: rider.enemyWeakPerTurn.turns });
        if (rider.enemyVulnPerTurn) state.scheduledEffects.push({ trigger: 'enemy-turn-start', kind: 'vuln',   amount: rider.enemyVulnPerTurn.amount, turnsRemaining: rider.enemyVulnPerTurn.turns });
        if (rider.dormantDamage)    state.scheduledEffects.push({ trigger: 'enemy-turn-start', kind: 'dormantDamage', amount: rider.dormantDamage.amount, turnsRemaining: rider.dormantDamage.delay });
        if (rider.selfBlockPerTurn) state.scheduledEffects.push({ trigger: 'player-turn-start', kind: 'block', amount: rider.selfBlockPerTurn.amount, turnsRemaining: rider.selfBlockPerTurn.turns });
        if (rider.selfDrawPerTurn)  state.scheduledEffects.push({ trigger: 'player-turn-start', kind: 'draw',  amount: rider.selfDrawPerTurn.amount, turnsRemaining: rider.selfDrawPerTurn.turns });
        // v3.4.36 cycle 4 — remaining Thorns riders mirrored from App.jsx applyRider.
        // Without these the Thorns school was inert in sim (block-only).
        if (rider.selfPoisePerTurn) state.scheduledEffects.push({ trigger: 'player-turn-start', kind: 'poise', amount: rider.selfPoisePerTurn.amount, turnsRemaining: rider.selfPoisePerTurn.turns });
        if (rider.selfHpRegenPerTurn) state.scheduledEffects.push({ trigger: 'player-turn-start', kind: 'hpRegen', amount: rider.selfHpRegenPerTurn.amount, turnsRemaining: rider.selfHpRegenPerTurn.turns });
        if (rider.selfThornsPerTurn) {
          if (!state.thornsCharges) state.thornsCharges = { amount: 0, count: 0, weakOnReflect: 0, turnsRemaining: 0 };
          state.thornsCharges.amount = Math.max(state.thornsCharges.amount, rider.selfThornsPerTurn.amount);
          state.thornsCharges.turnsRemaining = Math.max(state.thornsCharges.turnsRemaining || 0, rider.selfThornsPerTurn.turns);
        }
        if (rider.selfThornsSchedule && Array.isArray(rider.selfThornsSchedule)) {
          if (!state.thornsCharges) state.thornsCharges = { amount: 0, count: 0, weakOnReflect: 0, turnsRemaining: 0 };
          state.thornsCharges.schedule = [...rider.selfThornsSchedule];
          state.thornsCharges.turnsRemaining = Math.max(state.thornsCharges.turnsRemaining || 0, rider.selfThornsSchedule.length);
        }
        if (rider.stripEnemyBlockPerTurn) state.scheduledEffects.push({ trigger: 'player-turn-start', kind: 'stripEnemyBlock', amount: rider.stripEnemyBlockPerTurn.amount, turnsRemaining: rider.stripEnemyBlockPerTurn.turns });
        if (rider.bankDoublePerTurn) state.scheduledEffects.push({ trigger: 'enemy-turn-start', kind: 'bankDouble', amount: 0, turnsRemaining: rider.bankDoublePerTurn.turns });
        if (rider.thorns) {
          if (!state.thornsCharges) state.thornsCharges = { amount: 0, count: 0, weakOnReflect: 0 };
          state.thornsCharges.amount = Math.max(state.thornsCharges.amount, rider.thorns.amount);
          state.thornsCharges.count += rider.thorns.count;
          state.thornsCharges.weakOnReflect = Math.max(state.thornsCharges.weakOnReflect || 0, rider.thorns.weakOnReflect || 0);
        }
        if (rider.stripEnemyBlock)  enemy.block = Math.max(0, (enemy.block || 0) - rider.stripEnemyBlock);
        if (rider.forceSkipNextAttack) state.enemySkipNextAttack = true;
        if (rider.addBank)          state.wordsBank = (state.wordsBank || 0) + rider.addBank;
        // v3.4.42 — Thorns/Crescendo redesign rider parsing.
        if (rider.mirrorReflectCharges) {
          state.mirrorReflectCharges = state.mirrorReflectCharges || { count: 0, capPerHit: 0 };
          state.mirrorReflectCharges.count += (rider.mirrorReflectCharges.count || 0);
          state.mirrorReflectCharges.capPerHit = Math.max(state.mirrorReflectCharges.capPerHit, rider.mirrorReflectCharges.capPerHit || 999);
        }
        if (rider.skipAndReturnNext) {
          state.enemySkipNextAttack = true;
          state.skipAndReturnArmed = true;
        }
        if (rider.bankAuraDoublePerTurn) {
          state.scheduledEffects = state.scheduledEffects || [];
          state.scheduledEffects.push({
            trigger: 'enemy-turn-start',
            kind: 'bankAuraDouble',
            amount: 0,
            turnsRemaining: rider.bankAuraDoublePerTurn.turns,
          });
        }
      };
      if (fftResult.fft) {
        applyRiderSim(fftResult.fft.rider);
      } else if (fftResult.partialRow) {
        applyRiderSim(WIT_PARTIAL_ROW_BONUSES[fftResult.partialRow.schoolId]);
      } else if (fftResult.schoolId) {
        applyRiderSim(WIT_SAME_SCHOOL_BONUSES[fftResult.schoolId]);
      }
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

      // v2.25: DOUBLING DOWN — bank a corner token when a handler
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

      // v2.46: WON'T SHUT UP — arm the commitment flag if the resolved
      // target carries `mustPlayAnotherJnsq`. Cleared by any subsequent
      // jnsq-lane play this turn (see the post-cast follow-up pass below);
      // unpaid bills hit at end of turn for 3 HP.
      if (tray.target?.effect?.mustPlayAnotherJnsq) {
        state.wontShutUpArmed = true;
        telemetry.wontShutUpArmed = (telemetry.wontShutUpArmed || 0) + 1;
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
      // conclusion." Mirrors the handler capstone telemetry. Counts every
      // resolved cast where the in-summary target landed plus the total
      // damage. The three riders (threadScaling, openingBonus, delayedMisstep)
      // tick their own existing telemetry (threadBonus rolled into footnote
      // / spell bonuses; missTepCasts via the delayedMisstep block below).
      if (tray.target?.id === 'wv2-t-in-summary') {
        telemetry.inSummaryCasts = (telemetry.inSummaryCasts || 0) + 1;
        telemetry.inSummaryTotalDamage = (telemetry.inSummaryTotalDamage || 0) + dmg;
      }
      // v2.51: jnsq SYNERGY CAPSTONE — "universe sideways." Counts every
      // resolved cast and the total damage. Three riders share existing
      // wiring: mustPlayAnotherJnsq → state.wontShutUpArmed (above), per-
      // TagBonus → baked into result.damage via shared.js, tangentOnCast
      // → fires the Tangent dispatcher below AS PART OF this resolve.
      if (tray.target?.id === 'jv2-t-universe-sideways') {
        telemetry.universeSidewaysCasts = (telemetry.universeSidewaysCasts || 0) + 1;
        telemetry.universeSidewaysTotalDamage = (telemetry.universeSidewaysTotalDamage || 0) + dmg;
      }
      // v2.51: TANGENT-ON-CAST rider — fire the v2.44 Tangent dispatcher
      // (random jnsq from discard → stage/cast). Reuses resolveTangentSim
      // (defined ~line 1001 in this turn-loop) so the surfaced-card pipeline
      // matches the "That reminds me," skill exactly. Caveat: the tray is
      // about to be cleared by the cast resolution (line ~1783), so a
      // surfaced target falls into the no-intro/subject branch and fizzles
      // back to discard — chaos by design. Word surfacing stages for next
      // turn; the per-turn cast cap stops a 2nd cast this turn regardless.
      if (tray.target?.effect?.tangentOnCast) {
        telemetry.tangentOnCastFires = (telemetry.tangentOnCastFires || 0) + 1;
        // Step 1: discard random from draw.
        if (state.deck.length > 0) {
          const ridx = Math.floor(rnd() * state.deck.length);
          const lost = state.deck[ridx];
          state.deck.splice(ridx, 1);
          state.discard.push(lost);
        }
        // Step 2 + 3: pull a random jnsq card from discard and resolve.
        // Discard at this point still contains every staged-and-cast card
        // EXCEPT the universe-sideways target itself (still in `tray.target`
        // — discharged below at line 1662). That's fine: a wider pool is a
        // chaos feature, not a bug.
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

    // v2.49: BABBLING 2nd-cast restage. If babbling is installed AND the
    // first cast fired AND we still have energy + a remaining intro+subject
    // +target chain in hand, run a compact staging pass and fire a 2nd cast.
    // Cheap-and-restricted: only stages the three required slots (no
    // modifier optimization, no defensive plays — those already fired in the
    // first pass). The 0.6× scalar lands in the existing cast block via
    // `isSecondCast = castsThisTurn === 1`.
    if (state.babblingInstalled && castsThisTurn === 1 && state.energy >= 2) {
      // Minimal stage: pick cheapest intro, subject, target that fit our
      // remaining energy budget. Skip if we can't afford the chain.
      const introIdx = state.hand.findIndex(c => c.slot === 'intro' && c.lane === 'jnsq' && (c.cost || 0) <= state.energy);
      if (introIdx >= 0) {
        const intro = state.hand[introIdx];
        const subjEnergy = state.energy - (intro.cost || 0);
        const subjIdx = state.hand.findIndex((c, i) => i !== introIdx && c.slot === 'subject' && c.lane === 'jnsq' && (c.cost || 0) <= subjEnergy);
        if (subjIdx >= 0) {
          const subject = state.hand[subjIdx];
          const tgtEnergy = subjEnergy - (subject.cost || 0);
          // Pick cheapest target (no fancy heuristic — the 0.6× scalar
          // already gates the gambit; AI shouldn't burn high-cost targets
          // on 2nd casts where they only deliver 60% value).
          // v2.50: PREFER the rare "getting away from me" target as cast #2
          // when its mustPlayAnotherJnsq follow-up gate can be satisfied — i.e.
          // there's another jnsq-lane card in the hand (excluding the intro,
          // subject, and the target itself) that the player could legally
          // play to clear the wont-shut-up flag. Doubling on cast #2 net 1.2×
          // a first-cast baseline — meaningfully ahead of a baseline target
          // taking the 0.6× scalar uncompensated.
          let tgtIdx = -1;
          let tgtCost = Infinity;
          let gettingAwayIdx = -1;
          for (let i = 0; i < state.hand.length; i++) {
            if (i === introIdx || i === subjIdx) continue;
            const c = state.hand[i];
            if (c.slot !== 'target' || c.lane !== 'jnsq') continue;
            if ((c.cost || 0) > tgtEnergy) continue;
            if (c.id === 'jv2-t-getting-away-from-me') {
              // v2.53: loosened gate. The rare's mustPlayAnotherJnsq is
              // armed AFTER the 2nd-cast (see post-restage block below); the
              // post-cast wontShutUp follow-up pass at ~line 2094 then tries
              // ANY remaining jnsq card. We only need to know one exists in
              // hand — cost doesn't matter because the followup pass also
              // gets remaining energy. Even if it can't clear, the -3 HP
              // bill is usually a worthwhile trade for the 2× × 0.6× = 1.2×
              // damage multiplier on a tier-3 rare. ALSO drop the strict
              // "must have follow-up" — if no jnsq card is around, the bill
              // is still cheap relative to the cast payoff (rare's base 9
              // × jnsq comp × 1.2 > 3 HP value most of the time).
              gettingAwayIdx = i;
              continue; // skip the cheapest-cost branch — rare gets explicit pick
            }
            if ((c.cost || 0) < tgtCost) {
              tgtIdx = i; tgtCost = c.cost || 0;
            }
          }
          if (gettingAwayIdx >= 0) tgtIdx = gettingAwayIdx;
          if (tgtIdx >= 0) {
            const target = state.hand[tgtIdx];
            // Commit: pay all three costs, place into tray, splice out of hand
            // in descending-index order so splice doesn't shift later indices.
            const indices = [introIdx, subjIdx, tgtIdx].sort((a, b) => b - a);
            state.energy -= (intro.cost || 0) + (subject.cost || 0) + (target.cost || 0);
            state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
            for (const i of indices) state.hand.splice(i, 1);
            tray = { intro, subject, target, modifiers: [] };
            // Direct cast — reuse the same damage pipeline by setting a flag
            // for the cast block. The simplest path is to set a re-entry
            // marker and let a small inline cast resolve the damage. Since
            // the cast block above is huge, we inline a compact version:
            const isSecondCast = true;
            castsThisTurn++;
            const simCtx2 = {
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
              pauseDoubled: false, // already cashed in on cast 1 if armed
              isSecondCast: true, // v2.50: doubleOnSecondCast rider fires here
            };
            const result2 = computeSpellDamage(tray.intro, tray.subject, tray.target, tray.modifiers, simCtx2);
            let dmg2 = result2.damage;
            const stat2 = tray.target.effect?.scaleBy || tray.target.lane || 'jnsq';
            const dmgType2 = tray.target.effect?.damageType || 'composure';
            const mult2 = (dmgType2 === 'physical')
              ? (enemy.effectiveness?.physical ?? 1.0)
              : (enemy.effectiveness?.[stat2] ?? 1.0);
            dmg2 = Math.round(dmg2 * mult2 * (state.playerDmgMult || 1.0));
            if (state.drunkenInstalled) {
              const preDrunk2 = dmg2;
              dmg2 = Math.round(dmg2 * 1.5);
              telemetry.drunkenCastBonus = (telemetry.drunkenCastBonus || 0) + (dmg2 - preDrunk2);
              telemetry.drunkenCasts = (telemetry.drunkenCasts || 0) + 1;
            }
            // Babbling 0.6× scalar
            dmg2 = Math.round(dmg2 * 0.6);
            telemetry.babblingSecondCasts = (telemetry.babblingSecondCasts || 0) + 1;
            telemetry.babblingSecondCastDamage = (telemetry.babblingSecondCastDamage || 0) + dmg2;
            // v2.50: getting-away-from-me — restage path always fires this as
            // the 2nd cast, so when the rare lands here it's always doubled.
            if (tray.target?.id === 'jv2-t-getting-away-from-me') {
              telemetry.gettingAwayCasts = (telemetry.gettingAwayCasts || 0) + 1;
              if (tray.target.effect?.doubleOnSecondCast) {
                telemetry.gettingAwayDoubled = (telemetry.gettingAwayDoubled || 0) + 1;
              }
            }
            // v2.53: arm wontShutUpArmed if the 2nd-cast target carries
            // mustPlayAnotherJnsq, mirroring the main cast path. Previously
            // the 2nd-cast inline block skipped this, which let the rare
            // "Getting Away" target cheese its commitment. The post-cast
            // followup pass at ~line 2094 will clear it if a jnsq card is
            // affordable; otherwise -3 HP bill at end of turn.
            if (tray.target?.effect?.mustPlayAnotherJnsq) {
              state.wontShutUpArmed = true;
              telemetry.wontShutUpArmed = (telemetry.wontShutUpArmed || 0) + 1;
            }
            // Apply through enemy block.
            if (result2.sideEffects.stripBlock) {
              enemy.block = Math.max(0, enemy.block - result2.sideEffects.stripBlock);
            }
            let remaining2 = dmg2;
            if (enemy.block > 0) {
              const absorbed2 = Math.min(enemy.block, remaining2);
              enemy.block -= absorbed2; remaining2 -= absorbed2;
            }
            if (dmgType2 === 'physical') enemy.currentHp = Math.max(0, enemy.currentHp - remaining2);
            else                         enemy.currentComp = Math.max(0, enemy.currentComp - remaining2);
            // Riders.
            if (result2.riders.weak)       state.enemyDmgMult = Math.max(0.5, (state.enemyDmgMult || 1) - 0.25 * result2.riders.weak);
            if (result2.riders.vulnerable) state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * result2.riders.vulnerable);
            if (result2.riders.block)      state.block += result2.riders.block;
            if (result2.sideEffects.drawCount) drawCards(state, result2.sideEffects.drawCount);
            // Discharge: intro/subject/modifiers → discard; target → discard.
            state.discard.push(tray.intro, tray.subject, ...tray.modifiers);
            state.discard.push(tray.target);
            // Telemetry parity with first cast.
            telemetry.castsAttempted++;
            telemetry.totalDamageDealt += dmg2;
            if (result2.tier === 3) telemetry.tier3Casts++;
            if (result2.tier === 2) telemetry.tier2Casts++;
            if (result2.tier === 1) telemetry.tier1Casts++;
            tray = { intro: null, subject: null, target: null, modifiers: [] };
            cast = true;
          }
        }
      }
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
        state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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

    // v2.46: WON'T SHUT UP follow-up pass. If the cast just armed the
    // commitment flag, find ANY affordable jnsq-lane card in hand and play
    // it to clear the flag. Preference order: cheapest skill (apology /
    // tangent / etc — pure tempo) → cheapest word (stages into empty tray
    // toward a possible next-turn cast) → modifier (fizzles into empty
    // tray since cast already fired, but still discharges via stage path).
    // Each clear is a "dodge"; if no card fits, the end-of-turn bill (-3 HP)
    // catches it. The pre-cast AI gate (pickBestForSlotRageAware) ensures a
    // follow-up was reserved, so dodges should outnumber damages.
    if (state.lane === 'jnsq' && state.wontShutUpArmed) {
      const followUpIdxs = [];
      for (let i = 0; i < state.hand.length; i++) {
        const fc = state.hand[i];
        if (fc.lane !== 'jnsq') continue;
        if ((fc.cost || 0) > state.energy) continue;
        // v3.0 cycle 4: tighten follow-up — target or tier-2+ only.
        // App.jsx mirror: cheap basic jnsq words no longer count.
        const qualifies = fc.slot === 'target' || fc.type === 'effect' || (fc.tier || 1) >= 2;
        if (!qualifies) continue;
        followUpIdxs.push({ i, cost: fc.cost || 0, slot: fc.slot, type: fc.type });
      }
      if (followUpIdxs.length > 0) {
        // Sort by cost asc, then prefer skill > word > modifier > target
        // (we want a clean dodge — skills resolve cleanest after cast).
        const slotPriority = { skill: 0, intro: 1, subject: 1, modifier: 2, target: 3 };
        followUpIdxs.sort((a, b) =>
          a.cost - b.cost
          || (slotPriority[a.type === 'skill' ? 'skill' : a.slot] ?? 9)
             - (slotPriority[b.type === 'skill' ? 'skill' : b.slot] ?? 9)
        );
        const pick = followUpIdxs[0];
        const fc = state.hand[pick.i];
        state.energy -= fc.cost || 0;
        state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
        state.hand.splice(pick.i, 1);
        // Route by shape — simplest path: stage if word, discard if skill,
        // discard if modifier-into-empty-tray (no slot to fill post-cast),
        // discard if target-into-empty-tray (no intro/subject staged).
        if (fc.slot === 'intro' || fc.slot === 'subject') {
          if (tray[fc.slot]) state.hand.push(tray[fc.slot]); // refund displaced
          tray[fc.slot] = fc;
        } else if (fc.slot === 'modifier') {
          if (tray.modifiers.length >= 2) {
            state.hand.push(tray.modifiers[0]);
            tray.modifiers = [...tray.modifiers.slice(1), fc];
          } else {
            tray.modifiers.push(fc);
          }
        } else {
          // Skill, target-into-empty, or anything else — straight to discard.
          state.discard.push(fc);
        }
        state.wontShutUpArmed = false;
        telemetry.wontShutUpDodges = (telemetry.wontShutUpDodges || 0) + 1;
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
        const eidSwing = expectedIntentDamage(state, enemy);
        const expectedSwing = eidSwing.hp + eidSwing.comp;
        const unblockedExpected = Math.max(0, eidSwing.hp - (state.block || 0)) + Math.max(0, eidSwing.comp - (state.poise || 0));
        const tougher = (enemy.tier === 'boss' || enemy.tier === 'elite');
        const worthPlaying = (
          (lt >= 2 && expectedSwing > 0) ||
          (lt >= 1 && unblockedExpected >= 2) ||
          (lt >= 1 && tougher && unblockedExpected >= 4)
        ) && (c.cost || 0) <= state.energy;
        if (worthPlaying) {
          state.energy -= c.cost || 0;
          state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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
    // v2.46: WON'T SHUT UP billing. Still armed at end of turn → eat 3
    // unblocked HP. The follow-up pass above will have cleared the flag
    // if a jnsq card was available. Fires BEFORE the enemy turn for the
    // same reason as corner-tokens (stacking risk is intended).
    if (state.wontShutUpArmed) {
      state.hp = Math.max(0, state.hp - 3);
      telemetry.wontShutUpDamage = (telemetry.wontShutUpDamage || 0) + 1;
      state.wontShutUpArmed = false;
      if (state.hp <= 0) {
        flushThreadPeak();
        return { outcome: 'lost', turns, killedBy: 'wontShutUp', telemetry };
      }
    }

    // Weave debt resolution (wit/jnsq) — fires at the END of the player turn.
    // Stacks were applied by a Hollow-Weaver-style 'weave' intent on the
    // PREVIOUS enemy turn. Lane-agnostic rule (Alan, 2026-06-02): the weave
    // fires unless the player dealt damage to the enemy this turn. For
    // wit/jnsq a resolved cast is the damage source, so castsThisTurn > 0 is
    // the proxy here (the AI only casts to hurt the enemy). The Handler runs
    // its own combat path with a damage-delta check. Mirrors App.jsx endTurn.
    state.castedThisTurn = castsThisTurn > 0;
    if ((state.weaveStacks || 0) > 0) {
      if (!state.castedThisTurn) {
        const dmg = state.weaveStacks;
        state.composure = Math.max(0, state.composure - dmg);
        telemetry.weaveDamage = (telemetry.weaveDamage || 0) + dmg;
        if (state.composure <= 0) {
          flushThreadPeak();
          return { outcome: 'lost', turns, killedBy: 'weave', telemetry };
        }
      }
      state.weaveStacks = 0;
    }

    // Enemy turn
    // v3.4 Poison-style DoT tick (single counter on enemy.dot).
    // v3.4.17 — schedule-driven tick consumes schedule[0] then shifts.
    if (enemy.dot && enemy.dot.turnsRemaining > 0) {
      const sched = Array.isArray(enemy.dot.schedule) ? enemy.dot.schedule : null;
      const tickDmg = sched && sched.length > 0 ? sched[0] : enemy.dot.damage;
      if (tickDmg > 0) {
        enemy.currentComp = Math.max(0, enemy.currentComp - tickDmg);
        telemetry.fftDotTickDamage = (telemetry.fftDotTickDamage || 0) + tickDmg;
      }
      enemy.dot.turnsRemaining -= 1;
      if (sched) {
        enemy.dot.schedule = sched.slice(1);
        enemy.dot.damage = enemy.dot.schedule.length > 0 ? enemy.dot.schedule[0] : enemy.dot.damage;
      }
      if (enemy.dot.turnsRemaining <= 0) enemy.dot = null;
      if (enemy.currentComp <= 0) {
        flushThreadPeak();
        return { outcome: 'won', turns, telemetry };
      }
    }
    // v3.3 scheduled-effects tick (non-DoT over-time effects).
    if (state.scheduledEffects && state.scheduledEffects.length > 0) {
      const remaining = [];
      let weakStacks = 0, vulnStacks = 0, dormantBurst = 0, bankDoubled = false;
      for (const eff of state.scheduledEffects) {
        if (eff.trigger !== 'enemy-turn-start') {
          remaining.push(eff);
          continue;
        }
        if (eff.kind === 'weak')   weakStacks += eff.amount;
        else if (eff.kind === 'vuln')   vulnStacks += eff.amount;
        else if (eff.kind === 'bankDouble') bankDoubled = true;
        else if (eff.kind === 'dormantDamage' && eff.turnsRemaining <= 1) dormantBurst += eff.amount;
        if (eff.turnsRemaining > 1) remaining.push({ ...eff, turnsRemaining: eff.turnsRemaining - 1 });
      }
      if (dormantBurst > 0) {
        enemy.currentComp = Math.max(0, enemy.currentComp - dormantBurst);
        telemetry.fftDormantDamage = (telemetry.fftDormantDamage || 0) + dormantBurst;
      }
      if (weakStacks > 0) state.enemyDmgMult = Math.max(0.5, (state.enemyDmgMult || 1) - 0.25 * weakStacks);
      if (vulnStacks > 0) state.playerDmgMult = Math.min(1.5, (state.playerDmgMult || 1) + 0.25 * vulnStacks);
      if (bankDoubled)    state.wordsBank = Math.min(40, (state.wordsBank || 0) * 2);
      state.scheduledEffects = remaining;
      if (enemy.currentComp <= 0) {
        flushThreadPeak();
        return { outcome: 'won', turns, telemetry };
      }
    }
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
    // === INTENT RESOLUTION (v3.5 — full port from App.jsx applyEnemyIntent) ===
    // The enemy acts on the intent it telegraphed last turn (state.enemyIntent,
    // rolled at the end of the previous enemy turn / at combat start). Attack
    // and attack-multi feed the `incoming` damage pipeline below; block / weak /
    // vulnerable / weave / discard-hand resolve here. Riders attached to the
    // intent apply after the attack lands (see end of enemy turn). A fresh
    // intent is rolled (with anti-repeat) at the end of this turn.
    const intent = state.enemyIntent;
    let intentIncoming = 0;
    let intentTargetsComposure = false;
    // Reusable debuff applicator (weak / vulnerable), shared by main-kind
    // intents and riders. NOT LISTENING absorbs the first stack per combat;
    // each reflectNextDebuff charge bounces one debuff back as a comp ping.
    const applyDebuffSim = (kind, value = 1) => {
      for (let s = 0; s < value; s++) {
        state.enemyDebuffRolls = (state.enemyDebuffRolls || 0) + 1;
        if (state.notListeningCharges > 0) {
          state.notListeningCharges -= 1;
          telemetry.notListeningAbsorbs = (telemetry.notListeningAbsorbs || 0) + 1;
          continue;
        }
        if (state.reflectNextDebuff > 0) {
          state.reflectNextDebuff -= 1;
          enemy.currentComp = Math.max(0, enemy.currentComp - 6);
          telemetry.passingThoughtMirrorReasoningFires = (telemetry.passingThoughtMirrorReasoningFires || 0) + 1;
          continue;
        }
        state.enemyDebuffLanded = (state.enemyDebuffLanded || 0) + 1;
        if (kind === 'weak') state.playerDmgMult = Math.max(0.5, (state.playerDmgMult || 1) - 0.25);
        else                 state.enemyDmgMult  = Math.min(1.5, (state.enemyDmgMult  || 1) + 0.25);
      }
    };
    if (intent) {
      if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
        const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
        intentIncoming = (intent.value || 0) * hits;
        intentTargetsComposure = intent.pool === 'composure';
      } else if (intent.kind === 'block') {
        enemy.block += (intent.value || 0);
      } else if (intent.kind === 'weak') {
        applyDebuffSim('weak', intent.value || 1);
      } else if (intent.kind === 'vulnerable') {
        applyDebuffSim('vulnerable', intent.value || 1);
      } else if (intent.kind === 'weave') {
        // Accrue stacks that fire at end of the next player turn unless the
        // player dealt damage. (Handler runs its own combat path.)
        state.weaveStacks = (state.weaveStacks || 0) + (intent.value || 1);
      } else if (intent.kind === 'discard-hand' && !state.loomStole) {
        // Loom Familiar — remove N cards from hand (prefer non-spell pieces),
        // exile them. Mirrors App.jsx. HARD CAP: one steal per combat — the
        // `!state.loomStole` guard mirrors App's loomStoleThisCombatRef.
        const requested = intent.value || 1;
        const n = Math.min(requested, state.hand.length);
        const isSpellPiece = (c) => c.slot === 'intro' || c.slot === 'subject' || c.slot === 'target';
        let taken = 0;
        for (let k = 0; k < n; k++) {
          if (state.hand.length === 0) break;
          const nonSpellIdxs = state.hand.map((c, i) => isSpellPiece(c) ? -1 : i).filter(i => i >= 0);
          const pool = nonSpellIdxs.length > 0 ? nonSpellIdxs : state.hand.map((_, i) => i);
          const pickedIdx = pool[Math.floor(rnd() * pool.length)];
          state.exiled.push(state.hand[pickedIdx]);
          state.hand.splice(pickedIdx, 1);
          taken++;
        }
        if (taken > 0) { telemetry.discardHandStolen = (telemetry.discardHandStolen || 0) + taken; state.loomStole = true; }
      }
    }

    // v2.93: D-1 (Talking Over Them) — colorless flag that zeroes the
    // next enemy attack. We let the rest of the turn flow run (drift,
    // bracing capture, etc.) with incoming=0 so the math chain stays
    // intact.
    let attackSkipped = false;
    if (state.enemySkipNextAttack) {
      state.enemySkipNextAttack = false;
      attackSkipped = true;
      telemetry.passingThoughtSkipsAttack = (telemetry.passingThoughtSkipsAttack || 0) + 1;
      // v3.4.42 — Thorns skipAndReturnNext: the cancelled attack damage
      // is dealt to the enemy as composure damage.
      if (state.skipAndReturnArmed) {
        state.skipAndReturnArmed = false;
        const returned = Math.round((intentIncoming || 0) * (state.enemyDmgMult || 1));
        if (returned > 0) {
          enemy.currentComp = Math.max(0, enemy.currentComp - returned);
          telemetry.skipAndReturnDamage = (telemetry.skipAndReturnDamage || 0) + returned;
        }
      }
    }
    // Spittle Peck (Rabid Scrubjay onExit): redirect the enemy's attack onto
    // itself. Mirrors App.jsx redirectEnemyAttackRef consumption.
    if (!attackSkipped && state.redirectEnemyAttack) {
      state.redirectEnemyAttack = false;
      attackSkipped = true;
      const returned = Math.round((intentIncoming || 0) * (state.enemyDmgMult || 1));
      if (returned > 0) {
        enemy.currentComp = Math.max(0, enemy.currentComp - returned);
        telemetry.spittlePeckDamage = (telemetry.spittlePeckDamage || 0) + returned;
      }
    }
    let incoming = attackSkipped ? 0 : intentIncoming;
    // v2.36: ACTUALLY— arguing-back surcharge. Each Actually— played this
    // turn adds +1 to enemy raw damage. Tracked for telemetry so the cost
    // side is visible in reports.
    if ((state.arguingBackThisTurn || 0) > 0) {
      const bonus = state.arguingBackThisTurn;
      incoming += bonus;
      telemetry.arguingBackEnemyBonus = (telemetry.arguingBackEnemyBonus || 0) + bonus;
    }
    // v2.47: DRUNKEN CONFIDENCE — +1 raw damage on every enemy attack
    // while installed (was +2 pre-v3.0). Applied BEFORE block routing.
    if (state.drunkenInstalled && incoming > 0) {
      incoming += 1;
      telemetry.drunkenIncomingPenalty = (telemetry.drunkenIncomingPenalty || 0) + 1;
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
    // v3.3 Thorns: per-enemy-turn reflect. Sim models 1 composite swing
    // per turn, so 1 charge consumed per attack turn (App is per-swing).
    // v3.3+: weakOnReflect applies Weak to enemy per charge consumed.
    if (state.thornsCharges && state.thornsCharges.count > 0 && state.thornsCharges.amount > 0 && incoming > 0) {
      enemy.currentComp = Math.max(0, enemy.currentComp - state.thornsCharges.amount);
      telemetry.fftThornsReflectDamage = (telemetry.fftThornsReflectDamage || 0) + state.thornsCharges.amount;
      if ((state.thornsCharges.weakOnReflect || 0) > 0) {
        state.enemyDmgMult = Math.max(0.5, (state.enemyDmgMult || 1) - 0.25 * state.thornsCharges.weakOnReflect);
        telemetry.fftThornsWeakApplied = (telemetry.fftThornsWeakApplied || 0) + state.thornsCharges.weakOnReflect;
      }
      state.thornsCharges.count -= 1;
      if (enemy.currentComp <= 0) {
        flushThreadPeak();
        return { outcome: 'won', turns, telemetry };
      }
    }
    // v3.4.42 — Mirror Reflect: reflects 100% of incoming damage capped per hit.
    if (state.mirrorReflectCharges && state.mirrorReflectCharges.count > 0 && incoming > 0) {
      const reflected = Math.min(incoming, state.mirrorReflectCharges.capPerHit || 9999);
      enemy.currentComp = Math.max(0, enemy.currentComp - reflected);
      telemetry.mirrorReflectDamage = (telemetry.mirrorReflectDamage || 0) + reflected;
      state.mirrorReflectCharges.count -= 1;
      if (enemy.currentComp <= 0) {
        flushThreadPeak();
        return { outcome: 'won', turns, telemetry };
      }
    }
    // v2.52: DRUNKEN STAGGER — 50% dodge roll. Sim models the enemy turn as a
    // single composite swing, so we roll ONCE per turn (the App rolls per
    // swing on attack-multi — that nuance is collapsed here). Conservative
    // vs the App; a real attack-multi enemy averages partial dodges (~50%
    // of swings missed), which over multiple hits = same expected damage
    // avoided as a 1-roll model.
    if (state.staggerActive && incoming > 0) {
      if (rnd() < 0.5) {
        telemetry.staggerMissesAvoided = (telemetry.staggerMissesAvoided || 0) + 1;
        telemetry.staggerDamageAvoided = (telemetry.staggerDamageAvoided || 0) + incoming;
        incoming = 0;
      }
    }
    // v2.9: Beetle's first-hit absorb consumes once per combat.
    if (state.beetleAbsorb > 0 && incoming > 0) {
      const absorbed = Math.min(state.beetleAbsorb, incoming);
      incoming = Math.max(0, incoming - absorbed);
      state.beetleAbsorb = 0;
    }
    // v3.0 cycle 5: Long Thread defensive bonus. While LT > 0, reduce
    // incoming damage by 1 per LT stack (cap at 3). Pairs with the
    // offensive thread-scaling rider on wit targets.
    if ((state.longThread || 0) > 0 && incoming > 0) {
      const threadReduction = Math.min(3, state.longThread);
      incoming = Math.max(0, incoming - threadReduction);
      telemetry.threadDefenseAbsorbs = (telemetry.threadDefenseAbsorbs || 0) + threadReduction;
    }
    // Drift player buffs back toward 1.0 (0.25/turn)
    if (state.enemyDmgMult < 1.0) state.enemyDmgMult = Math.min(1.0, state.enemyDmgMult + 0.25);
    if (state.playerDmgMult > 1.0) state.playerDmgMult = Math.max(1.0, state.playerDmgMult - 0.25);
    if (state.playerDmgMult < 1.0) state.playerDmgMult = Math.min(1.0, state.playerDmgMult + 0.25);
    // v3.5: weak/vuln are now driven by real intents (resolved above) + riders
    // (resolved at end of enemy turn), not a stochastic sampler. The old
    // per-turn debuff-roll approximation was removed with the intent port.
    incoming = Math.round(incoming * (state.enemyDmgMult || 1));
    // v3.5: pool routing (faithful to App.jsx applyEnemyIntent). A composure-
    // pool attack hits the composure pool, soaked by POISE; any other attack
    // hits HP, soaked by BLOCK. The two defenses are separate — a player who
    // built only physical block has no answer to a composure threat, and vice
    // versa. (Replaces the old 50/50 split, which blurred this distinction.)
    let compIncoming = intentTargetsComposure ? incoming : 0;
    let hpIncoming = intentTargetsComposure ? 0 : incoming;
    // Poise absorbs the composure pool.
    if (state.poise > 0 && compIncoming > 0) {
      const absorbed = Math.min(state.poise, compIncoming);
      state.poise -= absorbed; compIncoming -= absorbed;
    }
    // Block absorbs the HP pool.
    if (state.block > 0 && hpIncoming > 0) {
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
            state.wordsBank = Math.min((state.wordsBank || 0) + 1, 20);
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

    // v2.48: AWKWARD PAUSE — graduate pauseHeld (this-turn arm) into
    // pauseHeldActive (next-cast doubling bank). If pauseHeldActive was
    // already set (multi-turn buildup — no cast last turn either), it
    // stays set. Tray persists by default; this flag is the doubling key.
    if (state.pauseHeld) {
      state.pauseHeld = false;
      state.pauseHeldActive = true;
    }
    // v2.52: DRUNKEN STAGGER — clear the dodge window AFTER the enemy turn
    // resolved. One-turn defensive only. The flag was set this turn by the
    // skill play; this clear sets the next player turn back to "no dodge".
    if (state.staggerActive) {
      state.staggerActive = false;
    }
    // v2.93 D-6 (Bracing for Impact): if armed and HP dropped this turn,
    // draw 3 cards. Consume the flag either way. Pre-empty-hand cleanup
    // so the drawn cards are available next turn via reshuffle if needed.
    if (state.bracingArmed) {
      state.bracingArmed = false;
      if (state.hp < (state.hpAtTurnStart || 0)) {
        drawCards(state, 3);
        telemetry.passingThoughtBracingFires = (telemetry.passingThoughtBracingFires || 0) + 1;
      }
    }
    // v3.5: intent riders — a combo intent can attach extra side-effects that
    // fire AFTER the main effect. Keys: weak (player potency down), vulnerable
    // (player damage taken up), block (enemy gains block). NOT LISTENING absorbs
    // the first debuff via applyDebuffSim. Mirrors App.jsx ~10344. (The player
    // already survived the attack above; riders never deal player damage, so
    // running them post-KO-check is safe.)
    if (intent && intent.riders) {
      const r = intent.riders;
      if (r.weak)       applyDebuffSim('weak', r.weak);
      if (r.vulnerable) applyDebuffSim('vulnerable', r.vulnerable);
      if (r.block)      enemy.block += r.block;
    }
    // v3.5: roll the NEXT intent (telegraphed for the upcoming player turn),
    // with anti-repeat over the last 2 kinds — mirrors App.jsx's lastIntentKinds
    // window. rollIntent falls back to the full pool if the filter empties it.
    {
      const justFired = intent?.kind;
      state.lastIntentKinds = justFired
        ? [...(state.lastIntentKinds || []), justFired].slice(-2)
        : (state.lastIntentKinds || []);
      // Loom Familiar: once it has stolen this combat, never re-roll another
      // steal. Mirrors App.jsx's discard-hand exclude.
      const intentExclude = state.loomStole
        ? [...state.lastIntentKinds, 'discard-hand']
        : state.lastIntentKinds;
      state.enemyIntent = rollIntent(enemy, intentExclude);
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
        // v3.0 cycle 5: decay-by-1 instead of full reset.
        state.longThread = Math.max(0, state.longThread - 1);
      }
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
    // v3.3 unified scheduled-effects tick (player-turn-start trigger).
    if (state.scheduledEffects && state.scheduledEffects.length > 0) {
      const remaining = [];
      let blockGained = 0, drawGained = 0, poiseGained = 0, hpRegainGained = 0, blockStripped = 0;
      let bankAuraDoubled = false;
      for (const eff of state.scheduledEffects) {
        if (eff.trigger !== 'player-turn-start') {
          if (eff.kind === 'bankAuraDouble' && eff.turnsRemaining > 0) bankAuraDoubled = true;
          remaining.push(eff);
          continue;
        }
        if (eff.kind === 'block')        blockGained += eff.amount;
        else if (eff.kind === 'draw')    drawGained += eff.amount;
        else if (eff.kind === 'poise')   poiseGained += eff.amount;
        else if (eff.kind === 'hpRegen') hpRegainGained += eff.amount;
        else if (eff.kind === 'stripEnemyBlock') blockStripped += eff.amount;
        if (eff.turnsRemaining > 1) remaining.push({ ...eff, turnsRemaining: eff.turnsRemaining - 1 });
      }
      // v3.4.42 — Bank Aura tick.
      if (state.lane === 'wit' && (state.wordsBank || 0) > 0 && enemy) {
        let auraDmg = Math.min(4, Math.floor(state.wordsBank / 5));
        if (bankAuraDoubled) auraDmg *= 2;
        if (auraDmg > 0) {
          enemy.currentComp = Math.max(0, enemy.currentComp - auraDmg);
          telemetry.bankAuraDamage = (telemetry.bankAuraDamage || 0) + auraDmg;
        }
      }
      if (blockGained > 0) state.block = (state.block || 0) + blockGained;
      if (drawGained > 0) drawCards(state, drawGained);
      if (poiseGained > 0) state.poise = (state.poise || 0) + poiseGained;
      if (hpRegainGained > 0) {
        state.hp = Math.min(state.maxHp, state.hp + hpRegainGained);
        telemetry.thornsHpRegen = (telemetry.thornsHpRegen || 0) + hpRegainGained;
      }
      if (blockStripped > 0 && enemy) {
        enemy.block = Math.max(0, (enemy.block || 0) - blockStripped);
        telemetry.thornsBlockStripped = (telemetry.thornsBlockStripped || 0) + blockStripped;
      }
      // v3.4.36 cycle 4 — Thorns aura tick: if charges active this turn,
      // estimate reflect damage from the enemy's projected attack-shaped
      // intent. The aura was completely silent in sim before.
      if (state.thornsCharges && state.thornsCharges.turnsRemaining > 0 && enemy) {
        const willAttack = (enemy.behaviors || []).some(b => b.kind === 'attack' || b.kind === 'attack-multi');
        if (willAttack) {
          let reflectAmt = state.thornsCharges.amount || 0;
          if (Array.isArray(state.thornsCharges.schedule) && state.thornsCharges.schedule.length > 0) {
            reflectAmt = Math.max(reflectAmt, state.thornsCharges.schedule.shift() || 0);
          }
          if (reflectAmt > 0) {
            enemy.currentComp = Math.max(0, enemy.currentComp - reflectAmt);
            telemetry.thornsReflectDamage = (telemetry.thornsReflectDamage || 0) + reflectAmt;
          }
        }
        state.thornsCharges.turnsRemaining -= 1;
        if (state.thornsCharges.turnsRemaining <= 0 && !state.thornsCharges.count) {
          state.thornsCharges = null;
        }
      }
      state.scheduledEffects = remaining;
    }
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

// Handler reward draft. Samples 3 distinct cards from HANDLER_REWARD_POOL and
// picks one, biased toward TACTIC VARIETY + burst tools for boss fights.
function aiPickHandlerReward(state) {
  const owned = [...state.deck, ...state.hand, ...state.discard, ...state.exiled];
  const ownedIds = new Set(owned.map(c => c.id));
  const ownedTactics = new Set(owned.filter(c => c.type === 'tactic').map(c => c.id));
  const ownedCounts = {};
  for (const c of owned) ownedCounts[c.id] = (ownedCounts[c.id] || 0) + 1;
  const pool = shuffle(HANDLER_REWARD_POOL.slice());
  const candidates = [];
  for (const id of pool) {
    if (candidates.length >= 3) break;
    candidates.push(HANDLER_CARDS_BY_ID[id]);
  }
  const ownedLureCount = owned.filter(c => c.type === 'lure').length;
  function score(card) {
    let s = 0;
    if (card.type === 'tactic') {
      s += ownedTactics.has(card.id) ? 3 : 14;
    } else if (card.type === 'lure') {
      s += ownedIds.has(card.id) ? 4 : 9;
      if (ownedLureCount < 3) s += 8;
      else if (card.id === 'cv2-l-tender-greens' && (ownedCounts[card.id] || 0) < 3) s += 4;
    } else if (card.util === 'onThree') {
      s += ownedIds.has(card.id) ? 5 : 12;
    } else {
      s += 6;
    }
    if (card.rarity === 'uncommon') s += 2;
    return s;
  }
  const best = candidates.reduce((b, c) => (!b || score(c) > score(b.card) ? { card: c, sc: score(c) } : b), null);
  return best ? best.card : null;
}

function awardReward(state) {
  // Handler (Animal Summoner) drafts from its own pool, biased to tactic
  // variety + boss-burst tools. No verbal word-pool draft applies.
  if (state.lane === 'handler') {
    const card = aiPickHandlerReward(state);
    if (card) {
      state.discard.push({ ...card, uid: uid() });
      state.rewardsTaken.push(card.id);
    }
    return;
  }
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
  // v3.4.48 — Opening Statement bias and Revisit-Opening bias removed
  // (cards deleted from the pool in the same cycle).
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
  // v2.46: "the soup, you see, was never the point." target bias — jnsq
  // lane only. Uncommon Effect target with commitment chain. ~20% bias;
  // cap at one (a second copy can't usefully co-exist with the first —
  // both armings in the same turn double the bill but only one follow-up
  // can be played per cast cap). Gated on owning enough jnsq cards for
  // the follow-up to consistently land (≥6 total jnsq cards in deck —
  // the 5 starter staples plus at least one acquired reward).
  if (state.lane === 'jnsq') {
    const ownsSoup = allCards.some(c => c.id === 'jv2-t-soup-was-never-the-point');
    if (!ownsSoup) {
      const jnsqCount = allCards.filter(c => c.lane === 'jnsq').length;
      const sk = pool.find(c => c.id === 'jv2-t-soup-was-never-the-point');
      if (sk && jnsqCount >= 6 && rnd() < 0.10) {
        state.discard.push({ ...sk, uid: uid() });
        state.rewardsTaken.push(sk.id);
        return;
      }
    }
  }
  // v2.47: "sober second thought," skill bias — jnsq lane only. Gated on
  // OWNING the "Hold my drink," power so we don't draft the removal without
  // anything to remove. ~30% when the gate passes — the skill is the only
  // explicit off-switch for the +2 incoming penalty, so the deck wants it
  // available the moment the trade turns sour. Cap at one copy.
  if (state.lane === 'jnsq') {
    const ownsHoldMyDrink = allCards.some(c => c.id === 'jv2-p-hold-my-drink');
    const ownsSober = allCards.some(c => c.id === 'jv2-k-sober-second-thought');
    if (ownsHoldMyDrink && !ownsSober) {
      const sk = pool.find(c => c.id === 'jv2-k-sober-second-thought');
      if (sk && rnd() < 0.30) {
        state.discard.push({ ...sk, uid: uid() });
        state.rewardsTaken.push(sk.id);
        return;
      }
    }
  }
  // v2.48: "...go on, I'm listening." skill bias — jnsq lane only. Common
  // cost-0 Skill (tray-hold + doubling bank). ~25% bias, cap at one — only
  // the first copy lights the bank, additional copies sit dead in hand
  // while the bank is armed. The skill is strong enough to want consistent
  // draft into a jnsq deck so the doubled-cast payoff is reachable.
  if (state.lane === 'jnsq') {
    const ownsGoOn = allCards.some(c => c.id === 'jv2-k-go-on-im-listening');
    if (!ownsGoOn) {
      const gk = pool.find(c => c.id === 'jv2-k-go-on-im-listening');
      if (gk && rnd() < 0.25) {
        state.discard.push({ ...gk, uid: uid() });
        state.rewardsTaken.push(gk.id);
        return;
      }
    }
  }
  // v2.52: "sorry, I lost my balance for a second," skill bias — jnsq lane
  // only. Uncommon cost-1 Skill (50% per-swing dodge for the turn). ~25%
  // bias, cap at TWO copies (defensive skills are cycle-relevant — the
  // player wants one in rotation every few turns against attack-multi
  // enemies). Compared to go-on (single copy, tray-hold), stagger is a
  // repeat-use defensive button.
  if (state.lane === 'jnsq') {
    const staggerCount = allCards.filter(c => c.id === 'jv2-k-sorry-lost-balance').length;
    if (staggerCount < 2) {
      const sk = pool.find(c => c.id === 'jv2-k-sorry-lost-balance');
      if (sk && rnd() < 0.25) {
        state.discard.push({ ...sk, uid: uid() });
        state.rewardsTaken.push(sk.id);
        return;
      }
    }
  }
  // v2.47: "Hold my drink," power bias — jnsq lane only. Uncommon Power.
  // The generic power bias (~15%) at top of awardReward fires only when
  // the player owns ZERO power cards; for jnsq we also want a targeted
  // ~12% bias so the drunken power lands reliably in jnsq runs even when
  // (rarely) another power has already been drafted. Cap at one copy.
  if (state.lane === 'jnsq') {
    const ownsHoldMyDrink = allCards.some(c => c.id === 'jv2-p-hold-my-drink');
    if (!ownsHoldMyDrink) {
      const pk = pool.find(c => c.id === 'jv2-p-hold-my-drink');
      if (pk && rnd() < 0.12) {
        state.discard.push({ ...pk, uid: uid() });
        state.rewardsTaken.push(pk.id);
        return;
      }
    }
  }
  // v2.50: GETTING-AWAY-FROM-ME rare target bias — jnsq lane only. The card
  // is a high-base rare with mustPlayAnotherJnsq + doubleOnSecondCast. Without
  // Babbling installed, it's a respectable T3 finisher with a follow-up
  // commitment. WITH Babbling, cast as #2 it's the highest-EV target in the
  // lane (net 1.2× a baseline first cast, since 2× × 0.6 > 1.0×). Bias up
  // when the player has already drafted Babbling so the pairing reliably
  // shows up in jnsq runs. Cap at one copy (mustPlayAnotherJnsq makes more
  // than one redundant in a single combat — only one fires per follow-up).
  if (state.lane === 'jnsq') {
    const ownsGettingAway = allCards.some(c => c.id === 'jv2-t-getting-away-from-me');
    if (!ownsGettingAway) {
      const ownsBabbling = allCards.some(c => c.id === 'jv2-p-wait-and-another-thing' || c.installPower?.id === 'babbling');
      const rate = ownsBabbling ? 0.30 : 0.10;
      const gk = pool.find(c => c.id === 'jv2-t-getting-away-from-me');
      if (gk && rnd() < rate) {
        state.discard.push({ ...gk, uid: uid() });
        state.rewardsTaken.push(gk.id);
        return;
      }
    }
  }
  // v2.51: SYNERGY CAPSTONE bias — jnsq lane only. The "universe sideways"
  // capstone rewards a tag-cohesive jnsq deck (perTagBonus reads chaotic /
  // absurd / mystical across the tray). Bias UP when the deck already
  // contains multiple chaotic/absurd/mystical-tagged jnsq cards — the rider
  // pays out only when those tags actually show up in the tray. Cap at one
  // copy (mustPlayAnotherJnsq + tangentOnCast make >1 redundant within a
  // single combat). ~18% baseline mirrors the wit in-summary capstone bias,
  // ~28% when the deck is already themed.
  if (state.lane === 'jnsq') {
    const ownsCapstone = allCards.some(c => c.id === 'jv2-t-universe-sideways');
    if (!ownsCapstone) {
      const themeTags = ['chaotic', 'absurd', 'mystical'];
      const themedJnsqCount = allCards.filter(c =>
        c.lane === 'jnsq' && (c.tags || []).some(t => themeTags.includes(t))
      ).length;
      const rate = themedJnsqCount >= 6 ? 0.28 : 0.18;
      const ck = pool.find(c => c.id === 'jv2-t-universe-sideways');
      if (ck && rnd() < rate) {
        state.discard.push({ ...ck, uid: uid() });
        state.rewardsTaken.push(ck.id);
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
  // v3.4.8 Delta 1 — SCHOOL-CONSISTENT DRAFT BIAS (per HUMAN_PLAY_PROFILE
  // snapshot 10). Real-play data: Alan's 4 wit picks were all
  // slowburn/crescendo (matching the school his starter row seeded).
  // Sim was picking lane-pure-random with no school affinity. Now:
  // for wit-lane, count which FFT schools the player's existing deck
  // commits to (cards with that schoolId) and weight bucket picks
  // toward the dominant school. School-tagged cards get a +N weight
  // proportional to how many cards of that school are already owned;
  // untagged cards keep base weight.
  let card;
  if (state.lane === 'wit') {
    const schoolCounts = {};
    for (const c of allCards) {
      if (c.schoolId) schoolCounts[c.schoolId] = (schoolCounts[c.schoolId] || 0) + 1;
    }
    // Weight: base slot weight × (1 + schoolCount × 0.5).
    // A 4-card school owned → 3× weight bonus. A 0-card school → no bonus.
    const weightedPick = (cards) => {
      if (cards.length === 0) return null;
      const baseWeights = cards.map(c => {
        const slotW = SLOT_WEIGHTS[c.slot] || 10;
        // v3.4.41 cycle 10: With the partial-row tutor live, the school-mix
        // problem is mostly addressed by hand turnover. Back to a clean
        // 0.4 cohesion bias, no new-school bonus. The earlier 1.3 nudge
        // was forcing the AI into mixed decks that couldn't close combats.
        const sCount = c.schoolId ? (schoolCounts[c.schoolId] || 0) : 0;
        const schoolMult = c.schoolId
          ? 1 + sCount * 0.4
          : 1;
        return slotW * schoolMult;
      });
      const total = baseWeights.reduce((s, w) => s + w, 0);
      let r = rnd() * total;
      for (let i = 0; i < cards.length; i++) {
        r -= baseWeights[i];
        if (r <= 0) return cards[i];
      }
      return cards[cards.length - 1];
    };
    card = weightedPick(bucket);
  } else {
    card = pickSlotWeighted(bucket);
  }
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
  const lane = forcedLane || pickRandom(['wit', 'handler']);
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
    // v2.24: handler tunnel-vision / rage telemetry.
    rageTriggers: 0, bareKnucklesCasts: 0, bareKnucklesMisfires: 0,
    // v2.25: handler doubling-down telemetry.
    doubleDownCasts: 0, cornerTokenBills: 0, cornerTokenDamage: 0,
    // v2.26: handler storm-out telemetry.
    stormOutCasts: 0, stormOutEnergySpent: 0,
    // v2.27: handler hit-me-again telemetry.
    hitMeAgainInstalls: 0, hitMeAgainRecoilTotal: 0, hitMeAgainKills: 0,
    // v2.33: stubborn-block REMOVED.
    // v2.29: handler saying-it-louder telemetry. iSaidCasts counts the
    // number of "I SAID." casts; loudCountSum accumulates the loudCount
    // observed on each such cast so we can compute mean stack-size.
    iSaidCasts: 0, loudCountSum: 0, loudBonusSum: 0,
    // v2.30: handler smell-weakness telemetry. predatorTriggers counts
    // casts where the +N bonus actually fired (enemy was Vuln/Weak at cast),
    // predatorBonusTotal aggregates the +damage across the run.
    predatorTriggers: 0, predatorBonusTotal: 0,
    // v2.31: synergy capstone — AND-IM-NOT-DONE casts + total damage. Rare-
    // tier so the per-run count is expected to be 0-2 most runs.
    andImNotDoneCasts: 0, andImNotDoneTotalDamage: 0,
    // v2.41: wit SYNERGY CAPSTONE casts + total damage. Mirrors handler cap.
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
    // v2.67: general chip-cast skip counter (HUMAN_PLAY_PROFILE — humans
    // skip-cast on chip turns; sim AI now mirrors at ~25% damage threshold).
    chipCastSkips: 0,
    smoothedBackfires: 0,  // v2.90: pity-smooth fires (3rd-in-a-row 1 → 2)
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
    // v2.46: WON'T SHUT UP telemetry — commitment-chain mechanic. armed =
    // total times rider fired; damage = times the 3 HP landed (player
    // failed to follow through); dodges = times a follow-up jnsq card
    // played and cleared the flag. Dodges + damage should equal armed
    // (modulo combats that end mid-armed, which clear without counting).
    wontShutUpArmed: 0,
    wontShutUpDamage: 0,
    wontShutUpDodges: 0,
    // v2.47: DRUNKEN CONFIDENCE telemetry. installs = power plays (jnsq);
    // uninstalls = "sober second thought," removals; castBonus = total
    // bonus damage from the +50% on casts; incomingPenalty = total +2
    // chunks added to enemy attacks (pre-block); drunkenCasts = casts
    // that received the +50%.
    drunkenInstalls: 0,
    drunkenUninstalls: 0,
    drunkenCasts: 0,
    drunkenCastBonus: 0,
    drunkenIncomingPenalty: 0,
    // v2.48: AWKWARD PAUSE telemetry. awkwardPauses = skill plays (each is
    // one held turn arming the doubling); doubledCasts = casts that resolved
    // with the pauseDoubled context flag set (the bank cashed in); doubled-
    // ExtraDamage = raw damage delta vs the same cast without doubling.
    awkwardPauses: 0,
    doubledCasts: 0,
    doubledExtraDamage: 0,
    // v2.49: BABBLING telemetry. installs = power plays (jnsq); secondCasts
    // = casts that fired on castsThisTurn === 1 (the cap-lifted 2nd cast);
    // secondCastDamage = total post-scale damage delivered by those 2nd
    // casts. Net value question: secondCastDamage worth the 1-cost install +
    // the 0.6× scaling.
    babblingInstalls: 0,
    babblingSecondCasts: 0,
    babblingSecondCastDamage: 0,
    // v2.50: gettingAwayCasts = total casts of the rare "getting away from me"
    // target (any cast slot); gettingAwayDoubled = subset that fired with
    // doubleOnSecondCast active (cast as the 2nd cast under Babbling).
    gettingAwayCasts: 0,
    gettingAwayDoubled: 0,
    // v2.51: SYNERGY CAPSTONE — "universe sideways." casts = resolved cast
    // count; totalDamage = sum of resolved damage (used to compute avg);
    // tangentOnCastFires = times the on-cast Tangent dispatcher fired (= casts
    // when no edge cases — exposed separately to surface broken pipeline
    // states if they ever diverge).
    universeSidewaysCasts: 0,
    universeSidewaysTotalDamage: 0,
    tangentOnCastFires: 0,
    // v2.52: DRUNKEN STAGGER telemetry. plays = skill plays; missesAvoided =
    // composite swings that fully missed thanks to stagger; damageAvoided =
    // total raw incoming damage zeroed out (post-multipliers, pre-block).
    staggerPlays: 0,
    staggerMissesAvoided: 0,
    staggerDamageAvoided: 0,
    // v2.92: Passing Thoughts telemetry. grants = times a PT was added to
    // the deck via the rest-equivalent grant pass; plays = times the AI
    // resolved one in combat.
    passingThoughtGrants: 0,
    passingThoughtPlays: 0,
    // Handler (Animal Summoner) telemetry — accumulated in runHandlerCombat.
    handlerCombats: 0,
    handlerTicks: 0,
    handlerSummons: 0,
    handlerFeeds: 0,
    handlerShortStays: 0,
    handlerCombines: 0,
    handlerMenagerieComposure: 0,
    handlerMenagerieBlock: 0,
    handlerTacticChanges: 0,
    handlerTacticVarietySum: 0,
    handlerTacticEngaged: {},
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

  // v2.92: Reflect-equivalent — between non-boss combats, 20% chance to
  // grant a random Passing Thought to the deck. Mirrors a player picking
  // the 'reflect' rest-site option occasionally. The real-game map
  // distributes rest nodes more variably; 20% per slot averages out.
  const maybeReflect = () => {
    if (rnd() < 0.20) {
      const pt = pickRandom(PASSING_THOUGHTS_SIM);
      state.deck.push({ ...pt, uid: uid() });
      tele.passingThoughtGrants++;
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
      maybeReflect();
    }
    // 1 elite
    const eliteR = runCombat(state, pickRandom(ACT_ELITES[act.id]), tele);
    tele.combatCount++; tele.combatTurns += eliteR.turns;
    lastResult = { ...eliteR, where: `act${act.id}-elite` };
    if (eliteR.outcome !== 'won') return { lane, familiar: state.familiar, actsCleared, ...tele, ...lastResult, finalHp: state.hp, finalComposure: state.composure, finalDeckSize: state.deck.length + state.discard.length + state.exiled.length };
    awardReward(state);
    postCombatHeal();
    maybeReflect();
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
  const byLane = { wit: [], handler: [], jnsq: [] };
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
    // Handler (Animal Summoner) metrics.
    handlerRuns: results.filter(r => r.lane === 'handler').length,
    handlerWins: results.filter(r => r.lane === 'handler' && r.outcome === 'won').length,
    handlerCombats: results.reduce((s, r) => s + (r.handlerCombats || 0), 0),
    handlerSummons: results.reduce((s, r) => s + (r.handlerSummons || 0), 0),
    handlerFeeds: results.reduce((s, r) => s + (r.handlerFeeds || 0), 0),
    handlerShortStays: results.reduce((s, r) => s + (r.handlerShortStays || 0), 0),
    handlerCombines: results.reduce((s, r) => s + (r.handlerCombines || 0), 0),
    handlerMenagerieComposure: results.reduce((s, r) => s + (r.handlerMenagerieComposure || 0), 0),
    handlerMenagerieBlock: results.reduce((s, r) => s + (r.handlerMenagerieBlock || 0), 0),
    handlerTacticChanges: results.reduce((s, r) => s + (r.handlerTacticChanges || 0), 0),
    handlerTacticVarietySum: results.reduce((s, r) => s + (r.handlerTacticVarietySum || 0), 0),
    handlerTacticEngaged: results.reduce((acc, r) => {
      for (const [id, n] of Object.entries(r.handlerTacticEngaged || {})) acc[id] = (acc[id] || 0) + n;
      return acc;
    }, {}),
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
    // v2.67: general chip-cast skip metric.
    chipCastSkips: results.reduce((s, r) => s + (r.chipCastSkips || 0), 0),
    smoothedBackfires: results.reduce((s, r) => s + (r.smoothedBackfires || 0), 0),
    passingThoughtGrants: results.reduce((s, r) => s + (r.passingThoughtGrants || 0), 0),
    passingThoughtPlays: results.reduce((s, r) => s + (r.passingThoughtPlays || 0), 0),
    // v2.93 — per-card fire counters for the redesigned offense/defense set.
    passingThoughtSeamFires: results.reduce((s, r) => s + (r.passingThoughtSeamFires || 0), 0),
    passingThoughtPrecedentFires: results.reduce((s, r) => s + (r.passingThoughtPrecedentFires || 0), 0),
    passingThoughtInsultFires: results.reduce((s, r) => s + (r.passingThoughtInsultFires || 0), 0),
    passingThoughtDoubletakeFires: results.reduce((s, r) => s + (r.passingThoughtDoubletakeFires || 0), 0),
    passingThoughtSkipsAttack: results.reduce((s, r) => s + (r.passingThoughtSkipsAttack || 0), 0),
    passingThoughtMirrorReasoningFires: results.reduce((s, r) => s + (r.passingThoughtMirrorReasoningFires || 0), 0),
    passingThoughtBracingFires: results.reduce((s, r) => s + (r.passingThoughtBracingFires || 0), 0),
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
    // v2.46: WON'T SHUT UP aggregate. armed/damage/dodges summed; runs =
    // runs that armed at least once. The dodges/armed ratio is the AI's
    // follow-through rate; damages/armed is the punishment rate.
    wontShutUpArmed: results.reduce((s, r) => s + (r.wontShutUpArmed || 0), 0),
    wontShutUpDamage: results.reduce((s, r) => s + (r.wontShutUpDamage || 0), 0),
    wontShutUpDodges: results.reduce((s, r) => s + (r.wontShutUpDodges || 0), 0),
    wontShutUpRuns: results.filter(r => (r.wontShutUpArmed || 0) > 0).length,
    // v2.47: DRUNKEN CONFIDENCE aggregate. installs = per-combat power
    // plays; uninstalls = "sober second thought," removals; castBonus =
    // total bonus damage delivered by the +50% on casts; incomingPenalty
    // = total raw +2 damage added to enemy attacks (pre-block); runs =
    // runs with at least one install.
    drunkenInstalls: results.reduce((s, r) => s + (r.drunkenInstalls || 0), 0),
    drunkenUninstalls: results.reduce((s, r) => s + (r.drunkenUninstalls || 0), 0),
    drunkenCasts: results.reduce((s, r) => s + (r.drunkenCasts || 0), 0),
    drunkenCastBonus: results.reduce((s, r) => s + (r.drunkenCastBonus || 0), 0),
    drunkenIncomingPenalty: results.reduce((s, r) => s + (r.drunkenIncomingPenalty || 0), 0),
    drunkenRuns: results.filter(r => (r.drunkenInstalls || 0) > 0).length,
    // v2.48: AWKWARD PAUSE aggregate. pauses = skill plays (turns where
    // the player skipped a cast to bank the doubling); doubledCasts =
    // casts that fired with the bank cashed in; doubledExtraDamage = sum
    // of raw damage delta (post-double minus pre-double, pre-enemy-eff).
    // runs = runs with at least one pause.
    awkwardPauses: results.reduce((s, r) => s + (r.awkwardPauses || 0), 0),
    doubledCasts: results.reduce((s, r) => s + (r.doubledCasts || 0), 0),
    doubledExtraDamage: results.reduce((s, r) => s + (r.doubledExtraDamage || 0), 0),
    awkwardPauseRuns: results.filter(r => (r.awkwardPauses || 0) > 0).length,
    // v2.49: BABBLING aggregate.
    babblingInstalls: results.reduce((s, r) => s + (r.babblingInstalls || 0), 0),
    babblingSecondCasts: results.reduce((s, r) => s + (r.babblingSecondCasts || 0), 0),
    babblingSecondCastDamage: results.reduce((s, r) => s + (r.babblingSecondCastDamage || 0), 0),
    babblingRuns: results.filter(r => (r.babblingInstalls || 0) > 0).length,
    // v2.50: getting-away-from-me aggregate.
    gettingAwayCasts: results.reduce((s, r) => s + (r.gettingAwayCasts || 0), 0),
    gettingAwayDoubled: results.reduce((s, r) => s + (r.gettingAwayDoubled || 0), 0),
    gettingAwayRuns: results.filter(r => (r.gettingAwayCasts || 0) > 0).length,
    // v2.51: SYNERGY CAPSTONE aggregate (universe sideways).
    universeSidewaysCasts: results.reduce((s, r) => s + (r.universeSidewaysCasts || 0), 0),
    universeSidewaysTotalDamage: results.reduce((s, r) => s + (r.universeSidewaysTotalDamage || 0), 0),
    universeSidewaysRuns: results.filter(r => (r.universeSidewaysCasts || 0) > 0).length,
    tangentOnCastFires: results.reduce((s, r) => s + (r.tangentOnCastFires || 0), 0),
    // v2.52: DRUNKEN STAGGER aggregate. plays = skill fires per-run summed;
    // missesAvoided = swings the stagger dodge zeroed out; damageAvoided =
    // total raw incoming damage prevented. runs = runs with ≥1 play.
    staggerPlays: results.reduce((s, r) => s + (r.staggerPlays || 0), 0),
    staggerMissesAvoided: results.reduce((s, r) => s + (r.staggerMissesAvoided || 0), 0),
    staggerDamageAvoided: results.reduce((s, r) => s + (r.staggerDamageAvoided || 0), 0),
    staggerRuns: results.filter(r => (r.staggerPlays || 0) > 0).length,
    avgTurnsPerCombat: results.length ? mean(results.map(r => (r.combatTurns || 0) / Math.max(1, r.combatCount || 1))) : 0,
    avgDamageDealt: mean(results.map(r => r.totalDamageDealt || 0)),
    finalDeckSizeMean: mean(results.map(r => r.finalDeckSize || 0)),
    archetypeCounts: results.filter(r => r.outcome === 'won').reduce((m, r) => { m[r.archetype || 'unknown'] = (m[r.archetype || 'unknown'] || 0) + 1; return m; }, {}),
  };
}

function buildReport(agg) {
  const lines = [];
  lines.push(`# Witch Mountain Bridge v2 — Playtest Report`);
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
  lines.push(`## Handler ANIMAL SUMMONER (consolidated 2026-06-01)`);
  lines.push(`- Handler runs: ${agg.handlerRuns} · ${agg.handlerWins} wins (${agg.handlerRuns ? pct(agg.handlerWins / agg.handlerRuns) : '0.0%'})`);
  lines.push(`- Combats fought: ${agg.handlerCombats}`);
  lines.push(`- Summons: ${agg.handlerSummons} · feeds: ${agg.handlerFeeds} · short-stays (unfed left early): ${agg.handlerShortStays} · combines: ${agg.handlerCombines}`);
  lines.push(`- Menagerie composure dealt: ${agg.handlerMenagerieComposure} · block generated: ${agg.handlerMenagerieBlock}`);
  lines.push(`- Avg summons/combat: ${agg.handlerCombats ? (agg.handlerSummons / agg.handlerCombats).toFixed(2) : '0.00'} · avg feeds/combat: ${agg.handlerCombats ? (agg.handlerFeeds / agg.handlerCombats).toFixed(2) : '0.00'}`);
  lines.push(`- Tactic changes: ${agg.handlerTacticChanges} · avg distinct tactics/combat: ${agg.handlerCombats ? (agg.handlerTacticVarietySum / agg.handlerCombats).toFixed(2) : '0.00'}`);
  {
    const te = agg.handlerTacticEngaged || {};
    const order = ['shield', 'rabid', 'youth', 'nurture', 'feather'];
    const parts = order.map(id => `${id} ${te[id] || 0}`);
    lines.push(`- Tactic engagement: ${parts.join(' · ')}`);
  }
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
  lines.push(`- v2.67 chip-cast skips (HUMAN_PLAY_PROFILE-aligned): ${agg.chipCastSkips || 0}`);
  lines.push(`- v2.90 backfire-smoother fires (3rd consecutive 1 → 2): ${agg.smoothedBackfires || 0}`);
  lines.push(`- v2.92 Passing Thoughts: ${agg.passingThoughtGrants || 0} granted, ${agg.passingThoughtPlays || 0} played`);
  lines.push(`- v2.93 Find the Seam (bypass-effectiveness) fires: ${agg.passingThoughtSeamFires || 0}`);
  lines.push(`- v2.93 Precedent (echo-last-damage) fires: ${agg.passingThoughtPrecedentFires || 0}`);
  lines.push(`- v2.93 Insult-to-Injury (×N mult) fires: ${agg.passingThoughtInsultFires || 0}`);
  lines.push(`- v2.93 Doubletake (cast resolves twice) fires: ${agg.passingThoughtDoubletakeFires || 0}`);
  lines.push(`- v2.93 Skip-next-attack fires: ${agg.passingThoughtSkipsAttack || 0}`);
  lines.push(`- v2.93 Mirror Reasoning (reflect debuff) fires: ${agg.passingThoughtMirrorReasoningFires || 0}`);
  lines.push(`- v2.93 Bracing (draw-3-on-HP-loss) fires: ${agg.passingThoughtBracingFires || 0}`);
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
  lines.push(`## Jnsq WON'T SHUT UP (v2.46)`);
  lines.push(`- Rider armed (soup target cast): ${agg.wontShutUpArmed} (runs: ${agg.wontShutUpRuns} / ${agg.N}, ${pct(agg.wontShutUpRuns / agg.N)})`);
  lines.push(`- Dodges (kept going — follow-up jnsq played): ${agg.wontShutUpDodges} (${agg.wontShutUpArmed > 0 ? pct(agg.wontShutUpDodges / agg.wontShutUpArmed) : '0%'})`);
  lines.push(`- Damage fires (-3 HP each): ${agg.wontShutUpDamage} (${agg.wontShutUpArmed > 0 ? pct(agg.wontShutUpDamage / agg.wontShutUpArmed) : '0%'})`);
  lines.push(`- Total HP lost to commitment: ${agg.wontShutUpDamage * 3}`);
  lines.push('');
  lines.push(`## Jnsq DRUNKEN CONFIDENCE (v2.47)`);
  lines.push(`- Installs (per-combat): ${agg.drunkenInstalls} (runs: ${agg.drunkenRuns} / ${agg.N}, ${pct(agg.drunkenRuns / agg.N)})`);
  lines.push(`- Uninstalls (sober second thought): ${agg.drunkenUninstalls}`);
  lines.push(`- Casts that received the +50%: ${agg.drunkenCasts}`);
  lines.push(`- Total bonus damage from +50% on casts: ${agg.drunkenCastBonus}`);
  lines.push(`- Total +2 incoming penalty taken: ${agg.drunkenIncomingPenalty}`);
  lines.push(`- Net trade: ${agg.drunkenCastBonus - agg.drunkenIncomingPenalty} (positive = paying off)`);
  lines.push('');
  lines.push(`## Jnsq AWKWARD PAUSE (v2.48)`);
  lines.push(`- "...go on, I'm listening." plays: ${agg.awkwardPauses} (runs: ${agg.awkwardPauseRuns} / ${agg.N}, ${pct(agg.awkwardPauseRuns / agg.N)})`);
  lines.push(`- Doubled casts (bank cashed in): ${agg.doubledCasts}`);
  lines.push(`- Total extra damage from doubling: ${agg.doubledExtraDamage}`);
  lines.push(`- Avg extra damage / doubled cast: ${agg.doubledCasts > 0 ? (agg.doubledExtraDamage / agg.doubledCasts).toFixed(1) : '0.0'}`);
  lines.push(`- Cash-in ratio (doubled casts / pauses): ${agg.awkwardPauses > 0 ? pct(agg.doubledCasts / agg.awkwardPauses) : '0%'}`);
  lines.push('');
  lines.push(`## Jnsq BABBLING (v2.49)`);
  lines.push(`- Installs (per-combat): ${agg.babblingInstalls} (runs: ${agg.babblingRuns} / ${agg.N}, ${pct(agg.babblingRuns / agg.N)})`);
  lines.push(`- 2nd casts fired: ${agg.babblingSecondCasts}`);
  lines.push(`- Total damage delivered by 2nd casts: ${agg.babblingSecondCastDamage}`);
  lines.push(`- Avg damage / 2nd cast: ${agg.babblingSecondCasts > 0 ? (agg.babblingSecondCastDamage / agg.babblingSecondCasts).toFixed(1) : '0.0'}`);
  lines.push(`- 2nd-cast rate per install: ${agg.babblingInstalls > 0 ? (agg.babblingSecondCasts / agg.babblingInstalls).toFixed(2) : '0.00'}`);
  lines.push('');
  lines.push(`## Jnsq GETTING-AWAY-FROM-ME (v2.50)`);
  lines.push(`- Rare casts: ${agg.gettingAwayCasts} (runs: ${agg.gettingAwayRuns} / ${agg.N}, ${pct(agg.gettingAwayRuns / agg.N)})`);
  lines.push(`- Doubled fires (cast #2 under Babbling): ${agg.gettingAwayDoubled} (${agg.gettingAwayCasts > 0 ? pct(agg.gettingAwayDoubled / agg.gettingAwayCasts) : '0%'} of casts)`);
  lines.push('');
  lines.push(`## Jnsq SYNERGY CAPSTONE — "universe sideways" (v2.51)`);
  lines.push(`- Capstone casts: ${agg.universeSidewaysCasts} (runs: ${agg.universeSidewaysRuns} / ${agg.N}, ${pct(agg.universeSidewaysRuns / agg.N)})`);
  lines.push(`- Total capstone damage: ${agg.universeSidewaysTotalDamage}`);
  lines.push(`- Avg damage / capstone cast: ${agg.universeSidewaysCasts > 0 ? (agg.universeSidewaysTotalDamage / agg.universeSidewaysCasts).toFixed(2) : '0.00'}`);
  lines.push(`- Tangent-on-cast fires: ${agg.tangentOnCastFires}`);
  lines.push('');
  lines.push(`## Jnsq DRUNKEN STAGGER (v2.52)`);
  lines.push(`- "sorry, I lost my balance" plays: ${agg.staggerPlays} (runs: ${agg.staggerRuns} / ${agg.N}, ${pct(agg.staggerRuns / agg.N)})`);
  lines.push(`- Swings missed (50% dodge fired): ${agg.staggerMissesAvoided}`);
  lines.push(`- Total damage avoided: ${agg.staggerDamageAvoided}`);
  lines.push(`- Avg damage avoided / play: ${agg.staggerPlays > 0 ? (agg.staggerDamageAvoided / agg.staggerPlays).toFixed(1) : '0.0'}`);
  lines.push(`- Dodge rate (misses / plays): ${agg.staggerPlays > 0 ? pct(agg.staggerMissesAvoided / agg.staggerPlays) : '0%'}`);
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
  const forcedLane = ['wit', 'handler'].includes(laneArg) ? laneArg : null;
  console.log(`Running ${N} v2 playtests${forcedLane ? ` (lane=${forcedLane})` : ''}…`);
  if (process.env.DEATH_CAUSE) { globalThis.__deathCause = { hp: 0, composure: 0 }; globalThis.__maulCount = 0; }
  const results = [];
  // v2.53: when no lane filter is supplied, force ROUND-ROBIN across the
  // three lanes so the aggregate report has balanced per-lane telemetry
  // (previously the random picker would skew the distribution and dilute
  // per-lane signal — handler/wit cards' triggers got under-counted).
  const LANE_ROTATION = ['handler', 'wit'];
  for (let i = 0; i < N; i++) {
    const lane = forcedLane || LANE_ROTATION[i % LANE_ROTATION.length];
    results.push(simRun(lane));
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
  if (globalThis.__deathCause) console.log(`Death cause: HP=${globalThis.__deathCause.hp} Composure=${globalThis.__deathCause.composure}`);
  if (typeof globalThis.__maulCount === 'number') console.log(`Mauls fired: ${globalThis.__maulCount}`);
}

export { simRun, aggregate, buildReport };
