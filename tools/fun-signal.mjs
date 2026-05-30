#!/usr/bin/env node
// Fun Signal — telemetry-derived "was this run fun?" score.
//
// Designed against Alan's 2026-05-30 wit-death-run reaction
// ("really engaged, bonus cards felt like bonus cards, I worked to cast
// the spells, I failed at defense"). The composite scored 93% on that
// run, calibrated as the high-water mark.
//
// Usage:
//   node tools/fun-signal.mjs <telemetry.json>
//   node tools/fun-signal.mjs <telemetry.json> --all-sessions
//
// Default: scores ONLY the latest session containing a run.end event
// (the "death run" or "win run"). Use --all-sessions to score every
// session in the file individually.

import fs from 'fs';
import path from 'path';

const BUFF_CARD_IDS = new Set([
  'wv2-k-and-another-thing', 'wv2-k-already-thought-of-that',
  'wv2-k-hidden-meaning', 'wv2-k-enhanced-reasoning',
  'wv2-k-you-know-what-i-mean', 'wv2-k-myriad-of-reasons',
  'wv2-k-that-goes-for-all-of-you', 'wv2-k-blow-to-the-ego',
  'wv2-k-verbal-smack', 'wv2-k-i-wont-hear-of-it',
  'wv2-k-solid-argument', 'wv2-k-to-the-rafters', 'wv2-k-the-tutor',
  'wv2-k-where-was-i', 'wv2-k-threading-needle', 'wv2-k-to-the-point',
]);

function scoreSession(s) {
  const ev = s.events || [];
  if (ev.length === 0) return null;

  // 1. Buff engagement — did the drafted buff cards actually get played?
  const drafted = new Set();
  for (const p of ev.filter(e => e.type === 'pick.card')) {
    if (BUFF_CARD_IDS.has(p.payload?.cardId)) drafted.add(p.payload.cardId);
  }
  const played = new Set();
  for (const p of ev.filter(e => e.type === 'combat.card_play')) {
    if (BUFF_CARD_IDS.has(p.payload?.cardId)) played.add(p.payload.cardId);
  }
  const usedDrafted = [...drafted].filter(id => played.has(id)).length;
  const buffEngagement = drafted.size > 0 ? usedDrafted / drafted.size : 1.0;

  // 2. FFT rate — full Fully Formed Thought casts / total casts.
  const ffts = ev.filter(e => e.type === 'wit.fft.cast').length;
  const totalCasts = ev.filter(e => e.type === 'combat.spell_cast').length;
  const fftRate = totalCasts > 0 ? ffts / totalCasts : 0;

  // 3. Run arc — how many combats survived before loss/end.
  const ends = ev.filter(e => e.type === 'combat.end');
  const wins = ends.filter(e => e.payload?.outcome === 'won').length;
  const runArcScore = Math.min(1.0, wins / 7);

  // 4. HP attrition smoothness — meaningful decline without one-shot.
  const starts = ev.filter(e => e.type === 'combat.start');
  const hps = starts.map(s => s.payload.hp);
  let attritionScore = 0;
  let hpRange = 0;
  if (hps.length >= 2) {
    hpRange = Math.max(...hps) - Math.min(...hps);
    const ideal = 25;
    attritionScore = 1 - Math.min(1, Math.abs(hpRange - ideal) / 25);
  }

  // 5. Hold rate — staging vs casting balance. Sweet spot 50%.
  const te = ev.filter(e => e.type === 'combat.turn_end').length;
  const holdRatio = te > 0 ? (te - totalCasts) / te : 0;
  const holdScore = Math.max(0, 1 - Math.abs(holdRatio - 0.5) * 2);

  // 6. Variety — different FFT rows + different buff cards played.
  const fftRows = new Set(ev.filter(e => e.type === 'wit.fft.cast').map(e => e.payload?.rowId));
  const buffsPlayedKinds = played.size;
  const varietyScore = Math.min(1.0, (fftRows.size + buffsPlayedKinds) / 6);

  // 7. Death context — fairness of the loss. Died to elite/boss after
  // 3+ wins is "earned"; first-combat KO is "unfair".
  const re = ev.find(e => e.type === 'run.end');
  const died = re?.payload?.outcome === 'lost';
  let deathContextScore = 1.0;
  let killer = '—';
  if (died) {
    const lastEnd = ends[ends.length - 1];
    const tier = lastEnd?.payload?.tier;
    killer = re.payload?.killedBy || lastEnd?.payload?.enemyId || '?';
    const isEliteOrBoss = tier === 'elite' || tier === 'boss';
    deathContextScore = wins >= 3 ? (isEliteOrBoss ? 1.0 : 0.7) : 0.3;
  }

  const weights = { buff: 0.15, fft: 0.15, arc: 0.20, attr: 0.15, hold: 0.15, var: 0.10, death: 0.10 };
  const composite = (
    buffEngagement * weights.buff +
    fftRate * weights.fft +
    runArcScore * weights.arc +
    attritionScore * weights.attr +
    holdScore * weights.hold +
    varietyScore * weights.var +
    deathContextScore * weights.death
  );

  const verdict = composite > 0.75 ? 'HIGHLY FUN'
                : composite > 0.55 ? 'FUN'
                : composite > 0.35 ? 'MIXED'
                : 'NOT FUN';

  return {
    startedAt: s.startedAt,
    composite,
    verdict,
    metrics: {
      buffEngagement: { score: buffEngagement, drafted: drafted.size, used: usedDrafted },
      fftRate:        { score: fftRate, ffts, totalCasts },
      runArc:         { score: runArcScore, wins, died },
      attrition:      { score: attritionScore, hpRange, hps: hps.slice(0, 12) },
      hold:           { score: holdScore, ratio: holdRatio, holds: te - totalCasts, turns: te },
      variety:        { score: varietyScore, fftRowKinds: fftRows.size, buffKinds: buffsPlayedKinds },
      death:          { score: deathContextScore, killer, died },
    },
  };
}

function formatPct(n) { return (n * 100).toFixed(0) + '%'; }

function printReport(r) {
  console.log('\n=== FUN SIGNAL — ' + r.startedAt + ' ===\n');
  console.log('  Buff engagement:      ' + formatPct(r.metrics.buffEngagement.score).padStart(5) +
              '   (drafted ' + r.metrics.buffEngagement.drafted + ', played ' + r.metrics.buffEngagement.used + ')');
  console.log('  FFT rate:             ' + formatPct(r.metrics.fftRate.score).padStart(5) +
              '   (' + r.metrics.fftRate.ffts + '/' + r.metrics.fftRate.totalCasts + ' full FFTs)');
  console.log('  Run arc:              ' + formatPct(r.metrics.runArc.score).padStart(5) +
              '   (' + r.metrics.runArc.wins + ' wins, ' + (r.metrics.runArc.died ? 'died' : 'won/ongoing') + ')');
  console.log('  Attrition smoothness: ' + formatPct(r.metrics.attrition.score).padStart(5) +
              '   (HP range ' + r.metrics.attrition.hpRange + ', ideal 25)');
  console.log('  Hold rate balance:    ' + formatPct(r.metrics.hold.score).padStart(5) +
              '   (' + formatPct(r.metrics.hold.ratio) + ' holds; sweet spot 50%)');
  console.log('  Variety:              ' + formatPct(r.metrics.variety.score).padStart(5) +
              '   (' + r.metrics.variety.fftRowKinds + ' FFT rows, ' + r.metrics.variety.buffKinds + ' buff kinds)');
  console.log('  Death context:        ' + formatPct(r.metrics.death.score).padStart(5) +
              '   (' + (r.metrics.death.died ? 'killed by ' + r.metrics.death.killer : 'no death') + ')');
  console.log('\n  COMPOSITE: ' + formatPct(r.composite) + '  →  ' + r.verdict + '\n');
}

const args = process.argv.slice(2);
const file = args[0];
const allSessions = args.includes('--all-sessions');
if (!file) {
  console.error('Usage: node tools/fun-signal.mjs <telemetry.json> [--all-sessions]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const sessions = Array.isArray(data) ? data : [data];

if (allSessions) {
  for (const s of sessions) {
    const r = scoreSession(s);
    if (r) printReport(r);
  }
} else {
  // Find latest session containing a run.end event.
  let target = null;
  for (let i = sessions.length - 1; i >= 0; i--) {
    if ((sessions[i].events || []).find(e => e.type === 'run.end')) {
      target = sessions[i];
      break;
    }
  }
  if (!target) {
    // Fallback: pick the latest session with FFT casts (likely the active run).
    for (let i = sessions.length - 1; i >= 0; i--) {
      if ((sessions[i].events || []).some(e => e.type === 'wit.fft.cast')) {
        target = sessions[i];
        break;
      }
    }
  }
  if (!target) {
    console.log('No scoreable session found.');
    process.exit(0);
  }
  const r = scoreSession(target);
  if (r) printReport(r);
}
