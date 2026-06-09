// Build a Slay-the-Spire-2-style dataset for Witch Mountain Bridge cards.
//
// Models the schema of the public STS2 card dataset
// (huggingface.co/datasets/t22000t/slay-the-spire-2-cards), adapted to our
// sentence-engine cards. Like sim/playSimV2.js, it IMPORTS the live card
// modules so the dataset structurally cannot drift from what the game ships.
//
//   node tools/build-card-dataset.mjs
//
// Outputs to dataset/cards/:
//   - cards.json   (array of row objects — full tabular view)
//   - cards.jsonl  (one row per line — HF-friendly)
//   - cards.csv     (flat table, mirrors the STS2 column layout)
//   - README.md     (schema + provenance, mirroring the HF dataset card)
//
// STS2 image columns (image, image_resolution) are intentionally dropped —
// our cards are text fragments, not art. raw_json keeps full fidelity.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { WIT_V2 } from '../src/cards/wit-v2.js';
import { HANDLER_V2 } from '../src/cards/handler-v2.js';
import { JNSQ_V2 } from '../src/cards/jnsq-v2.js';

const GAME = 'Witch Mountain Bridge';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'dataset', 'cards');

// ---------------------------------------------------------------------------
// Column order — mirrors the STS2 dataset, with game-specific analogs.
//   color → lane (the three wizard "classes": wit / handler / jnsq)
//   STS2 "type" (Attack/Skill/Power) → our `type` + `slot` (intro/subject/
//     target/modifier/lure), since our cards compose a spell sentence.
// ---------------------------------------------------------------------------
const COLUMNS = [
  'id', 'game', 'name', 'lane', 'slot', 'type', 'rarity', 'tier', 'cost',
  'phrase', 'description', 'flavor', 'keywords',
  'scale_by', 'damage', 'damage_multiplier', 'damage_type',
  'stat_contribution', 'block', 'card_draw', 'self_damage',
  'status_effects_applied', 'summon', 'feed_key', 'mechanics',
  'modifier_kind', 'raw_json',
];

// Keys that are surfaced as their own columns or are pure bookkeeping — they
// should NOT be re-listed in the `mechanics` summary column.
const COLUMN_KEYS = new Set([
  'id', 'name', 'lane', 'slot', 'type', 'rarity', 'tier', 'cost', 'phrase',
  'desc', 'flavor', 'tags', 'stats', 'effect', 'effects', 'modifierEffect',
  'modifierKind', 'summon', 'feedKey',
  // authoring/meta bookkeeping, not gameplay mechanics
  'setId', 'setSlot', 'schoolId', 'icon', 'identity', 'theme', 'voice',
]);

function num(v) { return typeof v === 'number' ? v : ''; }

// Collect weak/vulnerable/etc. applied to the enemy, from every place a card
// can declare them: top-level effects, target effect.rider, modifier riders.
function statusEffects(card) {
  const out = [];
  const eat = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number' && v !== 0) out.push(`${k}:${v}`);
    }
  };
  // effects.{weak,vulnerable} live alongside draw/block; pull only the debuffs.
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

// A scannable list of the "interesting" mechanic keys a card carries, beyond
// the broken-out columns. Pulls top-level special flags plus the notable
// scaling/condition keys nested inside effect / modifierEffect.
function mechanics(card) {
  const keys = new Set();
  for (const [k, v] of Object.entries(card)) {
    if (COLUMN_KEYS.has(k)) continue;
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
  // effect: skip the keys already columned (base/multiplier/damageType/scaleBy/
  // rider/drawAfterCast). Everything else is a real mechanic.
  nested(card.effect, new Set(['base', 'multiplier', 'damageType', 'scaleBy', 'rider', 'drawAfterCast']));
  nested(card.modifierEffect, new Set(['rider']));
  return [...keys].sort().join('|');
}

function summonText(card) {
  const s = card.summon;
  if (!s) return '';
  const who = s.animalId || (s.animalIds ? s.animalIds.join('/') : '');
  const when = s.turnsToArrive != null ? ` in ${s.turnsToArrive}T` : '';
  return who ? `${who}${when}` : '';
}

function description(card) {
  if (card.desc) return card.desc;
  // Words/modifiers rarely carry a desc; synthesize a terse mechanical line so
  // the column is never empty, mirroring STS2's always-present description.
  const bits = [];
  const stat = card.stats?.[card.lane];
  if (stat) bits.push(`+${stat} ${card.lane}`);
  const e = card.effects || {};
  if (e.draw) bits.push(`Draw ${e.draw}`);
  if (e.block) bits.push(`Block ${e.block}`);
  if (e.loseHp) bits.push(`Lose ${e.loseHp} HP`);
  const st = statusEffects(card);
  if (st) bits.push(`Apply ${st}`);
  return bits.join('. ') || (card.phrase ? `Spell fragment: "${card.phrase}"` : '');
}

function toRow(card) {
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
    description: description(card),
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
    status_effects_applied: statusEffects(card),
    summon: summonText(card),
    feed_key: card.feedKey || '',
    mechanics: mechanics(card),
    modifier_kind: card.modifierKind || '',
    raw_json: JSON.stringify(card),
  };
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------------------------------------------------------------------------
const cards = [...WIT_V2, ...HANDLER_V2, ...JNSQ_V2];
const rows = cards.map(toRow);

mkdirSync(OUT_DIR, { recursive: true });

writeFileSync(join(OUT_DIR, 'cards.json'), JSON.stringify(rows, null, 2));
writeFileSync(join(OUT_DIR, 'cards.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');

const header = COLUMNS.join(',');
const body = rows.map(r => COLUMNS.map(c => csvCell(r[c])).join(',')).join('\n');
writeFileSync(join(OUT_DIR, 'cards.csv'), header + '\n' + body + '\n');

// Per-lane and per-rarity tallies for the README.
const byLane = {};
const byRarity = {};
for (const r of rows) {
  byLane[r.lane] = (byLane[r.lane] || 0) + 1;
  byRarity[r.rarity] = (byRarity[r.rarity] || 0) + 1;
}

const readme = `# ${GAME} — Card Dataset

A structured dataset of every playable card in ${GAME}, modeled on the schema of
the [Slay the Spire 2 card dataset](https://huggingface.co/datasets/t22000t/slay-the-spire-2-cards).

**${rows.length} cards.** Generated by \`tools/build-card-dataset.mjs\`, which imports
the live card modules (\`src/cards/{wit,handler,jnsq}-v2.js\`) — so the dataset
cannot drift from what the game ships. Re-run after any card change.

## Files
- \`cards.json\` — array of row objects
- \`cards.jsonl\` — one row per line (HF-friendly)
- \`cards.csv\` — flat table

## By lane (the three wizard "classes", analogous to STS color)
${Object.entries(byLane).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}

## By rarity
${Object.entries(byRarity).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Schema
${COLUMNS.map(c => `- \`${c}\``).join('\n')}

### Notes on the STS2 → ${GAME} mapping
- **lane** stands in for STS2 \`color\` — wit (the Scholar), handler (the Animal
  Summoner), jnsq (the drunken wizard).
- **slot** + **type** replace STS2's single \`type\` (Attack/Skill/Power). Our
  cards compose a spell *sentence*: intro + subject + target (+ modifiers), so
  the slot a card fills matters as much as its type.
- **phrase** is the composable text fragment — the heart of the verbal-combat
  engine; it has no STS2 analog.
- **damage** / **damage_multiplier** / **damage_type** describe target cards,
  whose damage is \`(damage + tray_stat × multiplier) × spell_tier_multiplier\`.
- **status_effects_applied** mirrors the STS2 column (weak / vulnerable / etc.).
- **mechanics** is a scannable pipe-list of special keys a card carries
  (e.g. \`tierWildcard\`, \`predator\`, \`threadScaling\`, \`summon\`); \`raw_json\`
  holds the complete card for full fidelity.
- Image columns from STS2 are dropped — these cards are text, not art.
`;
writeFileSync(join(OUT_DIR, 'README.md'), readme);

console.log(`Wrote ${rows.length} cards to ${OUT_DIR}`);
console.log('  by lane:', byLane);
console.log('  by rarity:', byRarity);
