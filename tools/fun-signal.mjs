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

// Challenge + Novelty — lane-agnostic signals added 2026-06-10 after a
// near-full Handler run scored 91% "HIGHLY FUN" while the player reported
// being bored ("same hand over and over, enemies very easy"). The 8 engine
// signals all measure "is the engine working" — which a SOLVED engine
// maximizes — so none of them could see an under-challenged, repetitive win.
// These two close that blind spot:
//   challenge — what fraction of combats actually threatened you? Trivial
//               fights (≤2 HP lost) drag it; meaningful bites (≥5) lift it.
//   novelty   — are you doing something DIFFERENT fight to fight, or replaying
//               one hand? Measured as 1 − the average card-set similarity
//               (Jaccard) between consecutive combats. High similarity = the
//               same loop every fight.
function computeChallengeNovelty(ev) {
  const combats = [];
  let cur = null;
  for (const e of ev) {
    if (e.type === 'combat.start') {
      cur = { cards: new Set(), hpStart: e.payload?.hp ?? null };
    } else if (e.type === 'combat.card_play' && cur) {
      if (e.payload?.cardId) cur.cards.add(e.payload.cardId);
    } else if (e.type === 'combat.end' && cur) {
      cur.hpEnd = e.payload?.hpAfter ?? cur.hpStart;
      combats.push(cur);
      cur = null;
    }
  }
  // Challenge: meaningful-damage fraction minus a penalty for trivial fights.
  let challengeScore = 1.0, meaningful = 0, trivial = 0;
  if (combats.length > 0) {
    for (const c of combats) {
      const lost = (c.hpStart ?? 0) - (c.hpEnd ?? 0);
      if (lost >= 5) meaningful++;
      if (lost <= 2) trivial++;
    }
    const meaningfulFrac = meaningful / combats.length;
    const trivialFrac = trivial / combats.length;
    challengeScore = Math.max(0, Math.min(1, meaningfulFrac - 0.5 * trivialFrac));
  }
  // Novelty: 1 − avg Jaccard similarity of consecutive combats' played-card
  // sets. Needs ≥2 combats with cards; otherwise neutral.
  const sets = combats.map(c => c.cards).filter(set => set.size > 0);
  let sims = [];
  for (let i = 1; i < sets.length; i++) {
    const a = sets[i - 1], b = sets[i];
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const uni = new Set([...a, ...b]).size;
    sims.push(uni ? inter / uni : 1);
  }
  const avgSim = sims.length ? sims.reduce((x, y) => x + y, 0) / sims.length : 0;
  const noveltyScore = sims.length ? Math.max(0, Math.min(1, 1 - avgSim)) : 1.0;
  return {
    challenge: { score: challengeScore, combats: combats.length, meaningful, trivial },
    novelty:   { score: noveltyScore, avgSimilarity: avgSim, comparisons: sims.length },
  };
}

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

  // Challenge + Novelty — same anti-boredom signals as the Handler scorer
  // (see computeChallengeNovelty). Mirrored here so a wit run can't post a
  // flattering score off a solved, under-challenged loop either.
  const cn = computeChallengeNovelty(ev);
  const challengeScore = cn.challenge.score;
  const noveltyScore = cn.novelty.score;

  const weights = { challenge: 0.18, novelty: 0.16, buff: 0.10, fft: 0.12,
                    arc: 0.12, attr: 0.08, hold: 0.10, var: 0.06, death: 0.08 };
  const composite = (
    challengeScore * weights.challenge +
    noveltyScore * weights.novelty +
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
      challenge:      { score: challengeScore, meaningful: cn.challenge.meaningful, trivial: cn.challenge.trivial, combats: cn.challenge.combats },
      novelty:        { score: noveltyScore, avgSimilarity: cn.novelty.avgSimilarity },
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

// Handler (Animal Summoner) scorer — the wit signals (FFT/buff/variety)
// read 0 for a Handler run, so a wit-calibrated score would always brand a
// Handler run "NOT FUN" no matter how it played. This mirrors the 7-signal
// shape against the Handler's identity loop: summon → menagerie attacks →
// feed for the exit bonus → manage Pack Tactics. Reads the Handler-specific
// events (combat.handler_summon / handler_tick / handler_feed / tactic_change).
function scoreHandlerSession(s) {
  const ev = s.events || [];
  if (ev.length === 0) return null;

  const summons = ev.filter(e => e.type === 'combat.handler_summon');
  const ticks   = ev.filter(e => e.type === 'combat.handler_tick');
  const feeds   = ev.filter(e => e.type === 'combat.handler_feed');
  const tactics = ev.filter(e => e.type === 'combat.tactic_change');
  const ends    = ev.filter(e => e.type === 'combat.end');
  const wins    = ends.filter(e => e.payload?.outcome === 'won').length;
  const turns   = ticks.length; // one tick per Handler end-of-turn

  // 1. Summon engagement — is the player actively staging lures? Sweet spot
  //    ~1 summon/turn (the validated chutzpah cadence). Idle turns drag it.
  const summonsPerTurn = turns > 0 ? summons.length / turns : 0;
  const summonScore = Math.min(1.0, summonsPerTurn / 0.8);

  // 2. Output rate — menagerie damage per turn the board was active. The
  //    Handler's "cast": did summoned animals actually convert to pressure?
  const activeTicks = ticks.filter(t => (t.payload?.attacks || 0) > 0);
  const totalDmg = activeTicks.reduce((a, t) => a + (t.payload?.composureDealt || 0) + (t.payload?.hpDealt || 0), 0);
  const avgDmg = activeTicks.length > 0 ? totalDmg / activeTicks.length : 0;
  const outputScore = Math.min(1.0, avgDmg / 8);

  // 3. Run arc — combats survived (lane-agnostic).
  const runArcScore = Math.min(1.0, wins / 7);

  // 4. HP attrition smoothness (lane-agnostic).
  const starts = ev.filter(e => e.type === 'combat.start');
  const hps = starts.map(st => st.payload.hp);
  let attritionScore = 0, hpRange = 0;
  if (hps.length >= 2) {
    hpRange = Math.max(...hps) - Math.min(...hps);
    attritionScore = 1 - Math.min(1, Math.abs(hpRange - 25) / 25);
  }

  // 5. Board uptime — fraction of turns the menagerie was actually swinging.
  //    The engine humming. Some downtime is fine (rebuild turns); near-zero
  //    uptime means the player never got animals to stick.
  const uptime = turns > 0 ? activeTicks.length / turns : 0;
  const uptimeScore = Math.min(1.0, uptime / 0.7);

  // 6. Variety — distinct species fielded + distinct Pack Tactics engaged.
  const speciesSet = new Set();
  for (const t of ticks) for (const a of (t.payload?.arrivals || [])) speciesSet.add(a);
  const tacticSet = new Set(tactics.filter(t => t.payload?.action === 'engage' || t.payload?.action === 'replace').map(t => t.payload?.tacticId));
  const varietyScore = Math.min(1.0, (speciesSet.size + tacticSet.size) / 6);

  // 7. Feeding — the validated exit-bonus gamble. Of all animals that left,
  //    how many were fed in time? Rewards the make-or-break feed decision.
  let fedExits = 0, totalExits = 0;
  for (const t of ticks) for (const x of (t.payload?.exits || [])) { totalExits++; if (x.fed) fedExits++; }
  const feedScore = totalExits > 0 ? fedExits / totalExits : 1.0;

  // 8. Death context (lane-agnostic).
  const re = ev.find(e => e.type === 'run.end');
  const died = re?.payload?.outcome === 'lost';
  let deathContextScore = 1.0, killer = '—';
  if (died) {
    const lastEnd = ends[ends.length - 1];
    const tier = lastEnd?.payload?.tier;
    killer = re.payload?.killedBy || lastEnd?.payload?.enemyId || '?';
    const isEliteOrBoss = tier === 'elite' || tier === 'boss';
    deathContextScore = wins >= 3 ? (isEliteOrBoss ? 1.0 : 0.7) : 0.3;
  }

  // Challenge + Novelty — the anti-boredom signals (see computeChallengeNovelty).
  const cn = computeChallengeNovelty(ev);
  const challengeScore = cn.challenge.score;
  const noveltyScore = cn.novelty.score;

  // Weights rebalanced 2026-06-10: challenge (0.20) + novelty (0.18) now carry
  // 38% combined, trimmed from the engine-humming signals (summon/output/
  // uptime/variety) which a solved loop maxes out. A bored, under-challenged
  // win (the 91% run that prompted this) now lands ~68% "FUN" instead of
  // "HIGHLY FUN"; a gripping, varied run still clears 0.85.
  const weights = { challenge: 0.20, novelty: 0.18, arc: 0.12, summon: 0.08,
                    output: 0.08, attr: 0.07, uptime: 0.05, var: 0.05,
                    feed: 0.07, death: 0.10 };
  const composite = (
    challengeScore * weights.challenge +
    noveltyScore * weights.novelty +
    runArcScore * weights.arc +
    summonScore * weights.summon +
    outputScore * weights.output +
    attritionScore * weights.attr +
    uptimeScore * weights.uptime +
    varietyScore * weights.var +
    feedScore * weights.feed +
    deathContextScore * weights.death
  );
  const verdict = composite > 0.75 ? 'HIGHLY FUN'
                : composite > 0.55 ? 'FUN'
                : composite > 0.35 ? 'MIXED' : 'NOT FUN';

  return {
    lane: 'handler',
    startedAt: s.startedAt,
    composite,
    verdict,
    metrics: {
      challenge:{ score: challengeScore, meaningful: cn.challenge.meaningful, trivial: cn.challenge.trivial, combats: cn.challenge.combats },
      novelty:  { score: noveltyScore, avgSimilarity: cn.novelty.avgSimilarity },
      summon:   { score: summonScore, summons: summons.length, perTurn: summonsPerTurn },
      output:   { score: outputScore, avgDmg, activeTicks: activeTicks.length },
      runArc:   { score: runArcScore, wins, died },
      attrition:{ score: attritionScore, hpRange, hps: hps.slice(0, 12) },
      uptime:   { score: uptimeScore, ratio: uptime, activeTurns: activeTicks.length, turns },
      variety:  { score: varietyScore, species: speciesSet.size, tactics: tacticSet.size },
      feed:     { score: feedScore, fed: fedExits, exits: totalExits },
      death:    { score: deathContextScore, killer, died },
    },
  };
}

function formatPct(n) { return (n * 100).toFixed(0) + '%'; }

function printHandlerReport(r) {
  console.log('\n=== FUN SIGNAL (HANDLER) — ' + r.startedAt + ' ===\n');
  console.log('  Challenge:            ' + formatPct(r.metrics.challenge.score).padStart(5) +
              '   (' + r.metrics.challenge.meaningful + '/' + r.metrics.challenge.combats + ' fights bit ≥5 HP, ' + r.metrics.challenge.trivial + ' trivial)');
  console.log('  Novelty (vs repeat):  ' + formatPct(r.metrics.novelty.score).padStart(5) +
              '   (' + formatPct(r.metrics.novelty.avgSimilarity) + ' same-hand similarity fight-to-fight)');
  console.log('  Summon engagement:    ' + formatPct(r.metrics.summon.score).padStart(5) +
              '   (' + r.metrics.summon.summons + ' summons, ' + r.metrics.summon.perTurn.toFixed(2) + '/turn)');
  console.log('  Menagerie output:     ' + formatPct(r.metrics.output.score).padStart(5) +
              '   (avg ' + r.metrics.output.avgDmg.toFixed(1) + ' dmg/active turn)');
  console.log('  Run arc:              ' + formatPct(r.metrics.runArc.score).padStart(5) +
              '   (' + r.metrics.runArc.wins + ' wins, ' + (r.metrics.runArc.died ? 'died' : 'won/ongoing') + ')');
  console.log('  Attrition smoothness: ' + formatPct(r.metrics.attrition.score).padStart(5) +
              '   (HP range ' + r.metrics.attrition.hpRange + ', ideal 25)');
  console.log('  Board uptime:         ' + formatPct(r.metrics.uptime.score).padStart(5) +
              '   (' + formatPct(r.metrics.uptime.ratio) + ' of ' + r.metrics.uptime.turns + ' turns swinging)');
  console.log('  Variety:              ' + formatPct(r.metrics.variety.score).padStart(5) +
              '   (' + r.metrics.variety.species + ' species, ' + r.metrics.variety.tactics + ' tactics)');
  console.log('  Feeding (exit bonus): ' + formatPct(r.metrics.feed.score).padStart(5) +
              '   (' + r.metrics.feed.fed + '/' + r.metrics.feed.exits + ' exits fed)');
  console.log('  Death context:        ' + formatPct(r.metrics.death.score).padStart(5) +
              '   (' + (r.metrics.death.died ? 'killed by ' + r.metrics.death.killer : 'no death') + ')');
  console.log('\n  COMPOSITE: ' + formatPct(r.composite) + '  →  ' + r.verdict + '\n');
}

function printReport(r) {
  console.log('\n=== FUN SIGNAL — ' + r.startedAt + ' ===\n');
  console.log('  Challenge:            ' + formatPct(r.metrics.challenge.score).padStart(5) +
              '   (' + r.metrics.challenge.meaningful + '/' + r.metrics.challenge.combats + ' fights bit ≥5 HP, ' + r.metrics.challenge.trivial + ' trivial)');
  console.log('  Novelty (vs repeat):  ' + formatPct(r.metrics.novelty.score).padStart(5) +
              '   (' + formatPct(r.metrics.novelty.avgSimilarity) + ' same-hand similarity fight-to-fight)');
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

// A session is a Handler run if it emitted any handler_tick. Route it to the
// Handler scorer so the wit-only signals don't sink an otherwise-fun run.
function isHandlerSession(s) {
  return (s.events || []).some(e => e.type === 'combat.handler_tick');
}
function scoreAny(s) {
  return isHandlerSession(s) ? scoreHandlerSession(s) : scoreSession(s);
}
function printAny(r) {
  if (r.lane === 'handler') printHandlerReport(r); else printReport(r);
}

if (allSessions) {
  for (const s of sessions) {
    const r = scoreAny(s);
    if (r) printAny(r);
  }
} else {
  // Handler runs often stop early (no run.end), so a finished wit session in
  // the same file would otherwise shadow them. Among Handler sessions, prefer
  // the LATEST one that actually ended (has a run.end) — that's the death/win
  // run the user just played. Only if no Handler session ended do we fall back
  // to the richest-by-handler_tick session. (Session-isolation rule: a finished
  // run must win over a longer but unfinished earlier session.)
  let target = null;
  const handlerSessions = sessions.filter(isHandlerSession);
  for (let i = handlerSessions.length - 1; i >= 0; i--) {
    if ((handlerSessions[i].events || []).some(e => e.type === 'run.end')) {
      target = handlerSessions[i];
      break;
    }
  }
  if (!target) {
    let bestTicks = 0;
    for (const s of sessions) {
      const n = (s.events || []).filter(e => e.type === 'combat.handler_tick').length;
      if (n > bestTicks) { bestTicks = n; target = s; }
    }
  }
  if (!target) {
    // No Handler content — find latest session containing a run.end event.
    for (let i = sessions.length - 1; i >= 0; i--) {
      if ((sessions[i].events || []).find(e => e.type === 'run.end')) {
        target = sessions[i];
        break;
      }
    }
  }
  if (!target) {
    // Fallback: pick the latest session with FFT casts.
    for (let i = sessions.length - 1; i >= 0; i--) {
      const evs = sessions[i].events || [];
      if (evs.some(e => e.type === 'wit.fft.cast')) {
        target = sessions[i];
        break;
      }
    }
  }
  if (!target) {
    console.log('No scoreable session found.');
    process.exit(0);
  }
  const r = scoreAny(target);
  if (r) printAny(r);
}
