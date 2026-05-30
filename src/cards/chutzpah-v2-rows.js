// =============================================================================
// CHUTZPAH FFT ROWS — three schools, 5 rows each (15 total).
//   bluster    — cumulative Pressure on enemy. Stacks Pressure, spend it later.
//   ballooning — Temp HP buffer. Persists past turn, decays after N turns.
//   ballistic  — heavy damage + self-Vulnerable. RAGE amps it.
//
// Row shape mirrors WIT_ROWS:
//   id:       'bluster-1' | 'ballooning-3' | etc.
//   schoolId: 'bluster' | 'ballooning' | 'ballistic'
//   introId / subjectId / targetId — references into chutzpah-v2.js word pool
//   rider:    keys consumed by App.jsx applyRider when full FFT fires
//   riderDesc — plain-language description for tooltips
// =============================================================================

export const CHUTZPAH_SAME_SCHOOL_BONUSES = {
  bluster:    { name: 'Bluster pressure (half-formed)',    bonus: 3 },
  ballooning: { name: 'Ballooning puff (half-formed)',     addTempHp: { amount: 3, turns: 2 } },
  ballistic:  { name: 'Ballistic spark (half-formed)',     bonus: 4, selfVulnerable: { amount: 1, turns: 1 } },
};

export const CHUTZPAH_PARTIAL_ROW_BONUSES = {
  bluster:    { name: 'Bluster pressure (half-formed)',    addPressure: 1 },
  ballooning: { name: 'Ballooning puff (half-formed)',     addTempHp: { amount: 4, turns: 2 } },
  ballistic:  { name: 'Ballistic spark (half-formed)',     bonus: 6 },
};

// =============================================================================
// THE 15 ROWS
// =============================================================================
export const CHUTZPAH_ROWS = [

  // ---- BLUSTER (cumulative Pressure on enemy) ----
  // Pressure stacks on the enemy. Bluster casts with `pressureBonus: true`
  // get +enemy.pressure flat damage. addPressure: N stacks more. The
  // capstone consumes all pressure for a damage spike.
  {
    id: 'bluster-1', schoolId: 'bluster', name: 'Take That Tone Elsewhere',
    canonical: 'Listen pal, take that tone elsewhere.',
    introId: 'cv2-i-bluster-1', subjectId: 'cv2-s-bluster-1', targetId: 'cv2-t-bluster-1',
    rider: { bonus: 12, addPressure: 1, pressureBonus: true },
    riderDesc: '+12 composure damage. +1 Pressure on enemy. Bonus = +Pressure flat damage.',
  },
  {
    id: 'bluster-2', schoolId: 'bluster', name: "Don't Walk Away From Me",
    canonical: "Buddy, don't walk away from me.",
    introId: 'cv2-i-bluster-2', subjectId: 'cv2-s-bluster-2', targetId: 'cv2-t-bluster-2',
    rider: { bonus: 8, addPressure: 2, pressureBonus: true },
    riderDesc: '+8 composure damage. +2 Pressure on enemy. Bonus = +Pressure flat.',
  },
  {
    id: 'bluster-3', schoolId: 'bluster', name: "Who Do You Think You're Talking To",
    canonical: "Look, who do you think you're talking to?",
    introId: 'cv2-i-bluster-3', subjectId: 'cv2-s-bluster-3', targetId: 'cv2-t-bluster-3',
    rider: { bonus: 15, addPressure: 1, pressureBonus: true, weak: 1 },
    riderDesc: '+15 composure. +1 Pressure. Bonus = +Pressure. Enemy Weak 1 (3 turns).',
  },
  {
    id: 'bluster-4', schoolId: 'bluster', name: "I'm Done Being Polite",
    canonical: "Frankly, I'm done being polite.",
    introId: 'cv2-i-bluster-4', subjectId: 'cv2-s-bluster-4', targetId: 'cv2-t-bluster-4',
    rider: { bonus: 6, addPressure: 1, consumePressureMult: 3 },
    riderDesc: '+6 composure. Eat all Pressure for ×3 flat damage. Then +1 Pressure.',
  },
  {
    id: 'bluster-5', schoolId: 'bluster', name: 'Now You Listen Here',
    canonical: 'Now you listen here.',
    introId: 'cv2-i-bluster-5', subjectId: 'cv2-s-bluster-5', targetId: 'cv2-t-bluster-5',
    rider: { bonus: 20, consumePressureMult: 5 },
    riderDesc: '+20 composure. Spike: eat all Pressure for ×5 flat damage. Capstone.',
  },

  // ---- BALLOONING (Temp HP buffer) ----
  // Adds temp HP that lives between Block and HP. Absorbs incoming damage
  // before HP. Decays back to 0 after N turns. Capstone (pop) cashes
  // remaining Temp HP as composure damage.
  {
    id: 'ballooning-1', schoolId: 'ballooning', name: 'Puff Up',
    canonical: 'I, frankly, am bigger than this implies.',
    introId: 'cv2-i-ballooning-1', subjectId: 'cv2-s-ballooning-1', targetId: 'cv2-t-ballooning-1',
    rider: { addTempHp: { amount: 8, turns: 3 } },
    riderDesc: '+8 Temp HP for 3 turns. Absorbs incoming damage before HP.',
  },
  {
    id: 'ballooning-2', schoolId: 'ballooning', name: 'Inflate the Story',
    canonical: 'It was at least, in fact, three of them.',
    introId: 'cv2-i-ballooning-2', subjectId: 'cv2-s-ballooning-2', targetId: 'cv2-t-ballooning-2',
    rider: { addTempHp: { amount: 12, turns: 2 } },
    riderDesc: '+12 Temp HP for 2 turns. Bigger buffer, shorter duration.',
  },
  {
    id: 'ballooning-3', schoolId: 'ballooning', name: 'Hot Air',
    canonical: "I've got plenty more where that came from.",
    introId: 'cv2-i-ballooning-3', subjectId: 'cv2-s-ballooning-3', targetId: 'cv2-t-ballooning-3',
    rider: { addTempHp: { amount: 6, turns: 4 }, block: 4 },
    riderDesc: '+6 Temp HP for 4 turns AND +4 Block this turn.',
  },
  {
    id: 'ballooning-4', schoolId: 'ballooning', name: 'Full of Yourself',
    canonical: "Speaking from authority, I'd already won.",
    introId: 'cv2-i-ballooning-4', subjectId: 'cv2-s-ballooning-4', targetId: 'cv2-t-ballooning-4',
    rider: { addTempHp: { amount: 10, turns: 3 }, addPressure: 1 },
    riderDesc: '+10 Temp HP for 3 turns AND +1 Pressure on enemy.',
  },
  {
    id: 'ballooning-5', schoolId: 'ballooning', name: 'Pop Off',
    canonical: "And THIS is what it was all for.",
    introId: 'cv2-i-ballooning-5', subjectId: 'cv2-s-ballooning-5', targetId: 'cv2-t-ballooning-5',
    rider: { consumeTempHpAsDamage: 1.5 },
    riderDesc: 'Consume current Temp HP, deal that × 1.5 composure damage. Capstone.',
  },

  // ---- BALLISTIC (Blind rage: heavy damage + self-Vulnerable) ----
  // Heavy direct damage. Each cast applies self-Vulnerable (incoming +25% per
  // stack) for N turns. Doubled while in RAGE (Tunnel Vision 5+).
  {
    id: 'ballistic-1', schoolId: 'ballistic', name: 'Going Off',
    canonical: 'Buddy, I am going OFF.',
    introId: 'cv2-i-ballistic-1', subjectId: 'cv2-s-ballistic-1', targetId: 'cv2-t-ballistic-1',
    rider: { bonus: 15, selfVulnerable: { amount: 1, turns: 2 } },
    riderDesc: '+15 composure. You take +25% incoming damage for 2 turns.',
  },
  {
    id: 'ballistic-2', schoolId: 'ballistic', name: 'Off the Rails',
    canonical: "Listen carefully, we are off the RAILS now.",
    introId: 'cv2-i-ballistic-2', subjectId: 'cv2-s-ballistic-2', targetId: 'cv2-t-ballistic-2',
    rider: { bonus: 12, addTunnelVision: 2, selfVulnerable: { amount: 1, turns: 2 } },
    riderDesc: '+12 composure. +2 Tunnel Vision. Self-Vuln 1 for 2 turns.',
  },
  {
    id: 'ballistic-3', schoolId: 'ballistic', name: 'Blind Rage',
    canonical: 'I can no longer see the room.',
    introId: 'cv2-i-ballistic-3', subjectId: 'cv2-s-ballistic-3', targetId: 'cv2-t-ballistic-3',
    rider: { bonus: 20, selfVulnerable: { amount: 2, turns: 2 }, rageDouble: true },
    riderDesc: '+20 composure (DOUBLED while in RAGE). Self-Vuln 2 for 2 turns.',
  },
  {
    id: 'ballistic-4', schoolId: 'ballistic', name: 'Nothing Left to Lose',
    canonical: "I, in point of fact, have nothing left to lose.",
    introId: 'cv2-i-ballistic-4', subjectId: 'cv2-s-ballistic-4', targetId: 'cv2-t-ballistic-4',
    rider: { bonus: 10, missingHpScaling: 1, selfVulnerable: { amount: 1, turns: 3 } },
    riderDesc: '+10 composure +1 per missing HP. Self-Vuln 1 for 3 turns.',
  },
  {
    id: 'ballistic-5', schoolId: 'ballistic', name: 'Scorched Earth',
    canonical: "Pal, this is officially scorched earth.",
    introId: 'cv2-i-ballistic-5', subjectId: 'cv2-s-ballistic-5', targetId: 'cv2-t-ballistic-5',
    rider: { bonus: 25, consumePressureMult: 3, selfVulnerable: { amount: 2, turns: 3 } },
    riderDesc: '+25 composure. Eat all Pressure × 3. Self-Vuln 2 for 3 turns. Cross-school capstone.',
  },
];

export const CHUTZPAH_ROW_BY_ID = Object.fromEntries(CHUTZPAH_ROWS.map(r => [r.id, r]));

// Shared rider keys this schema introduces (consumed by App.jsx applyRider):
//   addPressure: N              — enemy.pressure += N
//   pressureBonus: true         — damage += enemy.pressure (no consume)
//   consumePressureMult: N      — damage += enemy.pressure × N, then pressure = 0
//   addTempHp: { amount, turns }— grant N Temp HP that decays after M turns
//   consumeTempHpAsDamage: mult — damage += current tempHp × mult, tempHp = 0
//   selfVulnerable: { amount, turns } — apply Vulnerable to PLAYER for N turns
//   addTunnelVision: N          — bump existing tunnelVision meter
//   missingHpScaling: N         — damage += (maxHp - hp) × N
//   rageDouble: true            — damage doubled if Tunnel Vision >= 5 (RAGE)
