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
    selfBlockPerTurn: { amount: 2, turns: 2 },
    selfPoisePerTurn: { amount: 2, turns: 2 },
    flavor: 'A small shield, restated each round.',
  },
  crescendo: {
    name: 'Crescendo',
    addBank: 1,
    flavor: 'Words gathering, gently. The point is taking shape.',
  },
};

// v3.4.22 — Mixed-school cast bonuses. Fires WHENEVER the cast contains
// cards from 2+ different schools (intro/subject/target). Additive on
// top of whatever hierarchy match (full FFT / partial / same-school)
// already fires. Identifies the combo by its sorted school-pair key.
// Slow Burn × Thorns: small DoT + small Block-per-turn — the school's
// identities combined in miniature. Other pairs to be specced.
export const WIT_MIXED_SCHOOL_BONUSES = {
  'slowburn+thorns': {
    name: 'Slow Burn × Thorns',
    setDotMinDamage: 2, setDotMinTurns: 2,
    selfBlockPerTurn: { amount: 2, turns: 2 },
    flavor: 'The seam pulls — and the shield holds.',
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
    selfBlockPerTurn: { amount: 3, turns: 3 },
    selfPoisePerTurn: { amount: 3, turns: 3 },
    flavor: 'A small shield, restated each round — and standing for a while.',
  },
  crescendo: {
    name: 'Crescendo (half-formed)',
    addBank: 3,
    flavor: 'The committed row makes the bank grow. The damage waits for the full thought.',
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
    rider: { setDotMinDamage: 3, setDotMinTurns: 4, enemyVulnPerTurn: { amount: 1, turns: 3 } },
    riderDesc: 'DoT 3 composure/turn × 4 turns AND Vulnerable 1× each turn × 3.',
  },

  // ---- Thorns (Counter-Puncher) ----
  // THORNS v2 — pure counter-puncher. Every row is "throw their move back."
  // Dropped the defender lines (block-on-cast, heal-on-cast) so the school
  // has ONE clear identity. Strategic pick: choose Thorns when you see
  // attack-shaped intent. Weak against non-attackers, dominant against
  // aggressive enemies.
  {
    id: 'thorns-1', schoolId: 'thorns', name: 'Returned in Kind',
    canonical: 'Specifically speaking, your next attack comes back to you.',
    introId: 'wv2-i-specifically-speaking', subjectId: 'wv2-s-gentleman-bidet', targetId: 'wv2-t-not-a-gentleman',
    rider: { mirrorReflectCharges: { count: 3, capPerHit: 12 } },
    riderDesc: 'Next 3 enemy hits each reflect 100% of damage taken (capped at 12 per reflect). The mirror line.',
  },
  {
    id: 'thorns-2', schoolId: 'thorns', name: 'Rebound',
    canonical: 'Pardon my saying, every blow you throw rebounds with interest.',
    introId: 'wv2-i-pardon-saying', subjectId: 'wv2-s-dry-shaving', targetId: 'wv2-t-aesthetic-failure-first',
    rider: { selfThornsPerTurn: { amount: 5, turns: 3 } },
    riderDesc: 'Reflect 5 damage on every enemy hit for the next 3 rounds.',
  },
  {
    id: 'thorns-3', schoolId: 'thorns', name: 'Sharp Reflection',
    canonical: 'Or rather, your aggression turns inward, sharply.',
    introId: 'wv2-i-or-rather', subjectId: 'wv2-s-dental-schedule', targetId: 'wv2-t-politely-call-memorial',
    rider: { selfThornsSchedule: [5, 7, 10], enemyVulnPerTurn: { amount: 1, turns: 3 } },
    riderDesc: 'Reflect 5, then 7, then 10 across the next 3 rounds AND apply Vulnerable each round. Ramping retort.',
  },
  {
    id: 'thorns-5', schoolId: 'thorns', name: 'What You Get Back',
    canonical: 'Curiously, what you throw is what you get back.',
    introId: 'wv2-i-curiously', subjectId: 'wv2-s-towel-rotation', targetId: 'wv2-t-did-not-ask-to-know',
    rider: { skipAndReturnNext: true },
    riderDesc: 'Their NEXT attack is skipped entirely — AND the damage they would have dealt is dealt to them instead. Pure counter.',
  },
  {
    id: 'thorns-6', schoolId: 'thorns', name: 'Answered in Advance',
    canonical: 'Setting aside the obvious, your next move answers itself.',
    introId: 'wv2-i-setting-aside', subjectId: 'wv2-s-bathroom-door', targetId: 'wv2-t-rest-follows',
    rider: { selfThornsPerTurn: { amount: 5, turns: 3 }, stripEnemyBlockPerTurn: { amount: 7, turns: 3 } },
    riderDesc: 'Reflect 5 damage on every enemy hit AND strip 7 of their Block at the start of each of your next 3 turns.',
  },

  // ---- Crescendo (Visible Bank Aura) ----
  // CRESCENDO v2 — Bank is now a VISIBLE growing threat that ticks composure
  // damage every player turn (floor(bank/5), cap 4). Drops the build-then-
  // climax gating that made casts 1+2 useless. Crescendo cards become
  // flat Bank-spenders: deal Bank × N damage and consume.
  {
    id: 'crescendo-1', schoolId: 'crescendo', name: 'All At Once',
    canonical: 'When you add it up, every word so far lands at once.',
    introId: 'wv2-i-civically-speaking', subjectId: 'wv2-s-turn-signal', targetId: 'wv2-t-entire-drive',
    rider: { consumeBankFlat: 2 },
    riderDesc: 'Consume Words Bank — deal Bank × 2 damage on top of cast. The straight dump.',
  },
  {
    id: 'crescendo-2', schoolId: 'crescendo', name: 'Just Getting Started',
    canonical: 'Strictly speaking, this argument is just getting started.',
    introId: 'wv2-i-strictly-speaking', subjectId: 'wv2-s-yield-sign', targetId: 'wv2-t-suggestion-at-best',
    rider: { consumeBankFlat: 1, addBank: 5 },
    riderDesc: 'Consume Bank for Bank × 1 damage AND immediately re-bank 5. Sustain.',
  },
  {
    id: 'crescendo-3', schoolId: 'crescendo', name: 'Hardest Now',
    canonical: "I should think that what's been building lands hardest now.",
    introId: 'wv2-i-i-should-think', subjectId: 'wv2-s-your-volvo', targetId: 'wv2-t-conversation-with-you-itself',
    rider: { consumeBankFlat: 3 },
    riderDesc: 'Consume Bank — Bank × 3 damage on top of cast. The biggest payoff.',
  },
  {
    id: 'crescendo-4', schoolId: 'crescendo', name: 'It All Adds Up',
    canonical: "Actually, every point we've made adds up here.",
    introId: 'wv2-i-actually', subjectId: 'wv2-s-parallel-parking', targetId: 'wv2-t-essence-public-service',
    rider: { consumeBankFlat: 2, draw: 1 },
    riderDesc: 'Consume Bank for Bank × 2 damage AND draw 1. Tempo dump.',
  },
  {
    id: 'crescendo-5', schoolId: 'crescendo', name: 'Delivered',
    canonical: "Honestly, the case I've laid out delivers itself now.",
    introId: 'wv2-i-honestly', subjectId: 'wv2-s-left-lane-behavior', targetId: 'wv2-t-jurisdiction-moral-failing',
    rider: { doubleBankNow: true, bankAuraDoublePerTurn: { turns: 3 } },
    riderDesc: 'Bank doubles immediately — AND the Bank Aura ticks at 2× for 3 turns. No consume. Escalation.',
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
  // v3.4.22 — Thorns rebuilt as Defense over Time.
  'selfPoisePerTurn', 'selfHpRegenPerTurn',
  'selfThornsPerTurn', 'selfThornsSchedule', 'stripEnemyBlockPerTurn',
  // v3.4.42 — Thorns/Crescendo redesign:
  //   mirrorReflectCharges: { count, capPerHit } — N enemy hits each
  //     reflect 100% of damage taken (capped per hit).
  //   skipAndReturnNext: true — skip enemy's next attack AND deal that
  //     same damage to them instead.
  //   consumeBankFlat: N — consume entire Words Bank for Bank × N flat
  //     damage on top of the cast.
  //   doubleBankNow: true — multiply current wordsBank by 2.
  //   bankAuraDoublePerTurn: { turns } — for N enemy turns, the per-
  //     player-turn Bank Aura tick is doubled.
  'mirrorReflectCharges', 'skipAndReturnNext',
  'consumeBankFlat', 'doubleBankNow', 'bankAuraDoublePerTurn',
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
