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
//   tierId:   'slowburn' | 'thorns' | 'crescendo'
//
// Cards without these fields are FLAVOR POOL — still combine freely, never
// trigger FFT or same-tier bonuses.

export const WIT_TIER_SUB_BONUSES = {
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

// Half-Formed Thought (2-of-row partial bonus). Tier-flavored payouts
// that are noticeably bigger than the tier sub-bonus (the player has
// committed to a SPECIFIC row, not just a theme) but smaller than the
// full row rider (the third card is still random / from a different row).
export const WIT_PARTIAL_ROW_BONUSES = {
  slowburn: {
    name: 'Slow Burn (half-formed)',
    longThreadPerm: 2, composure: 3,
    flavor: 'The seam is already pulling tight. (DoT only triggers on full row.)',
  },
  thorns: {
    name: 'Thorns (half-formed)',
    thorns: { amount: 3, count: 2 },
    flavor: 'The boomerang is in flight; one shot is enough to land.',
  },
  crescendo: {
    name: 'Crescendo (half-formed)',
    addBank: 3,
    flavor: 'The momentum is forming. Bigger words are coming.',
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
    id: 'slowburn-1', tierId: 'slowburn', name: 'Slow Unraveling',
    canonical: 'Over time, your argument will slowly unravel.',
    introId: 'wv2-i-fabric-merchant', subjectId: 'wv2-s-your-taste', targetId: 'wv2-t-not-tolerated-after-8',
    rider: { setDotMinDamage: 3, setDotMinTurns: 3 },
    riderDesc: 'Establish DoT — set the enemy to at least 3/turn for 3 turns. The school\'s opener.',
  },
  {
    id: 'slowburn-2', tierId: 'slowburn', name: 'Slow Decay',
    canonical: 'Permit me to observe that your reasoning will slowly decay.',
    introId: 'wv2-i-permit-me-observe', subjectId: 'wv2-s-linen-october', targetId: 'wv2-t-precisely-what-one-does-not-do',
    rider: { addDotDamage: 2, addDotTurns: 2, enemyWeakPerTurn: { amount: 1, turns: 3 } },
    riderDesc: '+2 DoT damage/turn AND +2 turns AND Weak the enemy 1× each turn. Stacker.',
  },
  {
    id: 'slowburn-4', tierId: 'slowburn', name: 'Lingering Point',
    canonical: 'Frankly, your point lingers, badly.',
    introId: 'wv2-i-frankly', subjectId: 'wv2-s-boucle-suggestion', targetId: 'wv2-t-fabric-stops-asking',
    rider: { setDotMinDamage: 2, setDotMinTurns: 2, draw: 1 },
    riderDesc: 'Establish DoT 2/turn × 2, AND draw 1. Gentle starter intro.',
  },
  {
    id: 'slowburn-5', tierId: 'slowburn', name: 'Steady Erosion',
    canonical: 'Speaking plainly, your premise will erode steadily.',
    introId: 'wv2-i-speaking-plainly', subjectId: 'wv2-s-evening-wear', targetId: 'wv2-t-8-has-been-and-gone',
    rider: { dotMultiply: 2, enemyVulnPerTurn: { amount: 1, turns: 2 } },
    riderDesc: 'DOUBLE the enemy\'s current DoT damage AND Vulnerable each turn. The payoff cast — bigger the more you stacked first.',
  },
  {
    id: 'slowburn-8', tierId: 'slowburn', name: 'The Festering Wound',
    canonical: 'If memory serves, your conclusion will fester.',
    introId: 'wv2-i-memory-serves', subjectId: 'wv2-s-silk-before-8', targetId: 'wv2-t-not-what-one-wears-after',
    rider: { dotConsumeBig: true, selfBlockPerTurn: { amount: 2, turns: 3 } },
    riderDesc: 'DETONATE all remaining DoT damage at once (damage × turns), then +2 Block at each of your next 3 turns. The finisher.',
  },

  // ---- Thorns (Reflect) ----
  // THORNS — channel the "sparkling clean surface" motif: reflect their
  // attack as their own face, strip grime (block), preempt the move.
  {
    id: 'thorns-1', tierId: 'thorns', name: 'Returned in Kind',
    canonical: 'Specifically speaking, your next attack comes back to you.',
    introId: 'wv2-i-specifically-speaking', subjectId: 'wv2-s-gentleman-bidet', targetId: 'wv2-t-not-a-gentleman',
    rider: { thorns: { amount: 5, count: 3 } },
    riderDesc: 'Reflect 5 damage on next 3 enemy hits. The school\'s pure-reflect baseline.',
  },
  {
    id: 'thorns-2', tierId: 'thorns', name: 'Rebound',
    canonical: 'Pardon my saying, every blow you throw rebounds with interest.',
    introId: 'wv2-i-pardon-saying', subjectId: 'wv2-s-dry-shaving', targetId: 'wv2-t-aesthetic-failure-first',
    rider: { thorns: { amount: 4, count: 2, weakOnReflect: 1 } },
    riderDesc: 'Reflect 4 damage on next 2 enemy hits AND apply 1 Weak per reflect. Their second swing softens what would have been the third.',
  },
  {
    id: 'thorns-3', tierId: 'thorns', name: 'Sharp Reflection',
    canonical: 'Or rather, your aggression turns inward, sharply.',
    introId: 'wv2-i-or-rather', subjectId: 'wv2-s-dental-schedule', targetId: 'wv2-t-politely-call-memorial',
    rider: { thorns: { amount: 9, count: 1 } },
    riderDesc: 'ONE HUGE reflect — 9 damage on their next hit. Best opened on a multi-swing enemy where one swing matters most.',
  },
  {
    id: 'thorns-5', tierId: 'thorns', name: 'What You Get Back',
    canonical: 'Curiously, what you throw is what you get back.',
    introId: 'wv2-i-curiously', subjectId: 'wv2-s-towel-rotation', targetId: 'wv2-t-did-not-ask-to-know',
    rider: { thorns: { amount: 3, count: 3 }, stripEnemyBlock: 5 },
    riderDesc: 'Reflect 3 damage on next 3 enemy hits AND strip 5 of their Block right now. Cleans the surface so the reflect lands clean.',
  },
  {
    id: 'thorns-6', tierId: 'thorns', name: 'Answered in Advance',
    canonical: 'Setting aside the obvious, your next move answers itself.',
    introId: 'wv2-i-setting-aside', subjectId: 'wv2-s-bathroom-door', targetId: 'wv2-t-rest-follows',
    rider: { thorns: { amount: 4, count: 2 }, forceSkipNextAttack: true },
    riderDesc: 'Reflect 4 damage on next 2 hits AND their NEXT attack is skipped entirely. Pre-empts the swing — they cannot land a thing.',
  },

  // ---- Crescendo (Buildup / wordsBank) ----
  {
    id: 'crescendo-1', tierId: 'crescendo', name: 'All At Once',
    canonical: 'When you add it up, every word so far lands at once.',
    introId: 'wv2-i-civically-speaking', subjectId: 'wv2-s-turn-signal', targetId: 'wv2-t-entire-drive',
    rider: { consumeBank: 2 },
    riderDesc: 'Consume Words Bank — +2 damage per word.',
  },
  {
    id: 'crescendo-2', tierId: 'crescendo', name: 'Just Getting Started',
    canonical: 'Strictly speaking, this argument is just getting started.',
    introId: 'wv2-i-strictly-speaking', subjectId: 'wv2-s-yield-sign', targetId: 'wv2-t-suggestion-at-best',
    rider: { consumeBank: 2, addBank: 3 },
    riderDesc: 'Consume Words Bank for +2/word AND immediately re-bank 3.',
  },
  {
    id: 'crescendo-3', tierId: 'crescendo', name: 'Hardest Now',
    canonical: "I should think that what's been building lands hardest now.",
    introId: 'wv2-i-i-should-think', subjectId: 'wv2-s-your-volvo', targetId: 'wv2-t-conversation-with-you-itself',
    rider: { consumeBank: 3 },
    riderDesc: 'Consume Words Bank — +3 damage per word (biggest payoff).',
  },
  {
    id: 'crescendo-4', tierId: 'crescendo', name: 'It All Adds Up',
    canonical: "Actually, every point we've made adds up here.",
    introId: 'wv2-i-actually', subjectId: 'wv2-s-parallel-parking', targetId: 'wv2-t-essence-public-service',
    rider: { consumeBank: 2, draw: 1 },
    riderDesc: 'Consume Words Bank for +2/word AND draw 1.',
  },
  {
    id: 'crescendo-5', tierId: 'crescendo', name: 'Delivered',
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
  // v3.3 scheduled-effect riders (non-DoT over-time):
  'enemyWeakPerTurn', 'enemyVulnPerTurn', 'dormantDamage',
  'selfBlockPerTurn', 'selfDrawPerTurn', 'bankDoublePerTurn',
  // Thorns extended: thorns now accepts { amount, count, weakOnReflect }.
  'thorns', 'stripEnemyBlock', 'forceSkipNextAttack',
  // Crescendo bank:
  'addBank', 'consumeBank',
];

export const WIT_ROW_BY_ID = Object.fromEntries(WIT_ROWS.map(r => [r.id, r]));

// Helper: given three cards, return { fft, partialRow, tierId }.
// See castV2SentenceSpell in App.jsx for hierarchy semantics.
export function detectFFT(intro, subject, target) {
  if (!intro || !subject || !target) return { fft: null, partialRow: null, tierId: null };
  const sid = intro.setId;

  if (sid && subject.setId === sid && target.setId === sid) {
    return { fft: WIT_ROW_BY_ID[sid] || null, partialRow: null, tierId: intro.tierId || null };
  }

  let partialRow = null;
  if (intro.setId && intro.setId === subject.setId) partialRow = WIT_ROW_BY_ID[intro.setId] || null;
  else if (intro.setId && intro.setId === target.setId) partialRow = WIT_ROW_BY_ID[intro.setId] || null;
  else if (subject.setId && subject.setId === target.setId) partialRow = WIT_ROW_BY_ID[subject.setId] || null;

  let tierId = null;
  const tid = intro.tierId;
  if (tid && subject.tierId === tid && target.tierId === tid) tierId = tid;

  return { fft: null, partialRow, tierId };
}
