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

  // ---- Hygiene (8 rows total — 5 of 8 written) ----
  {
    id: 'hygiene-1',
    tierId: 'hygiene',
    name: 'The First Principle',
    canonical: 'Specifically speaking, the gentleman who skips the bidet, is not a gentleman at all.',
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

  // ---- Transportation (8 rows total — 5 of 8 written) ----
  {
    id: 'transportation-1',
    tierId: 'transportation',
    name: 'The Long Signal',
    canonical: "I'll bet when you drive, you leave your signal on, for a long time.",
    introId:   'wv2-i-bet-when-you-drive',
    subjectId: 'wv2-s-leave-signal-on',
    targetId:  'wv2-t-for-a-long-time',
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

// Helper: given three cards, return { fft: row | null, tierId: string | null }.
// FFT wins if all three cards share a setId (a fully-formed thought).
// Same-tier wins if all three share a tierId but NOT a setId.
export function detectFFT(intro, subject, target) {
  if (!intro || !subject || !target) return { fft: null, tierId: null };
  const sid = intro.setId;
  if (sid && subject.setId === sid && target.setId === sid) {
    return { fft: WIT_ROW_BY_ID[sid] || null, tierId: intro.tierId || null };
  }
  const tid = intro.tierId;
  if (tid && subject.tierId === tid && target.tierId === tid) {
    return { fft: null, tierId: tid };
  }
  return { fft: null, tierId: null };
}
