// Witch Mountain Bridge — Sentence Engine v2: shared schema + tier math.
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

// Stat contribution per rarity (cards within the same school vary in raw wit).
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
  // v2.7: tierWildcard — a card with this flag counts as the highest
  // tier among the OTHER two slots for sum calculation. Lets a player
  // get a T2-only hand to land at T3 by staging a wildcard subject.
  const it = intro.tierWildcard ? Math.max(subject.tier || 1, target.tier || 1) : (intro.tier || 1);
  const st = subject.tierWildcard ? Math.max(intro.tier || 1, target.tier || 1) : (subject.tier || 1);
  const tt = target.tierWildcard ? Math.max(intro.tier || 1, subject.tier || 1) : (target.tier || 1);
  const sum = it + st + tt;
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
  // v2.94: prefer target.effect.scaleBy over target.lane. Targets like
  // Coil declare `scaleBy: 'chutzpah'` but carry no `lane` field — without
  // this fallback, statTotal would sum wit stats (zero) instead of chutzpah,
  // and the cast lands at base damage only. Math bar + cast formula now agree.
  const lane = eff?.scaleBy || target.lane || 'wit';

  // Stat contribution: sum across intro + subject + target's own stats.
  // (Targets typically don't carry stat contribution but the field is honored
  // for future hybrid cards.)
  // v2.35: FOOTNOTE — a Word card instance can carry a `footnotes: N`
  // count, added on top of its base wit stat per slot. Footnotes are
  // applied via the "As Hewn-Greaves notes in his footnotes," skill;
  // each play bumps the chosen card's count by 1. The bonus scales
  // through ALL stat-bearing slots (intro/subject/modifier) AND target's
  // own stat block if hybrid. Targets without stats simply ignore it.
  const introFn   = intro.footnotes   || 0;
  const subjectFn = subject.footnotes || 0;
  const targetFn  = target.footnotes  || 0;
  // v2.48: AWKWARD PAUSE — when context.pauseDoubled is set (caller pressed
  // the "...go on, I'm listening." skip-turn skill last turn, banking a
  // doubled-stat cast for this turn), every staged-card stat contribution
  // doubles. Doubles the BASE stat AND the footnote-rider, since footnotes
  // ride through statTotal and a held-and-doubled tray's footnotes should
  // double too. Applied once per cast — caller clears the flag.
  const pauseMult = context.pauseDoubled ? 2 : 1;
  const introStat   = ((intro.stats?.[lane]   || 0) + introFn)  * pauseMult;
  const subjectStat = ((subject.stats?.[lane] || 0) + subjectFn) * pauseMult;
  const targetStat  = ((target.stats?.[lane]  || 0) + targetFn)  * pauseMult;
  // Modifiers may also contribute stat (e.g. "I daresay," adds +1 wit).
  let modFnTotal = 0;
  const modStat = modifiers.reduce(
    (s, m) => {
      const fn = m?.footnotes || 0;
      modFnTotal += fn;
      return s + ((m?.stats?.[lane] || 0) + fn) * pauseMult;
    }, 0);
  const statTotal = introStat + subjectStat + targetStat + modStat;
  const totalFootnotes = (introFn + subjectFn + targetFn + modFnTotal) * pauseMult;

  const tierMult = TIER_MULTIPLIER[tier] || 1.0;
  let damage = (eff.base + statTotal * eff.multiplier) * tierMult;
  // v2.35: how much of `damage` came from the footnote stat-rider, for
  // log/telemetry. Footnotes ride through `statTotal`, so each unit of
  // footnote adds `eff.multiplier × tierMult` flat damage. Modifier-side
  // multipliers (damageMult, conditionalMult, etc.) compound onto this
  // too — we apply the SAME scaling chain when surfacing the bonus
  // (post-loop) by ratioing the final damage against pre-footnote dmg.
  const damageNoFootnotes = (eff.base + (statTotal - totalFootnotes) * eff.multiplier) * tierMult;

  // Handle target-side tier-3 conditions.
  if (eff.tier3Double && tier === 3) damage *= 2;

  // v2.50: doubleOnSecondCast — paired with Babbling (jv2-p-wait-and-another-
  // thing). When this target fires as cast #2 of the turn (caller passes
  // context.isSecondCast = true), damage doubles HERE — before the App/sim
  // apply their 0.6× babbling scalar. Net vs first cast: 2 × 0.6 = 1.2×.
  // Only the "getting away from me" rare carries this flag today; gated by
  // `mustPlayAnotherJnsq` so the pairing requires deck commitment.
  if (eff.doubleOnSecondCast && context.isSecondCast) damage *= 2;
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
  // v2.7: tagAmpMult — any staged card with this field doubles tag-payoff
  // bonuses on the cast. Wit "sheer academic" subject is the lead card.
  const tagAmp = [intro, subject, target, ...modifiers].reduce(
    (m, c) => m * (c?.tagAmpMult || 1), 1);
  if (eff.perLaneTag) {
    const allTags = trayTags(intro, subject, target, modifiers);
    const count = allTags.filter(t => eff.perLaneTag.tags.includes(t)).length;
    damage += eff.perLaneTag.bonus * count * tagAmp;
  }
  // v2.51: SYNERGY CAPSTONE — `perTagBonus` mirrors `perLaneTag` but is
  // gated to the jnsq capstone target ("universe sideways"). Counts every
  // matching tag across the tray WITH multiplicity (a card with both
  // 'chaotic' and 'absurd' counts as 2, two cards each with 'mystical'
  // count as 2). Practical cap is the visible tag count of staged cards;
  // a fully-tagged jnsq tray (intro+subject+target+2 modifiers each
  // carrying 2-3 matching tags) lands ~6-9 bonus at bonus=3. Honors the
  // same tagAmp pipeline as perLaneTag for consistency with v2.7.
  if (eff.perTagBonus) {
    const allTags = trayTags(intro, subject, target, modifiers);
    const count = allTags.filter(t => eff.perTagBonus.tags.includes(t)).length;
    damage += eff.perTagBonus.bonus * count * tagAmp;
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
      damage += me.perSharedTag * sharedTagCount(intro, subject, target) * tagAmp;
    }
    if (me.perLaneTag) {
      const allTags = trayTags(intro, subject, target, modifiers);
      const count = allTags.filter(t => me.perLaneTag.tags.includes(t)).length;
      damage += me.perLaneTag.bonus * count * tagAmp;
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

  // v2.6: damageTypeFlip — convert composure damage to physical (or vice
  // versa). Lets the player route around stat-resistant enemies.
  const flippedDmgType = modifiers.some(m => m?.modifierEffect?.damageTypeFlip)
    ? (eff.damageType === 'physical' ? 'composure' : 'physical')
    : null;

  // v2.29: chutzpah SAYING IT LOUDER — repetition scaling. Each demanding-
  // tagged chutzpah WORD card staged this turn (intro/subject/modifier)
  // bumps context.loudCount. Targets with `loudScaling: true` get a flat
  // +loudCount × 3 added AFTER the tier-multiplied base. Note: this is a
  // flat bonus (not multiplied by tier or stakeMult) so the math reads as
  // "every louder say is +3 damage on the finisher" no matter the tier.
  let loudBonus = 0;
  if (eff.loudScaling && context.loudCount > 0) {
    loudBonus = context.loudCount * 3;
    damage += loudBonus;
  }

  // v2.30: chutzpah SMELL WEAKNESS — predator rider. If the enemy currently
  // has Vulnerable (playerDmgMult > 1) OR Weak (enemyDmgMult < 1) applied,
  // a target with `predator: N` adds N flat damage to the cast. Flat (not
  // tier-multiplied) so the math reads as "+N when the prey is wounded".
  // Caller passes the current mults via context.playerDmgMult / enemyDmgMult
  // (both default to 1.0). The bonus is conditional: clean enemies = no
  // bonus, so chutzpah players are incentivised to OPEN with a Vuln/Weak
  // applier before swinging the predator finisher.
  let predatorBonus = 0;
  const enemyDebuffed = (context.playerDmgMult || 1) > 1.0 ||
                        (context.enemyDmgMult || 1) < 1.0;
  if (eff.predator > 0 && enemyDebuffed) {
    predatorBonus = eff.predator;
    damage += predatorBonus;
  }

  // v2.34: wit LONG THREAD — consecutive-turn scaling. Targets carrying
  // `threadScaling: N` add `N × longThread` flat damage on cast. Flat (not
  // tier-multiplied) so the math reads as "+N per turn we held the thread".
  // Caller passes the current meter via context.longThread (defaults to 0).
  let threadBonus = 0;
  if (eff.threadScaling > 0 && (context.longThread || 0) > 0) {
    threadBonus = eff.threadScaling * context.longThread;
    damage += threadBonus;
  }

  // v2.39: wit OPENING STATEMENT — first-turn scaling. Targets carrying
  // `openingBonus: N` add N flat damage on cast IF cast on the first
  // player turn of combat OR if the "to revisit my opening point," skill
  // has extended the opening into this turn. Flat (not tier-multiplied)
  // so the math reads as "+N because the room hasn't settled yet."
  // Caller passes context.combatTurn (1-indexed) AND context.openingExtended.
  let openingBonusDmg = 0;
  if (eff.openingBonus > 0) {
    const firstTurn = (context.combatTurn || 0) === 1;
    const extended = !!context.openingExtended;
    if (firstTurn || extended) {
      openingBonusDmg = eff.openingBonus;
      damage += openingBonusDmg;
    }
  }

  // v2.42: wit INSULT VULNERABILITIES — targets with `pierceVulnerableInsult: N`
  // gain N flat damage per staged-card tag that matches an entry in the enemy's
  // `insultVulnerabilities` array. Each tag occurrence counts as one match
  // (multi-tag subjects stack matches); capped at 3 matches per cast so a
  // jacuzzi of `dismissive` tags can't snowball. Caller passes
  // context.insultVulnerabilities (defaults to []).
  let insultBonusDmg = 0;
  let insultMatches = 0;
  const insultMatchedTags = [];
  if (eff.pierceVulnerableInsult > 0) {
    const vulns = context.insultVulnerabilities || [];
    if (vulns.length > 0) {
      const allTags = trayTags(intro, subject, target, modifiers);
      for (const t of allTags) {
        if (vulns.includes(t)) {
          insultMatches++;
          insultMatchedTags.push(t);
        }
      }
      const cappedMatches = Math.min(insultMatches, 3);
      if (cappedMatches > 0) {
        insultBonusDmg = cappedMatches * eff.pierceVulnerableInsult;
        damage += insultBonusDmg;
      }
    }
  }

  // v2.11: chutzpah ALL IN — per-cast HP wager. context.stakeAmount is
  // the staked HP. Per-card stakeMultiplier picks the MAX value (so a
  // staged Double-or-Nothing target overrides the default 1.5×). If any
  // modifier has stakeAutoDouble, the final stake bonus doubles.
  const stakeAmount = context.stakeAmount || 0;
  let stakeBonus = 0;
  if (stakeAmount > 0) {
    const stakeMults = [intro, subject, target, ...modifiers]
      .map(c => c?.stakeMultiplier || c?.effect?.stakeMultiplier || 0)
      .filter(m => m > 0);
    // v2.99: default stake multiplier 1.0 → 1.5 to match the design intent
    // ("+1.5 damage per HP" was already in the UI tooltip). Brings the
    // ALL IN baseline above 1:1 so it's value-positive without requiring
    // a stake-multiplier synergy card. Synergy cards still boost further.
    const stakeMult = stakeMults.length > 0 ? Math.max(...stakeMults) : 1.5;
    stakeBonus = Math.ceil(stakeAmount * stakeMult);
    const autoDouble = modifiers.some(m => m?.modifierEffect?.stakeAutoDouble);
    if (autoDouble) stakeBonus *= 2;
    damage += stakeBonus;
  }

  // v2.35: footnote bonus = pre-modifier dmg delta the footnotes carried,
  // surfaced for log/telemetry. Modifiers (damageMult etc.) compound onto
  // this too — `damage - damageNoFootnotes` would be the modifier-aware
  // bonus, but at this point in the code `damage` has had stakeBonus,
  // loudBonus, predatorBonus, threadBonus added FLAT on top of the
  // pre-stat math, so subtracting the no-footnote pre-stat math from the
  // current damage isn't clean either. We surface the pre-modifier flat
  // damage delta and let callers multiply by the visible final/base
  // ratio if they want a fully accurate post-mod number.
  const footnoteBonus = totalFootnotes > 0
    ? Math.round((eff.base + statTotal * eff.multiplier) * tierMult
                 - damageNoFootnotes)
    : 0;

  return {
    damage: Math.max(0, Math.round(damage)),
    tier,
    riders,
    flippedDmgType, // v2.6: null or the new damage type to use
    stakeBonus, // v2.11: how much damage came from the stake (for UI/log)
    loudBonus, // v2.29: how much damage came from saying-it-louder repetition
    predatorBonus, // v2.30: how much damage came from the predator rider
    threadBonus, // v2.34: how much damage came from the LONG THREAD scaling
    footnoteBonus, // v2.35: how much damage came from FOOTNOTE stat-riders
    openingBonus: openingBonusDmg, // v2.39: how much damage came from OPENING STATEMENT
    insultBonus: insultBonusDmg, // v2.42: how much damage came from INSULT VULNERABILITY pierce
    insultMatches, // v2.42: raw match count (uncapped) — for telemetry diagnostics
    insultMatchedTags, // v2.42: matched tag list — for tooltip display
    pauseDoubled: !!context.pauseDoubled, // v2.48: AWKWARD PAUSE — was this cast doubled?
    sideEffects: {
      drawCount,
      stripBlock,
      selfComposureCost,
      selfHpCost,
      // v2.11: target with stakeRefundHalf heals half the stake on hit.
      stakeRefundHalf: !!target?.effect?.stakeRefundHalf,
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
