// Menagerie v4 — animals are CARDS (Alan, 2026-06-13). See design/MENAGERIE_V4.md.
//
// Each animal is a single-use card: play it → it stages on the board; on CAST
// it resolves (attack composure / grant block / run onCast) then leaves unless
// fed. Combos are POWER cards you install; once installed they pay off on every
// CAST that meets their board condition. Shared by App.jsx and the sim.
//
// onCast keys handled by the engine (castMenagerie):
//   attack:N      — N composure to the enemy
//   block:N       — N Block to the player
//   draw:N        — draw N cards
//   weak:N        — enemy Weak N (its damage −25%)
//   vulnerable:N  — enemy Vulnerable N (your damage +50%)
//   thorns:N      — for the rest of THIS enemy turn, reflect N when it attacks
//   herd:N        — +N attack to every OTHER animal in the volley this cast
const LANE = 'handler';

export const MENAGERIE_ANIMALS = [
  // ── OFFENSE ──────────────────────────────────────────────────────────────
  { id: 'av-field-mouse', name: 'Field Mouse', icon: '🐭', type: 'animal', slot: 'animal',
    cost: 0, rarity: 'basic', lane: LANE, tags: ['small', 'land'],
    attack: 2, onCast: { draw: 1 },
    desc: 'Deal 2. Draw 1.',
    flavor: 'Small, quick, and already gone before you finish the sentence.',
    upgrade: { attack: 3, onCast: { draw: 1 } } },
  { id: 'av-scrubjay', name: 'Rabid Scrubjay', icon: '🐦', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'basic', lane: LANE, tags: ['bird'],
    attack: 4,
    desc: 'Deal 4.',
    flavor: 'Foams a little. Means well. Aims worse — at everyone but you.',
    upgrade: { attack: 6 } },
  { id: 'av-raven', name: 'Raven', icon: '🐦‍⬛', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'common', lane: LANE, tags: ['bird'],
    attack: 3, onCast: { draw: 1 },
    desc: 'Deal 3. Draw 1.',
    flavor: 'Brings you a shiny thing. The shiny thing is a fact about your opponent.',
    upgrade: { attack: 5, onCast: { draw: 1 } } },
  { id: 'av-goose', name: 'Goose', icon: '🪿', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'common', lane: LANE, tags: ['bird'],
    attack: 3, onCast: { weak: 1 },
    desc: 'Deal 3. Apply Weak 1 (enemy damage −25%).',
    flavor: 'It has opinions about the proceedings and will share them at volume.',
    upgrade: { attack: 4, onCast: { weak: 1 } } },
  { id: 'av-young-buck', name: 'Young Buck', icon: '🦌', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'common', lane: LANE, tags: ['land'],
    attack: 5,
    desc: 'Deal 5.',
    flavor: 'New antlers. Big feelings. Absolute commitment to the bit.',
    upgrade: { attack: 7 } },
  { id: 'av-hawk', name: 'Hawk', icon: '🦅', type: 'animal', slot: 'animal',
    cost: 2, rarity: 'uncommon', lane: LANE, tags: ['bird', 'predator'],
    attack: 8,
    desc: 'Deal 8.',
    flavor: 'Sees the loose thread in any argument from half a mile up.',
    upgrade: { attack: 11 } },
  { id: 'av-ox', name: 'Ox', icon: '🐂', type: 'animal', slot: 'animal',
    cost: 2, rarity: 'uncommon', lane: LANE, tags: ['land'],
    attack: 5, block: 4,
    desc: 'Deal 5. Gain 4 Block.',
    flavor: 'Pulls the whole cart. Has never once been told what is in the cart.',
    upgrade: { attack: 6, block: 6 } },
  { id: 'av-bear', name: 'Bear', icon: '🐻', type: 'animal', slot: 'animal',
    cost: 2, rarity: 'rare', lane: LANE, tags: ['predator'],
    attack: 12,
    desc: 'Deal 12.',
    flavor: 'The conversation is over. The bear has decided it is over.',
    upgrade: { attack: 16 } },

  // ── DEFENSE ──────────────────────────────────────────────────────────────
  { id: 'av-porcupine', name: 'Porcupine', icon: '🦔', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'basic', lane: LANE, tags: ['defensive'],
    block: 5, onCast: { thorns: 2 },
    desc: 'Gain 5 Block. Thorns 2 (reflect 2 each time the enemy hits you this turn).',
    flavor: 'Touch at your own risk. Touching has been factored in.',
    upgrade: { block: 7, onCast: { thorns: 3 } } },
  { id: 'av-bunaroo', name: 'Bonzai Bunaroo', icon: '🐰', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'common', lane: LANE, tags: ['small', 'defensive'],
    block: 3, onCast: { draw: 1 },
    desc: 'Gain 3 Block. Draw 1.',
    flavor: 'Tiny. Tended. Ferocious in a managed, ornamental way.',
    upgrade: { block: 5, onCast: { draw: 1 } } },
  { id: 'av-sheepdog', name: 'Sheepdog', icon: '🐕', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'common', lane: LANE, tags: ['land', 'defensive'],
    block: 4, onCast: { herd: 2 },
    desc: 'Gain 4 Block. Herd: +2 attack to every other animal in this cast.',
    flavor: 'Keeps the volley in formation through sheer force of disappointment.',
    upgrade: { block: 5, onCast: { herd: 3 } } },
  { id: 'av-sloth', name: 'Sloth', icon: '🦥', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'uncommon', lane: LANE, tags: ['defensive'],
    block: 9,
    desc: 'Gain 9 Block.',
    flavor: 'Arrives eventually. Defends absolutely. Has no notes on urgency.',
    upgrade: { block: 13 } },
  // POISE = composure defense. Block stops physical hits; Poise stops the ones
  // that go for your nerve (🎭). The menagerie needed a composure shield —
  // every other defensive animal only grants Block (Alan, 2026-06-13).
  { id: 'av-tortoise', name: 'Tortoise', icon: '🐢', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'basic', lane: LANE, tags: ['defensive'],
    poise: 5,
    desc: 'Gain 5 Poise (damage defense — stops 🎭 attacks).',
    flavor: 'Withdraws. Considers. Declines to be rattled, on principle.',
    upgrade: { poise: 7 } },
  { id: 'av-pangolin', name: 'Pangolin', icon: '🦔', type: 'animal', slot: 'animal',
    cost: 1, rarity: 'common', lane: LANE, tags: ['defensive'],
    block: 4, poise: 4,
    desc: 'Gain 4 Block AND 4 Poise — braced against both kinds of attack.',
    flavor: 'Rolls into a problem-shaped ball. The problem rolls away.',
    upgrade: { block: 6, poise: 6 } },
];

// COMBO CARDS — install (power); pay off on every CAST that meets the board
// condition. Drafted, not starter — earning a combo is the deckbuilding hook.
// Engine reads `combo: { needTag, count, payoff }` at cast time.
export const MENAGERIE_COMBOS = [
  { id: 'cv-murder-of-crows', name: 'A Murder of Crows', icon: '🐦‍⬛', type: 'power', slot: 'power',
    cost: 1, rarity: 'uncommon', lane: LANE,
    installPower: { id: 'comboMurder' },
    combo: { needTag: 'bird', count: 2, payoff: { attack: 6 } },
    desc: 'Power. On each CAST with 2+ birds, deal +6 damage.',
    flavor: 'It is technically a murder at three. At two it is merely a strongly worded letter.',
    upgrade: { combo: { payoff: { attack: 9 } }, desc: 'Power. On each CAST with 2+ birds, deal +9 damage.' } },
  { id: 'cv-stampede', name: 'Stampede', icon: '🦌', type: 'power', slot: 'power',
    cost: 1, rarity: 'uncommon', lane: LANE,
    installPower: { id: 'comboStampede' },
    combo: { needTag: 'land', count: 2, payoff: { repeatLand: true } },
    desc: 'Power. On each CAST with 2+ land animals, every land animal attacks TWICE.',
    flavor: 'The ground remembers. Briefly. Loudly.',
    upgrade: { cost: 0 } },
  { id: 'cv-apex-predator', name: 'Apex Predator', icon: '🐻', type: 'power', slot: 'power',
    cost: 1, rarity: 'rare', lane: LANE,
    installPower: { id: 'comboApex' },
    combo: { needTag: 'predator', count: 1, needOther: true, payoff: { predatorBonus: 7 } },
    desc: 'Power. On each CAST, if a predator AND a smaller animal both fire, the predator deals +7 (it eats well).',
    flavor: 'The food chain is just a syllabus with teeth.',
    upgrade: { combo: { payoff: { predatorBonus: 11 } }, desc: 'Power. On each CAST, if a predator AND a smaller animal both fire, the predator deals +11.' } },
  { id: 'cv-briar-wall', name: 'Briar Wall', icon: '🦔', type: 'power', slot: 'power',
    cost: 1, rarity: 'uncommon', lane: LANE,
    installPower: { id: 'comboBriar' },
    combo: { needTag: 'defensive', count: 2, payoff: { doubleBlock: true } },
    desc: 'Power. On each CAST with 2+ defensive animals, their Block is DOUBLED.',
    flavor: 'A hedge, but with intent. The intent is that you stop.',
    upgrade: { cost: 0 } },
  { id: 'cv-full-menagerie', name: 'The Full Menagerie', icon: '🎪', type: 'power', slot: 'power',
    cost: 2, rarity: 'rare', lane: LANE,
    installPower: { id: 'comboFull' },
    combo: { needCount: 3, payoff: { attack: 8, block: 4 } },
    desc: 'Power. On each CAST with a FULL board (3 animals), deal +8 damage and gain 4 Block.',
    flavor: 'Everyone is here. Everyone has been briefed. It is going to be a lot.',
    upgrade: { combo: { payoff: { attack: 12, block: 6 } }, desc: 'Power. On each CAST with a FULL board (3 animals), deal +12 damage and gain 6 Block.' } },
];

// Best-guess starter (design/MENAGERIE_V4.md): cheap, balanced, teaches the
// stage→cast loop, two ways to defend, a draw engine. All animals.
// Knocked down (Alan, 2026-06-13): a tight starter — a couple that ATTACK, a
// couple that BLOCK, nothing else. Restrict the opening menagerie to 4 animal
// types (2 copies each) so the deck reads instantly; build out variety via
// rewards. Pacing of that build-out is TBD.
export const MENAGERIE_V4_STARTER = [
  'av-scrubjay', 'av-scrubjay',     // attack 4
  'av-young-buck', 'av-young-buck', // attack 5
  'av-porcupine', 'av-porcupine',   // 5 Block + Thorns (physical defense)
  'av-tortoise', 'av-tortoise',     // 5 Poise (composure defense)
  // One combo to open with (Alan, 2026-06-13) — teaches the whole "stage
  // matching animals → big payoff" idea turn one. Stampede pairs with the two
  // Young Bucks (both land): stage both, CAST, they attack TWICE.
  'cv-stampede',
];

// Reward pool — the rest of the roster + combos (drafted post-combat).
export const MENAGERIE_V4_REWARD_POOL = [
  'av-raven', 'av-goose', 'av-young-buck', 'av-hawk', 'av-ox', 'av-bear',
  'av-bunaroo', 'av-sheepdog', 'av-sloth', 'av-tortoise', 'av-pangolin',
  'cv-murder-of-crows', 'cv-stampede', 'cv-apex-predator', 'cv-briar-wall', 'cv-full-menagerie',
];

export const MENAGERIE_BY_ID = Object.fromEntries(
  [...MENAGERIE_ANIMALS, ...MENAGERIE_COMBOS].map(c => [c.id, c]));
