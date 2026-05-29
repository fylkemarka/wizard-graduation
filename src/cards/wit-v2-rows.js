// Wit v2 — Fully Formed Thought (FFT) row data.
//
// v3.3 — tiers are STRATEGY-themed (not personality-themed). Each tier
// expresses a distinct combat strategy:
//
//   slowburn  — DoT. Casts apply ticking composure damage. Set and forget.
//   thorns    — Reflect. Casts arm incoming-hit reflects. Reactive playstyle.
//   crescendo — Buildup. Casts grow / consume a "words bank" for big payoffs.
//
// Schema on a card (in wit-v2.js):
//   setId:    'slowburn-1' | 'thorns-3' | etc. (one of WIT_ROWS[*].id)
//   setSlot:  'intro' | 'subject' | 'target'   (matches the card's slot field)
//   schoolId:   'slowburn' | 'thorns' | 'crescendo'
//
// Cards without these fields are FLAVOR POOL — still combine freely, never
// trigger FFT or same-school bonuses.

export const WIT_SAME_SCHOOL_BONUSES = {
  slowburn: {
    name: 'Slow Burn',
    longThreadPerm: 1, composure: 2,
    flavor: 'The argument keeps working long after the moment ends. (DoT only from full row casts.)',
  },
  thorns: {
    name: 'Thorns',
    thorns: { amount: 2, count: 2 },
    flavor: 'Their next blows answer themselves.',
  },
  crescendo: {
    name: 'Crescendo',
    addBank: 2,
    flavor: 'Words gathering. The point is taking shape.',
  },
};

// Half-Formed Thought (2-of-row partial bonus). v3.4.19 (Alan): partial
// casts now fire a genuine half-school payoff so 2-of-3 is a real
// "press now or wait" decision. Stacking DoT means partials add to
// existing dots without overwriting — the full row is still strictly
// better, but partial is no longer a sad consolation prize.
export const WIT_PARTIAL_ROW_BONUSES = {
  slowburn: {
    name: 'Slow Burn (half-formed)',
    longThreadPerm: 1, composure: 2,
    setDotMinDamage: 2, setDotMinTurns: 2,
    flavor: 'The seam is already pulling tight — a small thread, but it pulls.',
  },
  thorns: {
    name: 'Thorns (half-formed)',
    thorns: { amount: 4, count: 2 },
    flavor: 'The boomerang is in flight; one shot is enough to land.',
  },
  crescendo: {
    name: 'Crescendo (half-formed)',
    consumeBank: 1, addBank: 2,
    flavor: 'A little of the gathered momentum lands now — and more is still gathering.',
  },
};

// v3.3 — 15 rows, 5 per strategy tier. Canonicals are placeholders for
// now (Alan: "make them more straightforward and understandable; I'll
// improve them later"). Riders are the focus this pass.
//
// Rider keys interpreted by App.jsx castV2SentenceSpell + sim mirror:
//   damageMult, bonus    — cast damage modifiers (apply before damage lands)
//   composure, block, poise, energy, draw, longThreadPerm  — combat state
//   dot: { amount, turns } — apply DoT stack to enemy (ticks each enemy turn)
//   thorns: { amount, count } — arm N enemy hits to reflect amount damage
//   addBank: N           — increment player's wordsBank (Crescendo currency)
//   consumeBank: N       — consume wordsBank, +bank×N bonus damage to cast
export const WIT_ROWS = [
  // ---- Slow Burn (DoT) ----
  // SLOW BURN — Poison-style DoT school (v3.4). Enemies carry a single
  // DoT counter (enemy.dot.{damage, turnsRemaining}). Cards stack the
  // counter rather than each casting an independent stack. The goal:
  // small upfront cast, big DoT payoff over multiple turns. Play setup
  // → stack DoT → finish with multiply or consume burst.
  {
    id: 'slowburn-1', schoolId: 'slowburn', name: 'Slow Unraveling',
    canonical: 'Over time, your argument will slowly unravel.',
    introId: 'wv2-i-fabric-merchant', subjectId: 'wv2-s-your-taste', targetId: 'wv2-t-not-tolerated-after-8',
    rider: { setDotMinDamage: 2, setDotMinTurns: 8 },
    riderDesc: 'DoT 2 composure/turn × 8 turns. The long, thin burn.',
  },
  {
    id: 'slowburn-2', schoolId: 'slowburn', name: 'Slow Decay',
    canonical: 'Permit me to observe that your reasoning will slowly decay.',
    introId: 'wv2-i-permit-me-observe', subjectId: 'wv2-s-linen-october', targetId: 'wv2-t-precisely-what-one-does-not-do',
    rider: { setDotSchedule: [5, 4, 3, 2, 1] },
    riderDesc: 'DoT 5, 4, 3, 2, 1 composure across 5 turns. Front-loaded.',
  },
  {
    id: 'slowburn-4', schoolId: 'slowburn', name: 'Lingering Point',
    canonical: 'Frankly, your point lingers, badly.',
    introId: 'wv2-i-frankly', subjectId: 'wv2-s-boucle-suggestion', targetId: 'wv2-t-fabric-stops-asking',
    rider: { setDotMinDamage: 3, setDotMinTurns: 3 },
    riderDesc: 'DoT 3 composure/turn × 3 turns. The school\'s clean opener.',
  },
  {
    id: 'slowburn-5', schoolId: 'slowburn', name: 'Steady Erosion',
    canonical: 'Speaking plainly, your premise will erode steadily.',
    introId: 'wv2-i-speaking-plainly', subjectId: 'wv2-s-evening-wear', targetId: 'wv2-t-8-has-been-and-gone',
    rider: { setDotSchedule: [1, 3, 6, 8] },
    riderDesc: 'DoT 1, 3, 6, 8 composure across 4 turns. Ramping payoff.',
  },
  {
    id: 'slowburn-8', schoolId: 'slowburn', name: 'The Festering Wound',
    canonical: 'If memory serves, your conclusion will fester.',
    introId: 'wv2-i-memory-serves', subjectId: 'wv2-s-silk-before-8', targetId: 'wv2-t-not-what-one-wears-after',
    rider: { setDotMinDamage: 3, setDotMinTurns: 4, enemyVulnPerTurn: { amount: 1, turns: 4 } },
    riderDesc: 'DoT 3 composure/turn × 4 turns AND Vulnerable 1× each turn.',
  },

  // ---- Thorns (Reflect) ----
  // THORNS — channel the "sparkling clean surface" motif: reflect their
  // attack as their own face, strip grime (block), preempt the move.
  {
    id: 'thorns-1', schoolId: 'thorns', name: 'Returned in Kind',
    canonical: 'Specifically speaking, your next attack comes back to you.',
    introId: 'wv2-i-specifically-speaking', subjectId: 'wv2-s-gentleman-bidet', targetId: 'wv2-t-not-a-gentleman',
    rider: { thorns: { amount: 5, count: 3 } },
    riderDesc: 'Reflect 5 damage on next 3 enemy hits. The school\'s pure-reflect baseline.',
  },
  {
    id: 'thorns-2', schoolId: 'thorns', name: 'Rebound',
    canonical: 'Pardon my saying, every blow you throw rebounds with interest.',
    introId: 'wv2-i-pardon-saying', subjectId: 'wv2-s-dry-shaving', targetId: 'wv2-t-aesthetic-failure-first',
    rider: { thorns: { amount: 4, count: 2, weakOnReflect: 1 } },
    riderDesc: 'Reflect 4 damage on next 2 enemy hits AND apply 1 Weak per reflect. Their second swing softens what would have been the third.',
  },
  {
    id: 'thorns-3', schoolId: 'thorns', name: 'Sharp Reflection',
    canonical: 'Or rather, your aggression turns inward, sharply.',
    introId: 'wv2-i-or-rather', subjectId: 'wv2-s-dental-schedule', targetId: 'wv2-t-politely-call-memorial',
    rider: { thorns: { amount: 9, count: 1 } },
    riderDesc: 'ONE HUGE reflect — 9 damage on their next hit. Best opened on a multi-swing enemy where one swing matters most.',
  },
  {
    id: 'thorns-5', schoolId: 'thorns', name: 'What You Get Back',
    canonical: 'Curiously, what you throw is what you get back.',
    introId: 'wv2-i-curiously', subjectId: 'wv2-s-towel-rotation', targetId: 'wv2-t-did-not-ask-to-know',
    rider: { thorns: { amount: 3, count: 3 }, stripEnemyBlock: 5 },
    riderDesc: 'Reflect 3 damage on next 3 enemy hits AND strip 5 of their Block right now. Cleans the surface so the reflect lands clean.',
  },
  {
    id: 'thorns-6', schoolId: 'thorns', name: 'Answered in Advance',
    canonical: 'Setting aside the obvious, your next move answers itself.',
    introId: 'wv2-i-setting-aside', subjectId: 'wv2-s-bathroom-door', targetId: 'wv2-t-rest-follows',
    rider: { thorns: { amount: 4, count: 2 }, forceSkipNextAttack: true },
    riderDesc: 'Reflect 4 damage on next 2 hits AND their NEXT attack is skipped entirely. Pre-empts the swing — they cannot land a thing.',
  },

  // ---- Crescendo (Buildup / wordsBank) ----
  {
    id: 'crescendo-1', schoolId: 'crescendo', name: 'All At Once',
    canonical: 'When you add it up, every word so far lands at once.',
    introId: 'wv2-i-civically-speaking', subjectId: 'wv2-s-turn-signal', targetId: 'wv2-t-entire-drive',
    rider: { consumeBank: 2 },
    riderDesc: 'Consume Words Bank — +2 damage per word.',
  },
  {
    id: 'crescendo-2', schoolId: 'crescendo', name: 'Just Getting Started',
    canonical: 'Strictly speaking, this argument is just getting started.',
    introId: 'wv2-i-strictly-speaking', subjectId: 'wv2-s-yield-sign', targetId: 'wv2-t-suggestion-at-best',
    rider: { consumeBank: 2, addBank: 3 },
    riderDesc: 'Consume Words Bank for +2/word AND immediately re-bank 3.',
  },
  {
    id: 'crescendo-3', schoolId: 'crescendo', name: 'Hardest Now',
    canonical: "I should think that what's been building lands hardest now.",
    introId: 'wv2-i-i-should-think', subjectId: 'wv2-s-your-volvo', targetId: 'wv2-t-conversation-with-you-itself',
    rider: { consumeBank: 3 },
    riderDesc: 'Consume Words Bank — +3 damage per word (biggest payoff).',
  },
  {
    id: 'crescendo-4', schoolId: 'crescendo', name: 'It All Adds Up',
    canonical: "Actually, every point we've made adds up here.",
    introId: 'wv2-i-actually', subjectId: 'wv2-s-parallel-parking', targetId: 'wv2-t-essence-public-service',
    rider: { consumeBank: 2, draw: 1 },
    riderDesc: 'Consume Words Bank for +2/word AND draw 1.',
  },
  {
    id: 'crescendo-5', schoolId: 'crescendo', name: 'Delivered',
    canonical: "Honestly, the case I've laid out delivers itself now.",
    introId: 'wv2-i-honestly', subjectId: 'wv2-s-left-lane-behavior', targetId: 'wv2-t-jurisdiction-moral-failing',
    rider: { consumeBank: 2, bankDoublePerTurn: { turns: 3 } },
    riderDesc: 'Consume Words Bank for +2/word NOW — AND for the next 3 enemy turns, the bank doubles automatically. The longer you wait to cast another Crescendo, the bigger the next one.',
  },
];

export const WIT_RIDER_KEYS = [
  'damageMult', 'bonus', 'longThreadPerm', 'composure',
  'block', 'energy', 'draw', 'poise',
  // v3.4 — Poison-style DoT counter (enemy.dot). Replaces v3.3 `dot:`.
  'addDotDamage', 'addDotTurns', 'setDotMinDamage', 'setDotMinTurns',
  'dotMultiply', 'dotConsumeBig',
  // v3.4.17 — explicit per-turn DoT curve (Slow Decay, Steady Erosion).
  'setDotSchedule',
  // v3.3 scheduled-effect riders (non-DoT over-time):
  'enemyWeakPerTurn', 'enemyVulnPerTurn', 'dormantDamage',
  'selfBlockPerTurn', 'selfDrawPerTurn', 'bankDoublePerTurn',
  // Thorns extended: thorns now accepts { amount, count, weakOnReflect }.
  'thorns', 'stripEnemyBlock', 'forceSkipNextAttack',
  // Crescendo bank:
  'addBank', 'consumeBank',
];

export const WIT_ROW_BY_ID = Object.fromEntries(WIT_ROWS.map(r => [r.id, r]));

// Helper: given three cards, return { fft, partialRow, schoolId }.
// See castV2SentenceSpell in App.jsx for hierarchy semantics.
export function detectFFT(intro, subject, target) {
  if (!intro || !subject || !target) return { fft: null, partialRow: null, schoolId: null };
  const sid = intro.setId;

  if (sid && subject.setId === sid && target.setId === sid) {
    return { fft: WIT_ROW_BY_ID[sid] || null, partialRow: null, schoolId: intro.schoolId || null };
  }

  let partialRow = null;
  if (intro.setId && intro.setId === subject.setId) partialRow = WIT_ROW_BY_ID[intro.setId] || null;
  else if (intro.setId && intro.setId === target.setId) partialRow = WIT_ROW_BY_ID[intro.setId] || null;
  else if (subject.setId && subject.setId === target.setId) partialRow = WIT_ROW_BY_ID[subject.setId] || null;

  let schoolId = null;
  const tid = intro.schoolId;
  if (tid && subject.schoolId === tid && target.schoolId === tid) schoolId = tid;

  return { fft: null, partialRow, schoolId };
}
