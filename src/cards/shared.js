// Wizard Graduation — Sentence Engine v2: shared schema + tier math.
//
// All v2 cards (wit / chutzpah / jnsq) share this schema. The lane-specific
// data files (wit-v2.js, chutzpah-v2.js, jnsq-v2.js) only differ in the
// `lane`, `tags`, and `phrase` content.
//
// Card shape:
//   {
//     id: 'wv2-i-frankly',
//     lane: 'wit' | 'chutzpah' | 'jnsq',
//     slot: 'intro' | 'subject' | 'target' | 'modifier',
//     tier: 1 | 2 | 3,             // Basic+Common=1, Uncommon=2, Rare=3
//     rarity: 'basic' | 'common' | 'uncommon' | 'rare',
//     cost: 0..3,
//     type: 'word' | 'effect' | 'modifier',  // back-compat for play handler
//     phrase: 'Frankly,',
//     tags: ['dismissive', 'cutting'],
//     stats: { wit: 1 },           // word/modifier slot: lane-stat contribution
//     effect: { ... },              // target slot: damage formula
//     modifierKind: 'pre'|'post'|'replaces-intro',  // modifier slot only
//     modifierEffect: { ... },      // modifier slot only
//     flavor: '...',
//   }

// Spell-tier multiplier table. Spell tier = banded sum of card tiers.
// Curve gentled from ×1.0/×1.5/×2.5 (with min-tier) so that mixed-tier hands
// can still hit T2 reliably without making the all-rare cliff trivial.
export const TIER_MULTIPLIER = { 1: 1.0, 2: 1.4, 3: 2.0 };

// Stat contribution per rarity (cards within the same tier vary in raw wit).
export const RARITY_WIT = { basic: 1, common: 2, uncommon: 3, rare: 4 };

// Map rarity → tier for the new system.
export const RARITY_TIER = { basic: 1, common: 1, uncommon: 2, rare: 3 };

// Lane-stat key (cards in lane X contribute to that stat).
export const LANE_STAT = { wit: 'wit', chutzpah: 'chutzpah', jnsq: 'jnsq' };

// =============================================================================
// HELPERS
// =============================================================================

// Compute spell tier from staged intro + subject + target. Returns 0 if any
// slot is missing.
//
// v2.1: sum-of-tiers, banded. Replaces the old min-tier rule which made
// T2/T3 hands mathematically unreachable in a ~14-card v2 deck. The bands
// reward partial honing — picking up a Rare now lifts the tier even when
// the rest of the hand is Common.
//
//   sum 3 (1+1+1)         → T1
//   sum 4 (1+1+2)         → T1   (single uncommon doesn't lift alone)
//   sum 5 (1+2+2, 1+1+3)  → T2
//   sum 6 (2+2+2, 1+2+3)  → T2
//   sum 7 (1+3+3, 2+2+3)  → T3   (two rares = tier-3 payoff)
//   sum 8 (2+3+3)         → T3
//   sum 9 (3+3+3)         → T3
export function computeSpellTier(intro, subject, target) {
  if (!intro || !subject || !target) return 0;
  const sum = (intro.tier || 1) + (subject.tier || 1) + (target.tier || 1);
  if (sum <= 4) return 1;
  if (sum <= 6) return 2;
  return 3;
}

// Build a flat list of all tags currently in the tray (across intro, subject,
// target, and any staged modifiers). Useful for resonance + modifier triggers.
export function trayTags(intro, subject, target, modifiers = []) {
  const tags = [];
  for (const c of [intro, subject, target, ...modifiers]) {
    if (!c) continue;
    for (const t of c.tags || []) tags.push(t);
  }
  return tags;
}

// Count tags that appear on ALL THREE primary slots. NOT used for tier (tier
// is purely card-rarity-based in v2), but exposed for tag-payoff modifiers
// that bonus damage per shared tag.
export function sharedTagCount(intro, subject, target) {
  if (!intro || !subject || !target) return 0;
  const a = new Set(intro.tags || []);
  const b = new Set(subject.tags || []);
  const c = new Set(target.tags || []);
  let n = 0;
  for (const tag of a) if (b.has(tag) && c.has(tag)) n++;
  return n;
}

// Compose the full spell sentence text for display. Modifiers respect their
// kind: 'pre' prepends to the head, 'post' appends to the tail, and
// 'replaces-intro' substitutes the intro.
export function composeSpellText(intro, subject, target, modifiers = []) {
  if (!intro || !subject || !target) return '';
  const preModifiers = modifiers.filter(m => m?.modifierKind === 'pre');
  const postModifiers = modifiers.filter(m => m?.modifierKind === 'post');
  const replaceMods = modifiers.filter(m => m?.modifierKind === 'replaces-intro');
  const head = replaceMods.length > 0
    ? replaceMods.map(m => m.phrase).join(' ')
    : intro.phrase;
  const preBits = preModifiers.map(m => m.phrase).join(' ');
  const postBits = postModifiers.map(m => m.phrase).join(' ');
  const core = `${head} ${subject.phrase} ${target.phrase}`;
  let text = preBits ? `${preBits} ${core}` : core;
  if (postBits) text = `${text.replace(/[.!?]\s*$/, '')} ${postBits}`;
  return text.replace(/\s+/g, ' ').trim();
}

// Damage formula. Returns { damage, tier, riders, sideEffects }.
//
//   base damage = (target.effect.base + sum(card stat contributions) × target.effect.multiplier)
//   × tier_multiplier  (1.0 / 1.5 / 2.5)
//   then apply modifiers in order:
//     - damageMult (multiplicative)
//     - tier3Payoff (only at tier 3)
//     - tier3Double on target
//     - perSharedTag bonus
//     - perTagMatch bonus (modifier-specific)
//
// `sideEffects` carries non-damage outcomes — riders to apply, draw counts,
// block strips, self-composure costs — that the caster will resolve after
// damage lands.
export function computeSpellDamage(intro, subject, target, modifiers = [], context = {}) {
  if (!intro || !subject || !target || !target.effect) {
    return { damage: 0, tier: 0, riders: {}, sideEffects: {} };
  }
  const tier = computeSpellTier(intro, subject, target);
  const eff = target.effect;
  const lane = target.lane || 'wit';

  // Stat contribution: sum across intro + subject + target's own stats.
  // (Targets typically don't carry stat contribution but the field is honored
  // for future hybrid cards.)
  const introStat   = intro.stats?.[lane]   || 0;
  const subjectStat = subject.stats?.[lane] || 0;
  const targetStat  = target.stats?.[lane]  || 0;
  // Modifiers may also contribute stat (e.g. "I daresay," adds +1 wit).
  const modStat = modifiers.reduce((s, m) => s + (m?.stats?.[lane] || 0), 0);
  const statTotal = introStat + subjectStat + targetStat + modStat;

  const tierMult = TIER_MULTIPLIER[tier] || 1.0;
  let damage = (eff.base + statTotal * eff.multiplier) * tierMult;

  // Handle target-side tier-3 conditions.
  if (eff.tier3Double && tier === 3) damage *= 2;
  if (eff.requiresTier3 && tier < 3) {
    // Fail-condition: damage cut. (v2.4: dropped exile-on-fail — double
    // punishment turned rare-target gambles into trap cards. Half-damage
    // is enough sting; the card still goes to discard like any other.)
    damage *= eff.requiresTier3.failureDamageMult || 0.5;
  }

  // v2.2: target-side tag scaling (jnsq lane identity hook). +N damage
  // per matching tag in the staged cards. Modifiers' perLaneTag is below
  // in the modifier loop; this is the target-side mirror so jnsq targets
  // can reward tag-cohesive deck-building directly.
  if (eff.perLaneTag) {
    const allTags = trayTags(intro, subject, target, modifiers);
    const count = allTags.filter(t => eff.perLaneTag.tags.includes(t)).length;
    damage += eff.perLaneTag.bonus * count;
  }

  // v2.5: unique target scaling mechanics. Caller passes world state via
  // `context`; if it's missing the field, that scaling contributes 0.
  if (eff.perDiscardCard && context.discardSize > 0) {
    damage += eff.perDiscardCard * context.discardSize;
  }
  if (eff.perDeckCard && context.deckSize > 0) {
    damage += eff.perDeckCard * context.deckSize;
  }
  if (eff.missingHpBonus && context.missingHpFrac > 0) {
    // Linear scaling: 50% missing HP = +50% damage at missingHpBonus: 1.0
    damage *= (1 + eff.missingHpBonus * context.missingHpFrac);
  }

  // Sum riders: from target effect + per-modifier rider triggers.
  const riders = { ...(eff.rider || {}) };
  // v2.2: target cards can also grant drawAfterCast as a smoothing mechanic.
  let drawCount = eff.drawAfterCast || 0;
  let stripBlock = 0;
  let selfComposureCost = 0;
  // v2.4: HP-cost-on-cast (Chutzpah identity). Modifiers can also add to it.
  let selfHpCost = eff.loseHpOnCast || 0;

  for (const m of modifiers) {
    if (!m) continue;
    const me = m.modifierEffect || {};
    if (me.damageMult) damage *= me.damageMult;
    if (me.conditionalMult?.tier2Plus && tier >= 2) damage *= me.conditionalMult.tier2Plus;
    if (me.tier3Payoff && tier === 3) {
      if (me.tier3Payoff.damageMult) damage *= me.tier3Payoff.damageMult;
      if (me.tier3Payoff.rider) {
        for (const [k, v] of Object.entries(me.tier3Payoff.rider)) {
          riders[k] = (riders[k] || 0) + v;
        }
      }
    }
    if (me.perSharedTag) {
      damage += me.perSharedTag * sharedTagCount(intro, subject, target);
    }
    if (me.perLaneTag) {
      const allTags = trayTags(intro, subject, target, modifiers);
      const count = allTags.filter(t => me.perLaneTag.tags.includes(t)).length;
      damage += me.perLaneTag.bonus * count;
    }
    if (me.rider) {
      for (const [k, v] of Object.entries(me.rider)) {
        riders[k] = (riders[k] || 0) + v;
      }
    }
    if (me.drawAfterCast) drawCount += me.drawAfterCast;
    if (me.stripEnemyBlock) stripBlock += me.stripEnemyBlock;
    if (me.selfComposureCost) selfComposureCost += me.selfComposureCost;
    if (me.loseHpOnCast) selfHpCost += me.loseHpOnCast;
  }

  return {
    damage: Math.max(0, Math.round(damage)),
    tier,
    riders,
    sideEffects: {
      drawCount,
      stripBlock,
      selfComposureCost,
      selfHpCost,
      // v2.4: exhaustTarget always false now. The exile-on-tier-3-fail
      // double-punishment was a trap; rare gamble targets keep the
      // half-damage penalty but stay in the deck for replay.
      exhaustTarget: false,
    },
  };
}

// Default stat contribution by rarity (used when authoring new cards).
export function defaultWitForRarity(rarity) { return RARITY_WIT[rarity] || 1; }
export function defaultTierForRarity(rarity) { return RARITY_TIER[rarity] || 1; }
