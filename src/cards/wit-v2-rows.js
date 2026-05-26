// Wit v2 — Fully Formed Thought (FFT) row data.
//
// The 24 named rows that the Wit wizard's 72 set-tagged cards are organized
// into. Each row is one canonical Pratchett-style sentence broken into three
// cards (intro/subject/target). All cards still combine freely with any
// other wit-v2 card — the row structure is an OVERLAY for set-collection
// bonuses, not a constraint on stitching.
//
// Three tiers, eight rows each:
//   - 'atelier'        — fabric, linen, silk pajamas, fabric merchant, evening rituals
//   - 'hygiene'        — bidet morality, judgement, the right way to live, propriety
//   - 'transportation' — civic responsibilities on public roads, the Volvo, sensible defense
//
// Schema on a card (in wit-v2.js):
//   setId:    'atelier-1' | 'hygiene-3' | etc. (one of WIT_ROWS[*].id)
//   setSlot:  'intro' | 'subject' | 'target'   (matches the card's slot field)
//   tierId:   'atelier' | 'hygiene' | 'transportation'
//
// Cards without these fields are FLAVOR POOL — still combine freely, never
// trigger FFT or same-tier bonuses.

// Tier sub-bonuses fire when all three played cards (intro+subject+target)
// share the same tierId but DO NOT share a setId (a "thematically coherent
// but not fully formed" cast). Wit-identity payouts only — no flat damage,
// so chasing a tier deepens the lane's defender engine rather than chasing
// a burst.
export const WIT_TIER_SUB_BONUSES = {
  atelier: {
    name: 'The Atelier',
    longThreadPerm: 1,
    flavor: 'A well-tailored argument carries longer.',
  },
  hygiene: {
    name: 'Hygiene',
    composure: 3,
    flavor: 'Smug certainty is its own armor.',
  },
  transportation: {
    name: 'Transportation',
    block: 4,
    flavor: 'Civic-minded defense, no theatrics.',
  },
};

// v3.2 Phase 5: Half-Formed Thought — fires when ANY 2 of the 3 played
// cards share a setId (but the 3rd doesn't, so it's not a full FFT). Tier-
// flavored payouts that are noticeably bigger than the tier sub-bonus
// (because the player has committed to a SPECIFIC row, not just a theme)
// but smaller than a full row rider (because the third card is still
// random / from a different row). The log message names the row, doubling
// as a discovery hint: "Half-Formed Thought: Linen Truths — find the
// missing target."
export const WIT_PARTIAL_ROW_BONUSES = {
  atelier: {
    name: 'The Atelier (half-formed)',
    longThreadPerm: 1,
    poise: 1,
    flavor: 'The seam is already pulling tight.',
  },
  hygiene: {
    name: 'Hygiene (half-formed)',
    composure: 3,
    block: 1,
    flavor: 'The point is forming. The point is, in fact, already taken.',
  },
  transportation: {
    name: 'Transportation (half-formed)',
    block: 3,
    longThreadPerm: 1,
    flavor: 'The lecture has begun. The driver does not yet know.',
  },
};

// The 24 named rows. Phase 2 fills this in; Phase 1 keeps it empty so the
// FFT detection layer is invisible to the player until content lands.
//
// Row shape:
//   {
//     id: 'atelier-1',
//     tierId: 'atelier',
//     name: 'Linen Truths',
//     canonical: 'As I was saying to the fabric merchant, your taste would not be tolerated after 8.',
//     introId:   'wv2-i-as-i-was-saying-fabric-merchant',
//     subjectId: 'wv2-s-your-taste',
//     targetId:  'wv2-t-not-tolerated-after-8',
//     rider: { /* see RIDER_KEYS below */ },
//   }
export const WIT_ROWS = [
  // ---- Atelier (8 rows total — 3 of 8 written) ----
  {
    id: 'atelier-1',
    tierId: 'atelier',
    name: 'Linen Truths',
    canonical: 'As I was saying to the fabric merchant, your taste would not be tolerated after 8.',
    introId:   'wv2-i-fabric-merchant',
    subjectId: 'wv2-s-your-taste',
    targetId:  'wv2-t-not-tolerated-after-8',
    rider: { longThreadPerm: 2 },
    riderDesc: '+2 Long Thread permanently this combat.',
  },
  {
    id: 'atelier-2',
    tierId: 'atelier',
    name: 'The Off-Season',
    canonical: 'Permit me to observe that linen, in October, is precisely what one does not do.',
    introId:   'wv2-i-permit-me-observe',
    subjectId: 'wv2-s-linen-october',
    targetId:  'wv2-t-precisely-what-one-does-not-do',
    rider: { longThreadPerm: 1, draw: 1 },
    riderDesc: '+1 Long Thread permanently AND draw 1.',
  },
  {
    id: 'atelier-3',
    tierId: 'atelier',
    name: 'The Cuff',
    canonical: 'By any measure, your cuff is, somehow, both wrong and proud.',
    introId:   'wv2-i-by-any-measure',
    subjectId: 'wv2-s-your-cuff',
    targetId:  'wv2-t-wrong-and-proud',
    rider: { longThreadPerm: 1, poise: 1 },
    riderDesc: '+1 Long Thread permanently AND +1 Poise.',
  },
  {
    id: 'atelier-4',
    tierId: 'atelier',
    name: 'The Bouclé Suggestion',
    canonical: 'Frankly, your bouclé suggestion is what happens when fabric stops asking permission.',
    introId:   'wv2-i-frankly',
    subjectId: 'wv2-s-boucle-suggestion',
    targetId:  'wv2-t-fabric-stops-asking',
    rider: { longThreadPerm: 1, composure: 2 },
    riderDesc: '+1 Long Thread permanently AND +2 Composure.',
  },
  {
    id: 'atelier-5',
    tierId: 'atelier',
    name: 'Late Pajamas',
    canonical: 'Speaking plainly, your evening wear announces, with regret, that 8 has been and gone.',
    introId:   'wv2-i-speaking-plainly',
    subjectId: 'wv2-s-evening-wear',
    targetId:  'wv2-t-8-has-been-and-gone',
    rider: { longThreadPerm: 2, composure: 1 },
    riderDesc: '+2 Long Thread permanently AND +1 Composure.',
  },
  {
    id: 'atelier-6',
    tierId: 'atelier',
    name: "Wool's Opinions",
    canonical: 'It would appear that your wool, in spring, has its own opinions.',
    introId:   'wv2-i-it-would-appear',
    subjectId: 'wv2-s-wool-spring',
    targetId:  'wv2-t-its-own-opinions',
    rider: { longThreadPerm: 1, draw: 1 },
    riderDesc: '+1 Long Thread permanently AND draw 1.',
  },
  {
    id: 'atelier-7',
    tierId: 'atelier',
    name: 'The Hem',
    canonical: 'Were I being charitable, the hem of that garment would still be unkind.',
    introId:   'wv2-i-charitable',
    subjectId: 'wv2-s-hem-garment',
    targetId:  'wv2-t-still-be-unkind',
    rider: { longThreadPerm: 3 },
    riderDesc: '+3 Long Thread permanently — the heaviest tailoring payout.',
  },
  {
    id: 'atelier-8',
    tierId: 'atelier',
    name: 'Silk by Eight',
    canonical: 'If memory serves, the silk one wears before 8 is not what one wears after.',
    introId:   'wv2-i-memory-serves',
    subjectId: 'wv2-s-silk-before-8',
    targetId:  'wv2-t-not-what-one-wears-after',
    rider: { longThreadPerm: 2, composure: 2 },
    riderDesc: '+2 Long Thread permanently AND +2 Composure.',
  },

  // ---- Hygiene (8 rows total) ----
  {
    id: 'hygiene-1',
    tierId: 'hygiene',
    name: 'The First Principle',
    canonical: 'Specifically speaking, the gentleman who skips the bidet is not a gentleman at all.',
    introId:   'wv2-i-specifically-speaking',
    subjectId: 'wv2-s-gentleman-bidet',
    targetId:  'wv2-t-not-a-gentleman',
    rider: { damageMult: 1.5 },
    riderDesc: 'Cast damage ×1.5 — the moral truth cuts through.',
  },
  {
    id: 'hygiene-2',
    tierId: 'hygiene',
    name: 'Dry Shaving',
    canonical: 'Pardon my saying, dry shaving is, frankly, an aesthetic failure first.',
    introId:   'wv2-i-pardon-saying',
    subjectId: 'wv2-s-dry-shaving',
    targetId:  'wv2-t-aesthetic-failure-first',
    rider: { composure: 4 },
    riderDesc: '+4 Composure — aesthetic certainty as armor.',
  },
  {
    id: 'hygiene-3',
    tierId: 'hygiene',
    name: 'Dental',
    canonical: 'Or rather, your dental schedule is what the rest of us would politely call a memorial.',
    introId:   'wv2-i-or-rather',
    subjectId: 'wv2-s-dental-schedule',
    targetId:  'wv2-t-politely-call-memorial',
    rider: { damageMult: 1.3, composure: 2 },
    riderDesc: 'Cast damage ×1.3 AND +2 Composure.',
  },
  {
    id: 'hygiene-4',
    tierId: 'hygiene',
    name: 'Standards',
    canonical: 'Truly, your standards of upkeep are what the rest of us call a soft start.',
    introId:   'wv2-i-truly',
    subjectId: 'wv2-s-standards-of-upkeep',
    targetId:  'wv2-t-soft-start',
    rider: { composure: 3, block: 2 },
    riderDesc: '+3 Composure AND +2 Block this turn.',
  },
  {
    id: 'hygiene-5',
    tierId: 'hygiene',
    name: 'The Towel',
    canonical: 'Curiously, your towel rotation tells us things we did not ask to know.',
    introId:   'wv2-i-curiously',
    subjectId: 'wv2-s-towel-rotation',
    targetId:  'wv2-t-did-not-ask-to-know',
    rider: { composure: 5 },
    riderDesc: '+5 Composure — towel-grade certainty.',
  },
  {
    id: 'hygiene-6',
    tierId: 'hygiene',
    name: 'Civic Cleanliness',
    canonical: 'Setting aside the obvious, your bathroom door is left open, often, and the rest follows.',
    introId:   'wv2-i-setting-aside',
    subjectId: 'wv2-s-bathroom-door',
    targetId:  'wv2-t-rest-follows',
    rider: { composure: 3, draw: 1 },
    riderDesc: '+3 Composure AND draw 1.',
  },
  {
    id: 'hygiene-7',
    tierId: 'hygiene',
    name: 'The Regimen',
    canonical: 'If the records can be trusted, your evening regimen is, in fact, ongoing.',
    introId:   'wv2-i-if-records-trusted',
    subjectId: 'wv2-s-evening-regimen',
    targetId:  'wv2-t-in-fact-ongoing',
    rider: { composure: 4, longThreadPerm: 1 },
    riderDesc: '+4 Composure AND +1 Long Thread permanently.',
  },
  {
    id: 'hygiene-8',
    tierId: 'hygiene',
    name: 'The Civilizing Hour',
    canonical: 'It strikes me that your post-meal ritual is, regrettably, optional in your house.',
    introId:   'wv2-i-strikes-me',
    subjectId: 'wv2-s-post-meal-ritual',
    targetId:  'wv2-t-optional-in-your-house',
    rider: { damageMult: 1.4, composure: 1 },
    riderDesc: 'Cast damage ×1.4 AND +1 Composure.',
  },

  // ---- Transportation (8 rows total) ----
  {
    id: 'transportation-1',
    tierId: 'transportation',
    name: 'The Long Signal',
    canonical: 'Civically speaking, your relationship to the turn signal lasts, somehow, the entire drive.',
    introId:   'wv2-i-civically-speaking',
    subjectId: 'wv2-s-turn-signal',
    targetId:  'wv2-t-entire-drive',
    rider: { block: 6, draw: 1 },
    riderDesc: '+6 Block this turn AND draw 1.',
  },
  {
    id: 'transportation-2',
    tierId: 'transportation',
    name: 'The Yield',
    canonical: 'Strictly speaking, your relationship to the yield sign is, on review, a suggestion at best.',
    introId:   'wv2-i-strictly-speaking',
    subjectId: 'wv2-s-yield-sign',
    targetId:  'wv2-t-suggestion-at-best',
    rider: { block: 4, longThreadPerm: 1 },
    riderDesc: '+4 Block this turn AND +1 Long Thread permanently.',
  },
  {
    id: 'transportation-3',
    tierId: 'transportation',
    name: 'The Volvo Sermon',
    canonical: 'I should think that your Volvo would have, by now, had the conversation with you itself.',
    introId:   'wv2-i-i-should-think',
    subjectId: 'wv2-s-your-volvo',
    targetId:  'wv2-t-conversation-with-you-itself',
    rider: { block: 5, poise: 1 },
    riderDesc: '+5 Block this turn AND +1 Poise.',
  },
  {
    id: 'transportation-4',
    tierId: 'transportation',
    name: 'The Parallel',
    canonical: 'Actually, your parallel parking attempt is, in essence, a public service.',
    introId:   'wv2-i-actually',
    subjectId: 'wv2-s-parallel-parking',
    targetId:  'wv2-t-essence-public-service',
    rider: { block: 5, draw: 1 },
    riderDesc: '+5 Block this turn AND draw 1.',
  },
  {
    id: 'transportation-5',
    tierId: 'transportation',
    name: 'The Left Lane',
    canonical: 'Honestly, your left-lane behavior is, in this jurisdiction, a moral failing.',
    introId:   'wv2-i-honestly',
    subjectId: 'wv2-s-left-lane-behavior',
    targetId:  'wv2-t-jurisdiction-moral-failing',
    rider: { block: 4, longThreadPerm: 1, poise: 1 },
    riderDesc: '+4 Block this turn, +1 Long Thread permanently, +1 Poise.',
  },
  {
    id: 'transportation-6',
    tierId: 'transportation',
    name: 'Roundabouts',
    canonical: 'One could argue that your relationship to the roundabout is what insurance forms are for.',
    introId:   'wv2-i-one-could-argue',
    subjectId: 'wv2-s-roundabout',
    targetId:  'wv2-t-insurance-forms',
    rider: { block: 5, longThreadPerm: 1 },
    riderDesc: '+5 Block this turn AND +1 Long Thread permanently.',
  },
  {
    id: 'transportation-7',
    tierId: 'transportation',
    name: 'Speed Limits',
    canonical: 'Let the record show that your relationship to the speed limit is, generously, aspirational.',
    introId:   'wv2-i-let-the-record',
    subjectId: 'wv2-s-speed-limit',
    targetId:  'wv2-t-generously-aspirational',
    rider: { block: 4, draw: 1 },
    riderDesc: '+4 Block this turn AND draw 1.',
  },
  {
    id: 'transportation-8',
    tierId: 'transportation',
    name: 'The Four-Way Stop',
    canonical: 'From a purely analytical perspective, your relationship to the four-way stop is, on its own, a category of confusion.',
    introId:   'wv2-i-purely-analytical',
    subjectId: 'wv2-s-four-way-stop',
    targetId:  'wv2-t-category-of-confusion',
    rider: { block: 6, poise: 1 },
    riderDesc: '+6 Block this turn AND +1 Poise.',
  },
];

// Rider keys interpreted by applyFFTRider() in App.jsx and sim/playSimV2.js.
// Add new keys here AND in both dispatchers.
//   damageMult     — multiply cast damage (final, after all other multipliers)
//   bonus          — flat add to cast damage
//   longThreadPerm — +N longThread permanently this combat
//   composure      — +N Composure
//   block          — +N Block this turn
//   energy         — refund/grant N energy this turn
//   draw           — draw N cards
//   poise          — +N Poise
export const WIT_RIDER_KEYS = [
  'damageMult', 'bonus', 'longThreadPerm', 'composure',
  'block', 'energy', 'draw', 'poise',
];

// Quick lookup. Phase 2 will populate as WIT_ROWS fills.
export const WIT_ROW_BY_ID = Object.fromEntries(WIT_ROWS.map(r => [r.id, r]));

// Helper: given three cards, return { fft, partialRow, tierId }.
// Hierarchy (most specific wins; only one bonus type fires per cast):
//   1. fft        — all three cards share a setId (full row).
//   2. partialRow — any two cards share a setId (half-formed thought).
//   3. tierId     — all three share a tierId (no row match at all).
//   4. neither    — none of the above; random combo.
//
// Both `partialRow` and `tierId` can be non-null on the same cast (e.g. 2
// Atelier cards from Linen Truths + 1 Atelier card from a different row);
// the CALLER decides which to apply. By convention partial > tier when
// both fire, since partial means tighter player intent.
export function detectFFT(intro, subject, target) {
  if (!intro || !subject || !target) return { fft: null, partialRow: null, tierId: null };
  const sid = intro.setId;

  // Full row: all three share setId.
  if (sid && subject.setId === sid && target.setId === sid) {
    return { fft: WIT_ROW_BY_ID[sid] || null, partialRow: null, tierId: intro.tierId || null };
  }

  // Partial row: any 2 share setId.
  let partialRow = null;
  if (intro.setId && intro.setId === subject.setId) partialRow = WIT_ROW_BY_ID[intro.setId] || null;
  else if (intro.setId && intro.setId === target.setId) partialRow = WIT_ROW_BY_ID[intro.setId] || null;
  else if (subject.setId && subject.setId === target.setId) partialRow = WIT_ROW_BY_ID[subject.setId] || null;

  // Tier sub-bonus: all three share tierId.
  let tierId = null;
  const tid = intro.tierId;
  if (tid && subject.tierId === tid && target.tierId === tid) tierId = tid;

  return { fft: null, partialRow, tierId };
}
