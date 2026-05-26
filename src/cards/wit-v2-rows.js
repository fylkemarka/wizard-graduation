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
  // ---- Atelier (8 rows total — 1 of 8 written) ----
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

  // ---- Hygiene (8 rows total — 1 of 8 written) ----
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

  // ---- Transportation (8 rows total — 1 of 8 written) ----
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
