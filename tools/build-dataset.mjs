// Build STS2-style diagnostic datasets for Witch Mountain Bridge.
//
// A balancing / diagnostic FIXTURE — modeled on the public Slay-the-Spire-2
// card dataset (huggingface.co/datasets/t22000t/slay-the-spire-2-cards),
// adapted to our sentence-engine cards, plus a parallel enemy table.
//
// Like sim/playSimV2.js, it IMPORTS the live data modules
// (src/cards/{wit,handler,jnsq}-v2.js, src/data/enemies.js) so the datasets
// structurally cannot drift from what the game ships. It is wired as
// pre{dev,build} in package.json, so the fixture refreshes automatically
// whenever the game is run or built; run it directly to refresh on demand:
//
//   node tools/build-dataset.mjs
//
// Outputs to dataset/:
//   cards/{cards.json,cards.jsonl,cards.csv,README.md}
//   enemies/{enemies.json,enemies.jsonl,enemies.csv,README.md}
//   README.md  (top-level provenance)
//
// STS2 image columns (image, image_resolution) are dropped — our cards are
// text fragments, not art. raw_json keeps full fidelity on every row.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { WIT_V2 } from '../src/cards/wit-v2.js';
import { HANDLER_V2 } from '../src/cards/handler-v2.js';
import { JNSQ_V2 } from '../src/cards/jnsq-v2.js';
import { ENEMIES } from '../src/data/enemies.js';
import { ANIMALS, ADJACENCY_COMBOS } from '../src/data/animals.js';

const GAME = 'Witch Mountain Bridge';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'dataset');

// =============================================================================
// SHARED HELPERS
// =============================================================================
function num(v) { return typeof v === 'number' ? v : ''; }

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Write one logical dataset in all three formats + a README.
function writeDataset(subdir, columns, rows, readme) {
  const dir = join(OUT_DIR, subdir);
  mkdirSync(dir, { recursive: true });
  const base = subdir; // file basename matches the folder (cards/, enemies/)
  writeFileSync(join(dir, `${base}.json`), JSON.stringify(rows, null, 2));
  writeFileSync(join(dir, `${base}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => csvCell(r[c])).join(',')).join('\n');
  writeFileSync(join(dir, `${base}.csv`), header + '\n' + body + '\n');
  writeFileSync(join(dir, 'README.md'), readme);
}

function tally(rows, key) {
  const out = {};
  for (const r of rows) out[r[key]] = (out[r[key]] || 0) + 1;
  return out;
}

// =============================================================================
// CARDS DATASET
// =============================================================================
const CARD_COLUMNS = [
  'id', 'game', 'name', 'lane', 'slot', 'type', 'rarity', 'tier', 'cost',
  'phrase', 'description', 'flavor', 'keywords',
  'scale_by', 'damage', 'damage_multiplier', 'damage_type',
  'stat_contribution', 'block', 'card_draw', 'self_damage',
  'status_effects_applied', 'summon', 'feed_key', 'mechanics',
  'modifier_kind', 'raw_json',
];

// Keys surfaced as their own columns or pure bookkeeping — not re-listed in
// the `mechanics` summary column.
const CARD_COLUMN_KEYS = new Set([
  'id', 'name', 'lane', 'slot', 'type', 'rarity', 'tier', 'cost', 'phrase',
  'desc', 'flavor', 'tags', 'stats', 'effect', 'effects', 'modifierEffect',
  'modifierKind', 'summon', 'feedKey',
  'setId', 'setSlot', 'schoolId', 'icon', 'identity', 'theme', 'voice',
]);

function cardStatusEffects(card) {
  const out = [];
  const eat = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number' && v !== 0) out.push(`${k}:${v}`);
    }
  };
  if (card.effects) {
    for (const k of ['weak', 'vulnerable']) {
      if (typeof card.effects[k] === 'number') out.push(`${k}:${card.effects[k]}`);
    }
  }
  eat(card.effect?.rider);
  eat(card.modifierEffect?.rider);
  eat(card.modifierEffect?.tier3Payoff?.rider);
  return out.join('|');
}

function cardMechanics(card) {
  const keys = new Set();
  for (const [k, v] of Object.entries(card)) {
    if (CARD_COLUMN_KEYS.has(k)) continue;
    if (v === undefined || v === null || v === false) continue;
    keys.add(k);
  }
  const nested = (obj, skip) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (skip.has(k)) continue;
      if (v === undefined || v === null || v === false) continue;
      keys.add(k);
    }
  };
  nested(card.effect, new Set(['base', 'multiplier', 'damageType', 'scaleBy', 'rider', 'drawAfterCast']));
  nested(card.modifierEffect, new Set(['rider']));
  return [...keys].sort().join('|');
}

function cardSummon(card) {
  const s = card.summon;
  if (!s) return '';
  const who = s.animalId || (s.animalIds ? s.animalIds.join('/') : '');
  const when = s.turnsToArrive != null ? ` in ${s.turnsToArrive}T` : '';
  return who ? `${who}${when}` : '';
}

function cardDescription(card) {
  if (card.desc) return card.desc;
  const bits = [];
  const stat = card.stats?.[card.lane];
  if (stat) bits.push(`+${stat} ${card.lane}`);
  const e = card.effects || {};
  if (e.draw) bits.push(`Draw ${e.draw}`);
  if (e.block) bits.push(`Block ${e.block}`);
  if (e.loseHp) bits.push(`Lose ${e.loseHp} HP`);
  const st = cardStatusEffects(card);
  if (st) bits.push(`Apply ${st}`);
  return bits.join('. ') || (card.phrase ? `Spell fragment: "${card.phrase}"` : '');
}

function cardRow(card) {
  const eff = card.effect || {};
  const e = card.effects || {};
  const draw = (e.draw || 0) + (eff.drawAfterCast || 0);
  const self = (e.loseHp || 0) + (eff.loseHpOnCast || 0);
  return {
    id: card.id,
    game: GAME,
    name: card.name || card.phrase || card.id,
    lane: card.lane || '',
    slot: card.slot || '',
    type: card.type || '',
    rarity: card.rarity || '',
    tier: num(card.tier),
    cost: num(card.cost),
    phrase: card.phrase || '',
    description: cardDescription(card),
    flavor: card.flavor || '',
    keywords: (card.tags || []).join('|'),
    scale_by: eff.scaleBy || '',
    damage: num(eff.base),
    damage_multiplier: num(eff.multiplier),
    damage_type: eff.damageType || '',
    stat_contribution: num(card.stats?.[card.lane]),
    block: num(e.block),
    card_draw: draw || '',
    self_damage: self || '',
    status_effects_applied: cardStatusEffects(card),
    summon: cardSummon(card),
    feed_key: card.feedKey || '',
    mechanics: cardMechanics(card),
    modifier_kind: card.modifierKind || '',
    raw_json: JSON.stringify(card),
  };
}

function buildCards() {
  const cards = [...WIT_V2, ...HANDLER_V2, ...JNSQ_V2];
  const rows = cards.map(cardRow);
  const byLane = tally(rows, 'lane');
  const byRarity = tally(rows, 'rarity');
  const readme = `# ${GAME} — Card Dataset

Every playable card, modeled on the schema of the
[Slay the Spire 2 card dataset](https://huggingface.co/datasets/t22000t/slay-the-spire-2-cards).

**${rows.length} cards.** Generated by \`tools/build-dataset.mjs\`, which imports the
live card modules (\`src/cards/{wit,handler,jnsq}-v2.js\`) — so the dataset cannot
drift from what the game ships. It auto-refreshes on \`npm run dev\`/\`build\`.

## Files
- \`cards.json\` — array of row objects
- \`cards.jsonl\` — one row per line (HF-friendly)
- \`cards.csv\` — flat table

## By lane (the three wizard "classes", analogous to STS color)
${Object.entries(byLane).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}

## By rarity
${Object.entries(byRarity).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Schema
${CARD_COLUMNS.map(c => `- \`${c}\``).join('\n')}

### STS2 → ${GAME} mapping
- **lane** stands in for STS2 \`color\` — wit (Scholar), handler (Animal Summoner),
  jnsq (drunken wizard).
- **slot** + **type** replace STS2's single \`type\` (Attack/Skill/Power). Our
  cards compose a spell *sentence* (intro + subject + target + modifiers), so the
  slot a card fills matters as much as its type.
- **phrase** is the composable text fragment — no STS2 analog.
- **damage / damage_multiplier / damage_type** describe target cards; cast damage
  is \`(damage + tray_stat × multiplier) × spell_tier_multiplier\`.
- **status_effects_applied** mirrors the STS2 column (weak / vulnerable / …).
- **mechanics** is a scannable pipe-list of special keys (\`tierWildcard\`,
  \`predator\`, \`threadScaling\`, \`summon\`, …); \`raw_json\` holds the full card.
- Image columns are dropped — these cards are text, not art.
`;
  writeDataset('cards', CARD_COLUMNS, rows, readme);
  return { count: rows.length, byLane, byRarity };
}

// =============================================================================
// ENEMIES DATASET
// =============================================================================
const ENEMY_COLUMNS = [
  'id', 'game', 'name', 'act', 'tier', 'diff',
  'composure_max', 'hp_max', 'physical_immune',
  'num_behaviors', 'behavior_kinds',
  'exp_dmg_per_turn', 'exp_hp_dmg', 'exp_composure_dmg',
  'max_attack', 'applies_weak', 'applies_vulnerable',
  'insult_vulnerabilities', 'special_flags', 'duo_partner',
  'behaviors', 'flavor', 'raw_json',
];

// Per-behavior raw attack value (multi attacks count × value). Non-attacks → 0.
function behaviorDamage(b) {
  if (b.kind === 'attack') return b.value || 0;
  if (b.kind === 'attack-multi') return (b.value || 0) * (b.count || 1);
  if (b.kind === 'charge') return b.value || 0; // lands next turn, but it's damage
  return 0;
}

// Weighted expected damage per turn, split by pool. composure-pool attacks are
// flagged `pool: 'composure'`; everything else lands on HP. `maul` attacks are
// HP-pool block-checks, counted as HP damage for the expectation.
function enemyExpectations(behaviors) {
  const totalWeight = behaviors.reduce((s, b) => s + (b.weight || 0), 0) || 1;
  let hp = 0, comp = 0, max = 0;
  for (const b of behaviors) {
    const dmg = behaviorDamage(b);
    if (dmg > max) max = dmg;
    const w = (b.weight || 0) / totalWeight;
    if (b.pool === 'composure') comp += dmg * w;
    else hp += dmg * w;
  }
  return {
    expHp: Math.round(hp * 10) / 10,
    expComp: Math.round(comp * 10) / 10,
    expTotal: Math.round((hp + comp) * 10) / 10,
    max,
  };
}

// Non-behavior, non-column top-level flags that change how the enemy plays.
const ENEMY_FLAG_KEYS = ['summonerOnly', 'escalatingMaul'];

function enemyRow(enemy) {
  const behaviors = enemy.behaviors || [];
  const { expHp, expComp, expTotal, max } = enemyExpectations(behaviors);
  const kinds = [...new Set(behaviors.map(b => b.kind))].sort();
  const appliesWeak = behaviors.some(b => b.kind === 'weak' || b.riders?.weak);
  const appliesVuln = behaviors.some(b => b.kind === 'vulnerable' || b.riders?.vulnerable);
  const flags = ENEMY_FLAG_KEYS.filter(k => enemy[k]);
  return {
    id: enemy.id,
    game: GAME,
    name: enemy.name,
    act: num(enemy.act),
    tier: enemy.tier || '',
    diff: num(enemy.diff),
    composure_max: num(enemy.composureMax),
    hp_max: num(enemy.hpMax),
    // hpMax 999 is the project's "physically immune, defeat via composure" sentinel.
    physical_immune: enemy.hpMax === 999,
    num_behaviors: behaviors.length,
    behavior_kinds: kinds.join('|'),
    exp_dmg_per_turn: expTotal,
    exp_hp_dmg: expHp,
    exp_composure_dmg: expComp,
    max_attack: max,
    applies_weak: appliesWeak,
    applies_vulnerable: appliesVuln,
    insult_vulnerabilities: (enemy.insultVulnerabilities || []).join('|'),
    special_flags: flags.join('|'),
    duo_partner: enemy.duoPartnerId || '',
    behaviors: JSON.stringify(behaviors),
    flavor: enemy.flavor || '',
    raw_json: JSON.stringify(enemy),
  };
}

function buildEnemies() {
  const rows = ENEMIES.map(enemyRow);
  const byAct = tally(rows, 'act');
  const byTier = tally(rows, 'tier');
  const readme = `# ${GAME} — Enemy Dataset

Every enemy in the roster, as a balancing/diagnostic counterpart to the card
dataset. Generated by \`tools/build-dataset.mjs\` from the live source
(\`src/data/enemies.js\`) — the same module \`sim/playSimV2.js\` runs against, so
stats and behaviors cannot drift. Auto-refreshes on \`npm run dev\`/\`build\`.

## Files
- \`enemies.json\` — array of row objects
- \`enemies.jsonl\` — one row per line
- \`enemies.csv\` — flat table

**${rows.length} enemies.**

## By act
${Object.entries(byAct).map(([k, v]) => `- act ${k}: ${v}`).join('\n')}

## By tier
${Object.entries(byTier).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Schema
${ENEMY_COLUMNS.map(c => `- \`${c}\``).join('\n')}

### Notes
- **composure_max / hp_max** are the two defeat pools. \`hp_max: 999\` is the
  project's "physically immune — beat it on composure" sentinel; surfaced as the
  **physical_immune** boolean.
- **exp_dmg_per_turn** is the weight-averaged expected attack value across the
  enemy's intent table, split into **exp_hp_dmg** and **exp_composure_dmg** by
  each behavior's pool. attack-multi counts as value × count; charge counts the
  telegraphed hit; non-attack intents (block / heal / weave / maul-utility …)
  count as 0 damage. **max_attack** is the single biggest telegraphed hit.
- **behavior_kinds** lists the distinct intent kinds (attack / attack-multi /
  block / weak / vulnerable / heal / charge / summon / maul / weave / …).
- **insult_vulnerabilities** are the tags that pierce this enemy hardest (Sway).
- **behaviors** holds the full weighted intent table; **raw_json** the full enemy.
`;
  writeDataset('enemies', ENEMY_COLUMNS, rows, readme);
  return { count: rows.length, byAct, byTier };
}

// =============================================================================
// ANIMALS DATASET
//
// Animals are the Handler lane's actual damage dealers — summoned entities,
// not cards. To make them comparable to STS-style one-shot cards, the headline
// metric is `lifetime_damage` (attack × duration + composure exit damage): the
// total a body delivers across its stay, which lines up against a card's single
// damage number.
// =============================================================================
const ANIMAL_COLUMNS = [
  'id', 'game', 'name', 'icon', 'role',
  'attack', 'attack_pool', 'duration', 'lifetime_damage',
  'feed_key', 'summoned_by', 'summon_source', 'elite_variant',
  'is_special', 'is_keeper',
  'on_attack', 'on_exit', 'turn_grant',
  'trained_attack', 'trained_duration', 'trained_lifetime_damage',
  'mechanics', 'flavor', 'description', 'raw_json',
];

// Top-level fields surfaced as columns or pure presentation — excluded from the
// `mechanics` summary.
const ANIMAL_COLUMN_KEYS = new Set([
  'name', 'icon', 'attack', 'attackPool', 'duration', 'feedKey', 'elite',
  'special', 'keeper', 'onAttack', 'onExit', 'turnGrant', 'upgrade',
  'flavor', 'desc',
]);

// Reverse index: animalId → lures that summon it (from the live handler cards).
function buildSummonIndex() {
  const idx = {};
  for (const card of HANDLER_V2) {
    const s = card.summon;
    if (!s) continue;
    const ids = s.animalId ? [s.animalId] : (s.animalIds || []);
    for (const id of ids) (idx[id] ||= []).push(card.name);
  }
  return idx;
}

// Sets of animals that arrive by means OTHER than a lure, for summon_source.
function buildArrivalSets() {
  const predators = new Set();
  const elites = new Set();
  const spawns = new Set();
  for (const a of Object.values(ANIMALS)) {
    for (const row of a.predatorRoll?.table || []) for (const id of row.ids) predators.add(id);
    if (a.predatorChain?.animalId) predators.add(a.predatorChain.animalId);
    if (a.elite) elites.add(a.elite);
    if (a.adjacentSpawn?.animalId) spawns.add(a.adjacentSpawn.animalId);
  }
  return { predators, elites, spawns };
}

// composure damage a body delivers over its whole stay: per-turn attack × turns
// + a composure-typed exit hit. Utility/0-attack animals score their exit hit
// only (their value is the verb, captured in `mechanics`/`description`).
function lifetimeDamage(attack, duration, onExit) {
  let dmg = (attack || 0) * (duration || 0);
  if (onExit?.damage && (onExit.damageType === 'composure' || !onExit.damageType)) {
    dmg += onExit.damage;
  }
  return dmg;
}

function kvSummary(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => (typeof v === 'boolean' ? (v ? k : '') : `${k}:${v}`))
    .filter(Boolean)
    .join('|');
}

function animalRole(a) {
  // Descriptions lead with "THE HEAVY HITTER." / "THE CYCLER." etc.
  const m = (a.desc || '').match(/THE ([A-Z][A-Z- ]+?)[.—]/);
  if (m) return m[1].trim();
  if (a.keeper) return 'KEEPER';
  if (a.special) return 'UTILITY';
  return '';
}

function animalMechanics(a) {
  const keys = new Set();
  for (const [k, v] of Object.entries(a)) {
    if (ANIMAL_COLUMN_KEYS.has(k)) continue;
    if (v === undefined || v === null || v === false) continue;
    keys.add(k === 'activatedAbility' && v?.id ? `activatedAbility:${v.id}` : k);
  }
  // redirectEnemyAttack lives inside onExit — surface it as a mechanic too.
  if (a.onExit?.redirectEnemyAttack) keys.add('redirectEnemyAttack');
  return [...keys].sort().join('|');
}

function animalRow(id, a, summonIdx, arrival) {
  const summonedBy = summonIdx[id] || [];
  let source = summonedBy.length ? 'lure'
    : arrival.predators.has(id) ? 'predator'
    : arrival.elites.has(id) ? 'elite-upgrade'
    : arrival.spawns.has(id) ? 'adjacent-spawn'
    : '';
  const up = a.upgrade || {};
  const trainedAttack = up.attack ?? a.attack;
  const trainedDuration = up.duration ?? a.duration;
  return {
    id,
    game: GAME,
    name: a.name,
    icon: a.icon || '',
    role: animalRole(a),
    attack: num(a.attack),
    attack_pool: a.attackPool || '',
    duration: num(a.duration),
    lifetime_damage: lifetimeDamage(a.attack, a.duration, a.onExit),
    feed_key: a.feedKey || '',
    summoned_by: summonedBy.join('|'),
    summon_source: source,
    elite_variant: a.elite || '',
    is_special: !!a.special,
    is_keeper: !!a.keeper,
    on_attack: kvSummary(a.onAttack),
    on_exit: kvSummary(a.onExit),
    turn_grant: kvSummary(a.turnGrant),
    trained_attack: num(trainedAttack),
    trained_duration: num(trainedDuration),
    trained_lifetime_damage: lifetimeDamage(trainedAttack, trainedDuration, up.onExit || a.onExit),
    mechanics: animalMechanics(a),
    flavor: a.flavor || '',
    description: a.desc || '',
    raw_json: JSON.stringify(a),
  };
}

const COMBO_COLUMNS = ['name', 'icon', 'pair', 'damage', 'pool', 'riders', 'description'];
function comboRow(c) {
  const riders = kvSummary({
    weak: c.applyWeak, vulnerable: c.applyVulnerable, draw: c.draw, block: c.block,
  });
  return {
    name: c.name,
    icon: c.icon || '',
    pair: `${c.a}+${c.b}`,
    damage: num(c.damage),
    pool: c.pool || '',
    riders,
    description: c.desc || '',
  };
}

function buildAnimals() {
  const summonIdx = buildSummonIndex();
  const arrival = buildArrivalSets();
  const rows = Object.entries(ANIMALS).map(([id, a]) => animalRow(id, a, summonIdx, arrival));
  const comboRows = ADJACENCY_COMBOS.map(comboRow);
  const bySource = tally(rows, 'summon_source');

  const readme = `# ${GAME} — Animal Dataset

The Handler lane's combatants. Animals are summoned entities (not cards) that
occupy a stage slot and attack each turn, so this is the table that makes the
Handler comparable to the other lanes' damage cards. Generated by
\`tools/build-dataset.mjs\` from the live source (\`src/data/animals.js\`) — the
same module \`sim/playSimV2.js\` runs against. Auto-refreshes on \`npm run dev\`/\`build\`.

## Files
- \`animals.json\` / \`animals.jsonl\` / \`animals.csv\` — the roster (${rows.length} animals)
- \`combos.json\` / \`combos.csv\` — ${comboRows.length} adjacency combos (joint attacks when two
  species sit in adjacent slots)

## By summon source
${Object.entries(bySource).map(([k, v]) => `- ${k || '(other)'}: ${v}`).join('\n')}

## Schema (animals)
${ANIMAL_COLUMNS.map(c => `- \`${c}\``).join('\n')}

### Comparing animals to cards
- **lifetime_damage** = \`attack × duration\` + composure exit damage. This is the
  apples-to-apples number against a card's one-shot \`damage\`: a Goose (6×2 + 3 =
  **15**) is roughly a mid-tier finisher that also costs a slot and a turn to land.
- **trained_lifetime_damage** is the same after the animal's \`upgrade\` (Basic
  Training). 0-attack utility animals score only their exit hit — their value is
  the **mechanics** verb (amplify / reflect / tempo-lock / intent-scramble / …),
  not raw damage.
- **summoned_by** lists the lure card(s) that bring the animal; **summon_source**
  distinguishes lure / predator (swoops on bait) / elite-upgrade (rare variant) /
  adjacent-spawn.
- **mechanics** is a scannable pipe-list of special engine fields
  (\`predatorRoll\`, \`eatsAdjacent\`, \`amplifyAdjacent\`, \`birdTheft\`,
  \`copiesHighest\`, \`thorns\`, \`slowsEnemy\`, \`activatedAbility:*\`, \`turnGrant\`, …);
  \`raw_json\` holds the full animal.
- **on_attack / on_exit / turn_grant** summarize the per-turn and send-off riders
  (draw, block, heal, applyWeak, …).
`;
  writeDataset('animals', ANIMAL_COLUMNS, rows, readme);
  // Secondary combos table in the same folder.
  const dir = join(OUT_DIR, 'animals');
  writeFileSync(join(dir, 'combos.json'), JSON.stringify(comboRows, null, 2));
  const header = COMBO_COLUMNS.join(',');
  const body = comboRows.map(r => COMBO_COLUMNS.map(c => csvCell(r[c])).join(',')).join('\n');
  writeFileSync(join(dir, 'combos.csv'), header + '\n' + body + '\n');

  return { count: rows.length, combos: comboRows.length, bySource };
}

// =============================================================================
// RUN
// =============================================================================
const cards = buildCards();
const enemies = buildEnemies();
const animals = buildAnimals();

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'README.md'), `# ${GAME} — Diagnostic Datasets

STS2-style fixtures for balancing and metric comparison. Modeled on the
[Slay the Spire 2 card dataset](https://huggingface.co/datasets/t22000t/slay-the-spire-2-cards).

Generated by \`tools/build-dataset.mjs\`, which imports the **live** game data
(\`src/cards/*\`, \`src/data/enemies.js\`) so the fixtures cannot drift from what
ships. Wired as \`predev\`/\`prebuild\` in package.json — refreshes automatically
whenever the game is run or built. Refresh on demand with \`npm run dataset\`.

- [\`cards/\`](./cards/README.md) — ${cards.count} cards
- [\`enemies/\`](./enemies/README.md) — ${enemies.count} enemies
- [\`animals/\`](./animals/README.md) — ${animals.count} Handler animals + ${animals.combos} adjacency combos
`);

console.log(`cards:   ${cards.count}`, cards.byLane);
console.log(`enemies: ${enemies.count}`, enemies.byTier);
console.log(`animals: ${animals.count} (+${animals.combos} combos)`, animals.bySource);
