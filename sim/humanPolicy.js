// Wizard Graduation — human-policy ingest stub.
//
// What this does:
//   Loads a JSON file exported from the in-browser telemetry badge and
//   builds frequency tables over human-player decisions. The greedy sim
//   AI in playSim.js can later be augmented (or replaced) by reading
//   these tables instead of hand-coded heuristics.
//
// Current state: ANALYSIS-ONLY stub. We don't yet have human session data
// to learn from. This module exists so that:
//   (1) the moment Alan exports a JSON file, we have a tested pipeline
//       to look at it.
//   (2) the sim's aiPickReward / pickMoveDestination / etc. have a clear
//       upgrade path — replace their heuristic with `humanPickReward()`.
//
// To use:
//   node sim/humanPolicy.js path/to/wg-telemetry-2026-05-21T18-00-00.json
// or programmatically:
//   const { loadTelemetryFile, summarize } = require('./humanPolicy.js');
//   const data = loadTelemetryFile('/path/to/file.json');
//   console.log(summarize(data));

import fs from 'fs';
import { fileURLToPath } from 'url';

// =============================================================================
// 1. LOADERS
// =============================================================================

function loadTelemetryFile(path) {
  const raw = fs.readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  // exportAllSessions writes an array of session objects.
  const sessions = Array.isArray(parsed) ? parsed : [parsed];
  return sessions.filter(s => s && Array.isArray(s.events));
}

// Group all events from all sessions into a flat list, annotated with
// sessionId so per-run replay is still possible.
function flattenEvents(sessions) {
  const out = [];
  for (const s of sessions) {
    for (const e of s.events) {
      out.push({ ...e, sessionId: s.sessionId, runStartedAt: s.startedAt });
    }
  }
  return out;
}

// =============================================================================
// 2. AGGREGATIONS
// =============================================================================

// Count how often each (cardId among offered set) gets picked. Discards
// the broader context (HP, enemy, etc.) — this is the simplest learnable
// signal. More-contextual versions would condition on enemy tier, current
// act, deck composition, etc.
function rewardPickFrequency(events) {
  const offered = {};   // cardId -> times in an offered set
  const picked  = {};   // cardId -> times picked
  for (const e of events) {
    if (e.type !== 'pick.card' && e.type !== 'pick.starting') continue;
    const offer = e.payload?.offered || [];
    for (const id of offer) offered[id] = (offered[id] || 0) + 1;
    const pickedId = e.payload?.cardId;
    if (pickedId) picked[pickedId] = (picked[pickedId] || 0) + 1;
  }
  // Pick-rate = picked / offered. Filter to ones offered ≥3 times.
  const rates = {};
  for (const id of Object.keys(offered)) {
    if (offered[id] < 3) continue;
    rates[id] = picked[id] ? picked[id] / offered[id] : 0;
  }
  return { offered, picked, rates };
}

// Count map-node choices conditioned on the offered node-type set. The
// payload includes offeredNodeIds; we look up each via the run's earlier
// MAP_NODE events to recover types. Simpler version: just count chosen
// node-type frequencies overall.
function mapNodeFrequency(events) {
  const typeCount = {};
  for (const e of events) {
    if (e.type !== 'pick.node') continue;
    const t = e.payload?.nodeType;
    if (!t) continue;
    typeCount[t] = (typeCount[t] || 0) + 1;
  }
  return typeCount;
}

// Played-card frequency in combat. Tells us which cards the player
// actually USES (vs which they just collect). Useful for deck-design
// feedback.
function combatPlayFrequency(events) {
  const playCount = {};
  for (const e of events) {
    if (e.type !== 'combat.card_play') continue;
    const id = e.payload?.cardId;
    if (!id) continue;
    playCount[id] = (playCount[id] || 0) + 1;
  }
  return playCount;
}

// Per-enemy win/loss rate from the human's perspective.
function enemyOutcomes(events) {
  const stats = {}; // enemyId -> { won, lost }
  for (const e of events) {
    if (e.type !== 'combat.end') continue;
    const id = e.payload?.enemyId;
    if (!id) continue;
    if (!stats[id]) stats[id] = { won: 0, lost: 0 };
    if (e.payload.outcome === 'won')      stats[id].won++;
    else if (e.payload.outcome === 'lost') stats[id].lost++;
  }
  return stats;
}

function runOutcomes(events) {
  const wins = [];
  const losses = [];
  for (const e of events) {
    if (e.type !== 'run.end') continue;
    if (e.payload?.outcome === 'won')      wins.push(e);
    else if (e.payload?.outcome === 'lost') losses.push(e);
  }
  return { wins, losses, total: wins.length + losses.length };
}

// =============================================================================
// 3. HIGH-LEVEL SUMMARY
// =============================================================================

function summarize(sessions) {
  const events = flattenEvents(sessions);
  const rewards = rewardPickFrequency(events);
  const nodes = mapNodeFrequency(events);
  const plays = combatPlayFrequency(events);
  const enemies = enemyOutcomes(events);
  const runs = runOutcomes(events);

  return {
    sessions: sessions.length,
    totalEvents: events.length,
    runs: { wins: runs.wins.length, losses: runs.losses.length, total: runs.total },
    rewardPickRates: rewards.rates,
    rewardOfferedCount: rewards.offered,
    mapNodeTypeFrequency: nodes,
    cardPlayFrequency: plays,
    enemyOutcomes: enemies,
  };
}

// =============================================================================
// 4. POLICY HOOKS (stubs — wire up once data exists)
// =============================================================================

// humanPickReward(offered, context, frequencyTable) → cardId
// Drop-in replacement for aiPickReward. For now, returns null if no data;
// callers should fall back to the heuristic.
function humanPickReward(offered, frequencyTable) {
  if (!frequencyTable || !offered || offered.length === 0) return null;
  // Pick whichever offered card has the highest pick rate. Ties → first.
  let bestId = null;
  let bestRate = -Infinity;
  for (const card of offered) {
    const id = card?.id || card;
    const rate = frequencyTable[id];
    if (rate == null) continue;
    if (rate > bestRate) { bestRate = rate; bestId = id; }
  }
  return bestId;
}

// =============================================================================
// 5. CLI
// =============================================================================

// ES-module "called directly" check.
const isMain = (typeof process !== 'undefined' && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]);
if (isMain) {
  const inPath = process.argv[2];
  if (!inPath) {
    console.error('Usage: node sim/humanPolicy.js path/to/wg-telemetry-*.json');
    process.exit(1);
  }
  const sessions = loadTelemetryFile(inPath);
  const s = summarize(sessions);
  console.log(`Sessions: ${s.sessions}`);
  console.log(`Events: ${s.totalEvents}`);
  console.log(`Runs: ${s.runs.wins}W / ${s.runs.losses}L (total ${s.runs.total})`);
  console.log(`\nReward pick rates (offered ≥3 times):`);
  const ranked = Object.entries(s.rewardPickRates).sort((a, b) => b[1] - a[1]);
  for (const [id, rate] of ranked) {
    console.log(`  ${id}: ${(rate * 100).toFixed(1)}% (offered ${s.rewardOfferedCount[id]}x)`);
  }
  console.log(`\nMap node type frequency:`);
  for (const [t, c] of Object.entries(s.mapNodeTypeFrequency).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${c}`);
  }
  console.log(`\nMost-played cards in combat (top 15):`);
  const playsRanked = Object.entries(s.cardPlayFrequency).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [id, c] of playsRanked) console.log(`  ${id}: ${c}`);
  console.log(`\nEnemy win/loss:`);
  for (const [id, r] of Object.entries(s.enemyOutcomes).sort((a, b) => (b[1].won + b[1].lost) - (a[1].won + a[1].lost))) {
    const tot = r.won + r.lost;
    console.log(`  ${id}: ${r.won}W / ${r.lost}L (${tot ? Math.round(r.won / tot * 100) : 0}%)`);
  }
}

export {
  loadTelemetryFile,
  flattenEvents,
  rewardPickFrequency,
  mapNodeFrequency,
  combatPlayFrequency,
  enemyOutcomes,
  runOutcomes,
  summarize,
  humanPickReward,
};
