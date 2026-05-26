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
    dot: { amount: 2, turns: 2 },
    flavor: 'The argument keeps working long after the moment ends.',
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
    dot: { amount: 3, turns: 2 },
    flavor: 'The seam is already pulling tight.',
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
  {
    id: 'slowburn-1', tierId: 'slowburn', name: 'Linen Truths',
    canonical: 'As I was saying to the fabric merchant, your taste would not be tolerated after 8.',
    introId: 'wv2-i-fabric-merchant', subjectId: 'wv2-s-your-taste', targetId: 'wv2-t-not-tolerated-after-8',
    rider: { dot: { amount: 4, turns: 3 } },
    riderDesc: 'Apply DoT 4/turn for 3 turns (12 total).',
  },
  {
    id: 'slowburn-2', tierId: 'slowburn', name: 'The Off-Season',
    canonical: 'Permit me to observe that linen, in October, is precisely what one does not do.',
    introId: 'wv2-i-permit-me-observe', subjectId: 'wv2-s-linen-october', targetId: 'wv2-t-precisely-what-one-does-not-do',
    rider: { dot: { amount: 3, turns: 4 } },
    riderDesc: 'Apply DoT 3/turn for 4 turns (12 total).',
  },
  {
    id: 'slowburn-4', tierId: 'slowburn', name: 'The Bouclé Suggestion',
    canonical: 'Frankly, your bouclé suggestion is what happens when fabric stops asking permission.',
    introId: 'wv2-i-frankly', subjectId: 'wv2-s-boucle-suggestion', targetId: 'wv2-t-fabric-stops-asking',
    rider: { dot: { amount: 2, turns: 3 }, draw: 1 },
    riderDesc: 'Apply DoT 2/turn for 3 turns AND draw 1.',
  },
  {
    id: 'slowburn-5', tierId: 'slowburn', name: 'Late Pajamas',
    canonical: 'Speaking plainly, your evening wear announces, with regret, that 8 has been and gone.',
    introId: 'wv2-i-speaking-plainly', subjectId: 'wv2-s-evening-wear', targetId: 'wv2-t-8-has-been-and-gone',
    rider: { dot: { amount: 5, turns: 2 }, composure: 2 },
    riderDesc: 'Apply DoT 5/turn for 2 turns AND +2 Composure.',
  },
  {
    id: 'slowburn-8', tierId: 'slowburn', name: 'Silk by Eight',
    canonical: 'If memory serves, the silk one wears before 8 is not what one wears after.',
    introId: 'wv2-i-memory-serves', subjectId: 'wv2-s-silk-before-8', targetId: 'wv2-t-not-what-one-wears-after',
    rider: { dot: { amount: 3, turns: 3 }, longThreadPerm: 1 },
    riderDesc: 'Apply DoT 3/turn for 3 turns AND +1 Long Thread permanently.',
  },

  // ---- Thorns (Reflect) ----
  {
    id: 'thorns-1', tierId: 'thorns', name: 'The First Principle',
    canonical: 'Specifically speaking, the gentleman who skips the bidet is not a gentleman at all.',
    introId: 'wv2-i-specifically-speaking', subjectId: 'wv2-s-gentleman-bidet', targetId: 'wv2-t-not-a-gentleman',
    rider: { thorns: { amount: 5, count: 3 } },
    riderDesc: 'Reflect 5 damage on next 3 enemy hits.',
  },
  {
    id: 'thorns-2', tierId: 'thorns', name: 'Dry Shaving',
    canonical: 'Pardon my saying, dry shaving is, frankly, an aesthetic failure first.',
    introId: 'wv2-i-pardon-saying', subjectId: 'wv2-s-dry-shaving', targetId: 'wv2-t-aesthetic-failure-first',
    rider: { thorns: { amount: 4, count: 2 }, composure: 3 },
    riderDesc: 'Reflect 4 damage on next 2 enemy hits AND +3 Composure.',
  },
  {
    id: 'thorns-3', tierId: 'thorns', name: 'Dental',
    canonical: 'Or rather, your dental schedule is what the rest of us would politely call a memorial.',
    introId: 'wv2-i-or-rather', subjectId: 'wv2-s-dental-schedule', targetId: 'wv2-t-politely-call-memorial',
    rider: { thorns: { amount: 6, count: 2 } },
    riderDesc: 'Reflect 6 damage on next 2 enemy hits.',
  },
  {
    id: 'thorns-5', tierId: 'thorns', name: 'The Towel',
    canonical: 'Curiously, your towel rotation tells us things we did not ask to know.',
    introId: 'wv2-i-curiously', subjectId: 'wv2-s-towel-rotation', targetId: 'wv2-t-did-not-ask-to-know',
    rider: { thorns: { amount: 3, count: 3 }, block: 4 },
    riderDesc: 'Reflect 3 damage on next 3 enemy hits AND +4 Block.',
  },
  {
    id: 'thorns-6', tierId: 'thorns', name: 'Civic Cleanliness',
    canonical: 'Setting aside the obvious, your bathroom door is left open, often, and the rest follows.',
    introId: 'wv2-i-setting-aside', subjectId: 'wv2-s-bathroom-door', targetId: 'wv2-t-rest-follows',
    rider: { thorns: { amount: 4, count: 2 }, draw: 1 },
    riderDesc: 'Reflect 4 damage on next 2 enemy hits AND draw 1.',
  },

  // ---- Crescendo (Buildup / wordsBank) ----
  {
    id: 'crescendo-1', tierId: 'crescendo', name: 'The Long Signal',
    canonical: 'Civically speaking, your relationship to the turn signal lasts, somehow, the entire drive.',
    introId: 'wv2-i-civically-speaking', subjectId: 'wv2-s-turn-signal', targetId: 'wv2-t-entire-drive',
    rider: { consumeBank: 2 },
    riderDesc: 'Consume Words Bank — +2 damage per word.',
  },
  {
    id: 'crescendo-2', tierId: 'crescendo', name: 'The Yield',
    canonical: 'Strictly speaking, your relationship to the yield sign is, on review, a suggestion at best.',
    introId: 'wv2-i-strictly-speaking', subjectId: 'wv2-s-yield-sign', targetId: 'wv2-t-suggestion-at-best',
    rider: { consumeBank: 2, addBank: 3 },
    riderDesc: 'Consume Words Bank for +2/word AND immediately re-bank 3.',
  },
  {
    id: 'crescendo-3', tierId: 'crescendo', name: 'The Volvo Sermon',
    canonical: 'I should think that your Volvo would have, by now, had the conversation with you itself.',
    introId: 'wv2-i-i-should-think', subjectId: 'wv2-s-your-volvo', targetId: 'wv2-t-conversation-with-you-itself',
    rider: { consumeBank: 3 },
    riderDesc: 'Consume Words Bank — +3 damage per word (biggest payoff).',
  },
  {
    id: 'crescendo-4', tierId: 'crescendo', name: 'The Parallel',
    canonical: 'Actually, your parallel parking attempt is, in essence, a public service.',
    introId: 'wv2-i-actually', subjectId: 'wv2-s-parallel-parking', targetId: 'wv2-t-essence-public-service',
    rider: { consumeBank: 2, draw: 1 },
    riderDesc: 'Consume Words Bank for +2/word AND draw 1.',
  },
  {
    id: 'crescendo-5', tierId: 'crescendo', name: 'The Left Lane',
    canonical: 'Honestly, your left-lane behavior is, in this jurisdiction, a moral failing.',
    introId: 'wv2-i-honestly', subjectId: 'wv2-s-left-lane-behavior', targetId: 'wv2-t-jurisdiction-moral-failing',
    rider: { consumeBank: 2, poise: 2 },
    riderDesc: 'Consume Words Bank for +2/word AND +2 Poise.',
  },
];

export const WIT_RIDER_KEYS = [
  'damageMult', 'bonus', 'longThreadPerm', 'composure',
  'block', 'energy', 'draw', 'poise',
  'dot', 'thorns', 'addBank', 'consumeBank',
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
