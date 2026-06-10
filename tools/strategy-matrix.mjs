// Strategy matrix runner — plays every committed archetype through the sim
// and assembles a comparison table, so the design loop can SEE which
// strategies are strong, which are weak, and where new cards are needed.
// (Alan, 2026-06-09: "The sim should be LOOKING for strategies and then
// creating them where they're found to be lacking.")
//
//   node tools/strategy-matrix.mjs [runsPerStrategy=60]
//
// Writes sim/strategy-matrix.md.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const N = parseInt(process.argv[2] || '60', 10);

const STRATEGIES = [
  { lane: 'wit', strategy: 'slowburn' },
  { lane: 'wit', strategy: 'thorns' },
  { lane: 'wit', strategy: 'crescendo' },
  { lane: 'handler', strategy: 'geese' },
  { lane: 'handler', strategy: 'bucks' },
  { lane: 'handler', strategy: 'keeper' },
  { lane: 'handler', strategy: 'sacrifice' },
  { lane: 'handler', strategy: 'offense' },
  { lane: 'handler', strategy: 'defense' },
];

const rows = [];
for (const { lane, strategy } of STRATEGIES) {
  process.stdout.write(`${lane}/${strategy} × ${N}… `);
  const out = execFileSync('node', ['sim/playSimV2.js', String(N), `--lane=${lane}`, `--strategy=${strategy}`],
    { encoding: 'utf8', env: { ...process.env } });
  const win = out.match(/Win rate: ([\d.]+)%/)?.[1] ?? '?';
  const turns = out.match(/Avg turns\/combat: ([\d.]+)/)?.[1] ?? '?';
  const report = readFileSync(`sim/report-v2-${lane}.md`, 'utf8');
  const acts = report.match(/Losses by acts-cleared: (.*)/)?.[1] ?? '';
  const holds = report.match(/Holds \(turn ended without cast — tray persists\): \d+ \(([\d.]+%)\)/)?.[1] ?? '-';
  const topKiller = report.match(/## Top killer enemies\n- ([^\n]*)/)?.[1] ?? '';
  // act-progress score: weighted acts cleared (0×d0 + 1×d1 + …) per loss row.
  const actNums = [...acts.matchAll(/(\d)=(\d+)/g)].map(m => [+m[1], +m[2]]);
  const losses = actNums.reduce((s, [, n]) => s + n, 0);
  const wins = N - losses;
  const progress = (actNums.reduce((s, [a, n]) => s + a * n, 0) + wins * 4) / N;
  rows.push({ lane, strategy, win: `${win}%`, progress: progress.toFixed(2), holds, turns, acts, topKiller });
  console.log(`win ${win}% · progress ${progress.toFixed(2)}`);
}

const lines = [];
lines.push(`# Strategy Matrix — ${N} runs per strategy`);
lines.push('');
lines.push(`Progress = average acts cleared (win counts as 4). The gap-finder: weak rows need new cards or tuning; strong rows may need counter-enemies.`);
lines.push('');
lines.push(`| lane | strategy | win | progress | holds | turns/combat | top killer |`);
lines.push(`|---|---|---|---|---|---|---|`);
for (const r of rows.sort((a, b) => b.progress - a.progress)) {
  lines.push(`| ${r.lane} | ${r.strategy} | ${r.win} | ${r.progress} | ${r.holds} | ${r.turns} | ${r.topKiller} |`);
}
lines.push('');
lines.push(`## Losses by act, per strategy`);
for (const r of rows) lines.push(`- **${r.lane}/${r.strategy}**: ${r.acts}`);
lines.push('');

writeFileSync('sim/strategy-matrix.md', lines.join('\n'));
console.log('\nWrote sim/strategy-matrix.md');
