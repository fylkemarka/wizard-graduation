// Witch Mountain Bridge — STS-inspired single-player roguelike deckbuilder.
//
// MVP5: Verbal combat. Cards are word-fragments and effect-seals; you
// build up a spell by playing words that contribute stat points across
// three traits (Handler / Wit / Jnsq), then play an Effect card to
// fire the spell against the enemy's Composure (or, for physical
// effects, their HP). Enemies have per-stat `effectiveness` —
// multipliers, with 0 meaning "completely immune to this kind of
// argument" (a Lich, for example, does not laugh). Defense (Block) is
// unchanged; physical damage from enemies still hits HP.
//
// Card shapes:
//   - WORD   ({ stats: { handler?, wit?, jnsq? }, phrase: '...' }) —
//            contributes stat points to the spell tray for this turn.
//            May also carry `effects` for an on-play side-bonus.
//   - EFFECT ({ effect: { scaleBy, base, multiplier, damageType,
//            rider?, exhaust? }, phrase: '...' }) — fires the spell.
//            Damage = (base + tray[scaleBy] * multiplier) * effectiveness.
//            Vulnerable/Weak ride after damage.
//   - SKILL  — utility (block, draw, energy, heal). No stat contribution.
//   - POWER  — installs on the field and triggers per turn hook.
//
// Effect dispatcher keys recognised at on-play time:
//   block / draw / vulnerable / weak / energy / hp / exhaust   (skill side)
//   stats: { handler, wit, jnsq }                             (word)
//   effect: { ... }                                            (effect-seal)
//
// Power trigger hooks:
//   startOfTurn / endOfTurn / onEffectCardPlayed
//
// Equipment-bonus keys read at the right hooks (start-of-combat, etc.):
//   strikeBonus            — +N base damage on any Strike-named effect card
//   startBlock             — +N Block at start of every combat
//   energyOnCombatStart    — +N energy on turn 1 of each combat (one-shot)
//   permanentEnergyBonus   — +N energy refilled EVERY turn (perm)
//   maxHp                  — +N max HP (applied once at install)
//   healOnCombatStart      — +N HP at start of every combat
//   extraStartHand         — +N to the turn-1 draw (per combat)

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { logEvent, logError, getStats, exportAllSessions, clearTelemetry, TelemetryEvents as TE } from './telemetry.js';
import { WIT_V2, WIT_V2_BY_SLOT } from './cards/wit-v2.js';
import { WIT_ROWS, WIT_SAME_SCHOOL_BONUSES, WIT_PARTIAL_ROW_BONUSES, WIT_MIXED_SCHOOL_BONUSES, WIT_ROW_BY_ID, detectFFT, registerRows } from './cards/wit-v2-rows.js';
// handler-v2-rows.js removed 2026-05-31 — Handler (formerly Handler)
// pivoted away from the FFT system entirely. Animal Summoner engine is
// the new direction. FFT system is wit-only.
import { HANDLER_V2, HANDLER_V2_BY_SLOT, SPECIAL_LURE_CARDS } from './cards/handler-v2.js';
import { JNSQ_V2, JNSQ_V2_BY_SLOT } from './cards/jnsq-v2.js';
import { ENEMIES, ENEMIES_BY_ID } from './data/enemies.js';
import Icon from './icons/Icon.jsx';
import ArtSlot from './components/ArtSlot.jsx';
import { ANIMALS, ADJACENCY_COMBOS } from './data/animals.js';
import { TIER_MULTIPLIER, computeSpellTier, computeSpellDamage, composeSpellText, sharedTagCount } from './cards/shared.js';
import { CardFullBody } from './components/CardFullBody.jsx';
import { CombatScreen } from './components/CombatScreen.jsx';
import { Compendium } from './components/Compendium.jsx';
import { DeckView } from './components/DeckView.jsx';
import { ReadingRoom } from './components/ReadingRoom.jsx';

// v2 card-pool lookup table keyed by lane.
const LANE_POOL = { wit: WIT_V2, handler: HANDLER_V2, jnsq: JNSQ_V2 };
const LANE_POOL_BY_SLOT = { wit: WIT_V2_BY_SLOT, handler: HANDLER_V2_BY_SLOT, jnsq: JNSQ_V2_BY_SLOT };
const ALL_V2_CARDS = [...WIT_V2, ...HANDLER_V2, ...JNSQ_V2];
// Only the foundational VARIETY lures come in pairs as a reward — each summons
// from a 3-animal pool, so two copies keep the species cycling. Every other
// lure (Fish Food and the single-named-animal special lures) is a single card.
// Single source of truth for both the reward-screen badge and the deck-add.
const PAIR_LURE_IDS = new Set(['cv2-l-birdseed', 'cv2-l-tender-greens']);
// Handler menagerie slot order. Module-scoped so helpers/intent handlers
// outside endTurn (adjacent-amplify, copy-left, Sloth, Porcupine) can read it.
const SLOT_ORDER = ['intro', 'subject', 'target'];

// =============================================================================
// 1. DATA
// =============================================================================
const CARDS = [
  // v2 sentence-engine cards: imported from src/cards/{wit,handler,jnsq}-v2.js.
  ...ALL_V2_CARDS,

  // =============================================================================
  // SKILL CARDS — no stat contribution, no spell sealing. Pure utility.
  // =============================================================================
  // ---- BASIC (starter) ----
  { id: 'c-defend', name: 'Defend', cost: 1, type: 'skill', rarity: 'basic',
    effects: { block: 8 }, upgrade: { effects: { block: 11 } },
    desc: 'Gain 8 Block (vs physical attacks).' },
  // v2.9: starter Poise card. Defends against composure (🎭) attacks
  // which Block can't touch. Every starter deck gets one of these
  // alongside Defend so the player has both shields from turn 1.
  { id: 'c-compose', name: 'Compose Yourself', cost: 1, type: 'skill', rarity: 'basic',
    effects: { poise: 7, removeWeak: 1 }, upgrade: { effects: { poise: 10, removeWeak: 2 } },
    desc: 'Gain 7 Poise (vs composure attacks). Remove 1 Weak from yourself.',
    flavor: 'The first thing they took from you is the first thing you take back.' },
  // v3.4.10 (Alan): replaces the cross-row second intro that used to ride
  // along in the wit starter. One-shot, non-exhausting damage so the
  // starter has a reliable chip-cast option that doesn't depend on
  // assembling the tray. Goes back to deck (cycles) — not a gesture.
  { id: 'c-rebut', name: 'Rebut', cost: 1, type: 'skill', rarity: 'basic',
    effects: { compDmg: 4 }, upgrade: { effects: { compDmg: 6 } },
    desc: 'Deal 4 composure damage.',
    flavor: 'Not the cleverest reply. Lands anyway.' },
  // Punchline removed 2026-05-31 — handler pivoted away from the Loudness
  // mechanic with the Animal Summoner engine. No card now feeds or consumes
  // Loudness. State machinery remains in place (dormant) until the new engine
  // either repurposes or fully retires it.
  // Handler-specific defend. The Handler outsources fighting to the
  // menagerie, so personal defense is softer than the colorless +8 c-defend.
  // Mirrors c-defend in shape: 1 energy, +N block, cycles back via discard.
  { id: 'c-defend-handler', name: 'Step Back', cost: 1, type: 'skill', rarity: 'basic',
    effects: { block: 6 },
    desc: 'Gain 6 Block.',
    flavor: 'You take half a step back. Let the goose handle this.' },
  // ---- Handler interplay cards (Animal Summoner slice 2, 2026-05-31) ----
  // Designed to add per-turn decisions to the Handler loop. Without them
  // the play loop is "stage → defend → wait → repeat" with no in-turn
  // choices. These four hit different beats: slot setup (Whistle), patience
  // payoff (Treat), spike turn (Pack Tactics), impatience option (Just Eat It).
  { id: 'c-whistle', name: 'Whistle', cost: 1, type: 'skill', rarity: 'basic', lane: 'handler',
    effects: { whistleSwap: true },
    desc: 'Pick two stage slots and swap their contents. (Lures, animals, or empty.)',
    flavor: 'A short, important note. The animals re-arrange themselves accordingly.' },
  { id: 'c-treat', name: 'Treat', cost: 1, type: 'skill', rarity: 'common', lane: 'handler',
    effects: { treatExtend: 1 },
    desc: 'Pick a summoned animal. It stays one more turn.',
    flavor: 'You produce it from a pocket. Frankly, it has been there for some time.' },
  { id: 'c-pack-tactics', name: 'On Three!', cost: 2, type: 'skill', rarity: 'uncommon', lane: 'handler',
    effects: { packTactics: true, exhaust: true },
    desc: 'Each of your animals attacks again this turn. Exhaust.',
    flavor: "On three. Yes, you'll count. They are very busy." },
  { id: 'c-just-eat-it', name: 'Just Eat It', cost: 0, type: 'skill', rarity: 'common', lane: 'handler',
    effects: { eatLureNow: true, exhaust: true },
    desc: 'Pick a staged lure. The animal it summons arrives immediately. Exhaust.',
    flavor: 'You explain, with the gentle authority of a man with no time, that it is, in fact, lunch.' },
  { id: 'c-buffet', name: 'Buffet', cost: 2, type: 'skill', rarity: 'uncommon', lane: 'handler',
    effects: { buffetArmed: true, exhaust: true },
    desc: 'Your next lure is placed in every empty stage slot. Exhaust.',
    flavor: 'A spread, really. You laid it out. Now they come.' },
  // ---- LURE TUTORS (Alan, 2026-06-01) — consistency cards. With three
  // lures it was hard to keep bait in hand to feed the menagerie; these
  // fetch a lure from a given pile so the engine keeps running. They do NOT
  // exhaust — they cycle back so the player can keep digging.
  { id: 'c-rummage', name: 'Rummage the Satchel', cost: 1, type: 'skill', rarity: 'common', lane: 'handler',
    effects: { fetchLure: 'deck' },
    desc: 'Search your draw pile for a lure and put it in your hand.',
    flavor: 'There is always something at the bottom. There is always more than you packed.' },
  { id: 'c-back-of-the-bin', name: 'Back of the Bin', cost: 1, type: 'skill', rarity: 'common', lane: 'handler',
    effects: { fetchLure: 'discard' },
    desc: 'Return a lure from your discard pile to your hand.',
    flavor: "You don't throw food away. You relocate it. Temporarily." },
  { id: 'c-something-turns-up', name: 'Something Turns Up', cost: 0, type: 'skill', rarity: 'common', lane: 'handler',
    effects: { fetchLureRandom: true },
    desc: 'A random lure from your draw pile turns up in your hand.',
    flavor: 'You weren\'t looking for it. It was, apparently, looking for you.' },
  // ---- LURE NARROWING — shape a variable lure toward a known species so
  // adjacency combos become reachable. Gated: a lure never narrows below 2
  // possible creatures, and the narrowing resets every combat. (Alan,
  // 2026-06-02 — deck-paths convergence; pairs with ADJACENCY_COMBOS.)
  { id: 'c-narrow', name: 'Acquired Taste', cost: 1, type: 'skill', rarity: 'common', lane: 'handler',
    effects: { narrowLure: true, exhaust: true },
    desc: 'Pick a lure and one creature it summons; that lure stops summoning that creature for the rest of combat. (A lure never narrows below 2 creatures.) Exhaust.',
    flavor: 'You explain, at length, what they will and will not be eating. They develop opinions.' },
  // ---- TACTICS — persistent FREE stances that bend the animal-summoner
  // engine (cost 0 as of 2026-06-02). A Tactic occupies the modifier slot of
  // the spell tray (relabelled "Pack Tactics" for handler) and stays until
  // replaced by another tactic. They cost no energy: a summoner's 3 energy is
  // all spent on lures, so a tactic that competed for it never got played.
  // The decision is which stance fits the board, and you run one at a time.
  { id: 'c-tactic-shield', name: 'Summoned Shield', cost: 0, type: 'tactic', slot: 'tactic', rarity: 'common', lane: 'handler',
    tactic: { id: 'shield' },
    desc: 'Free stance: animal attack damage becomes Block AND Poise for you instead of damage to the enemy.',
    flavor: 'Each beast turns its body to the door. You may pass between them.' },
  { id: 'c-tactic-rabid', name: 'Rabid', cost: 0, type: 'tactic', slot: 'tactic', rarity: 'uncommon', lane: 'handler',
    tactic: { id: 'rabid' },
    desc: 'Free stance: animal attacks deal 50% more damage. You take 10% of that damage as composure recoil.',
    flavor: "It's contagious, frankly. Try not to make eye contact." },
  { id: 'c-tactic-youth', name: 'Fountain of Youth', cost: 0, type: 'tactic', slot: 'tactic', rarity: 'common', lane: 'handler',
    tactic: { id: 'youth' },
    desc: 'Free stance: your next 3 lure plays summon animals that stay one extra turn. A Buffet that spreads one lure counts as a single use.',
    flavor: 'A small puddle. The animals know about it. Apparently.' },
  { id: 'c-tactic-nurture', name: 'Nurture', cost: 0, type: 'tactic', slot: 'tactic', rarity: 'uncommon', lane: 'handler',
    tactic: { id: 'nurture' },
    desc: 'Free stance: lures resolve immediately on placement — animals arrive the moment they are staged.',
    flavor: 'They were peckish anyway. Apparently.' },
  { id: 'c-tactic-feather', name: 'Birds of a Feather', cost: 0, type: 'tactic', slot: 'tactic', rarity: 'common', lane: 'handler',
    tactic: { id: 'feather', requiresExactlyOneAnimal: true },
    desc: 'Draw 1. Free stance: requires exactly one animal in play. Any new animal summoned matches the existing species. Self-exhausts when three of the same animal are on the field.',
    flavor: "A field full of one thing. They've been doing this for some time." },

  // ====================================================================
  // HANDLER ARCHETYPE PASS (2026-06-01) — adds draftable game plans on top
  // of the stage→wait→repeat loop (playtest note #4: utility cards lacked
  // depth). Four archetypes: THE TRAINER (persistent summon powers), THE
  // BUTCHER (sacrifice/cash-in), THE FLOCK (tribal by feedKey), THE GLUTTON
  // (feed-as-resource). See memory: wg-handler-playtest-20260601.
  // ====================================================================
  // ---- THE TRAINER — powers that shape every future summon. The lane had
  // no persistent powers of its own; this is the install-and-snowball axis.
  { id: 'c-house-rules', name: 'House Rules', cost: 2, type: 'power', rarity: 'uncommon', lane: 'handler',
    installPower: { id: 'houseRules' },
    desc: 'Pick a summoned animal. It — and every other copy of it on the board — stays 2 more turns.',
    flavor: 'You explain the arrangement. They settle in, slightly longer than invited.' },
  { id: 'c-well-drilled', name: 'Well-Drilled', cost: 2, type: 'power', rarity: 'uncommon', lane: 'handler',
    installPower: { id: 'wellDrilled' },
    desc: 'Pick a summoned animal. It — and every other copy of it on the board — gains +2 attack for the rest of combat.',
    flavor: 'They have, it turns out, been practising. Quietly. Without you.' },
  { id: 'c-whisperer', name: 'The Whisperer', cost: 2, type: 'power', rarity: 'rare', lane: 'handler',
    installPower: { id: 'whisperer' },
    desc: 'Power. Whenever one of your animals leaves play, draw 1 next turn.',
    flavor: 'You have a quiet word with each of them as they go. They tell you things.' },
  { id: 'c-open-door', name: 'Open Door Policy', cost: 2, type: 'power', rarity: 'rare', lane: 'handler',
    installPower: { id: 'openDoor' },
    desc: 'Power. The first lure you play each turn costs 0.',
    flavor: 'The door is always open. The first one in never pays.' },
  { id: 'c-pecking-order', name: 'Pecking Order', cost: 1, type: 'power', rarity: 'uncommon', lane: 'handler',
    installPower: { id: 'peckingOrder' },
    desc: 'Power. When an enemy mauls, it takes your weakest animal instead of your strongest.',
    flavor: 'Someone has to go first. The committee has determined it will not be the big one.' },
  // ---- THE BUTCHER — the board is ammunition. These two cash the board in
  // for value. Pairs with The Whisperer.
  { id: 'c-last-supper', name: 'Last Supper', cost: 1, type: 'skill', rarity: 'uncommon', lane: 'handler',
    effects: { sacrificeForValue: true },
    desc: 'Send off one of your animals. Gain Energy equal to its remaining turns and draw 1.',
    flavor: 'A generous portion. A fond farewell. A faint sense of having planned this.' },
  { id: 'c-make-it-count', name: 'Make It Count', cost: 2, type: 'skill', rarity: 'rare', lane: 'handler',
    effects: { sacrificeAllForBurst: true, exhaust: true },
    desc: 'Each of your animals attacks for double, then leaves play. Exhaust.',
    flavor: 'You give the signal you swore you would only give once.' },
  // ---- THE FLOCK — commit to one feedKey family. Murmuration scales with
  // birds; Stampede is a small-land Pack Tactics.
  { id: 'c-murmuration', name: 'Murmuration', cost: 1, type: 'skill', rarity: 'uncommon', lane: 'handler',
    effects: { compDmgPerBird: 3 },
    desc: 'Deal 3 composure for each bird you have in play.',
    flavor: 'They move as one. The enemy is, briefly, outnumbered by a single idea.' },
  { id: 'c-stampede', name: 'Stampede', cost: 1, type: 'skill', rarity: 'uncommon', lane: 'handler',
    effects: { smallLandAttackAgain: true, exhaust: true },
    desc: 'Each small-land animal you control attacks again this turn. Exhaust.',
    flavor: 'It starts with one. It is, by the third, a policy.' },
  // ---- THE GLUTTON — feeding stops being a tax and becomes the build.
  // Full Pockets keeps food in hand (playtest note #1); Gorge overfeeds.
  { id: 'c-full-pockets', name: 'Full Pockets', cost: 2, type: 'power', rarity: 'common', lane: 'handler',
    installPower: { id: 'fullPockets' },
    desc: 'Add a Treat to your hand.',
    flavor: 'You are never not carrying something edible. It is, frankly, a condition.' },
  // Token Treat handed out by Full Pockets. Functionally identical to the
  // real Treat card (treatExtend), but `token: true` scrubs it at the next
  // combat's deck reconstitution so it never persists into the run deck.
  { id: 'c-snack', name: 'Treat', cost: 1, type: 'skill', rarity: 'basic', lane: 'handler', token: true,
    effects: { treatExtend: 1 },
    desc: 'Pick an animal. It stays one more turn.',
    flavor: 'Produced from a pocket. Warm, somehow. Best not to ask.' },
  { id: 'c-gorge', name: 'Gorge', cost: 2, type: 'skill', rarity: 'uncommon', lane: 'handler',
    effects: { gorge: true },
    desc: 'Pick an animal: it stays +3 turns. If it was already fed this turn, it also gains +3 attack permanently.',
    flavor: 'Too much, really. That was always the plan.' },

  // ---- COMMON ----
  { id: 'c-mend', name: 'Mend', cost: 1, type: 'skill', rarity: 'common',
    effects: { block: 7 }, upgrade: { effects: { block: 10 } },
    desc: 'Gain 7 Block.' },
  // v2.9: Poise common — composure-shield mid-tier.
  { id: 'c-steady', name: 'Steady Breath', cost: 1, type: 'skill', rarity: 'common',
    effects: { poise: 7 }, upgrade: { effects: { poise: 10 } },
    desc: 'Gain 7 Poise.' },
  { id: 'c-acuity', name: 'Acuity', cost: 1, type: 'skill', rarity: 'common',
    effects: { draw: 2 }, upgrade: { effects: { draw: 3 } },
    desc: 'Draw 2 cards.' },
  { id: 'c-channel', name: 'Channel', cost: 0, type: 'skill', rarity: 'common',
    effects: { draw: 1, energy: 1, exhaust: true }, upgrade: { effects: { draw: 2, energy: 1, exhaust: true } },
    desc: '+1 Energy. Draw 1. Exhaust.' },

  // ---- UNCOMMON ----
  { id: 'c-bulwark', name: 'Bulwark', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 10 }, upgrade: { effects: { block: 14 } },
    desc: 'Gain 10 Block.' },
  { id: 'c-meditate', name: 'Meditate', cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { energy: 1, draw: 1, exhaust: true }, upgrade: { effects: { energy: 1, draw: 1 } },
    desc: 'Gain 1 Energy. Draw 1. Exhaust.' },
  { id: 'c-warding', name: 'Warding Glyph', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 4, vulnerable: 1 }, upgrade: { effects: { block: 6, vulnerable: 2 } },
    desc: 'Gain 4 Block. Apply 1 Vulnerable.' },
  { id: 'c-clarity', name: 'Clarity', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { draw: 3, exhaust: true }, upgrade: { effects: { draw: 4, exhaust: true } },
    desc: 'Draw 3 cards. Exhaust.' },
  // Cycle 4 batch 3: handler sustain + next-cast boost. Pairs with
  // Don't Hold Back / Go For The Throat / Corner Them — heal the chip
  // damage your own deck inflicts, then go big on the next handler cast.
  { id: 'c-iron-stomach', name: 'Iron Stomach', cost: 1, type: 'skill', rarity: 'uncommon', lane: 'handler',
    effects: { hp: 5, boostNextHandlerCast: 0.5, exhaust: true },
    upgrade: { effects: { hp: 8, boostNextHandlerCast: 0.5, exhaust: true } },
    desc: 'Heal 5 HP. Your next Handler Effect this turn deals +50% damage. Exhaust.',
    flavor: 'You\'ve digested worse. You\'ll digest this.' },
  // v2.97: defensive variants (universal). Three options that each force a
  // different "how to spend my defense energy" decision. Brace rewards
  // safe turns; Reframe trades incoming HP for incoming Composure;
  // Riposte arms a counter-attack baked into your block.
  { id: 'c-brace', name: 'Brace', cost: 1, type: 'skill', rarity: 'common',
    effects: { block: 5, braceDrawNext: 1 },
    upgrade: { effects: { block: 7, braceDrawNext: 2 } },
    desc: 'Gain 5 Block. If no unblocked HP damage this turn, draw 1 next turn.',
    flavor: 'You set your feet. The room notices.' },
  { id: 'c-reframe', name: 'Reframe', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 3, swapNextHitToComp: true, exhaust: true },
    upgrade: { effects: { block: 5, swapNextHitToComp: true, exhaust: true } },
    desc: 'Gain 3 Block. Next HP damage you would take is dealt to your Composure instead. Exhaust.',
    flavor: 'The bruise was a metaphor all along.' },
  { id: 'c-riposte', name: 'Animal Reflexes', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 4, riposteArmed: 4, exhaust: true },
    upgrade: { effects: { block: 6, riposteArmed: 6, exhaust: true } },
    desc: 'Gain 4 Block. The next enemy attack ALSO deals 4 Composure damage to its source.',
    flavor: 'Something in you twitches first and explains later.' },
  // v3.0 multi-hit: Brace for Many — universal scaling defense. Block
  // gain = bracePerSwing × swing-count in enemy's NEXT attack. A 4×3
  // enemy = 8 block; a 1×12 enemy = 2 block. Lets the player read the
  // intent and commit defensive resources proportional to the threat.
  // Pre-computed at play time (intent doesn't change mid-turn).
  { id: 'c-brace-for-many', name: 'Brace for Many', cost: 1, type: 'skill', rarity: 'common',
    effects: { bracePerSwing: 2 },
    upgrade: { effects: { bracePerSwing: 3 } },
    desc: 'Gain 2 Block PER swing in the enemy\'s next attack (1 swing → 2 Block, 4× multi → 8 Block).',
    flavor: 'The room, you have decided, is going to do this.' },

  // ---- RARE ----
  { id: 'c-aegis', name: 'Aegis', cost: 2, type: 'skill', rarity: 'rare',
    effects: { block: 16 }, upgrade: { effects: { block: 21 } },
    desc: 'Gain 16 Block.' },

  // v3.4 — COLORLESS ONE-SHOT OFFENSIVE skills. Alan: "I think more
  // one-shot damage cards are needed that can be used while staging
  // spells. I'm never using colorless cards for the most part, need
  // more incentive to make them useful." These are deliberately
  // lane-agnostic (no `lane` field) so they appear in any wizard's
  // reward pool. Fire-and-forget chip damage that lets the player
  // pressure the enemy on turns where the big spell isn't ready.
  { id: 'c-sharp-aside', name: 'Sharp Aside', nameByLane: { handler: 'Sharp Whistle' },
    cost: 0, type: 'skill', rarity: 'common',
    effects: { compDmg: 4 },
    upgrade: { effects: { compDmg: 6 } },
    desc: '4 Composure damage.',
    flavor: 'A small remark with a quiet edge.' },
  { id: 'c-cutting-remark', name: 'Cutting Remark', nameByLane: { handler: 'Sharp Bark' },
    cost: 1, type: 'skill', rarity: 'common',
    effects: { compDmg: 7 },
    upgrade: { effects: { compDmg: 10 } },
    desc: '7 Composure damage.',
    flavor: 'Pre-considered. Pre-felt.' },
  { id: 'c-slip-word', name: 'Slip In A Word', nameByLane: { handler: 'Quiet Step' },
    cost: 0, type: 'skill', rarity: 'common',
    effects: { compDmg: 3, block: 2, exhaust: true },
    upgrade: { effects: { compDmg: 5, block: 3, exhaust: true } },
    desc: '3 Composure damage. Gain 2 Block. Exhaust.',
    flavor: 'Between their sentences. Briefly. Lethally.' },
  { id: 'c-crack-wise', name: 'Crack Wise', nameByLane: { handler: 'Crack the Whip' },
    cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { compDmg: 5, draw: 1 },
    upgrade: { effects: { compDmg: 7, draw: 1 } },
    desc: '5 Composure damage. Draw 1.',
    flavor: 'The line was already there. You just delivered it.' },

  // ---- v3.4.59 (Alan) — Universal-lane utility / tempo skills + powers.
  { id: 'c-take-as-compliment', name: "I'll Take That as a Compliment", cost: 2, type: 'skill', rarity: 'uncommon',
    effects: { block: 5, complimentHealOnAbsorb: 5, exhaust: true },
    upgrade: { effects: { block: 7, complimentHealOnAbsorb: 7, exhaust: true } },
    desc: 'Gain 5 Block. At end of turn, heal HP for damage this Block absorbed (max 5). Exhaust.',
    flavor: 'Thank you. Really. It means a lot.' },
  { id: 'c-speechless', name: 'Speechless', cost: 2, type: 'skill', rarity: 'uncommon',
    effects: { enemySkipNextTurn: true, exhaust: true },
    upgrade: { effects: { enemySkipNextTurn: true, draw: 1, exhaust: true } },
    desc: 'The enemy is stunned — they lose their next turn entirely. Exhaust.',
    flavor: 'They had something prepared. They no longer do.' },
  { id: 'c-when-youre-older', name: "I'll Tell You When You're Older", cost: 3, type: 'skill', rarity: 'rare',
    effects: { delayedComposureDamage: { amount: 21, delay: 3 }, exhaust: true },
    upgrade: { effects: { delayedComposureDamage: { amount: 27, delay: 3 }, exhaust: true } },
    desc: 'Deal 21 composure damage to the enemy 3 turns from now. Exhaust.',
    flavor: 'For now, you simply file it.' },
  { id: 'c-know-what-to-say', name: 'I Know Just What to Say', nameByLane: { handler: 'Extra Food in the Pocket' },
    cost: 1, type: 'skill', rarity: 'common',
    effects: { nextCardFree: true, exhaust: true },
    upgrade: { effects: { nextCardFree: true, draw: 1, exhaust: true } },
    desc: 'Your next card played this turn costs 0. Exhaust.',
    flavor: 'You did, in fact, know just what to say.' },
  { id: 'c-kind-word', name: 'A Kind Word', cost: 2, type: 'skill', rarity: 'common',
    effects: { hp: 4, composure: 4, exhaust: true },
    upgrade: { effects: { hp: 6, composure: 6, exhaust: true } },
    desc: 'Heal 4 HP and 4 Composure. Exhaust.',
    flavor: 'Brief. Unrehearsed. The room exhales.' },
  // v3.4.66 (Alan) — The Tutor, moved from wit-v2.js to colorless so all
  // wizards can draft it. Currently only meaningful for wit (FFT rows
  // exist); becomes useful for handler/jnsq when those lanes get their
  // row systems built.
  { id: 'c-the-tutor', name: 'The Tutor', cost: 3, type: 'skill', rarity: 'common',
    effects: { tutorArmNextSentence: true, exhaust: true }, fftOnly: true,
    desc: 'Next time you stage an intro AND a subject from the same row, the matching effect card is pulled from your hand, deck, or discard and placed directly in the spell tray, ready to cast. Exhaust.',
    flavor: 'They never stopped grading you. They never will.' },
  // ---- Powers (rest of combat) ----
  { id: 'c-subject-matter-expert', name: 'Subject Matter Expert', cost: 2, type: 'power', rarity: 'uncommon',
    installPower: { id: 'subjectCheaper' }, fftOnly: true,
    desc: 'Power. All Subject cards cost 1 less for the rest of combat (min 0).',
    flavor: 'They asked you. They keep asking you.' },
  { id: 'c-allow-me-to-introduce', name: 'Allow Me to Introduce Myself', cost: 2, type: 'power', rarity: 'uncommon',
    installPower: { id: 'introCheaper' }, fftOnly: true,
    desc: 'Power. All Intro cards cost 1 less for the rest of combat (min 0).',
    flavor: 'They had heard. They wanted to hear it from you.' },
  { id: 'c-intended-effect', name: 'Intended Effect', cost: 3, type: 'power', rarity: 'rare',
    installPower: { id: 'targetCheaper' }, fftOnly: true,
    desc: 'Power. All Effect (target) cards cost 1 less for the rest of combat (min 0).',
    flavor: 'The arrow finds the gap. Did not look for it. Found it.' },
  { id: 'c-keynote-speaker', name: 'Keynote Speaker', cost: 3, type: 'power', rarity: 'rare',
    installPower: { id: 'offensiveFftAmp25' }, fftOnly: true,
    desc: 'Power. All offensive FFT casts deal +25% damage, including DoT ticks. Rest of combat.',
    flavor: 'The applause was, in retrospect, pre-arranged.' },
  { id: 'c-speak-to-my-agent', name: 'Speak to My Agent', cost: 2, type: 'power', rarity: 'uncommon',
    installPower: { id: 'defensiveFftAmp25' }, fftOnly: true,
    desc: 'Power. All defensive FFT amounts (Block, Thorns reflect, defense-over-time) +25%. Rest of combat.',
    flavor: 'You no longer take meetings yourself.' },

  // ---- MODIFIER SKILLS — stacking toward [0.5, 1.5] caps ----
  // v2.65: per-play shift dropped 0.25 → 0.15. Combined with the
  // slower 0.10/turn drift, you now need 3-4 plays to reach the cap
  // — the "stacks" text on the card is meaningful again, but the
  // payoff curve is smoother. A single play is +15% (was +25%), so
  // a 2-Amplify burst is +30% (was +50%, too strong per playtest).
  { id: 'c-sap', name: 'Sap', cost: 2, type: 'skill', rarity: 'common',
    effects: { enemyDmgMod: -0.15 },
    upgrade: { effects: { enemyDmgMod: -0.15, draw: 1 } },
    desc: 'Reduce enemy attack damage by 15% (stacks; caps at −50%).',
    flavor: 'You did not finish your sentence. They did not finish theirs, either.' },
  { id: 'c-amplify', name: 'Amplify', cost: 1, type: 'skill', rarity: 'common',
    notLanes: ['handler'],
    effects: { playerDmgMod: +0.15 },
    upgrade: { effects: { playerDmgMod: +0.15, draw: 1 } },
    desc: 'Increase your spell potency by 15% (stacks; caps at +50%). Each play this combat costs +1 energy more than the last.',
    flavor: 'You feel taller. It is, demonstrably, a feeling.' },
  // Handler equivalent of Amplify (which boosts player casts — meaningless
  // for a summoner). Agitate the tank: every summoned animal's NEXT attack
  // hits +50% harder, multiplying the slot's nextAttackMult so it stacks
  // with the Tender Greens row bonus. Exhaust one-shot — dead with an empty
  // tank, a burst with three sets of teeth.
  { id: 'c-tap-the-glass', name: 'Tap the Glass', lane: 'handler', cost: 1, type: 'skill', rarity: 'common',
    effects: { agitateMenagerie: 1.5, exhaust: true },
    desc: "Each summoned animal's next attack deals +50% damage. Exhaust.",
    flavor: 'You tap once. Three sets of eyes snap toward the glass.' },
  { id: 'c-dispel', name: 'Dispel', nameByLane: { handler: 'Steady' },
    cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { enemyDmgMod: -0.15, playerDmgMod: +0.15, exhaust: true },
    upgrade: { effects: { enemyDmgMod: -0.30, playerDmgMod: +0.30, exhaust: true } },
    desc: 'Enemy attack −15%, your potency +15%. Exhaust.',
    flavor: 'You wave a hand. Several small certainties fall out of the air.' },

  // =============================================================================
  // POWERS — install on the field, trigger via turn hooks.
  // =============================================================================
  { id: 'p-borrowed-confidence', name: 'Borrowed Confidence',
    cost: 2, type: 'power', rarity: 'common',
    power: { startOfTurn: { block: 2 } }, upgrade: { power: { startOfTurn: { block: 3 } } },
    desc: 'At the start of each turn, gain 2 Block.',
    flavor: 'On loan from someone who needed it less.' },
  { id: 'p-mildly-threatening', name: 'Mildly Threatening Demeanour',
    cost: 2, type: 'power', rarity: 'common',
    power: { endOfTurn: { weak: 1 } }, upgrade: { power: { endOfTurn: { weak: 2 } } },
    desc: 'At the end of each turn, apply 1 Weak (3-turn duration).',
    flavor: "You haven't done anything yet. But you might." },
  { id: 'p-strongly-worded', name: 'A Strongly Worded Letter',
    cost: 2, type: 'power', rarity: 'uncommon',
    power: { endOfTurn: { vulnerable: 1 } }, upgrade: { power: { endOfTurn: { vulnerable: 2 } } },
    desc: 'At the end of each turn, apply 1 Vulnerable (3-turn duration).',
    flavor: 'You will hear from the Bursar. Probably. He hasn\'t replied yet either.' },
  { id: 'p-inadvisable-acceleration', name: 'Inadvisable Acceleration',
    cost: 2, type: 'power', rarity: 'uncommon',
    power: { startOfTurn: { draw: 1 } }, upgrade: { power: { startOfTurn: { draw: 2 } } },
    desc: 'At the start of each turn, draw 1 extra card.',
    flavor: 'The faster you go, the more there is to look at. Look anyway.' },
  { id: 'p-significant-pause', name: 'The Significant Pause',
    cost: 3, type: 'power', rarity: 'uncommon',
    power: { startOfTurn: { energy: 1 } }, upgrade: { cost: 2 },
    desc: 'At the start of each turn, gain 1 Energy.',
    flavor: 'Wait. …Now.' },
  { id: 'p-ostensible-inferno', name: 'Ostensible Inferno',
    cost: 2, type: 'power', rarity: 'rare',
    power: { endOfTurn: { composure: 4 } }, upgrade: { power: { endOfTurn: { composure: 6 } } },
    desc: 'At the end of each turn, deal 4 Composure damage.',
    flavor: 'The fire is technically there. The fire-flavoured atmosphere certainly is.' },
  { id: 'p-octarine-squint', name: 'Octarine Squint',
    cost: 2, type: 'power', rarity: 'rare',
    power: { onEffectCardPlayed: { vulnerable: 1 } }, upgrade: { power: { onEffectCardPlayed: { vulnerable: 2 } } },
    desc: 'Each Effect you cast also applies 1 Vulnerable.',
    flavor: 'You\'re looking at the colour magic comes from. Don\'t blink.' },
];

// Relics — passive items earned from elites / bosses / events. Persist
// across combats AND across acts (whole-run). Effect hooks read by the
// combat loop at the right moments:
//   passiveStrikeBonus: N   — flat +N base on Strike-named effect cards
//   permanentEnergyBonus: N — +N to every-turn energy refill
//   onCombatStart: { effects } — applied once at start of every combat
//   onEnemyDefeated: { effects } — fires when an enemy (non-boss) dies
//   onCombatEnd: { effects }   — fires when a combat resolves to victory
//   everyNthEffect: { n, extraDamage } — every Nth Effect card cast gets
//                                        +N flat damage (composure OR phys)
// Pratchett tone — pompous artifacts of an over-administered school.
const RELICS = [
  // ---- COMMON ----
  { id: 'r-lecturers-pointer', name: "Lecturer's Pointer", rarity: 'common',
    effect: { passiveStrikeBonus: 1 },
    desc: 'Your Strikes deal +1 damage.',
    flavor: 'Frequently lost. Always returns.' },
  { id: 'r-hat-pin', name: 'Hat Pin of Persistence', rarity: 'common',
    effect: { onCombatStart: { block: 3 } },
    desc: 'At the start of every combat, gain 3 Block.',
    flavor: 'Holds the hat. Holds the dignity.' },
  { id: 'r-pocket-familiar', name: 'Pocket Familiar', rarity: 'common',
    effect: { onCombatStart: { draw: 1 } },
    desc: 'At the start of every combat, draw 1 extra card.',
    flavor: "It's a beetle. The beetle is on its third career." },

  // ---- UNCOMMON ----
  { id: 'r-deans-half-coat', name: "Dean's Half-Coat", rarity: 'uncommon',
    effect: { onEnemyDefeated: { heal: 4 } },
    desc: 'Whenever you defeat an enemy, heal 4 HP.',
    flavor: 'The other half is on the Dean.' },
  { id: 'r-sigil-orders', name: 'Sigil of Standing Orders', rarity: 'uncommon',
    effect: { onCombatEnd: { heal: 6 } },
    desc: 'At the end of every combat you win, heal 6 HP.',
    flavor: 'Filed in triplicate. Refiled if necessary.' },
  { id: 'r-brass-owl', name: 'Brass Owl, Polished', rarity: 'uncommon',
    effect: { everyNthEffect: { n: 5, extraDamage: 5 } },
    desc: 'Every 5th Effect you cast deals +5 damage.',
    flavor: 'Watches everything. Pretends it isn\'t.' },
  // v3.4.55 (Alan) — wit-flavored DoT relics.
  { id: 'r-the-footnote', name: 'The Footnote', rarity: 'uncommon', lane: 'wit',
    effect: { fftDotDamagePlus: 1 },
    desc: '+1 damage to every tick of every offensive DoT applied by a FFT.',
    flavor: 'Footnotes accumulate. Eventually they outweigh the body.' },
  { id: 'r-cited-source', name: 'Cited Source', rarity: 'uncommon', lane: 'wit',
    effect: { fftDefensiveDotPlus: 1 },
    desc: '+1 to every tick of every defensive DoT (block / Thorns aura) applied by a FFT.',
    flavor: 'Citation is, in a sense, armour. Or perhaps a brick wall.' },
  // v3.4.56 (Alan) — universal lane-agnostic relics.
  { id: 'r-thesaurus', name: 'Thesaurus', rarity: 'common',
    effect: { permanentDrawBonus: 1 },
    desc: '+1 card draw at the start of every turn.',
    flavor: 'Same word, three flavours of regret.' },
  { id: 'r-run-on-sentence', name: 'Run-on Sentence', rarity: 'common',
    effect: { permanentEnergyBonus: 1 },
    desc: '+1 Energy every turn (permanent).',
    flavor: 'There is, properly speaking, no good place to stop, and so —' },
  { id: 'r-novice-retort', name: 'Novice Retort', rarity: 'common',
    effect: { onAcquire: { maxComposurePlus: 5 } },
    desc: '+5 max Composure (applied when acquired).',
    flavor: 'Stiffens the spine. Slightly. Repeatedly.' },
  { id: 'r-words-of-comfort', name: 'Words of Comfort', rarity: 'common',
    effect: { onCombatStart: { block: 7 } },
    desc: 'At the start of every combat, gain 7 Block.',
    flavor: 'Someone said something nice. It is hard to know what.' },
  { id: 'r-epiphany', name: 'Epiphany', rarity: 'uncommon',
    effect: { onAcquire: { upgradeRandomCards: 2 } },
    desc: 'On acquire: upgrade 2 random cards in your deck.',
    flavor: 'A small bell, ringing twice. The room feels different.' },
  { id: 'r-thesis-statement', name: 'Thesis Statement', rarity: 'rare', lane: 'wit',
    effect: { onAcquire: { upgradeRandomFFTRow: true } },
    desc: 'On acquire: upgrade 1 random FFT row you own (all 3 cards).',
    flavor: 'One sentence. Three citations. The room is yours.' },
  { id: 'r-even-more-familiar', name: 'Even More Familiar', rarity: 'uncommon',
    effect: { onAcquire: { upgradeFamiliar: true } },
    desc: "On acquire: upgrade your familiar's bonus to Tier 2.",
    flavor: 'It nods. You did not know it could nod.' },

  // ---- RARE / BOSS ----
  { id: 'r-inverted-hourglass', name: 'Inverted Hourglass', rarity: 'rare',
    effect: { permanentEnergyBonus: 1 },
    desc: '+1 Energy every turn (permanent).',
    flavor: "The sand falls upward. Don't comment." },
  { id: 'r-lockbox', name: 'Lockbox of Examinations', rarity: 'rare',
    effect: { onCombatStart: { draw: 2 } },
    desc: 'At the start of every combat, draw 2 extra cards.',
    flavor: 'Locked. Possibly empty. Definitely locked.' },
];
const RELICS_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]));

// v2.92: PASSING THOUGHTS — colorless one-shot cards (like STS colorless).
// Lane-agnostic, exhaust on play (so once-per-combat) and return to deck at
// combat end via the existing exile-back-to-deck flow. Acquired via the new
// "Reflect" rest-site option (and any future grant flow). Rarity
// 'colorless' keeps them out of normal pickCardByRarity rolls — they only
// show up where the code explicitly draws from PASSING_THOUGHTS.
const PASSING_THOUGHTS = [
  // ---- DEFENSE (6 — reactive flags & pool-conversions, v2.93 redesign) ----
  { id: 'pt-talking-over',       name: 'Talking Over Them',              cost: 1, type: 'skill', rarity: 'colorless',
    effects: { enemySkipNextAttack: true, exhaust: true },
    desc: 'The enemy\'s next attack deals 0 damage (you spoke through it). Exhaust.',
    flavor: 'A volume that ascends, mid-sentence, into the next sentence. The room follows you.' },
  { id: 'pt-glancing-blow',      name: 'A Glancing Blow',                cost: 1, type: 'skill', rarity: 'colorless',
    effects: { swapNextHitToComp: true, exhaust: true },
    desc: 'The next HP damage you would take is dealt to your Composure instead. Exhaust.',
    flavor: 'The body, briefly, was elsewhere. The nerve will remember it.' },
  { id: 'pt-settle-score',       name: 'Settle the Score',               cost: 1, type: 'skill', rarity: 'colorless',
    effects: { reflectNextHitAsComp: true, exhaust: true },
    desc: 'When the enemy next damages you, they take the same amount as Composure damage. Exhaust.',
    flavor: 'A score, properly settled, ends with a ledger that balances loudly.' },
  { id: 'pt-bracing',            name: 'Bracing for Impact',             cost: 1, type: 'skill', rarity: 'colorless',
    effects: { bracingArmed: true, exhaust: true },
    desc: 'If you take any HP damage this turn, draw 3 cards at end of turn. Exhaust.',
    flavor: 'The body assumes the worst. The cards, for once, follow.' },
  { id: 'pt-measured-response',  name: 'A Measured Response',            cost: 1, type: 'skill', rarity: 'colorless',
    effects: { blockFromComposure: true, exhaust: true },
    desc: 'Gain Block equal to ⅓ of your current Composure. Exhaust.',
    flavor: 'Measured. The measurement is private. The response is not.' },
  { id: 'pt-speaking-experience', name: 'Speaking from Experience',      cost: 0, type: 'skill', rarity: 'colorless',
    effects: { composure: -5, block: 10, exhaust: true },
    desc: 'Spend 5 Composure. Gain 10 Block. Exhaust.',
    flavor: 'You were younger. You knew less. You are now suddenly older.' },

  // ---- OFFENSE (6 — cast-modifier flags & state-aware damage, v2.93 redesign) ----
  { id: 'pt-precedent',          name: 'A Precedent, Cited',             cost: 1, type: 'skill', rarity: 'colorless',
    effects: { nextCastBonusEqualsLast: true, exhaust: true },
    desc: 'Your next cast deals bonus damage equal to your LAST cast\'s damage. Exhaust.',
    flavor: 'Page 47, footnote 3. The footnote, on review, settles things.' },
  { id: 'pt-about-that-time',    name: 'And What About THAT Time',       cost: 1, type: 'skill', rarity: 'colorless',
    effects: { reflectNextDebuff: 1, exhaust: true },
    desc: 'When the enemy next applies Vuln or Weak to you, that debuff also lands on them. Exhaust.',
    flavor: 'You did not invent the precedent. You just recall it, very loudly, at exactly the wrong moment for them.' },
  { id: 'pt-pile-on',            name: 'The Pile-On',                    cost: 1, type: 'skill', rarity: 'colorless',
    effects: { compDmgFromEnemyMissing: 0.33, exhaust: true },
    desc: 'Deal Composure damage equal to ⅓ of the enemy\'s missing Composure. Exhaust.',
    flavor: 'The phrase "while we\'re at it" is doing meaningful work in this room.' },
  { id: 'pt-find-seam',          name: 'Find the Seam',                  cost: 1, type: 'skill', rarity: 'colorless',
    effects: { nextCastBypassEff: true, exhaust: true },
    desc: 'Your next cast ignores enemy effectiveness (treated as ×1.0 regardless). Exhaust.',
    flavor: 'Every surface has one. The seam is where the surface, helpfully, comes apart.' },
  { id: 'pt-insult-injury',      name: 'Adding Insult to Injury',        cost: 1, type: 'skill', rarity: 'colorless',
    effects: { nextCastDamageMult: 1.5, exhaust: true },
    desc: 'Your next cast deals 1.5× damage. Exhaust.',
    flavor: 'A small unkindness, tucked into the middle. Larger than it looks.' },
  { id: 'pt-doubletake',         name: 'The Doubletake',                 cost: 2, type: 'skill', rarity: 'colorless',
    effects: { nextCastDoubles: true, exhaust: true },
    desc: 'Your next cast\'s damage applies twice. Exhaust.',
    flavor: 'The first one didn\'t land. The second one is for the first one.' },

  // ---- TEMPO / DRAW (5) ----
  { id: 'pt-what-if-however',    name: 'What If, However—',              cost: 1, type: 'skill', rarity: 'colorless',
    effects: { draw: 2, exhaust: true },
    desc: 'Draw 2 cards. Exhaust.',
    flavor: 'The dash is the discovery. The discovery is, frankly, the dash.' },
  { id: 'pt-where-was-i',        name: 'Now Where Was I',                cost: 0, type: 'skill', rarity: 'colorless',
    effects: { discardRandom: 1, draw: 2, exhaust: true },
    desc: 'Discard 1 random card. Draw 2. Exhaust.',
    flavor: 'The thread, when located, was attached to something different than you remembered.' },
  { id: 'pt-reconsideration',    name: 'A Brief Reconsideration',        cost: 1, type: 'skill', rarity: 'colorless',
    effects: { returnDiscardToHand: 1, exhaust: true },
    desc: 'Return a random card from your discard pile to your hand. Exhaust.',
    flavor: 'On second thought — and there is, in jnsq, always a second.' },
  { id: 'pt-removing-glasses',   name: 'Quietly Removing My Glasses',    cost: 0, type: 'skill', rarity: 'colorless',
    effects: { draw: 1, energy: 1, exhaust: true },
    desc: 'Draw 1 and gain 1 Energy. Exhaust.',
    flavor: 'The look without the lenses is somehow more pointed. Hard to say why.' },
  { id: 'pt-drawing-conclusions', name: 'Drawing Conclusions',           cost: 1, type: 'skill', rarity: 'colorless',
    effects: { draw: 3, exhaust: true },
    desc: 'Draw 3 cards. Exhaust.',
    flavor: 'Several. All of them, on review, the same conclusion.' },

  // ---- UTILITY (3) ----
  { id: 'pt-embarrassed-silence', name: 'An Embarrassed Silence',        cost: 1, type: 'skill', rarity: 'colorless',
    effects: { stripBlock: 6, exhaust: true },
    desc: 'Strip 6 Block from enemy. Exhaust.',
    flavor: 'The silence is on them. Their composure leaks out of it.' },
  { id: 'pt-misapplied-compliment', name: 'An Old Compliment, Misapplied', cost: 1, type: 'skill', rarity: 'colorless',
    effects: { hp: 3, composure: 3, exhaust: true },
    desc: 'Heal 3 HP and 3 Composure. Exhaust.',
    flavor: 'Said to the wrong person, decades ago. They never forgot. You\'re holding it now.' },
  { id: 'pt-decisively-inconclusive', name: 'Decisively Inconclusive',   cost: 2, type: 'skill', rarity: 'colorless',
    effects: { discardHand: true, draw: 5, exhaust: true },
    desc: 'Discard your hand. Draw 5 cards. Exhaust.',
    flavor: 'The sentence ends. The next one will, you assure them, be entirely different.' },
];
const PASSING_THOUGHTS_BY_ID = Object.fromEntries(PASSING_THOUGHTS.map(c => [c.id, c]));

// v2.8: Opening-shop boons. Player picks ONE of three (Card / Relic / Boon)
// at game start instead of two-of-five cards. Boons are pure stat boosts;
// the relic and card slots cover effects and deckbuilding. `apply` is a
// string key consumed by the supply-shop's commit handler.
const SHOP_BOONS = [
  { id: 'boon-vigor',  icon: '❤',  name: 'Wellspring',    desc: '+10 max HP. Restore to full.',         apply: 'maxHpPlus10' },
  { id: 'boon-focus',  icon: '✨', name: 'Composed Mind', desc: '+10 max Composure. Restore to full.',  apply: 'maxCompPlus10' },
  { id: 'boon-sturdy', icon: '🪨', name: 'Sturdy Frame',  desc: '+5 max HP and +5 max Composure.',      apply: 'sturdy' },
];

// Familiars — chosen at the familiar shop in town before the first map.
// Each grants a passive `bonus` (same effect-shape as relics, plus three
// new keys defined below) AND adds a signature `card` to the player's
// deck. The player names the familiar afterward; the name appears in
// chips, logs, and the run summary.
//
// New effect keys introduced by familiars (in addition to all the relic
// keys: passiveStrikeBonus, permanentEnergyBonus, onCombatStart,
// onEnemyDefeated, onCombatEnd, everyNthAttack, maxHp):
//   damageReduction: N        — flat -N from each incoming attack (min 1
//                               total damage taken, never reduces to 0)
//   startOfTurnBlock: N       — gain N Block at the start of every player
//                               turn (different from onCombatStart.block
//                               which fires once per combat)
//   startCombatVulnerable: N  — apply N Vulnerable to the enemy at combat
//                               start
const FAMILIARS = [
  {
    id: 'fam-raven', species: 'Raven', emoji: '🐦‍⬛',
    desc: 'At the start of every combat, draw 1 extra card.',
    flavor: 'It has read several of your books. Two of them.',
    bonus: { onCombatStart: { draw: 1 } },
    bonusUpgrade: { onCombatStart: { draw: 2 } },
    upgradeDesc: 'At the start of every combat, draw 2 extra cards.',
    card: { id: 'f-quoth', name: 'Quoth', cost: 0, type: 'skill', rarity: 'basic',
      effects: { draw: 2, exhaust: true },
      upgrade: { effects: { draw: 3, exhaust: true } },
      desc: 'Draw 2. Exhaust.',
      flavor: 'It said something. You half-heard.' },
  },
  {
    id: 'fam-cat', species: 'Cat', emoji: '🐈',
    desc: 'At the start of every combat, gain 4 Block and draw 1.',
    flavor: 'The cat knows where it is. The cat refuses to discuss it.',
    // v2.16: was block 5 (bipolar: 33% jnsq, 6% wit). Dropped to 4
    // + added 1 draw, which is lane-agnostic (helps wit tray-completion
    // as much as jnsq survival).
    bonus: { onCombatStart: { block: 4, draw: 1 } },
    bonusUpgrade: { onCombatStart: { block: 6, draw: 2 } },
    upgradeDesc: 'At the start of every combat, gain 6 Block and draw 2.',
    // v3.3: familiar cards are lane-AGNOSTIC. Was a handler-scaling
    // effect tied to dismissive/petty tags; now a skill that fires
    // immediately for any wizard.
    card: { id: 'f-stare', name: 'Indifferent Stare', cost: 1, type: 'skill', rarity: 'basic',
      effects: { compDmg: 5, weak: 1 },
      upgrade: { effects: { compDmg: 7, weak: 2 } },
      desc: '5 Composure damage. Apply 1 Weak.',
      flavor: 'It is unimpressed.' },
  },
  {
    id: 'fam-toad', species: 'Toad', emoji: '🐸',
    desc: 'At the end of every combat you win, heal 3 HP.',
    flavor: 'It hums when you cook. It hums anyway.',
    bonus: { onCombatEnd: { heal: 3 } },
    bonusUpgrade: { onCombatEnd: { heal: 5 } },
    upgradeDesc: 'At the end of every combat you win, heal 5 HP.',
    card: { id: 'f-sip', name: 'Sip', cost: 0, type: 'skill', rarity: 'basic',
      effects: { hp: 2, energy: 1, exhaust: true },
      upgrade: { effects: { hp: 4, energy: 1, exhaust: true } },
      desc: '+2 HP. +1 Energy. Exhaust.',
      flavor: 'The toad knows several recipes. You have learned one.' },
  },
  {
    id: 'fam-mouse', species: 'Mouse', emoji: '🐭',
    desc: '+1 Energy on turn 1 of every combat.',
    flavor: 'Where there is a small space, there is a mouse. There is always a small space.',
    bonus: { onCombatStart: { energy: 1 } },
    bonusUpgrade: { onCombatStart: { energy: 2 } },
    upgradeDesc: '+2 Energy on turn 1 of every combat.',
    card: { id: 'f-scurry', name: 'Scurry', cost: 0, type: 'skill', rarity: 'basic',
      effects: { block: 4, draw: 1, exhaust: true },
      upgrade: { effects: { block: 6, draw: 1, exhaust: true } },
      desc: 'Gain 4 Block. Draw 1. Exhaust.',
      flavor: 'It went under something. You did too.' },
  },
  {
    id: 'fam-owl', species: 'Owl', emoji: '🦉',
    desc: '+8 max HP. Heal 2 HP at the end of every combat you win.',
    flavor: 'It judges your reading speed. Privately. At length.',
    // v2.16: was flat +8 maxHp only (bottom-3 in two of three lanes).
    // Added end-of-combat heal so it actually scales across a run.
    bonus: { maxHp: 8, onCombatEnd: { heal: 2 } },
    bonusUpgrade: { maxHp: 12, onCombatEnd: { heal: 3 } },
    upgradeDesc: '+12 max HP. Heal 3 HP at the end of every combat you win.',
    card: { id: 'f-hoo', name: 'Hoo', cost: 1, type: 'skill', rarity: 'basic',
      effects: { draw: 2 },
      upgrade: { effects: { draw: 3 } },
      desc: 'Draw 2.',
      flavor: 'It is a question. It is always a question.' },
  },
  {
    id: 'fam-beetle', species: 'Beetle', emoji: '🪲',
    desc: '+6 max HP. The first incoming hit each combat does -3 damage.',
    flavor: 'It is on its third career. The first two were also waiting.',
    // v2.9: was damageReduction:1 (every hit, every combat) — that
    // arithmetic worked out to ~60 HP saved per full run, oppressively
    // strong vs other familiars. Re-tiered as a flat HP boost + a single
    // strong opening-hit absorb so the flavor stays ("survival pet") but
    // the math sits with other familiars.
    bonus: { maxHp: 6, firstHitReduction: 3 },
    bonusUpgrade: { maxHp: 10, firstHitReduction: 5 },
    upgradeDesc: '+10 max HP. The first incoming hit each combat does -5 damage.',
    // v3.3: lane-agnostic conversion (was jnsq-scaling effect).
    card: { id: 'f-clatter', name: 'Clatter', cost: 1, type: 'skill', rarity: 'basic',
      effects: { compDmg: 3, block: 3 },
      upgrade: { effects: { compDmg: 5, block: 4 } },
      desc: '3 Composure damage. Gain 3 Block.',
      flavor: 'The beetle is angry. In its way.' },
  },
  {
    id: 'fam-hedgehog', species: 'Hedgehog', emoji: '🦔',
    desc: 'At the start of every turn, gain 1 Block.',
    flavor: 'It does not move when you call it. You have called it.',
    // v2.14: 2/turn → 1/turn. Compounded too hard over long combats
    // (~58 HP equivalent over a full run); reduced to ~30 HP.
    bonus: { startOfTurnBlock: 1 },
    bonusUpgrade: { startOfTurnBlock: 2 },
    upgradeDesc: 'At the start of every turn, gain 2 Block.',
    card: { id: 'f-bristle', name: 'Bristle', cost: 1, type: 'skill', rarity: 'basic',
      effects: { block: 5, vulnerable: 1 },
      upgrade: { effects: { block: 7, vulnerable: 1 } },
      desc: 'Gain 5 Block. Apply 1 Vulnerable.',
      flavor: 'Touch at your own risk. Touching has been factored in.' },
  },
  {
    id: 'fam-crow', species: 'Crow', emoji: '🦅',
    desc: 'Whenever you defeat an enemy, heal 2 HP.',
    flavor: 'It has a collection. The collection has a collection.',
    bonus: { onEnemyDefeated: { heal: 2 } },
    bonusUpgrade: { onEnemyDefeated: { heal: 4 } },
    upgradeDesc: 'Whenever you defeat an enemy, heal 4 HP.',
    // v3.3: lane-agnostic conversion (was jnsq-scaling effect).
    card: { id: 'f-pilfer', name: 'Pilfer', cost: 1, type: 'skill', rarity: 'basic',
      effects: { compDmg: 4, draw: 1 },
      upgrade: { effects: { compDmg: 6, draw: 1 } },
      desc: '4 Composure damage. Draw 1.',
      flavor: 'It brought you something. You did not ask.' },
  },
  {
    id: 'fam-snake', species: 'Snake', emoji: '🐍',
    desc: '+5 max HP. At the start of every combat, apply 2 Vulnerable to the enemy.',
    flavor: 'It is patient. You are not. This is the arrangement.',
    // v2.14: was bottom-of-meta at 11.6% avg (vuln drifted back too
    // fast to matter past turn 1-2). Added +5 maxHp baseline so the
    // familiar earns its slot even on short fights.
    bonus: { maxHp: 5, startCombatVulnerable: 2 },
    bonusUpgrade: { maxHp: 8, startCombatVulnerable: 3 },
    upgradeDesc: '+8 max HP. At the start of every combat, apply 3 Vulnerable to the enemy.',
    // v3.3: lane-agnostic conversion (was handler-scaling effect).
    card: { id: 'f-coil', name: 'Coil', cost: 1, type: 'skill', rarity: 'basic',
      effects: { compDmg: 5, vulnerable: 1 },
      upgrade: { effects: { compDmg: 7, vulnerable: 2 } },
      desc: '5 Composure damage. Apply 1 Vulnerable.',
      flavor: 'A small green warning.' },
  },
  {
    id: 'fam-rabbit', species: 'Rabbit', emoji: '🐇',
    desc: 'Start every combat with +2 Poise.',
    flavor: 'Direction was secondary. Speed was the trick.',
    // v2.14: poise 3 → 2 (was top-of-meta across all lanes at ~30% avg
    // win rate; trimmed to bring closer to ~22% mid-pack).
    bonus: { startCombatPoise: 2 },
    bonusUpgrade: { startCombatPoise: 4 },
    upgradeDesc: 'Start every combat with +4 Poise.',
    // v3.3: lane-agnostic conversion (was handler-scaling effect).
    card: { id: 'f-bolt', name: 'Bolt', cost: 0, type: 'skill', rarity: 'basic',
      effects: { compDmg: 4, exhaust: true },
      upgrade: { effects: { compDmg: 6, exhaust: true } },
      desc: '4 Composure damage. Exhaust.',
      flavor: 'It was gone. So was the apple.' },
  },
];
const FAMILIARS_BY_ID = Object.fromEntries(FAMILIARS.map(f => [f.id, f]));
// v2.72: CARDS_BY_ID must include the v2 lane pools so forcedHand /
// forcedDeck lookups (used by the practice tutorial) resolve wv2-/cv2-/jv2-
// IDs. Previously only the shared CARDS table was indexed — the tutorial
// hand silently became a list of undefined objects.
// v2.92: also include PASSING_THOUGHTS so granted cards resolve by id.
const CARDS_BY_ID = Object.fromEntries(
  [...CARDS, ...ALL_V2_CARDS, ...PASSING_THOUGHTS].map(c => [c.id, c])
);

// v2.38: MISSTEP TOKEN — the delayed-consequence card delivered to hand
// 2 turns after casting "Saying Something Wrong." Not in the draft pool;
// only spawned by the delayedMisstep mechanic. Manual play: pay 1 Energy,
// exhausts (the player paid for the silence). Auto-play at end of turn
// while still in hand: 3 HP self-damage, exhausts (the realisation lands
// on you, hard). Either way it leaves play — it never enters discard.
const MISSTEP_TOKEN = {
  id: 'wv2-tok-misstep',
  name: 'Misstep',
  type: 'skill',
  lane: 'wit',
  rarity: 'token',
  cost: 1,
  tags: ['token', 'consequence'],
  effects: { exhaust: true, missTepDiscard: true },
  desc: 'Token. Discard for 1 Energy (exhausts). If still in hand at end of turn: -3 HP and exhausts.',
  flavor: 'A sentence you said two turns ago. It has, in the meantime, ripened.',
};

// 11-card starter. One word per stat (handler / wit / jnsq), one
// composure effect per stat (Bluster / Persuade / Bewilder), Spark for
// a guaranteed physical option against verbal-immune enemies, Channel
// for tempo/draw cycling, and three Defends. The starter word tags
// (formal / sarcastic / dismissive / chaotic) intentionally overlap
// with the basic effects' widened resonance lists so resonance can
// fire even before the player picks up reward cards.
// Slim, neutral starter — covers Handler and Wit shallowly so the
// player doesn't feel "already well-rounded" before deck-building begins.
// Jnsq is intentionally NOT here — it's the branch-out direction the
// player opens via the Starting Picks screen at game start (or via
// reward picks later). Old starter had 11 cards spanning all three stats
// + two physical effects; that made archetype commitment feel pointless
// because the deck was already a sampler.
// v2 starter deck — character-specific. Each character begins with a small
// lane-themed deck of basics: 3 intros + 3 subjects + 2 targets + 2 utility
// skills (defend + channel) for a 10-card opening hand pool. The basic
// rarity cards lock the player into Tier 1 spells until rewards bring in
// higher-tier intros / subjects / targets.
function buildStarterDeckForLane(lane, startingRow = null) {
  const pool = LANE_POOL_BY_SLOT[lane];
  if (!pool) return [];
  const basics = (arr) => arr.filter(c => c.rarity === 'basic');
  // v2.95: starter shape is now 1 intro + 1 subject + 1 effect + 2
  // lane-specific starter cards + 3 c-defend + 1 c-compose = 9 cards
  // (wit +1 annotation = 10). The "1 of each spell slot" cut is intentional:
  // early casts will be one-note, which makes the first new intro/subject/
  // target picks feel like real upgrades. Basic intros/subjects now carry
  // stats: 1 (down from 2); commons carry 2. Basic targets carry mult 2
  // (down from common's 3) so each step of the upgrade ladder is visible.
  // Basic-rarity skills + gestures in each lane pool are exactly the
  // v2.95 lane-specific starter cards (Square Up/Shove for handler,
  // Page-Mark/Aside for wit, Rhubarb/Stagger for jnsq).
  const laneStarters = [
    ...basics(pool.skill || []),
    ...basics(pool.gesture || []),
  ].map(c => c.id);
  // v3.1.4: +1 basic intro. Alan playtest: "having to draw one more
  // turn than I'd like to have enough spell components." Adding a 2nd
  // intro keeps the "few spell options" feel while easing the hand-
  // refill bottleneck (you'll usually have AT LEAST one intro in hand).
  // Picks of common intros are still meaningfully better (stat 2 vs 1).
  //
  // v3.2: WIT-only — seed the starter with one COMPLETE FFT row so the
  // player can trigger Fully Formed Thought in their first combat. We
  // hardcode the slowburn-4 row ("Lingering Point") because its intro
  // (Frankly,) is already the first basic intro that would be picked
  // anyway; we just override the generic basic subject/target with
  // same-row cards. After this the starter has 3 slowburn-4 cards
  // (full row) + 1 crescendo-4 intro + the usual util slots.
  // Telemetry from real play (2026-05-26) showed 11 casts / 0 FFT
  // triggers — the system was invisible because the starter never had
  // 2 cards from one row. Seeding the row makes FFT teach-itself in
  // the first combat.
  let introIds, subjectId, targetId;
  if (lane === 'wit') {
    if (startingRow) {
      // v3.4.7 — wit player chose a starting row at character select.
      // Use the chosen row's intro/subject/target as the seed. T1 stat
      // override (in buildStartingDeck) makes these cards starter-power
      // regardless of the row's natural tier.
      // v3.4.10 (Alan): dropped the cross-row second intro. Used to add
      // 'wv2-i-actually' (from crescendo-4 "It All Adds Up") OR
      // 'wv2-i-frankly' (from slowburn-4 "Lingering Point") as a slot-
      // variety pad — but that polluted the starter with a foreign-row
      // card and "threw off planning." The second intro slot is now
      // filled by c-rebut (one-shot, non-exhausting damage skill, added
      // alongside the c-* skills below).
      introIds = [startingRow.introId];
      subjectId = startingRow.subjectId;
      targetId  = startingRow.targetId;
    } else {
      // Default: slowburn-4 (Lingering Point) with dedicated basic-tier
      // starter variants (boucle-starter, fabric-starter).
      // v3.4.10: same drop as above — single intro only, c-rebut fills
      // the second damage slot via the c-* list below.
      introIds = ['wv2-i-frankly'];
      subjectId = 'wv2-s-boucle-starter';
      targetId  = 'wv2-t-fabric-starter';
    }
  } else if (lane === 'handler') {
    // 2026-05-31 — handler pivoted from FFT to Animal Summoner engine.
    // The bluster-1 row cards no longer exist. Starter is transitional
    // until lure cards land. No intro/subject/target — just utility +
    // gestures + defends so the character is at least loadable.
    introIds = [];
    subjectId = undefined;
    targetId  = undefined;
  } else {
    introIds = [basics(pool.intro)[0]?.id, basics(pool.intro)[1]?.id];
    subjectId = basics(pool.subject)[0]?.id;
    targetId  = basics(pool.target)[0]?.id;
  }
  // Handler uses the softer +6 Step Back instead of +8 c-defend — outsourcing
  // the fighting to the menagerie comes with a personal-defense tax.
  const defendCardId = lane === 'handler' ? 'c-defend-handler' : 'c-defend';
  const ids = [
    introIds[0],
    introIds[1],
    subjectId,
    targetId,
    ...laneStarters,
    defendCardId,
    defendCardId,
    'c-compose',
  ].filter(Boolean);
  if (lane === 'wit') {
    ids.push('wv2-ann-footnote-credibility');
    // v3.4.10 (Alan): one-shot, non-exhausting damage card replaces the
    // cross-row second intro that used to live in the wit starter.
    ids.push('c-rebut');
  }
  // Handler Animal Summoner starter — Tender Greens lures only. Fish Food
  // and Birdseed are reward-pool lures, not in the opening deck.
  if (lane === 'handler') {
    ids.push('cv2-l-tender-greens');    // 1-turn → random of Mouse/Rabbit/Buck
    ids.push('cv2-l-tender-greens');    // second copy — chance at Mouse House row / Tender Greens bonus
    ids.push('c-pack-tactics');         // all animals attack again this turn (exhaust)
    ids.push('c-buffet');               // next lure spreads across all empty slots (exhaust)
    ids.push('c-tactic-shield');        // Summoned Shield — play to route animal attacks into Block
  }
  return ids;
}

// STARTER_DECK is now a function of character. Kept as a const for any v1
// references that still grep for it — they'll get the wit-scholar default.
const STARTER_DECK = buildStarterDeckForLane('wit');

// Enemies. `act` filters which act they appear in. `tier` ∈ normal / elite / boss.
// Verbal-combat fields:
//   composureMax — verbal HP. Drains to 0 = enemy concedes / backs off.
//   hpMax        — physical HP. Most enemies effectively physical-immune
//                  (very high). A few (Living Thicket, Crystal Beetle…)
//                  have low hp — physical effects are the fast path on
//                  them.
//   effectiveness — multiplier per stat. 1.0 = baseline. 0 = HARD immune
//                   (a Lich does not laugh). Values >1 = susceptible.
// behaviors[*]: { kind, value, weight, telegraph, count? } — unchanged.
// ENEMIES / ENEMIES_BY_ID / ANIMALS moved to ./data/enemies.js and
// ./data/animals.js (2026-06-01) so the sim shares one source of truth.

// Equipment per slot with full tier ladders. `bonus` keys are read by the
// combat loop at appropriate hooks (start-of-combat, damage calc, etc.).
// Equipment data — placeholder Master-tier entries used by the
// current boss-grant flow. These exist as stat-stick fallbacks while
// the new crafting system is being built; once Commit 3 lands the
// boss flow routes through the crafting screen instead and these
// entries are reduced to "if the player skipped everything" defaults.
// `gem` data is kept as an orphan reference (no act maps to it).
const EQUIPMENT = {
  staff: {
    basic:  { id: 'eq-staff-basic',  name: 'Apprentice Staff',  bonus: { strikeBonus: 1 }, desc: '+1 damage on Strike.' },
    fine:   { id: 'eq-staff-fine',   name: 'Journeyman Staff',  bonus: { strikeBonus: 2 }, desc: '+2 damage on Strike.' },
    master: { id: 'eq-staff-master', name: 'Master Staff',      bonus: { strikeBonus: 4 }, desc: '+4 damage on Strike.' },
  },
  robes: {
    basic:  { id: 'eq-robes-basic',  name: 'Apprentice Robes',  bonus: { startBlock: 3 }, desc: 'Gain 3 Block at the start of every combat.' },
    fine:   { id: 'eq-robes-fine',   name: 'Woven Robes',       bonus: { startBlock: 6 }, desc: 'Gain 6 Block at the start of every combat.' },
    master: { id: 'eq-robes-master', name: 'Master Robes',      bonus: { startBlock: 10 }, desc: 'Gain 10 Block at the start of every combat.' },
  },
  ring: {
    basic:  { id: 'eq-ring-basic',   name: 'Apprentice Ring',   bonus: { extraStartHand: 1 }, desc: 'Draw 1 extra card on turn 1.' },
    fine:   { id: 'eq-ring-fine',    name: 'Journeyman Ring',   bonus: { energyOnCombatStart: 1 }, desc: '+1 Energy on turn 1 of every combat.' },
    master: { id: 'eq-ring-master',  name: 'Master Ring',       bonus: { permanentEnergyBonus: 1 }, desc: '+1 Energy every turn (permanent).' },
  },
  hat: {
    basic:  { id: 'eq-hat-basic',    name: 'Apprentice Cap',    bonus: { extraStartHand: 1 }, desc: 'Draw 1 extra card on turn 1.' },
    fine:   { id: 'eq-hat-fine',     name: 'Journeyman Hat',    bonus: { healOnCombatStart: 2 }, desc: 'Heal 2 HP at start of every combat.' },
    master: { id: 'eq-hat-master',   name: 'Master Hat',        bonus: { healOnCombatStart: 4, extraStartHand: 1 }, desc: 'Heal 4 HP and draw +1 on turn 1 of every combat.' },
  },
  // Orphan — the gem slot was retired in favour of ring/hat. Data kept
  // for possible future reuse (alternate equipment paths, etc.).
  gem: {
    basic:  { id: 'eq-gem-basic',    name: 'Rough Gem',         bonus: { maxHp: 8 }, desc: '+8 max HP.' },
    fine:   { id: 'eq-gem-fine',     name: 'Cut Gem',           bonus: { maxHp: 15 }, desc: '+15 max HP.' },
    master: { id: 'eq-gem-master',   name: 'Master Gem',        bonus: { maxHp: 20, healOnCombatStart: 3 }, desc: '+20 max HP. Heal 3 HP at start of every combat.' },
  },
};

// Events. `effects` keys handled by resolveEventChoice.
// Severity pass: every upside option carries a real, often-permanent cost
// (max HP loss, big HP scratch, a random card culled from the deck). The
// "walk away" option is intentionally a pittance or nothing — its value is
// situational. When you're already at 8 HP, "decline" IS the play.
const EVENTS = [
  {
    id: 'ev-old-tome',
    title: 'An Old Tome',
    flavor: 'A leather-bound book lies open on a rock. The page reads, in fading copperplate: BORROWED — RETURN BY THE EQUINOX OR FACE THE STACK CRONE. There is no further explanation, which is somehow more concerning.',
    choices: [
      { label: 'Read on. The pages bite back. (gain a Rare card, -2 max HP)', effects: { gainRareCard: 1, maxHp: -2 } },
      { label: 'Tear a page out. Pocket it. (gain a Common card, -5 HP)', effects: { gainCommonCard: 1, loseHp: 5 } },
      { label: 'Pretend you saw nothing.', effects: {} },
    ],
  },
  {
    id: 'ev-spring',
    title: 'Quiet Spring',
    flavor: 'A small spring bubbles between two stones. The water is cold, clear, and almost certainly not deliberately enchanted.',
    choices: [
      { label: 'Drink to the last drop. (heal to full, -3 max HP)', effects: { healFull: true, maxHp: -3 } },
      { label: 'Fill a flask. The flask leaks something else. (+8 HP, lose a random card)', effects: { heal: 8, loseRandomCard: true } },
      { label: 'Leave it for the next traveller.', effects: {} },
    ],
  },
  {
    id: 'ev-stranger',
    title: 'The Stranger',
    flavor: 'A figure in slightly-too-grey robes waits at a fork in the path. They produce a card from a satchel with the air of someone who has rehearsed this. Twice.',
    choices: [
      { label: 'Accept the card. The price is small, until it isn\'t. (gain Uncommon, -6 HP)', effects: { gainUncommonCard: 1, loseHp: 6 } },
      { label: 'Bargain hard. They take it out of your bones. (gain Rare, -3 max HP)', effects: { gainRareCard: 1, maxHp: -3 } },
      { label: 'Refuse politely. They expected this.', effects: {} },
    ],
  },
  {
    id: 'ev-shrine',
    title: 'Roadside Shrine',
    flavor: 'A weathered stone shrine to no god in particular. The donations bowl has been emptied recently. The donations bowl is, you suspect, emptied daily.',
    choices: [
      { label: 'Pray sincerely. The god takes a memory. (heal 10, lose a random card)', effects: { heal: 10, loseRandomCard: true } },
      { label: 'Pray sarcastically. The god is petty AND powerful. (+5 max HP, -12 HP)', effects: { maxHp: 5, loseHp: 12 } },
      { label: 'Walk on without looking.', effects: {} },
    ],
  },
  {
    id: 'ev-snake',
    title: 'Coiled Adder',
    flavor: 'A small green snake watches you pass. Its eyes are bright, deliberate, and noticeably more focused than yours have been all morning.',
    choices: [
      { label: 'Pick it up. It teaches you the hard way. (gain Rare, -8 HP)', effects: { gainRareCard: 1, loseHp: 8 } },
      { label: 'Offer it a crumb. It remembers your face. (gain Common, -1 max HP)', effects: { gainCommonCard: 1, maxHp: -1 } },
      { label: 'Step around it, politely.', effects: {} },
    ],
  },
  {
    id: 'ev-mirror',
    title: 'A Shard of Mirror',
    flavor: 'A piece of broken mirror, propped against a stump. The version of you in the glass is harder around the eyes. They are not exactly your eyes. You are pretty sure.',
    choices: [
      { label: 'Study it. The reflection takes your name. (gain Uncommon, lose a random card)', effects: { gainUncommonCard: 1, loseRandomCard: true } },
      { label: 'Break it further. The breaking shatters something else. (+6 max HP, -13 HP)', effects: { maxHp: 6, loseHp: 13 } },
      { label: 'Leave the shard. Leave quickly.', effects: {} },
    ],
  },
  {
    id: 'ev-pilgrim',
    title: 'Pilgrim on the Path',
    flavor: 'An old pilgrim sets out half a meal between you. "Eat," they say, "the path is longer than you think. Everybody\'s path is longer than they think. That\'s the trick of paths."',
    choices: [
      { label: 'Eat. The road takes back what it gives. (heal to full, -3 max HP)', effects: { healFull: true, maxHp: -3 } },
      { label: 'Trade words. The pilgrim\'s wisdom cuts. (gain Uncommon, -6 HP)', effects: { gainUncommonCard: 1, loseHp: 6 } },
      { label: 'Decline politely and continue.', effects: {} },
    ],
  },
  {
    id: 'ev-vow',
    title: 'A Vow Offered',
    flavor: 'A stone altar, carved with a single grand line: STRENGTH FOR STILLNESS. Beneath it, in much smaller letters: TERMS APPLY. CONSULT THE STELE.',
    choices: [
      { label: 'Take the full vow. (gain Rare, +7 max HP, -15 HP, lose a random card)', effects: { gainRareCard: 1, maxHp: 7, loseHp: 15, loseRandomCard: true } },
      { label: 'Read the small print, decline most. (gain Common, -2 max HP)', effects: { gainCommonCard: 1, maxHp: -2 } },
      { label: 'Walk away. The altar is unmoved.', effects: {} },
    ],
  },
];

// =============================================================================
// SIDEQUESTS — 4-7 node arcs the player can be pulled into off the main map.
// Triggered from the Town node (first arrival, one per act). Each has a list
// of `nodes`, each node either a `choice` (modal with options), a `combat`
// (enemy fight that routes back to next node on win), `narrative` (terse
// scene with one continue), or `boss` (transitions directly to act boss).
// Approximately 40% have `canAbandon: true` on a middle node, letting the
// player bail without finishing. Boss-shortcut quests CANNOT be abandoned.
// =============================================================================
const SIDEQUEST_TEMPLATES = {
  'sq-hot-mess': { id: 'sq-hot-mess', title: 'Citation Needed', act: 1,
    intro: 'A woman by the road, surrounded by floating paper arranged in defensive APA formation.',
    nodes: [
      { kind: 'choice', title: 'The Encounter',
        flavor: 'Persimmon "Sim" Quill is openly distressed. As you speak, a transparent man in a tweed jacket manifests and corrects your pronunciation of her name.',
        choices: [
          { label: 'Girl, I LIVE for drama.', effects: { loseHp: 4 } },
          { label: 'I\'m more than involved, and I\'m ready to be part of the problem.', effects: { loseHp: 4 } },
          { label: 'Whoever has you like this doesn\'t deserve you. You\'re too amazing for this. Remind me your name?', effects: { loseHp: 4 } },
        ] },
      { kind: 'choice', title: 'The Library That Reorders Itself',
        flavor: 'The library rearranges itself alphabetically every 30 seconds. The card catalog is screaming. You need Hewn-Greaves\'s 1893 notes.',
        choices: [
          { label: 'Search the stacks methodically. (-2 HP)', effects: { loseHp: 2 } },
          { label: 'Argue the library into submission. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Bribe the librarian. (lose a card)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'combat', enemyId: 'sq-critical-apparition',
        flavor: 'A small lecture hall has manifested in the middle of the road. Sim watches from the back, mouthing every counterargument a half-second after you make it.' },
      { kind: 'choice', title: 'The Compromise',
        flavor: 'Hewn-Greaves concedes one point. He proposes co-authorship. Sim is devastated. She has won and lost at the same time, which, as Hewn-Greaves notes, is an excellent thesis subject.',
        choices: [
          { label: 'The thesis is better for it. Take the deal.', effects: { gainCommonCard: 1 } },
          { label: 'He\'s wrong. Haunt him right back.', effects: { heal: 4 } },
          { label: 'Persimmon, you ARE the protagonist of your own life.', effects: { maxHp: 2, loseRandomCard: true } },
        ] },
    ] },

  'sq-jazz-cafe': { id: 'sq-jazz-cafe', title: 'A Small Cafe', act: 1,
    intro: 'You step out of a forest clearing onto a quiet Japanese street. A cafe is open, with only a few patrons inside.',
    nodes: [
      { kind: 'choice', title: 'The Cafe',
        flavor: 'Jazz drifts from a record player. The barista looks up, polite, waiting. Soft light. Wooden counter. Two patrons not looking up.',
        choices: [
          { label: 'Order a small drink. (+4 HP)', effects: { heal: 4 } },
          { label: 'Order a small meal. (+8 HP)', effects: { heal: 8 } },
          { label: 'Just sit. You\'re fine. (no heal)', effects: {} },
        ] },
      { kind: 'choice', title: 'The Cat',
        flavor: 'A cat at the next seat looks at you. Just looks. Patiently. It is, in some way you cannot articulate, asking a question.',
        choices: [
          { label: 'Look away. Finish your drink and leave.', effects: { endSpurEarly: true } },
          { label: 'Stare it down. (-5 HP, hold your nerve)', effects: { loseHp: 5 } },
        ] },
      { kind: 'narrative', title: 'The Man at the Counter',
        flavor: '"I should explain," says a man at the counter, "the cat is not, technically, mine. I am responsible for it. I am sorry for the bother. It is, regrettably, a life-stealing cat. You did well not to look away first."',
        next: { effects: {} } },
      { kind: 'narrative', title: 'About the Man',
        flavor: '"My life has been complicated. My right arm, you see, is actually my left arm. My left, my right. They look correct. They are not. I learned the guitar by mounting a left-handed neck on a right-handed body and tuning each peg the wrong direction. Allow me to play you a song."',
        next: { effects: {} } },
      { kind: 'narrative', title: 'Timber from Norway',
        flavor: 'He plays a song called Timber from Norway. It is beautiful in a way that suggests it should not be. As he leaves, he asks one thing of you — a postcard, every five nodes, with one specific five-word phrase written on it, blank otherwise. He will know if you forget. He gives you the phrase.',
        next: { effects: { grantPostcardPhrase: true } } },
    ] },

  'sq-goose': { id: 'sq-goose', title: 'The Goose', act: 1,
    intro: 'A villager weeps. Her prize goose has gone missing. The goose, you suspect, had opinions.',
    nodes: [
      { kind: 'choice', title: 'Margie\'s Plea',
        flavor: 'Margie Tellwright clutches a small empty wicker pen. The goose, named Constance, is by goose standards exceptional.',
        choices: [
          { label: 'I\'ll find her.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Chase',
        flavor: 'Constance is fast and has political opinions. She does not want to come back.',
        choices: [
          { label: 'Corner her. (-4 HP from goose bite)', effects: { loseHp: 4 } },
          { label: 'Reason with her. (she finds you condescending; lose a card)', effects: { loseRandomCard: true } },
          { label: 'Feed her bread. (lose Common card representing the bread)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'choice', title: 'The Return',
        flavor: 'Constance refuses to return unless you tell Margie she is, in fact, not a prize goose. Just a goose.',
        choices: [
          { label: 'Tell Margie the truth.', effects: { maxHp: 2 } },
          { label: 'Lie. Say Constance forgave her.', effects: { loseHp: 4 } },
          { label: 'Leave Constance somewhere quiet.', effects: { gainCommonCard: 1 } },
        ] },
    ] },

  'sq-cursed-letter': { id: 'sq-cursed-letter', title: 'The Cursed Letter', act: 2,
    intro: 'A courier hands you a sealed envelope. He apologises before you accept it.',
    nodes: [
      { kind: 'choice', title: 'Yves the Courier',
        flavor: 'Yves Marrow says: don\'t read it. Definitely don\'t read it. Then he runs.',
        choices: [
          { label: 'Take the letter.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Walk', canAbandon: true,
        flavor: 'The letter starts whispering. The whispers escalate.',
        choices: [
          { label: 'Suppress the whispers. (-3 HP)', effects: { loseHp: 3 } },
          { label: 'Open the letter. (lose a card to the curse)', effects: { loseRandomCard: true } },
          { label: 'Bury the letter. (-1 max HP, the ground complains)', effects: { maxHp: -1 } },
        ] },
      { kind: 'choice', title: 'The Fiancée',
        flavor: 'She takes the letter without reading it. She files it. She invites you in for terrible tea. The letter was technically a wedding invitation, but she was already engaged to someone else.',
        choices: [
          { label: 'Accept the tea graciously.', effects: { maxHp: 2 } },
          { label: 'Accept the unused engagement gift.', effects: { gainUncommonCard: 1 } },
        ] },
    ] },

  'sq-last-will-sneeze': { id: 'sq-last-will-sneeze', title: 'The Last Will of a Sneeze', act: 3,
    intro: 'A thin man in a suit is representing a sneeze. The sneeze is forty years old. The sneeze has assets.',
    nodes: [
      { kind: 'choice', title: 'The Hearing',
        flavor: 'You witness a divorce between an elderly Sneeze and an elderly Cough. You choose which keeps the property.',
        choices: [
          { label: 'Side with the Sneeze. (Cough curses you)', effects: { loseHp: 3 } },
          { label: 'Side with the Cough. (Sneeze curses you)', effects: { loseHp: 3 } },
        ] },
      { kind: 'choice', title: 'The Aftermath',
        flavor: 'The loser sues you. The winner blesses you.',
        choices: [
          { label: 'Pay the legal fees. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Pay the legal fees the other way. (-2 max HP)', effects: { maxHp: -2 } },
        ] },
    ] },

  'sq-wishful-beggar': { id: 'sq-wishful-beggar', title: 'The Wishful Beggar', act: 3,
    intro: 'An old woman on a milestone. She wishes for nothing in particular. She asks for the same.',
    nodes: [
      { kind: 'choice', title: 'The Search',
        flavor: 'Old Penny wants, specifically, nothing in particular. Acquiring this is harder than expected.',
        choices: [
          { label: 'Pay a vendor for empty air. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Consult a metaphysicist. (-1 max HP from confusion)', effects: { maxHp: -1 } },
          { label: 'Steal an empty pocket from a pickpocket. (-3 HP)', effects: { loseHp: 3 } },
        ] },
      { kind: 'choice', title: 'The Gift',
        flavor: 'Penny accepts the nothing. She blesses you. The blessing has a shape.',
        choices: [
          { label: 'Receive the blessing.', effects: { heal: 3 } },
        ] },
    ] },

  'sq-twins': { id: 'sq-twins', title: 'The Twins', act: 1,
    intro: 'Twin sisters insist the other is impersonating them. Both are impersonating each other.',
    nodes: [
      { kind: 'choice', title: 'Vera & Vere',
        flavor: 'They speak over each other. They finish each other\'s sentences. Both look hopeful at you.',
        choices: [
          { label: 'I\'ll help.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Test', canAbandon: true,
        flavor: 'Each gives "proof of identity." Vera\'s is a childhood scar. Vere\'s is the same scar in the same place.',
        choices: [
          { label: 'Trust Vera.', effects: {} },
          { label: 'Trust Vere.', effects: {} },
        ] },
      { kind: 'combat', enemyId: 'e2-pattern-maker',
        flavor: 'You arrive at an empty room. They were colluding. The pattern-maker steps out from behind a curtain.' },
      { kind: 'choice', title: 'Aftermath',
        flavor: 'You saw the pattern eventually.',
        choices: [
          { label: 'Take the reward.', effects: { maxHp: 1, gainCommonCard: 1 } },
        ] },
    ] },

  'sq-bridge-toll': { id: 'sq-bridge-toll', title: 'The Bridge Toll', act: 2,
    intro: 'A small troll under a bridge. He wants three reasons. He won\'t say what for.',
    nodes: [
      { kind: 'choice', title: 'Karst Underbridge',
        flavor: 'Karst is polite but firm. Three reasons. Doesn\'t matter what for. Choose three.',
        choices: [
          { label: 'A truth, a joke, and a confession.', effects: { loseRandomCard: true, heal: 2, loseHp: 3, maxHp: 1 } },
          { label: 'A lie, a lie, and another lie.', effects: { loseHp: 6 } },
          { label: 'Three philosophical observations.', effects: {} },
        ] },
      { kind: 'narrative', title: 'The Crossing',
        flavor: 'Karst writes all three down in a small notebook. He steps aside. He had no purpose for them. He\'s a collector.',
        next: { effects: { gainCommonCard: 1 } } },
    ] },

  'sq-inheriting-spider': { id: 'sq-inheriting-spider', title: 'The Inheriting Spider', act: 3,
    intro: 'A spider has been named sole heir to a small fortune. Multiple humans are contesting in court.',
    nodes: [
      { kind: 'choice', title: 'Hortensia',
        flavor: 'A lawyer informs you Hortensia (a spider) needs character witnesses. She is medium-sized and weaving aggressively.',
        choices: [
          { label: 'I\'ll testify.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Court', canAbandon: true,
        flavor: 'You\'re sworn in. Hortensia is on your shoulder. The humans glare.',
        choices: [
          { label: 'Testify for Hortensia. (the humans blacklist you; lose a card)', effects: { loseRandomCard: true } },
          { label: 'Testify against. (Hortensia attacks you)', effects: { loseHp: 4 } },
          { label: 'Recuse yourself. (-1 max HP from court contempt)', effects: { maxHp: -1 } },
        ] },
      { kind: 'choice', title: 'The Verdict',
        flavor: 'Hortensia wins regardless — the will was airtight. She bequeaths you a small token.',
        choices: [
          { label: 'Accept the token.', effects: { gainCommonCard: 1 } },
          { label: 'Decline. Accept her good opinion instead.', effects: { heal: 3 } },
        ] },
    ] },

  'sq-postmaster-daughter': { id: 'sq-postmaster-daughter', title: 'The Postmaster\'s Daughter', act: 3,
    intro: 'Aurelia Tipp weeps onto a map. The map is technically excellent. It charts her affections.',
    nodes: [
      { kind: 'choice', title: 'The Map',
        flavor: 'Aurelia is in love with three cartographers. They cooperate professionally and compete romantically.',
        choices: [
          { label: 'I\'ll mediate.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Cartographers', canAbandon: true,
        flavor: 'All three insist Aurelia loves them most. They have, between them, drawn 47 versions of her smile.',
        choices: [
          { label: 'Pick one for her. (the others war; -2 HP)', effects: { loseHp: 2 } },
          { label: 'Tell them they share a delusion. (they start mapping your face; lose a card)', effects: { loseRandomCard: true } },
          { label: 'Destroy the map. (-4 HP from her grief, +1 max HP from doing right)', effects: { loseHp: 4, maxHp: 1 } },
        ] },
      { kind: 'narrative', title: 'The Resolution',
        flavor: 'Aurelia chooses none of them. She moves to a coastal town and becomes a hermit. Six weeks later, you receive a postcard.',
        next: { effects: { heal: 2, gainCommonCard: 1 } } },
    ] },

  'sq-modest-favor': { id: 'sq-modest-favor', title: 'A Modest Favor', act: 1,
    intro: 'Apothecary Webb needs "modest" ingredients. The "modest" is a lie. He won\'t tell you what for.',
    nodes: [
      { kind: 'choice', title: 'The List',
        flavor: 'Salt from a sea that doesn\'t exist anymore. A leaf from a tree that grows backwards. The breath of a sleeping cat. Webb hands you the list with a kind smile.',
        choices: [
          { label: 'I\'ll fetch them.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Salt', canAbandon: true,
        flavor: 'A memory-merchant has the salt. He wants something in trade.',
        choices: [
          { label: 'Trade a card.', effects: { loseRandomCard: true } },
          { label: 'Trade a memory. (-3 HP from the absence)', effects: { loseHp: 3 } },
        ] },
      { kind: 'combat', enemyId: 'e1-thicket',
        flavor: 'The backwards-tree has a small protector spirit. It objects to leaf-gathering.' },
      { kind: 'choice', title: 'The Cat',
        flavor: 'The cat sleeps on Webb\'s rug. One breath is enough. Don\'t wake the cat.',
        choices: [
          { label: 'Perform an elaborate hush. (-1 max HP from concentration)', effects: { maxHp: -1 } },
          { label: 'Wake the cat anyway. (-3 HP)', effects: { loseHp: 3 } },
        ] },
      { kind: 'narrative', title: 'The Brew',
        flavor: 'Webb brews tea. He drinks it. He becomes mildly enlightened for twenty minutes. He thanks you absently.',
        next: { effects: { maxHp: 2, gainUncommonCard: 1 } } },
    ] },

  'sq-quiet-village': { id: 'sq-quiet-village', title: 'The Quiet Village', act: 2,
    intro: 'The villagers of Greyhollow welcome you. They smile. They do not blink.',
    nodes: [
      { kind: 'narrative', title: 'Welcome',
        flavor: 'A child whispers something in a language that hasn\'t existed for 400 years.',
        next: { effects: { loseHp: 2 } } },
      { kind: 'narrative', title: 'The Empty House',
        flavor: 'You find an empty house with all the doors locked from the inside.',
        next: { effects: { loseHp: 2 } } },
      { kind: 'combat', enemyId: 'e2-pattern-maker',
        flavor: 'Whatever the village has been hosting steps into the road. It is composed mostly of polite expectation.' },
      { kind: 'narrative', title: 'Departure',
        flavor: 'The village resumes blinking. You leave with the strange feeling you were the polite one all along.',
        next: { effects: { maxHp: 2, heal: 4 } } },
    ] },

  'sq-lost-familiar': { id: 'sq-lost-familiar', title: 'The Lost Familiar', act: 2,
    intro: 'A senior wizard\'s familiar has gone feral. The familiar has filed paperwork.',
    nodes: [
      { kind: 'choice', title: 'Master Penrith',
        flavor: 'Penrith explains. Lord Buttons has formally severed his contract. Paperwork is in triplicate.',
        choices: [
          { label: 'I\'ll find him.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Tavern',
        flavor: 'Lord Buttons is drinking. Drunken cats are unreasonable.',
        choices: [
          { label: 'Reason with him. (-2 HP)', effects: { loseHp: 2 } },
          { label: 'Match him drink for drink. (-1 max HP, earn his respect)', effects: { maxHp: -1 } },
          { label: 'Hire a feline translator. (lose a card)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'choice', title: 'The Hearing',
        flavor: 'Lord Buttons demands a show of good faith.',
        choices: [
          { label: 'Bring him an offering. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Give him your name as a curse-word.', effects: {} },
          { label: 'Offer him a personal vow. (lose a card)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'narrative', title: 'Reconciliation',
        flavor: 'Lord Buttons rescinds his paperwork. Penrith is grateful.',
        next: { effects: { gainUncommonCard: 1 } } },
    ] },

  'sq-schoolhouse': { id: 'sq-schoolhouse', title: 'The Schoolhouse', act: 1,
    intro: 'A schoolhouse has become sentient. It has begun grading everyone who walks past.',
    nodes: [
      { kind: 'narrative', title: 'The C-',
        flavor: 'A passing villager has been given a C-. They are inconsolable.',
        next: { effects: {} } },
      { kind: 'choice', title: 'Inside', canAbandon: true,
        flavor: 'The schoolhouse grades your entrance. It assigns you a B+. The grade is real and slightly demoralizing.',
        choices: [
          { label: 'Reason with it. (-2 HP from being marked down)', effects: { loseHp: 2 } },
          { label: 'Threaten the school board. (-1 max HP)', effects: { maxHp: -1 } },
          { label: 'Compliment its rigor. (+2 HP)', effects: { heal: 2 } },
        ] },
      { kind: 'narrative', title: 'The Agreement',
        flavor: 'The schoolhouse agrees to grade only voluntarily. Your final grade: A-.',
        next: { effects: { gainCommonCard: 1 } } },
    ] },

  'sq-skeptical-ghost': { id: 'sq-skeptical-ghost', title: 'The Ghost That Doesn\'t Believe In Itself', act: 3,
    intro: 'A ghost, skeptical of ghosts on principle. He needs evidence he exists. From you.',
    nodes: [
      { kind: 'choice', title: 'Ezekiel Marsh',
        flavor: 'Ezekiel folds transparent arms. He requires demonstration.',
        choices: [
          { label: 'I\'ll try.', effects: {} },
        ] },
      { kind: 'choice', title: 'The Demonstrations',
        flavor: 'Each piece of evidence Ezekiel rebuts.',
        choices: [
          { label: 'Walk through him. (he claims wide stance; -1 HP)', effects: { loseHp: 1 } },
          { label: 'Describe him. (he says you\'re imagining; lose a Wit card)', effects: { loseRandomCard: true } },
          { label: 'Get a third party. (the third party also can\'t see him; -2 HP)', effects: { loseHp: 2 } },
        ] },
      { kind: 'choice', title: 'The Counter',
        flavor: 'Ezekiel demands you prove the same about yourself. Each piece of evidence he rebuts.',
        choices: [
          { label: 'Concede the symmetry.', effects: {} },
        ] },
      { kind: 'narrative', title: 'Mutual Existence',
        flavor: 'You both agree you exist only in each other\'s presence. He becomes a small invisible companion for the rest of the act.',
        next: { effects: { maxHp: 1, heal: 3 } } },
    ] },

  'sq-returned-heir': { id: 'sq-returned-heir', title: 'The Returned Heir', act: 3,
    intro: 'Ferdinand Quenchwell, sole heir, declared dead, has returned. Multiple alternate heirs object.',
    nodes: [
      { kind: 'choice', title: 'Ferdinand',
        flavor: 'He needs witnesses to vouch he is, in fact, him. Three alternate heirs have stronger paperwork.',
        choices: [
          { label: 'I\'ll vouch.', effects: {} },
        ] },
      { kind: 'combat', enemyId: 'e3-quartz-sentinel', canAbandon: true,
        flavor: 'The family lawyer was paid by all four heirs. He objects to your involvement, professionally.' },
      { kind: 'choice', title: 'The Hearing',
        flavor: 'You give your testimony. The fake heir is now visibly nervous.',
        choices: [
          { label: 'Vouch for Ferdinand.', effects: { gainCommonCard: 1 } },
          { label: 'Reveal the fake. (-3 HP from magical backlash)', effects: { loseHp: 3, gainUncommonCard: 1 } },
          { label: 'Claim the estate yourself.', effects: { gainUncommonCard: 1, maxHp: -2 } },
        ] },
    ] },

  'sq-wedding-crash': { id: 'sq-wedding-crash', title: 'The Wedding Crash', act: 3,
    intro: 'Two families both believe they\'re hosting the same wedding. The bride doesn\'t exist.',
    nodes: [
      { kind: 'narrative', title: 'The Venue',
        flavor: 'Two wedding parties. Mutual confusion. The cake is also confused.',
        next: { effects: {} } },
      { kind: 'choice', title: 'The Bride', canAbandon: true,
        flavor: 'You locate her. She is a composite of paperwork and assumptions.',
        choices: [
          { label: 'Try to find the truth.', effects: {} },
        ] },
      { kind: 'combat', enemyId: 'e1-acolyte',
        flavor: 'The first family\'s enforcer challenges you when you suggest the bride isn\'t real.' },
      { kind: 'combat', enemyId: 'e1-imp',
        flavor: 'The OTHER family\'s enforcer arrives. They thought you were with the first.' },
      { kind: 'narrative', title: 'The Resolution',
        flavor: 'Both families realize together. They marry each other\'s matriarchs. The cake is consumed in relief.',
        next: { effects: { maxHp: 3, gainUncommonCard: 1 } } },
    ] },

  'sq-apprentice-of-apprentice': { id: 'sq-apprentice-of-apprentice', title: 'The Apprentice\'s Apprentice', act: 3,
    intro: 'Master Doone\'s apprentice Yves was surpassed by his apprentice Coriander. Everyone is upset.',
    nodes: [
      { kind: 'choice', title: 'The Three',
        flavor: 'They speak over each other. They each demand you settle the matter.',
        choices: [
          { label: 'Fine. Three tests.', effects: {} },
        ] },
      { kind: 'choice', title: 'Doone\'s Test',
        flavor: 'Beat his old test (an old test, by old standards).',
        choices: [
          { label: 'Pay the study fee. Pass.', effects: { loseRandomCard: true } },
        ] },
      { kind: 'choice', title: 'Yves\'s Test',
        flavor: 'Beat the test he beat Doone with. A sloppy spell rebounds.',
        choices: [
          { label: 'Take the rebound. Pass.', effects: { loseHp: 2 } },
        ] },
      { kind: 'narrative', title: 'Coriander\'s Test',
        flavor: 'The test is unsolvable. You fail. She is delighted. She gives you a card in pity.',
        next: { effects: { loseHp: 3, gainCommonCard: 1 } } },
      { kind: 'narrative', title: 'A New Academy',
        flavor: 'They resolve to start a small academy where rank is decided by rock-paper-scissors. They thank you sincerely.',
        next: { effects: { maxHp: 2 } } },
    ] },

  'sq-drunk-oracle': { id: 'sq-drunk-oracle', title: 'The Drunk Oracle', act: 3,
    intro: 'Hannelore the Half-Seen has prophesied your death. By Tuesday. By a turnip.',
    nodes: [
      { kind: 'choice', title: 'The Prophecy',
        flavor: 'She is specific. She is also several drinks in.',
        choices: [
          { label: 'I should probably verify.', effects: {} },
        ] },
      { kind: 'choice', title: 'Verification',
        flavor: 'A second oracle says Wednesday. By a turnip. Somehow worse.',
        choices: [
          { label: 'Search for the turnip. (-1 HP existential dread)', effects: { loseHp: 1 } },
          { label: 'Buy Hannelore another drink. (lose a card; she retracts temporarily)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'combat', enemyId: 'e1-shrine-rat',
        flavor: 'A turnip-themed cult has heard about the prophecy. They want to help fulfill it.' },
      { kind: 'narrative', title: 'The Distraction',
        flavor: 'You confront the turnip. It is not the murderer. It was a distraction.',
        next: { effects: {} } },
      { kind: 'combat', enemyId: 'e3-vein-devourer',
        flavor: 'A vegetable seller, wronged in Act 1 (offstage), finds you. He has been preparing.' },
      { kind: 'narrative', title: 'Averted',
        flavor: 'You survive. Tuesday passes. Hannelore later claims she meant a metaphorical turnip.',
        next: { effects: { maxHp: 3, gainUncommonCard: 1 } } },
    ] },

  'sq-unfinished-symphony': { id: 'sq-unfinished-symphony', title: 'The Unfinished Symphony', act: 3, bossShortcut: true,
    intro: 'Maestro Calvert Ainsworth\'s masterwork has been declared unfinishable. He wants the critic killed. The critic is, frankly, correct.',
    nodes: [
      { kind: 'choice', title: 'The Score',
        flavor: 'Ainsworth shows you the score. It\'s beautiful and broken. He needs help.',
        choices: [
          { label: 'I\'ll talk to her.', effects: {} },
        ] },
      { kind: 'narrative', title: 'The Thicket',
        flavor: 'A spirit guards the path to the critic\'s residence and insists on payment.',
        next: { effects: { loseRandomCard: true } } },
      { kind: 'combat', enemyId: 'sq-critical-apparition',
        flavor: 'The critic. Brutal. Accurate. Slightly bored.' },
      { kind: 'choice', title: 'The Revision',
        flavor: 'She concedes one paragraph. Bring it to Ainsworth.',
        choices: [
          { label: 'Bring the revision.', effects: { gainCommonCard: 1 } },
        ] },
      { kind: 'narrative', title: 'The Boss Approaches',
        flavor: 'Ainsworth revises. The symphony is now finishable. The act boss, observing all this, takes interest. The symphony, you realize, is what summoned them.',
        next: { effects: {} } },
      { kind: 'boss',
        flavor: 'Ainsworth has placed you in the boss\'s path. He\'s deeply apologetic.' },
    ] },

  'sq-borrowed-death': { id: 'sq-borrowed-death', title: 'The Borrowed Death', act: 3, bossShortcut: true,
    intro: 'Death, polite and slightly annoyed. Someone borrowed his scythe and hasn\'t returned it.',
    nodes: [
      { kind: 'choice', title: 'Death\'s Apology',
        flavor: 'He apologises for the inconvenience. The thief, he believes, is in this act.',
        choices: [
          { label: 'I\'ll find them.', effects: {} },
        ] },
      { kind: 'narrative', title: 'The Witness',
        flavor: 'A villager remembers a direction. Interview fatigue settles in.',
        next: { effects: { loseHp: 2 } } },
      { kind: 'combat', enemyId: 'e3-quartz-sentinel',
        flavor: 'A figure who tried the scythe and is now stuck to it. They cannot let go. They are not glad to see you.' },
      { kind: 'choice', title: 'The Child',
        flavor: 'A child saw the thief. They want payment first.',
        choices: [
          { label: 'Pay. (lose a card)', effects: { loseRandomCard: true } },
        ] },
      { kind: 'narrative', title: 'The Cuts',
        flavor: 'A cut in a hedge. A cut in a sentence. A cut in your memory of the act.',
        next: { effects: { loseRandomCard: true } } },
      { kind: 'combat', enemyId: 'e1-tutor',
        flavor: 'The thief. Using the scythe inexpertly. Cannot use it well. Cannot stop.' },
      { kind: 'boss',
        flavor: 'Death thanks you. He mentions, casually, that he was on his way to a specific appointment. The appointment was the act boss. He offers you a lift.' },
    ] },

  'sq-lovers-quarrel': { id: 'sq-lovers-quarrel', title: 'The Lover\'s Quarrel', act: 3,
    intro: 'Two gods are having a domestic. You\'ve been called in to referee. Gods are not allowed to mediate other gods.',
    nodes: [
      { kind: 'choice', title: 'The Two Gods',
        flavor: 'Auron of Hearths. Mehir of Doorways. Both very tall. Both very upset. Both very specific.',
        choices: [
          { label: 'Hear them out.', effects: {} },
        ] },
      { kind: 'narrative', title: 'Auron',
        flavor: 'He serves you divine tea. You aren\'t supposed to drink that.',
        next: { effects: { maxHp: -1 } } },
      { kind: 'narrative', title: 'Mehir', canAbandon: true,
        flavor: 'He has slides. The deck is twelve hundred years old and somewhat luminous.',
        next: { effects: { loseHp: 2 } } },
      { kind: 'narrative', title: 'The Investigation',
        flavor: 'A missing key. A misplaced welcome mat. A third party who left town.',
        next: { effects: {} } },
      { kind: 'choice', title: 'The God of Vestibules',
        flavor: 'He\'s hiding in a closet.',
        choices: [
          { label: 'Bribe him out. (lose a card)', effects: { loseRandomCard: true } },
          { label: 'Break the closet door. (-3 HP)', effects: { loseHp: 3 } },
          { label: 'Perform an elaborate hush. (-1 max HP)', effects: { maxHp: -1 } },
        ] },
      { kind: 'choice', title: 'The Mediation',
        flavor: 'You must make a binding judgment. Each god will dissatisfy two others.',
        choices: [
          { label: 'Side with Auron.', effects: { gainCommonCard: 1 } },
          { label: 'Side with Mehir.', effects: { gainCommonCard: 1 } },
          { label: 'Suggest the god of vestibules is the real victim.', effects: { maxHp: 3 } },
        ] },
      { kind: 'narrative', title: 'Departure',
        flavor: 'You leave before they notice. You witnessed a divine domestic and survived.',
        next: { effects: { gainCommonCard: 1 } } },
    ] },
};

// =============================================================================
// INSULT WORD POOLS — used by insult-type effect cards. On cast, the
// player picks one noun, one verb, one adjective (3 choices each, 4s
// timer per pick). Each word has pre-classified `tags`. Alignment
// against the enemy's `insultVulnerabilities` decides outcome:
//   ≥50% tag-match → LAND (heavy composure damage to enemy)
//   25-49%         → UNFAZE (player loses base composure cost only)
//   <25%           → BACKFIRE (enemy retorts — extra composure damage)
// =============================================================================
const INSULT_NOUNS = [
  // dismissive cluster (32)
  { word: 'wretch',          tags: ['dismissive'] },
  { word: 'bore',            tags: ['dismissive', 'petty'] },
  { word: 'mediocrity',      tags: ['dismissive'] },
  { word: 'nonentity',       tags: ['dismissive'] },
  { word: 'mistake',         tags: ['dismissive', 'petty'] },
  { word: 'embarrassment',   tags: ['dismissive', 'petty'] },
  { word: 'fool',            tags: ['dismissive'] },
  { word: 'simpleton',       tags: ['dismissive'] },
  { word: 'footnote',        tags: ['dismissive', 'academic'] },
  { word: 'asterisk',        tags: ['dismissive', 'academic'] },
  { word: 'typo',            tags: ['dismissive', 'absurd'] },
  { word: 'amateur',         tags: ['dismissive'] },
  { word: 'trainee',         tags: ['dismissive'] },
  { word: 'pretender',       tags: ['dismissive', 'sarcastic'] },
  { word: 'impostor',        tags: ['dismissive', 'threatening'] },
  { word: 'understudy',      tags: ['dismissive', 'petty'] },
  { word: 'afterthought',    tags: ['dismissive'] },
  { word: 'preliminary',     tags: ['dismissive', 'formal'] },
  { word: 'rough draft',     tags: ['dismissive'] },
  { word: 'rehearsal',       tags: ['dismissive'] },
  { word: 'shrug',           tags: ['dismissive'] },
  { word: 'parenthetical',   tags: ['dismissive', 'academic'] },
  { word: 'placeholder',     tags: ['dismissive'] },
  { word: 'first attempt',   tags: ['dismissive'] },
  { word: 'second-rater',    tags: ['dismissive', 'petty'] },
  { word: 'also-ran',        tags: ['dismissive'] },
  { word: 'runner-up',       tags: ['dismissive', 'sarcastic'] },
  { word: 'pamphlet',        tags: ['dismissive', 'petty'] },
  { word: 'leaflet',         tags: ['dismissive', 'petty'] },
  { word: 'memo',            tags: ['dismissive', 'formal'] },
  { word: 'footrest',        tags: ['dismissive', 'absurd'] },
  { word: 'doormat',         tags: ['dismissive', 'petty'] },
  // petty cluster (28)
  { word: 'crumb',           tags: ['petty'] },
  { word: 'flake',           tags: ['petty', 'absurd'] },
  { word: 'wisp',            tags: ['petty'] },
  { word: 'smudge',          tags: ['petty', 'absurd'] },
  { word: 'speck',           tags: ['petty'] },
  { word: 'mite',            tags: ['petty'] },
  { word: 'snippet',         tags: ['petty'] },
  { word: 'scrap',           tags: ['petty'] },
  { word: 'trifle',          tags: ['petty'] },
  { word: 'nibble',          tags: ['petty', 'absurd'] },
  { word: 'morsel',          tags: ['petty'] },
  { word: 'side dish',       tags: ['petty', 'absurd'] },
  { word: 'hanger-on',       tags: ['petty', 'dismissive'] },
  { word: 'accessory',       tags: ['petty'] },
  { word: 'tagalong',        tags: ['petty', 'dismissive'] },
  { word: 'junior',          tags: ['petty', 'dismissive'] },
  { word: 'second',          tags: ['petty'] },
  { word: 'third place',     tags: ['petty', 'sarcastic'] },
  { word: 'seat-warmer',     tags: ['petty', 'dismissive'] },
  { word: 'understudy',      tags: ['petty', 'dismissive'] },
  { word: 'sidekick',        tags: ['petty'] },
  { word: 'tagalong',        tags: ['petty'] },
  { word: 'penny ante',      tags: ['petty', 'dismissive'] },
  { word: 'cheap seat',      tags: ['petty'] },
  { word: 'bargain bin',     tags: ['petty', 'sarcastic'] },
  { word: 'discount cousin', tags: ['petty', 'absurd'] },
  { word: 'lukewarm tea',    tags: ['petty', 'absurd'] },
  { word: 'minor key',       tags: ['petty', 'sarcastic'] },
  // threatening cluster (18)
  { word: 'parasite',        tags: ['threatening', 'dismissive'] },
  { word: 'tumour',          tags: ['threatening'] },
  { word: 'infestation',     tags: ['threatening'] },
  { word: 'blight',          tags: ['threatening'] },
  { word: 'plague',          tags: ['threatening'] },
  { word: 'canker',          tags: ['threatening'] },
  { word: 'wound',           tags: ['threatening'] },
  { word: 'carrion',         tags: ['threatening'] },
  { word: 'liability',       tags: ['threatening', 'dismissive'] },
  { word: 'drain',           tags: ['threatening', 'dismissive'] },
  { word: 'burden',          tags: ['threatening', 'dismissive'] },
  { word: 'yoke',            tags: ['threatening', 'petty'] },
  { word: 'shackle',         tags: ['threatening'] },
  { word: 'menace',          tags: ['threatening', 'sarcastic'] },
  { word: 'predator',        tags: ['threatening'] },
  { word: 'leech',           tags: ['threatening', 'petty'] },
  { word: 'mosquito',        tags: ['threatening', 'petty'] },
  { word: 'tax-collector',   tags: ['threatening', 'formal'] },
  // booming cluster (12)
  { word: 'thunderhead',     tags: ['booming'] },
  { word: 'thundering twit', tags: ['booming', 'dismissive'] },
  { word: 'avalanche',       tags: ['booming'] },
  { word: 'tempest',         tags: ['booming'] },
  { word: 'cataclysm',       tags: ['booming', 'absurd'] },
  { word: 'bellow',          tags: ['booming'] },
  { word: 'roar',            tags: ['booming'] },
  { word: 'fanfare',         tags: ['booming', 'sarcastic'] },
  { word: 'thunderclap',     tags: ['booming'] },
  { word: 'gale',            tags: ['booming'] },
  { word: 'cannonade',       tags: ['booming', 'threatening'] },
  { word: 'klaxon',          tags: ['booming', 'absurd'] },
  // absurd cluster (50+)
  { word: 'cheese-cousin',   tags: ['absurd'] },
  { word: 'turnip',          tags: ['absurd', 'petty'] },
  { word: 'hat',             tags: ['absurd', 'dismissive'] },
  { word: 'compostable',     tags: ['absurd', 'dismissive'] },
  { word: 'small-clothes thief', tags: ['absurd', 'petty'] },
  { word: 'undercooked goose', tags: ['absurd', 'petty'] },
  { word: 'discount oracle', tags: ['absurd', 'sarcastic', 'mystical'] },
  { word: 'failed thesis',   tags: ['absurd', 'dismissive', 'academic'] },
  { word: 'badger-related incident', tags: ['absurd'] },
  { word: 'weekend lecture', tags: ['absurd', 'academic'] },
  { word: 'potato emergency', tags: ['absurd'] },
  { word: 'footnote with feelings', tags: ['absurd', 'academic'] },
  { word: 'spreadsheet of mistakes', tags: ['absurd', 'dismissive'] },
  { word: 'boiled biography',tags: ['absurd', 'academic'] },
  { word: 'parable about pickles', tags: ['absurd', 'mystical'] },
  { word: 'fermenting allegory', tags: ['absurd', 'academic'] },
  { word: 'carbohydrate enthusiast', tags: ['absurd'] },
  { word: 'minor cabbage',   tags: ['absurd', 'petty'] },
  { word: 'damp ledger',     tags: ['absurd', 'formal'] },
  { word: 'opinion-haver',   tags: ['absurd', 'dismissive'] },
  { word: 'small-shaped concept', tags: ['absurd', 'petty'] },
  { word: 'mid-sized regret',tags: ['absurd'] },
  { word: 'failed weather event', tags: ['absurd'] },
  { word: 'plural sneeze',   tags: ['absurd'] },
  { word: 'crustless metaphor', tags: ['absurd'] },
  { word: 'unfinished thank-you note', tags: ['absurd', 'formal'] },
  { word: 'enthusiastic mistake', tags: ['absurd', 'dismissive'] },
  { word: 'local nuisance',  tags: ['absurd', 'petty'] },
  { word: 'footnote-shaped person', tags: ['absurd', 'dismissive'] },
  { word: 'damp omen',       tags: ['absurd', 'mystical'] },
  { word: 'soup that learned to walk', tags: ['absurd'] },
  { word: 'half-spoken whisper', tags: ['absurd'] },
  { word: 'forgotten umbrella', tags: ['absurd', 'dismissive'] },
  { word: 'tax form with a soul', tags: ['absurd', 'formal'] },
  { word: 'enchanted pamphlet', tags: ['absurd', 'mystical', 'petty'] },
  { word: 'self-aware mop',  tags: ['absurd'] },
  { word: 'mildly haunted shelf', tags: ['absurd', 'mystical'] },
  { word: 'bureaucratic accident', tags: ['absurd', 'formal'] },
  { word: 'compound interest', tags: ['absurd', 'academic'] },
  { word: 'expired charm',   tags: ['absurd', 'mystical'] },
  { word: 'mediocre vortex', tags: ['absurd', 'dismissive'] },
  { word: 'bottle of opinions', tags: ['absurd'] },
  { word: 'minor heresy',    tags: ['absurd', 'mystical', 'petty'] },
  { word: 'weekend cult',    tags: ['absurd', 'mystical'] },
  { word: 'budget revelation', tags: ['absurd', 'mystical'] },
  { word: 'half-realized hex', tags: ['absurd', 'mystical'] },
  { word: 'small printed thing', tags: ['absurd', 'petty'] },
  { word: 'memory of soup',  tags: ['absurd'] },
  { word: 'weather-shaped person', tags: ['absurd'] },
  { word: 'emotional spreadsheet', tags: ['absurd', 'academic'] },
  { word: 'cardboard prophecy', tags: ['absurd', 'mystical'] },
  { word: 'third-tier disappointment', tags: ['absurd', 'dismissive'] },
  { word: 'failed bird impression', tags: ['absurd'] },
  { word: 'badly-folded napkin', tags: ['absurd', 'petty'] },
  { word: 'small library scandal', tags: ['absurd', 'academic'] },
  { word: 'allergy to consequences', tags: ['absurd', 'dismissive'] },
  { word: 'plural inconvenience', tags: ['absurd', 'petty'] },
  { word: 'half-known constant', tags: ['absurd', 'academic'] },
  { word: 'damp scroll',     tags: ['absurd', 'mystical', 'formal'] },
  { word: 'lesser invitation', tags: ['absurd', 'formal', 'petty'] },
  { word: 'footnote on a stove', tags: ['absurd', 'academic'] },
  { word: 'recipe-shaped insult', tags: ['absurd'] },
  { word: 'tax-free hex',    tags: ['absurd', 'mystical', 'formal'] },
  { word: 'small alphabetized misery', tags: ['absurd', 'petty'] },
  { word: 'half-priced moral panic', tags: ['absurd'] },
  { word: 'glass-eyed prefect', tags: ['absurd', 'formal'] },
  { word: 'sandwich-related grievance', tags: ['absurd'] },
  { word: 'unsolved sneeze', tags: ['absurd'] },
  // sarcastic cluster (16)
  { word: 'genius',          tags: ['sarcastic'] },
  { word: 'paragon',         tags: ['sarcastic', 'formal'] },
  { word: 'luminary',        tags: ['sarcastic', 'formal'] },
  { word: 'visionary',       tags: ['sarcastic'] },
  { word: 'prodigy',         tags: ['sarcastic'] },
  { word: 'wonder',          tags: ['sarcastic'] },
  { word: 'marvel',          tags: ['sarcastic'] },
  { word: 'specimen',        tags: ['sarcastic', 'academic'] },
  { word: 'piece of work',   tags: ['sarcastic'] },
  { word: 'example',         tags: ['sarcastic'] },
  { word: 'case study',      tags: ['sarcastic', 'academic'] },
  { word: 'textbook case',   tags: ['sarcastic', 'academic'] },
  { word: 'cautionary tale', tags: ['sarcastic'] },
  { word: 'urban legend',    tags: ['sarcastic'] },
  { word: 'one for the books', tags: ['sarcastic'] },
  { word: 'philosopher',     tags: ['sarcastic', 'academic'] },
  // academic / formal cluster (12)
  { word: 'erratum',         tags: ['academic'] },
  { word: 'retraction',      tags: ['academic', 'formal'] },
  { word: 'corrigendum',     tags: ['academic', 'formal'] },
  { word: 'annotation',      tags: ['academic'] },
  { word: 'marginalia',      tags: ['academic', 'petty'] },
  { word: 'abstract',        tags: ['academic'] },
  { word: 'citation',        tags: ['academic'] },
  { word: 'supplicant',      tags: ['formal', 'petty'] },
  { word: 'correspondent',   tags: ['formal'] },
  { word: 'functionary',     tags: ['formal', 'dismissive'] },
  { word: 'operative',       tags: ['formal', 'threatening'] },
  { word: 'apprentice',      tags: ['formal', 'dismissive'] },
  // rhetorical cluster (8)
  { word: 'straw-man',       tags: ['rhetorical', 'dismissive'] },
  { word: 'counter-example', tags: ['rhetorical', 'academic'] },
  { word: 'premise',         tags: ['rhetorical'] },
  { word: 'fallacy',         tags: ['rhetorical'] },
  { word: 'tautology',       tags: ['rhetorical'] },
  { word: 'corollary',       tags: ['rhetorical', 'academic'] },
  { word: 'red herring',     tags: ['rhetorical', 'absurd'] },
  { word: 'hand-wave',       tags: ['rhetorical', 'dismissive'] },
  // mystical cluster (10)
  { word: 'apparition',      tags: ['mystical'] },
  { word: 'revenant',        tags: ['mystical', 'threatening'] },
  { word: 'shade',           tags: ['mystical', 'petty'] },
  { word: 'phantom',         tags: ['mystical'] },
  { word: 'specter',         tags: ['mystical'] },
  { word: 'wraith',          tags: ['mystical'] },
  { word: 'ghoul',           tags: ['mystical', 'threatening'] },
  { word: 'familiar',        tags: ['mystical', 'dismissive'] },
  { word: 'cipher',          tags: ['mystical', 'dismissive'] },
  { word: 'omen',            tags: ['mystical', 'sarcastic'] },
  // chaotic cluster (14)
  { word: 'mess',            tags: ['chaotic', 'dismissive'] },
  { word: 'shambles',        tags: ['chaotic'] },
  { word: 'fiasco',          tags: ['chaotic', 'absurd'] },
  { word: 'débâcle',         tags: ['chaotic'] },
  { word: 'catastrophe-in-progress', tags: ['chaotic'] },
  { word: 'fire hazard',     tags: ['chaotic', 'threatening'] },
  { word: 'rolling disaster',tags: ['chaotic'] },
  { word: 'moving violation',tags: ['chaotic', 'formal'] },
  { word: 'ongoing situation', tags: ['chaotic', 'dismissive'] },
  { word: 'unravelling',     tags: ['chaotic'] },
  { word: 'wildfire',        tags: ['chaotic', 'threatening'] },
  { word: 'one-person riot', tags: ['chaotic'] },
  { word: 'public disturbance', tags: ['chaotic', 'formal'] },
  { word: 'walking concern', tags: ['chaotic'] },
];

const INSULT_VERBS = [
  // petty cluster (30)
  { word: 'mince',         tags: ['petty'] },
  { word: 'whine',         tags: ['petty'] },
  { word: 'fuss',          tags: ['petty'] },
  { word: 'fret',          tags: ['petty'] },
  { word: 'sulk',          tags: ['petty'] },
  { word: 'pout',          tags: ['petty'] },
  { word: 'simper',        tags: ['petty', 'sarcastic'] },
  { word: 'preen',         tags: ['petty', 'sarcastic'] },
  { word: 'wobble',        tags: ['petty', 'absurd'] },
  { word: 'flounder',      tags: ['petty', 'absurd'] },
  { word: 'fidget',        tags: ['petty'] },
  { word: 'titter',        tags: ['petty'] },
  { word: 'cringe',        tags: ['petty'] },
  { word: 'shrug',         tags: ['petty', 'dismissive'] },
  { word: 'mumble',        tags: ['petty'] },
  { word: 'natter',        tags: ['petty', 'absurd'] },
  { word: 'fritter',       tags: ['petty'] },
  { word: 'dawdle',        tags: ['petty'] },
  { word: 'fawn',          tags: ['petty', 'sarcastic'] },
  { word: 'grovel',        tags: ['petty', 'sarcastic'] },
  { word: 'snivel',        tags: ['petty'] },
  { word: 'snipe',         tags: ['petty'] },
  { word: 'twitter',       tags: ['petty', 'absurd'] },
  { word: 'fluster',       tags: ['petty'] },
  { word: 'flap',          tags: ['petty', 'absurd'] },
  { word: 'piddle',        tags: ['petty', 'absurd'] },
  { word: 'shilly-shally', tags: ['petty', 'absurd'] },
  { word: 'rabbit on',     tags: ['petty', 'absurd'] },
  { word: 'witter',        tags: ['petty', 'absurd'] },
  { word: 'huff',          tags: ['petty', 'sarcastic'] },
  // dismissive cluster (24)
  { word: 'shrug',         tags: ['dismissive'] },
  { word: 'wave away',     tags: ['dismissive'] },
  { word: 'sigh',          tags: ['dismissive'] },
  { word: 'roll your eyes',tags: ['dismissive', 'sarcastic'] },
  { word: 'change subject',tags: ['dismissive'] },
  { word: 'wander',        tags: ['dismissive'] },
  { word: 'wander off',    tags: ['dismissive'] },
  { word: 'doze',          tags: ['dismissive'] },
  { word: 'yawn',          tags: ['dismissive'] },
  { word: 'tune out',      tags: ['dismissive'] },
  { word: 'mutter',        tags: ['dismissive'] },
  { word: 'shuffle',       tags: ['dismissive', 'petty'] },
  { word: 'lose interest', tags: ['dismissive'] },
  { word: 'check the time',tags: ['dismissive'] },
  { word: 'walk past',     tags: ['dismissive'] },
  { word: 'look elsewhere',tags: ['dismissive'] },
  { word: 'change the topic', tags: ['dismissive'] },
  { word: 'forget the name', tags: ['dismissive'] },
  { word: 'lose your train of thought', tags: ['dismissive', 'absurd'] },
  { word: 'tap a foot',    tags: ['dismissive'] },
  { word: 'study a wall',  tags: ['dismissive', 'absurd'] },
  { word: 'pencil that in', tags: ['dismissive', 'sarcastic'] },
  { word: 'consider it later', tags: ['dismissive', 'sarcastic'] },
  { word: 'be otherwise engaged', tags: ['dismissive', 'formal'] },
  // booming cluster (18)
  { word: 'bellow',        tags: ['booming'] },
  { word: 'thunder',       tags: ['booming'] },
  { word: 'roar',          tags: ['booming'] },
  { word: 'rattle',        tags: ['booming', 'absurd'] },
  { word: 'demand',        tags: ['booming', 'rhetorical'] },
  { word: 'declare',       tags: ['booming', 'formal'] },
  { word: 'proclaim',      tags: ['booming', 'formal'] },
  { word: 'pronounce',     tags: ['booming', 'formal'] },
  { word: 'announce',      tags: ['booming'] },
  { word: 'broadcast',     tags: ['booming'] },
  { word: 'trumpet',       tags: ['booming', 'sarcastic'] },
  { word: 'rumble',        tags: ['booming', 'threatening'] },
  { word: 'shake the rafters', tags: ['booming', 'absurd'] },
  { word: 'split the air', tags: ['booming'] },
  { word: 'fill the room', tags: ['booming'] },
  { word: 'rattle the windows', tags: ['booming'] },
  { word: 'boom',          tags: ['booming'] },
  { word: 'shake fists',   tags: ['booming', 'threatening'] },
  // threatening cluster (16)
  { word: 'crumble',       tags: ['threatening', 'petty'] },
  { word: 'cower',         tags: ['threatening', 'petty'] },
  { word: 'flinch',        tags: ['threatening', 'petty'] },
  { word: 'tremble',       tags: ['threatening'] },
  { word: 'buckle',        tags: ['threatening'] },
  { word: 'fold',          tags: ['threatening', 'petty'] },
  { word: 'collapse',      tags: ['threatening'] },
  { word: 'wilt',          tags: ['threatening', 'petty'] },
  { word: 'crumple',       tags: ['threatening', 'petty'] },
  { word: 'shrink',        tags: ['threatening', 'petty'] },
  { word: 'shy away',      tags: ['threatening', 'petty'] },
  { word: 'shudder',       tags: ['threatening'] },
  { word: 'gulp',          tags: ['threatening', 'absurd'] },
  { word: 'pale',          tags: ['threatening'] },
  { word: 'tighten',       tags: ['threatening'] },
  { word: 'sweat',         tags: ['threatening', 'absurd'] },
  // academic / formal cluster (16)
  { word: 'lecture',       tags: ['academic', 'formal'] },
  { word: 'pontificate',   tags: ['academic', 'formal'] },
  { word: 'theorize',      tags: ['academic'] },
  { word: 'postulate',     tags: ['academic'] },
  { word: 'hypothesize',   tags: ['academic'] },
  { word: 'cite',          tags: ['academic'] },
  { word: 'footnote',      tags: ['academic', 'absurd'] },
  { word: 'argue',         tags: ['academic', 'rhetorical'] },
  { word: 'expound',       tags: ['academic', 'formal'] },
  { word: 'orate',         tags: ['formal', 'booming'] },
  { word: 'declaim',       tags: ['formal', 'booming'] },
  { word: 'recite',        tags: ['formal'] },
  { word: 'intone',        tags: ['formal'] },
  { word: 'enumerate',     tags: ['academic', 'rhetorical'] },
  { word: 'belabour',      tags: ['academic', 'dismissive'] },
  { word: 'opine',         tags: ['rhetorical', 'sarcastic'] },
  // rhetorical cluster (10)
  { word: 'object',        tags: ['rhetorical'] },
  { word: 'refute',        tags: ['rhetorical'] },
  { word: 'rebut',         tags: ['rhetorical'] },
  { word: 'dispute',       tags: ['rhetorical'] },
  { word: 'contradict',    tags: ['rhetorical'] },
  { word: 'qualify',       tags: ['rhetorical', 'dismissive'] },
  { word: 'caveat',        tags: ['rhetorical', 'dismissive'] },
  { word: 'parse',         tags: ['rhetorical', 'academic'] },
  { word: 'nitpick',       tags: ['rhetorical', 'petty'] },
  { word: 'quibble',       tags: ['rhetorical', 'petty'] },
  // chaotic cluster (14)
  { word: 'gibber',        tags: ['chaotic', 'absurd'] },
  { word: 'unravel',       tags: ['chaotic'] },
  { word: 'unspool',       tags: ['chaotic'] },
  { word: 'fall apart',    tags: ['chaotic'] },
  { word: 'come undone',   tags: ['chaotic'] },
  { word: 'detonate',      tags: ['chaotic', 'threatening'] },
  { word: 'fly apart',     tags: ['chaotic'] },
  { word: 'come unstuck',  tags: ['chaotic', 'absurd'] },
  { word: 'short-circuit', tags: ['chaotic', 'absurd'] },
  { word: 'cascade',       tags: ['chaotic'] },
  { word: 'spiral',        tags: ['chaotic'] },
  { word: 'go to pieces',  tags: ['chaotic'] },
  { word: 'lose the plot', tags: ['chaotic', 'absurd'] },
  { word: 'flail',         tags: ['chaotic', 'petty'] },
  // absurd cluster (40)
  { word: 'splutter',      tags: ['absurd', 'petty'] },
  { word: 'gobble',        tags: ['absurd'] },
  { word: 'wibble',        tags: ['absurd'] },
  { word: 'wibble-wobble', tags: ['absurd'] },
  { word: 'kerfuffle',     tags: ['absurd', 'chaotic'] },
  { word: 'palaver',       tags: ['absurd'] },
  { word: 'mither',        tags: ['absurd', 'petty'] },
  { word: 'faff',          tags: ['absurd', 'petty'] },
  { word: 'flap about',    tags: ['absurd', 'petty'] },
  { word: 'gallumph',      tags: ['absurd'] },
  { word: 'plod',          tags: ['absurd', 'dismissive'] },
  { word: 'trundle',       tags: ['absurd'] },
  { word: 'shamble',       tags: ['absurd'] },
  { word: 'pootle',        tags: ['absurd', 'petty'] },
  { word: 'flounce',       tags: ['absurd', 'petty', 'sarcastic'] },
  { word: 'galumph',       tags: ['absurd'] },
  { word: 'gallivant',     tags: ['absurd'] },
  { word: 'mooch',         tags: ['absurd', 'petty'] },
  { word: 'lurk',          tags: ['absurd', 'threatening'] },
  { word: 'loiter',        tags: ['absurd', 'petty'] },
  { word: 'meander',       tags: ['absurd', 'dismissive'] },
  { word: 'wallow',        tags: ['absurd', 'petty'] },
  { word: 'reek',          tags: ['absurd', 'dismissive'] },
  { word: 'curdle',        tags: ['absurd', 'threatening'] },
  { word: 'misfire',       tags: ['absurd', 'dismissive'] },
  { word: 'malfunction',   tags: ['absurd', 'dismissive'] },
  { word: 'sneeze theatrically', tags: ['absurd', 'sarcastic'] },
  { word: 'haunt a doorway', tags: ['absurd', 'mystical'] },
  { word: 'overstay your welcome', tags: ['absurd', 'sarcastic'] },
  { word: 'underwhelm a room', tags: ['absurd', 'dismissive'] },
  { word: 'inhabit a hallway', tags: ['absurd'] },
  { word: 'misplace a vowel', tags: ['absurd', 'petty'] },
  { word: 'mistake a noun', tags: ['absurd', 'dismissive'] },
  { word: 'over-explain a joke', tags: ['absurd', 'academic'] },
  { word: 'rehearse aloud', tags: ['absurd', 'sarcastic'] },
  { word: 'translate badly',tags: ['absurd', 'dismissive'] },
  { word: 'be small about it', tags: ['absurd', 'petty'] },
  { word: 'shed feathers', tags: ['absurd'] },
  { word: 'molt',          tags: ['absurd', 'petty'] },
  { word: 'rust',          tags: ['absurd', 'dismissive'] },
  // sarcastic cluster (12)
  { word: 'enthuse',       tags: ['sarcastic'] },
  { word: 'gush',          tags: ['sarcastic'] },
  { word: 'rave',          tags: ['sarcastic', 'booming'] },
  { word: 'wax lyrical',   tags: ['sarcastic', 'formal'] },
  { word: 'wax poetic',    tags: ['sarcastic'] },
  { word: 'bless',         tags: ['sarcastic'] },
  { word: 'congratulate yourself', tags: ['sarcastic'] },
  { word: 'try',           tags: ['sarcastic', 'dismissive'] },
  { word: 'really try',    tags: ['sarcastic'] },
  { word: 'bravely attempt', tags: ['sarcastic'] },
  { word: 'represent yourself', tags: ['sarcastic', 'formal'] },
  { word: 'do your best',  tags: ['sarcastic', 'dismissive'] },
  // mystical cluster (10)
  { word: 'haunt',         tags: ['mystical', 'threatening'] },
  { word: 'manifest',      tags: ['mystical'] },
  { word: 'discorporate',  tags: ['mystical', 'absurd'] },
  { word: 'fade',          tags: ['mystical', 'petty'] },
  { word: 'evaporate',     tags: ['mystical', 'absurd'] },
  { word: 'lurk in attics',tags: ['mystical', 'absurd'] },
  { word: 'occupy doorways', tags: ['mystical', 'absurd'] },
  { word: 'spook lightly', tags: ['mystical', 'absurd'] },
  { word: 'shimmer',       tags: ['mystical', 'sarcastic'] },
  { word: 'rattle chains', tags: ['mystical', 'absurd'] },
  // top-up additions to reach ≥200
  { word: 'misquote yourself', tags: ['dismissive', 'absurd'] },
  { word: 'circle the drain', tags: ['chaotic', 'absurd'] },
  { word: 'argue with a hat', tags: ['absurd', 'rhetorical'] },
  { word: 'apologise mid-threat', tags: ['threatening', 'absurd'] },
  { word: 'lecture a puddle', tags: ['academic', 'absurd'] },
  { word: 'announce yourself twice', tags: ['booming', 'absurd'] },
  { word: 'cite the wrong year', tags: ['academic', 'dismissive'] },
  { word: 'over-rehearse', tags: ['sarcastic', 'petty'] },
  { word: 'under-rehearse', tags: ['dismissive', 'absurd'] },
  { word: 'cluck',         tags: ['petty', 'absurd'] },
  { word: 'crow',          tags: ['booming', 'sarcastic'] },
  { word: 'preside over nothing', tags: ['formal', 'absurd'] },
];

const INSULT_ADJECTIVES = [
  // dismissive cluster (36)
  { word: 'mediocre',      tags: ['dismissive'] },
  { word: 'tedious',       tags: ['dismissive'] },
  { word: 'unconvincing',  tags: ['dismissive'] },
  { word: 'forgettable',   tags: ['dismissive'] },
  { word: 'derivative',    tags: ['dismissive', 'academic'] },
  { word: 'minor',         tags: ['dismissive', 'petty'] },
  { word: 'second-rate',   tags: ['dismissive', 'petty'] },
  { word: 'lukewarm',      tags: ['dismissive', 'absurd'] },
  { word: 'middling',      tags: ['dismissive'] },
  { word: 'passable',      tags: ['dismissive', 'sarcastic'] },
  { word: 'fine',          tags: ['dismissive', 'sarcastic'] },
  { word: 'adequate',      tags: ['dismissive', 'sarcastic'] },
  { word: 'serviceable',   tags: ['dismissive'] },
  { word: 'workmanlike',   tags: ['dismissive'] },
  { word: 'unremarkable',  tags: ['dismissive'] },
  { word: 'undistinguished', tags: ['dismissive', 'formal'] },
  { word: 'flat',          tags: ['dismissive'] },
  { word: 'dull',          tags: ['dismissive'] },
  { word: 'inert',         tags: ['dismissive', 'academic'] },
  { word: 'amateurish',    tags: ['dismissive'] },
  { word: 'half-baked',    tags: ['dismissive', 'absurd'] },
  { word: 'half-finished', tags: ['dismissive'] },
  { word: 'half-hearted',  tags: ['dismissive', 'petty'] },
  { word: 'unfinished',    tags: ['dismissive'] },
  { word: 'unproven',      tags: ['dismissive', 'academic'] },
  { word: 'untested',      tags: ['dismissive'] },
  { word: 'untalented',    tags: ['dismissive'] },
  { word: 'unstudied',     tags: ['dismissive', 'academic'] },
  { word: 'transparent',   tags: ['dismissive'] },
  { word: 'predictable',   tags: ['dismissive', 'sarcastic'] },
  { word: 'obvious',       tags: ['dismissive', 'sarcastic'] },
  { word: 'overcooked',    tags: ['dismissive', 'absurd'] },
  { word: 'overdone',      tags: ['dismissive'] },
  { word: 'overheated',    tags: ['dismissive', 'petty'] },
  { word: 'underwhelming', tags: ['dismissive'] },
  { word: 'long-winded',   tags: ['dismissive', 'academic'] },
  // petty cluster (24)
  { word: 'pathetic',      tags: ['petty', 'dismissive'] },
  { word: 'small',         tags: ['petty'] },
  { word: 'tiny',          tags: ['petty'] },
  { word: 'shrunken',      tags: ['petty'] },
  { word: 'embarrassing',  tags: ['petty', 'dismissive'] },
  { word: 'frankly humiliating', tags: ['petty', 'dismissive'] },
  { word: 'frankly embarrassing', tags: ['petty', 'dismissive'] },
  { word: 'mealy-mouthed', tags: ['petty', 'absurd'] },
  { word: 'wee',           tags: ['petty', 'absurd'] },
  { word: 'titchy',        tags: ['petty', 'absurd'] },
  { word: 'piddling',      tags: ['petty', 'absurd'] },
  { word: 'mingy',         tags: ['petty'] },
  { word: 'meagre',        tags: ['petty'] },
  { word: 'scant',         tags: ['petty'] },
  { word: 'paltry',        tags: ['petty'] },
  { word: 'measly',        tags: ['petty'] },
  { word: 'penny-pinching',tags: ['petty', 'sarcastic'] },
  { word: 'small-minded',  tags: ['petty', 'dismissive'] },
  { word: 'pinched',       tags: ['petty'] },
  { word: 'narrow',        tags: ['petty'] },
  { word: 'cramped',       tags: ['petty'] },
  { word: 'parochial',     tags: ['petty', 'formal'] },
  { word: 'provincial',    tags: ['petty', 'dismissive'] },
  { word: 'small-shaped',  tags: ['petty', 'absurd'] },
  // booming cluster (14)
  { word: 'thunderous',    tags: ['booming'] },
  { word: 'shrill',        tags: ['booming', 'petty'] },
  { word: 'shouting',      tags: ['booming'] },
  { word: 'loud',          tags: ['booming'] },
  { word: 'roaring',       tags: ['booming'] },
  { word: 'deafening',     tags: ['booming'] },
  { word: 'bellowing',     tags: ['booming'] },
  { word: 'thunderstruck', tags: ['booming', 'absurd'] },
  { word: 'thundering',    tags: ['booming'] },
  { word: 'over-loud',     tags: ['booming', 'petty'] },
  { word: 'overheard',     tags: ['booming', 'dismissive'] },
  { word: 'audible-from-three-rooms', tags: ['booming', 'absurd'] },
  { word: 'shouted',       tags: ['booming'] },
  { word: 'amplified',     tags: ['booming', 'sarcastic'] },
  // threatening cluster (14)
  { word: 'lethal',        tags: ['threatening'] },
  { word: 'feral',         tags: ['threatening', 'chaotic'] },
  { word: 'rabid',         tags: ['threatening', 'chaotic'] },
  { word: 'cornered',      tags: ['threatening', 'petty'] },
  { word: 'wounded',       tags: ['threatening', 'petty'] },
  { word: 'desperate',     tags: ['threatening', 'petty'] },
  { word: 'flailing',      tags: ['threatening', 'petty'] },
  { word: 'unhinged',      tags: ['threatening', 'chaotic'] },
  { word: 'snarling',      tags: ['threatening'] },
  { word: 'on-the-back-foot', tags: ['threatening', 'petty'] },
  { word: 'one-paragraph-from-tears', tags: ['threatening', 'absurd'] },
  { word: 'biting',        tags: ['threatening'] },
  { word: 'stabbing',      tags: ['threatening'] },
  { word: 'gnashing',      tags: ['threatening'] },
  // absurd cluster (45)
  { word: 'absurd',        tags: ['absurd'] },
  { word: 'damp',          tags: ['absurd', 'dismissive'] },
  { word: 'pungent',       tags: ['absurd', 'dismissive'] },
  { word: 'crinkly',       tags: ['absurd'] },
  { word: 'rumpled',       tags: ['absurd', 'petty'] },
  { word: 'unfolded',      tags: ['absurd'] },
  { word: 'half-laundered', tags: ['absurd', 'dismissive'] },
  { word: 'compost-shaped',tags: ['absurd', 'dismissive'] },
  { word: 'turnip-coloured', tags: ['absurd', 'petty'] },
  { word: 'badly translated', tags: ['absurd', 'dismissive'] },
  { word: 'autotranslated',tags: ['absurd', 'absurd'] },
  { word: 'haunted',       tags: ['absurd', 'mystical'] },
  { word: 'lightly cursed',tags: ['absurd', 'mystical'] },
  { word: 'badly cursed',  tags: ['absurd', 'mystical'] },
  { word: 'mildly enchanted', tags: ['absurd', 'mystical', 'petty'] },
  { word: 'unevenly fermented', tags: ['absurd'] },
  { word: 'second-week leftovers', tags: ['absurd', 'dismissive'] },
  { word: 'discount-bin',  tags: ['absurd', 'petty'] },
  { word: 'used-to-be-on-fire', tags: ['absurd'] },
  { word: 'almost-haunted',tags: ['absurd', 'mystical'] },
  { word: 'partially shouted', tags: ['absurd', 'booming'] },
  { word: 'spiritually clammy', tags: ['absurd', 'mystical'] },
  { word: 'narratively unstable', tags: ['absurd', 'chaotic'] },
  { word: 'rhetorically lukewarm', tags: ['absurd', 'rhetorical'] },
  { word: 'metaphorically damp', tags: ['absurd', 'dismissive'] },
  { word: 'literally inconvenient', tags: ['absurd', 'sarcastic'] },
  { word: 'borderline cabbage', tags: ['absurd'] },
  { word: 'almost-a-priest',tags: ['absurd', 'formal'] },
  { word: 'small-batch',   tags: ['absurd', 'petty'] },
  { word: 'briefly enchanted', tags: ['absurd', 'mystical'] },
  { word: 'self-published',tags: ['absurd', 'dismissive'] },
  { word: 'home-fermented',tags: ['absurd', 'dismissive'] },
  { word: 'occasionally lucid', tags: ['absurd', 'sarcastic'] },
  { word: 'allegorical',   tags: ['absurd', 'academic'] },
  { word: 'parabolic',     tags: ['absurd', 'academic'] },
  { word: 'overdetermined',tags: ['absurd', 'academic'] },
  { word: 'second-best at metaphors', tags: ['absurd', 'sarcastic'] },
  { word: 'goose-flavoured', tags: ['absurd', 'petty'] },
  { word: 'wet-paper',     tags: ['absurd', 'petty'] },
  { word: 'tepid',         tags: ['absurd', 'dismissive'] },
  { word: 'unsubscribed',  tags: ['absurd', 'sarcastic'] },
  { word: 'unfrosted',     tags: ['absurd', 'petty'] },
  { word: 'unwaxed',       tags: ['absurd'] },
  { word: 'unscrolled',    tags: ['absurd', 'mystical'] },
  { word: 'unscandalised', tags: ['absurd', 'sarcastic'] },
  // sarcastic cluster (16)
  { word: 'impressive',    tags: ['sarcastic'] },
  { word: 'fascinating',   tags: ['sarcastic'] },
  { word: 'remarkable',    tags: ['sarcastic'] },
  { word: 'astonishing',   tags: ['sarcastic'] },
  { word: 'breathtaking',  tags: ['sarcastic'] },
  { word: 'genuinely original', tags: ['sarcastic'] },
  { word: 'truly seminal', tags: ['sarcastic', 'academic'] },
  { word: 'absolutely cutting-edge', tags: ['sarcastic'] },
  { word: 'definitely a choice', tags: ['sarcastic', 'dismissive'] },
  { word: 'spirited',      tags: ['sarcastic'] },
  { word: 'enthusiastic',  tags: ['sarcastic', 'dismissive'] },
  { word: 'committed',     tags: ['sarcastic'] },
  { word: 'plucky',        tags: ['sarcastic', 'petty'] },
  { word: 'game',          tags: ['sarcastic', 'petty'] },
  { word: 'a-for-effort',  tags: ['sarcastic'] },
  { word: 'creative',      tags: ['sarcastic', 'dismissive'] },
  // mystical cluster (10)
  { word: 'eldritch',      tags: ['mystical'] },
  { word: 'spectral',      tags: ['mystical'] },
  { word: 'ethereal',      tags: ['mystical', 'sarcastic'] },
  { word: 'phantom-shaped',tags: ['mystical', 'absurd'] },
  { word: 'mildly cosmic', tags: ['mystical', 'absurd'] },
  { word: 'half-haunted',  tags: ['mystical', 'absurd'] },
  { word: 'discount-eldritch', tags: ['mystical', 'absurd', 'petty'] },
  { word: 'astrally inconvenient', tags: ['mystical', 'absurd'] },
  { word: 'celestially mediocre', tags: ['mystical', 'dismissive'] },
  { word: 'cosmically forgettable', tags: ['mystical', 'dismissive'] },
  // chaotic cluster (12)
  { word: 'incoherent',    tags: ['chaotic', 'dismissive'] },
  { word: 'unhinged',      tags: ['chaotic'] },
  { word: 'discombobulated', tags: ['chaotic', 'absurd'] },
  { word: 'unmoored',      tags: ['chaotic'] },
  { word: 'all-over-the-place', tags: ['chaotic'] },
  { word: 'one-step-ahead-of-collapse', tags: ['chaotic', 'absurd'] },
  { word: 'frothing',      tags: ['chaotic', 'threatening'] },
  { word: 'spluttering',   tags: ['chaotic', 'petty'] },
  { word: 'flying-by-the-seat-of-it', tags: ['chaotic', 'sarcastic'] },
  { word: 'unsupervised',  tags: ['chaotic', 'petty'] },
  { word: 'untreated',     tags: ['chaotic'] },
  { word: 'live-wire',     tags: ['chaotic', 'threatening'] },
  // academic / formal / rhetorical cluster (12)
  { word: 'long-winded',   tags: ['academic', 'dismissive'] },
  { word: 'overcited',     tags: ['academic'] },
  { word: 'pedantic',      tags: ['academic', 'petty'] },
  { word: 'circular',      tags: ['rhetorical'] },
  { word: 'tautological',  tags: ['rhetorical'] },
  { word: 'recursive',     tags: ['rhetorical', 'absurd'] },
  { word: 'overargued',    tags: ['rhetorical', 'dismissive'] },
  { word: 'underexplained',tags: ['rhetorical', 'dismissive'] },
  { word: 'over-formal',   tags: ['formal', 'dismissive'] },
  { word: 'starchy',       tags: ['formal', 'sarcastic'] },
  { word: 'stiff-collared',tags: ['formal', 'petty'] },
  { word: 'beige',         tags: ['formal', 'dismissive'] },
  // top-up additions to reach ≥200
  { word: 'twice-warmed',  tags: ['absurd', 'dismissive'] },
  { word: 'previously interesting', tags: ['sarcastic', 'dismissive'] },
  { word: 'aggressively normal', tags: ['sarcastic', 'dismissive'] },
  { word: 'professionally bewildered', tags: ['absurd', 'academic'] },
  { word: 'visibly improvising', tags: ['chaotic', 'sarcastic'] },
  { word: 'audibly out of ideas', tags: ['booming', 'dismissive'] },
  { word: 'rhetorically lopsided', tags: ['rhetorical', 'absurd'] },
  { word: 'spiritually crinkly', tags: ['mystical', 'absurd'] },
  { word: 'briefly correct', tags: ['sarcastic', 'academic'] },
  { word: 'occasionally upright', tags: ['sarcastic', 'absurd'] },
  { word: 'a-little-too-loud', tags: ['booming', 'petty'] },
  { word: 'a-little-too-quiet', tags: ['petty', 'dismissive'] },
  { word: 'mostly-bones',  tags: ['threatening', 'absurd'] },
  { word: 'mostly-rumour', tags: ['absurd', 'mystical'] },
  { word: 'half-a-thought',tags: ['absurd', 'petty'] },
  { word: 'twice-haunted', tags: ['mystical', 'absurd'] },
  { word: 'fully optional',tags: ['sarcastic', 'dismissive'] },
  { word: 'distinctly damp', tags: ['absurd', 'dismissive'] },
];

// Generic comeback templates by which tag the enemy WANTS to be insulted in.
// Used when the player's insult unfazes/backfires — gives the player a hint
// at which tag-flavor of word would have actually landed.
const INSULT_HINT_BY_TAG = {
  dismissive:  'Calling me boring would have stung harder than that.',
  petty:       'You\'d wound me more by going small.',
  threatening: 'Threats might actually move me.',
  booming:     'Speak louder. Make me hear you.',
  absurd:      'Try something genuinely absurd. That rattles me.',
  sarcastic:   'Sarcasm cuts deeper than sincere abuse.',
  mystical:    'Invoke something old and wrong.',
  formal:      'Adopt the proper register, would you?',
  academic:    'Cite a source. THAT would hurt.',
  rhetorical:  'Make an argument I can\'t refute.',
  chaotic:     'I prefer my insults a little unhinged.',
};

const INSULT_BACKFIRE_RETORTS = [
  'Is that all?',
  'I expect more from a real wizard.',
  'Your words slide off, and yours with them.',
  'You sound less like an insulter and more like an apologiser.',
  'My grandmother insulted me harder than this. Posthumously.',
];

// Map act number to the pool of sidequests available in that act.
// Postcard phrase pools for the Jazz Cafe quest. Generates short
// memorable five-word sentences the player must reproduce exactly.
const POSTCARD_NOUNS = ['umbrella','kettle','mountain','fish','door','window','song','shoe','star','moth','pen','cat','sparrow','lantern','cup','thread','bell','biscuit','sword','apple','cloud','stone','feather','kite','river','candle','letter','spoon','clock','chair'];
const POSTCARD_VERBS = ['forgives','remembers','forgets','follows','leaves','enters','opens','closes','sings','sleeps','wakes','waits','returns','rises','falls','mends','breaks','holds'];
const POSTCARD_ADJECTIVES = ['small','large','quiet','loud','cold','warm','patient','forgotten','old','new','tired','kind','distant','careful','clever','gentle'];
const POSTCARD_TEMPLATES = [
  ['the',     'adj',  'noun', 'verb', 'noun'],
  ['no',      'noun', 'verb', 'the',  'noun'],
  ['remember','the',  'noun', 'not',  'noun'],
  ['noun',    'verb', 'every','adj',  'noun'],
  ['adj',     'noun', 'verb', 'every','noun'],
  ['the',     'noun', 'verb', 'and',  'noun'],
];
function generatePostcardPhrase() {
  const tpl = POSTCARD_TEMPLATES[Math.floor(Math.random() * POSTCARD_TEMPLATES.length)];
  return tpl.map(slot => {
    if (slot === 'noun') return POSTCARD_NOUNS[Math.floor(Math.random() * POSTCARD_NOUNS.length)];
    if (slot === 'verb') return POSTCARD_VERBS[Math.floor(Math.random() * POSTCARD_VERBS.length)];
    if (slot === 'adj')  return POSTCARD_ADJECTIVES[Math.floor(Math.random() * POSTCARD_ADJECTIVES.length)];
    return slot;
  }).join(' ');
}

const SIDEQUESTS_BY_ACT = (() => {
  const map = {};
  for (const sq of Object.values(SIDEQUEST_TEMPLATES)) {
    (map[sq.act] = map[sq.act] || []).push(sq.id);
  }
  return map;
})();

// Materials — gathered at Material nodes during an act. Each slot has
// its own family. When the player visits a material node, three random
// variants from that slot's pool are rolled into a chooser (same shape
// as the old Arcane Workshop grove system). Stats here are placeholder
// signals that the crafting minigame (Commit 3) will roll into the
// final equipment card's per-slot mechanic.
// Each material has a UNIQUE mechanical identity within its slot —
// not a linear "more of the same stat" variant. Picking one is an
// archetype commitment, not a number comparison.
//
// Stat semantics by slot (buildCraftedEquipment consumes these):
//   STAFF (one-shot Effect card):
//     handler → base + multiplier (always primary)
//     loseHp   → loseHpOnPlay on the cast (Handler lever)
//     defense  → rider Block AND equipment bonus.damageReduction
//     dot      → rider Weak on cast + 'threatening' resonance
//     chance   → 50% bonus Vuln vs 50% self-Weak (Jnsq gamble)
//     jnsq     → 'absurd' resonance tag
//   ROBES (passive equipment):
//     defense  → permanent damageReduction (engine caps total at 2)
//     regen    → healOnCombatStart
//     draw     → extraStartHand on turn 1
//     vuln     → applies N enemy Vulnerable at combat start
//   RING (passive per-combat triggers):
//     defense  → permanent damageReduction
//     energy   → permanentEnergyBonus (+N per turn)
//     draw     → extraStartHand on turn 1
//     weak     → applies N enemy Weak at combat start
//   HAT (Power card → start-of-turn triggers):
//     block    → +N Block every turn
//     energy   → +N Energy every turn
//     draw     → +N Draw every turn
//     vuln     → applies N enemy Vulnerable every turn
const MATERIAL_TEMPLATES = {
  // v3.3 — staff material `power` stat (was handler). Lane-agnostic.
  // Each staff scales off the player's OWN lane at craft time (see
  // buildCraftedEquipment) — a wit-wizard's Maple Staff scales off wit,
  // a jnsq-wizard's off jnsq, etc.
  staff: [
    { id: 'mat-maple',    name: 'Maple Wood',  slot: 'staff', flavor: 'Clean grain, predictable yield.',
      stats: { power: 3 } },
    { id: 'mat-rosewood', name: 'Rosewood',    slot: 'staff', flavor: 'Heavy in the hand; quietly self-important. Every swing takes something from you.',
      stats: { power: 4, loseHp: 3 } },
    { id: 'mat-cedar',    name: 'Cedar',       slot: 'staff', flavor: "Smells of someone's grandmother. Smells of protection.",
      stats: { power: 2, defense: 2 } },
    { id: 'mat-madrone',  name: 'Madrone',     slot: 'staff', flavor: 'Burnished red. Reads the weather. Sometimes hits the wrong target.',
      stats: { power: 3, chance: 1 } },
    { id: 'mat-hemlock',  name: 'Hemlock',     slot: 'staff', flavor: "Slightly off in a way you can't place. The enemy noticed first.",
      stats: { power: 2, dot: 3 } },
  ],
  robes: [
    // Pure defensive baseline — damageReduction only.
    { id: 'mat-linen',       name: 'Linen Thread', slot: 'robes', flavor: 'Honest, plain, dependable. A robe that knows what a robe is for.',
      stats: { defense: 4 } },
    // Endurance tank — heals every combat, no DR.
    // Cycle 3 batch 5: relaunched at regen + extraStartHand. Different
    // identity from cycle 2's regen+draw (which dominated). Now Wild Silk
    // = "go-fast" robe (turn-1 hand size) for combo decks; competes with
    // burrgrass/wraithcloth but doesn't shadow them.
    { id: 'mat-wild-silk',   name: 'Wild Silk',    slot: 'robes', flavor: 'Cool to the touch, slightly haunted. It remembers the moth.',
      stats: { regen: 2, draw: 1 } },
    // Balanced hybrid — modest of everything.
    { id: 'mat-lichen',      name: 'Lichen Weave', slot: 'robes', flavor: 'Damp. Encouraging. Mildly photosynthetic.',
      stats: { defense: 1, regen: 1, draw: 1 } },
    // Card engine — heavy turn-1 draw, no defense.
    { id: 'mat-wraithcloth', name: 'Wraithcloth',  slot: 'robes', flavor: 'Drinks the light. Drinks several other things.',
      stats: { draw: 3 } },
    // Aggressive defender — DR + applies enemy Vuln at combat start.
    { id: 'mat-burrgrass',   name: 'Burrgrass',    slot: 'robes', flavor: 'Itches by design. The enemy will itch worse, eventually.',
      stats: { defense: 2, vuln: 1 } },
  ],
  ring: [
    // Passive DR ring — fits a defender build.
    { id: 'mat-iron',      name: 'Iron Ore',         slot: 'ring',  flavor: 'Plain. Reliable. Slightly rusted in places.',
      stats: { defense: 2 } },
    // Energy ring — +1 mana per turn (long-game compounder).
    { id: 'mat-copper',    name: 'Copper Ore',       slot: 'ring',  flavor: 'Conducts everything. Including embarrassment.',
      stats: { energy: 1 } },
    // Draw ring — +2 turn-1 hand size (combo enabler).
    { id: 'mat-silver',    name: 'Silver Ore',       slot: 'ring',  flavor: 'Bright, expensive, makes you feel watched.',
      stats: { draw: 2 } },
    // Debuff ring — applies enemy Weak at combat start + small DR.
    { id: 'mat-cold-iron', name: 'Cold Iron',        slot: 'ring',  flavor: 'Black, heavy, uncharmed. The fey would rather not.',
      stats: { weak: 1, defense: 1 } },
    // Combo ring — small bit of everything.
    { id: 'mat-mithril',   name: 'Mithril Filament', slot: 'ring',  flavor: 'Light as the idea of it. Suspiciously so.',
      stats: { energy: 1, draw: 1 } },
  ],
  hat: [
    // Per-turn block hat — defensive turn-by-turn.
    { id: 'mat-felt',          name: 'Felt',          slot: 'hat', flavor: 'Warm, forgiving, modestly opinionated.',
      stats: { block: 3 } },
    // Per-turn energy hat — the long-game power. Bigger spells every turn.
    { id: 'mat-suede',         name: 'Suede',         slot: 'hat', flavor: 'Stains if you look at it wrong. Apparently, magic.',
      stats: { energy: 1 } },
    // Hybrid hat — small block + small draw.
    { id: 'mat-tarred-canvas', name: 'Tarred Canvas', slot: 'hat', flavor: 'Waterproof, opinionated, smells of expedition.',
      stats: { block: 2, draw: 1 } },
    // Heavy draw hat — Wit-archetype enabler.
    { id: 'mat-brocade',       name: 'Brocade',       slot: 'hat', flavor: 'Heavy, ornate, deliberately ridiculous.',
      stats: { draw: 2 } },
    // Aggressive hat — applies enemy Vulnerable every turn.
    { id: 'mat-dragonwool',    name: 'Dragonwool',    slot: 'hat', flavor: 'Itches and shimmers and remembers the dragon. The enemy will, too.',
      stats: { vuln: 1 } },
  ],
};

// Skill events — found at Skill nodes on the map. Each event's `skill`
// field declares which craft it bumps; the map gen filters to skills
// whose act is still AHEAD of the player (you don't learn whittling
// the act after you've already built your staff). Resolver supports
// `fx.skill: { whittling: N }` etc. — see resolveEventChoice.
// Skill events use a "safe / risky / skip-with-bait" pattern. Every
// choice has a real trade so no option is dominated:
//   Safe pick   — +2 skill, no cost
//   Risky pick  — +4 skill but -1 MAX HP (permanent, not rest-healed)
//   Skip pick   — no skill but a real upside (HP heal, card, etc.)
const SKILL_EVENTS = [
  {
    id: 'skill-whittling-1',
    skill: 'whittling',
    title: 'A Mossy Whittling Block',
    flavor: 'A sturdy stump, a half-finished blank, and a knife with sentimental fingerprints. Someone left, presumably, before they were finished.',
    choices: [
      { label: 'Practice the long curve. (+2 Whittling, -8 HP)',             effects: { skill: { whittling: 2 }, loseHp: 8 } },
      { label: 'Carve until your hands cramp. (Trace the cut — up to +4 Whittling, -8 max HP)',    effects: { skill: { whittling: 4 }, maxHp: -8, minigame: 'trace-whittling' } },
      { label: 'Pocket the knife. Walk on. (+6 HP)',                          effects: { heal: 6 } },
    ],
  },
  {
    id: 'skill-whittling-2',
    skill: 'whittling',
    title: "Old Greb the Whittler",
    flavor: 'An old man sits beside the path, working a length of yew into a shape that does not declare itself. "Sit a while," he says. "I\'ll show you the trick. The trick is not what you think it is."',
    choices: [
      { label: 'Watch the trick. (+2 Whittling, -8 HP)',                     effects: { skill: { whittling: 2 }, loseHp: 8 } },
      { label: 'Sit for a long lesson. (Trace the cut — up to +4 Whittling, -8 max HP)',           effects: { skill: { whittling: 4 }, maxHp: -8, minigame: 'trace-whittling' } },
      { label: 'Decline. Old Greb gives you something instead. (+1 Common card)', effects: { gainCommonCard: 1 } },
    ],
  },
  {
    id: 'skill-weaving-1',
    skill: 'weaving',
    title: 'A Roadside Loom',
    flavor: 'It hums. Looms are not supposed to hum. This one is, apparently, an exception.',
    choices: [
      { label: 'Sit and practice. (+2 Weaving, -8 HP)',                      effects: { skill: { weaving: 2 }, loseHp: 8 } },
      { label: 'Try the difficult cross-warp. (+4 Weaving, -8 max HP)',      effects: { skill: { weaving: 4 }, maxHp: -8 } },
      { label: 'Step around it carefully. (+5 HP, it was warmer than it looked)', effects: { heal: 5 } },
    ],
  },
  {
    id: 'skill-weaving-2',
    skill: 'weaving',
    title: 'The Sewing Circle',
    flavor: 'Three women sit on a fence in a row. None of them speak. All of them sew. It is an enormous sock and they appear to be on the third foot.',
    choices: [
      { label: 'Join in. (+2 Weaving, -8 HP)',                               effects: { skill: { weaving: 2 }, loseHp: 8 } },
      { label: 'Stay until the fourth foot. (+4 Weaving, -8 max HP)',        effects: { skill: { weaving: 4 }, maxHp: -8 } },
      { label: 'Ask whose foot it is. (+1 Uncommon card)',                   effects: { gainUncommonCard: 1 } },
    ],
  },
  {
    id: 'skill-smithing-1',
    skill: 'smithing',
    title: 'A Travelling Forge',
    flavor: 'Coal smoke and a stranger pounding a hot bar into a shape you cannot, in the moment, identify. "Hold this," they say, before you have agreed to anything.',
    choices: [
      { label: 'Hold it. Carefully. (+2 Smithing, -8 HP)',                   effects: { skill: { smithing: 2 }, loseHp: 8 } },
      { label: 'Try the hammer yourself. (+4 Smithing, -8 max HP)',          effects: { skill: { smithing: 4 }, maxHp: -8 } },
      { label: 'Politely decline. (+1 Common card from the cart)',           effects: { gainCommonCard: 1 } },
    ],
  },
  {
    id: 'skill-smithing-2',
    skill: 'smithing',
    title: 'A Cooling Anvil',
    flavor: 'An anvil sits alone in a clearing, faintly warm. Around it: tongs, hammers, a kettle, and a brief note: BACK SHORTLY. PLEASE NO BANGING.',
    choices: [
      { label: 'Bang on it once, quietly. (+2 Smithing, -8 HP)',             effects: { skill: { smithing: 2 }, loseHp: 8 } },
      { label: 'Bang loudly. Take the consequences. (+4 Smithing, -8 max HP)', effects: { skill: { smithing: 4 }, maxHp: -8 } },
      { label: 'Read the note. Use the kettle. (+8 HP)',                     effects: { heal: 8 } },
    ],
  },
  {
    id: 'skill-felting-1',
    skill: 'felting',
    title: "A Milliner's Block",
    flavor: 'A wooden hat-block sits on a stump, slightly damp, alarmingly head-shaped. There are pins around it in the manner of a small ritual.',
    choices: [
      { label: 'Try a quick brimming exercise. (+2 Felting, -8 HP)',        effects: { skill: { felting: 2 }, loseHp: 8 } },
      { label: 'Block a felt with serious intent. (+4 Felting, -8 max HP)', effects: { skill: { felting: 4 }, maxHp: -8 } },
      { label: 'Tip your invisible hat at it. (+1 Common card)',             effects: { gainCommonCard: 1 } },
    ],
  },
  {
    id: 'skill-felting-2',
    skill: 'felting',
    title: 'The Old Hatter',
    flavor: '"It\'s about the brim," he tells you, before you have asked. "Everyone gets the crown right. The brim is where the wizard is."',
    choices: [
      { label: 'Study his brim work. (+2 Felting, -8 HP)',                  effects: { skill: { felting: 2 }, loseHp: 8 } },
      { label: 'Become an apprentice for the afternoon. (+4 Felting, -8 max HP)', effects: { skill: { felting: 4 }, maxHp: -8 } },
      { label: 'Argue about crowns. He throws you a hat. (+1 Uncommon card)', effects: { gainUncommonCard: 1 } },
    ],
  },
  // Cross-skill choice — pick which craft you'd rather invest in.
  // The "skip" path gives a real positive so it competes with the
  // skill picks (which are all currently +2, no cost — making this
  // the easy-mode skill node).
  {
    id: 'skill-crossroads',
    skill: 'any',
    title: 'A Crossroads Workshop',
    flavor: 'A tarp, a folding chair, and a sign: HALF AN HOUR\'S TUITION — PICK A CRAFT. The proprietor is asleep.',
    choices: [
      { label: '(Practice your weaving, if still relevant) (+2 Weaving, -8 HP)',   effects: { skill: { weaving: 2 }, loseHp: 8 } },
      { label: '(Practice your smithing, if still relevant) (+2 Smithing, -8 HP)', effects: { skill: { smithing: 2 }, loseHp: 8 } },
      { label: '(Practice your felting, if still relevant) (+2 Felting, -8 HP)',   effects: { skill: { felting: 2 }, loseHp: 8 } },
      { label: 'Leave the proprietor to it. (+6 HP, +1 Common card)',      effects: { heal: 6, gainCommonCard: 1 } },
    ],
  },
];

// Acts — four paths, one per equipment slot, with escalating
// difficulty. All four are ~15 rows long because Material and Skill
// nodes need room to compete with combat for the player's path
// budget. Slot order: robes → ring → hat → STAFF (the staff is the
// run's capstone item, crafted in the final act).
const ACTS = [
  { id: 1, slot: 'robes', name: 'The Thread Path',
    flavor: 'The countryside outside the town. Cottages with looms, threads worth walking miles for, and the things that walk between them. The right robes find the right wearer.',
    rows: 15, width: 4,
    bossId: 'e2-boss-tapestry',
    craft: 'weaving',
  },
  { id: 2, slot: 'ring',  name: 'The Forge Path',
    flavor: 'Down into the mines and cave systems beneath the hills. Coal, anvil, and a metal with opinions of its own. A ring earned in the dark fits no other hand.',
    rows: 15, width: 4,
    bossId: 'e3-boss-anvil',
    craft: 'smithing',
  },
  { id: 3, slot: 'staff', name: 'The Staff Path',
    flavor: 'The capstone. You walk into the deep forest to claim a staff fit to graduate with. The school will know if you return without it. The hat, mercifully, is provided.',
    rows: 15, width: 4,
    bossId: 'e1-boss-thornlord',
    craft: 'whittling',
  },
];

const SLOT_LABEL = { staff: 'Staff', robes: 'Robes', ring: 'Ring', hat: 'Hat', gem: 'Gem' };
const CRAFT_LABEL = { whittling: 'Whittling', weaving: 'Weaving', smithing: 'Smithing', felting: 'Felting' };

// Three wizard archetypes, one per lane. Selected at run start. Each
// commits the player to a specific voice + a specific (future) card pool.
// For now the only mechanical effect is that supply-shop offers are
// weighted toward the chosen lane's existing cards. When v2 pools ship
// (see design/{WIT,HANDLER,JNSQ}_V2_DESIGN.md), this field will switch
// the player's draw pool entirely.
const CHARACTERS = [
  {
    id: 'wit-scholar',
    name: 'The Scholar',
    lane: 'wit',
    voice: 'Hawkeye / Fleabag',
    title: 'graduates by being unkindly correct',
    desc: 'Spells land because they say what nobody else dares to phrase. Cuts through arguments like a librarian through a hangover.',
    poolDoc: 'design/WIT_V2_DESIGN.md',
    tagPalette: ['academic', 'dismissive', 'observational', 'ironic', 'cutting'],
  },
  {
    id: 'handler-bruiser',
    name: 'The Handler',
    lane: 'handler',
    voice: 'Pratchett menagerie-keeper / man who knows a guy with a bear',
    title: 'graduates by introducing the room to its predators',
    desc: "Spells are bait. Bait is patient. The bear is on its way — until then, here's a salmon flopping with surprising authority.",
    poolDoc: 'design/HANDLER_V2_DESIGN.md',
    tagPalette: ['patient', 'opportunist', 'fauna', 'ambush', 'wild'],
  },
  {
    id: 'jnsq-fool',
    name: 'The Fool',
    lane: 'jnsq',
    voice: 'Kramer / Charlie Kelly',
    title: 'graduates by going sideways through every door',
    desc: 'Spells land because nobody can find a foothold to disagree. The kitchen is rotating. Pay attention.',
    poolDoc: 'design/JNSQ_V2_DESIGN.md',
    tagPalette: ['mystical', 'absurd', 'chaotic', 'theatrical', 'conspiratorial'],
  },
];
const CHARACTERS_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

// =============================================================================
// 2. HELPERS
// =============================================================================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
let _uid = 0;
const uid = () => `u${++_uid}`;

// Roll a weighted-random intent from the enemy's behavior list. `excludeKinds`
// is an optional list of intent kinds to skip — used by the anti-repetition
// system so an enemy can't fire the same intent (e.g. 'block') 3+ turns in
// a row. Falls back to the full behavior list if every option is excluded
// (e.g. an enemy whose only behaviors share one kind).
function rollIntent(enemy, excludeKinds = []) {
  // E2E hook: ?forceMaul makes the next intent roll pick this enemy's maul
  // behavior (consumed once), so the maul render path is regression-testable
  // without hunting a fragile RNG seed. No-op when absent or enemy has no maul.
  if (typeof window !== 'undefined' && window.__forceMaul) {
    const maulB = enemy.behaviors.find(b => b.maul);
    if (maulB) { window.__forceMaul = false; return { ...maulB }; }
  }
  const filtered = enemy.behaviors.filter(b => !excludeKinds.includes(b.kind));
  const pool = filtered.length > 0 ? filtered : enemy.behaviors;
  const total = pool.reduce((s, b) => s + (b.weight || 1), 0);
  let roll = Math.random() * total;
  for (const b of pool) {
    roll -= (b.weight || 1);
    if (roll <= 0) return { ...b };
  }
  return { ...pool[0] };
}

// v3.4.7: optional `startingRow` (a WIT_ROWS entry) lets the wit player
// pick their starter row from any of the 15 available. Picked rows
// substitute for the default slowburn-4 starter; the row's intro/subject/
// target replace the basic starter cards. T1 power level is enforced at
// instance time by stamping stats: wit=1 + effect.base=2 + multiplier=2,
// matching the original Bouclé starter values.
function buildStartingDeck(lane = 'wit', opts = {}) {
  const startingRow = opts.startingRow || null;
  const ids = buildStarterDeckForLane(lane, startingRow);
  const cards = ids.map(id => ({ ...CARDS_BY_ID[id], uid: uid() }));
  if (lane === 'wit' && startingRow) {
    const rowIds = new Set([startingRow.introId, startingRow.subjectId, startingRow.targetId]);
    for (const card of cards) {
      if (!rowIds.has(card.id)) continue;
      // T1 stat override for the chosen row's cards. Deep-clones stats /
      // effect via spread so the source CARDS_BY_ID entries aren't mutated.
      if (card.slot === 'intro' || card.slot === 'subject') {
        card.stats = { ...(card.stats || {}), wit: 1 };
      } else if (card.slot === 'target' && card.effect) {
        card.effect = { ...card.effect, base: 2, multiplier: 2 };
      }
    }
  }
  return shuffle(cards);
}

// Return a new card object representing the upgraded version of `card`.
// The upgrade field can override `effects`, `power`, `cost`, `stats`,
// `effect`, or `phrase`. Sets `upgraded: true` and "+"-suffixes the name.
function upgradeCard(card) {
  if (card.upgraded) return card;
  // Explicit upgrade path (legacy v1 cards).
  if (card.upgrade) {
    const up = card.upgrade;
    const next = {
      ...card,
      uid: uid(),
      name: `${card.name}+`,
      upgraded: true,
      upgrade: null,
    };
    if (up.effects) next.effects = { ...card.effects, ...up.effects };
    if (up.power)   next.power   = { ...card.power, ...up.power };
    if (up.stats)   next.stats   = { ...card.stats, ...up.stats };
    if (up.effect)  next.effect  = { ...card.effect, ...up.effect };
    if (up.phrase !== undefined) next.phrase = up.phrase;
    if (up.cost !== undefined)   next.cost   = up.cost;
    return next;
  }
  // v2 sentence-engine auto-upgrade: any slot-typed card gets a tier-
  // appropriate buff. Intros/subjects gain +1 stat. Targets gain +2 base
  // damage. Modifiers gain +0.25 damage multiplier (or block bump if
  // they're defensive). All keep the same phrase but the card is marked
  // with a "+" suffix.
  const isV2 = card.slot && card.lane;
  if (isV2) {
    const baseName = card.name || card.phrase;
    const next = { ...card, uid: uid(), upgraded: true, name: `${baseName}+` };
    if (card.slot === 'intro' || card.slot === 'subject') {
      const lane = card.lane;
      next.stats = { ...card.stats, [lane]: (card.stats?.[lane] || 0) + 1 };
    } else if (card.slot === 'target' && card.effect) {
      next.effect = { ...card.effect, base: (card.effect.base || 0) + 2 };
    } else if (card.slot === 'modifier' && card.modifierEffect) {
      const me = card.modifierEffect;
      if (me.rider?.block) {
        next.modifierEffect = { ...me, rider: { ...me.rider, block: me.rider.block + 1 } };
      } else if (me.damageMult) {
        next.modifierEffect = { ...me, damageMult: me.damageMult + 0.25 };
      } else {
        // No clean upgrade hook → bump the lane stat instead.
        next.stats = { ...card.stats, [card.lane]: (card.stats?.[card.lane] || 0) + 1 };
      }
    } else if (card.slot === 'gesture' && card.gestureEffect) {
      // v2.18: gesture upgrade — bump damage +3 (the main payload) AND
      // any present rider value by +1. Falls back to damage-only.
      const ge = card.gestureEffect;
      const nextGE = { ...ge };
      nextGE.damage = (ge.damage || 0) + 3;
      if (ge.stripEnemyBlock) nextGE.stripEnemyBlock = ge.stripEnemyBlock + 2;
      if (ge.draw) nextGE.draw = ge.draw + 1;
      if (ge.rider) {
        const nextRider = { ...ge.rider };
        for (const k of Object.keys(nextRider)) {
          if (typeof nextRider[k] === 'number') nextRider[k] = nextRider[k] + 1;
        }
        nextGE.rider = nextRider;
      }
      next.gestureEffect = nextGE;
    } else if (card.slot === 'annotation' && card.annotationEffect) {
      // v2.18: annotation upgrade — +1 duration AND bump every numeric
      // effect value by 1. So Subtext-in-italics (bonusSpellDamage 4)
      // upgrades to 4 turns of +5 dmg/cast.
      next.duration = (card.duration || 3) + 1;
      const ae = card.annotationEffect;
      const nextAE = { ...ae };
      for (const k of Object.keys(nextAE)) {
        if (typeof nextAE[k] === 'number') nextAE[k] = nextAE[k] + 1;
      }
      next.annotationEffect = nextAE;
    } else {
      // v2.18: defensive catch-all — any v2 card slot we don't have an
      // explicit handler for still gets the lane-stat bump so the
      // upgrade flow never silently no-ops.
      next.stats = { ...card.stats, [card.lane]: (card.stats?.[card.lane] || 0) + 1 };
    }
    return next;
  }
  return card;
}

// Crafting output factory. Takes the chosen material + quality grade
// + skill level and produces either a CARD (for staff/hat — goes into
// the deck) or a stat-stick EQUIPMENT (for robes/ring — goes into the
// equipment[] slot). The two output shapes correspond to the per-slot
// mechanic decided in the design memo:
//   staff = one-shot drawable Effect
//   hat   = drawable Power
//   robes = permanent install via equipment bonus
//   ring  = per-turn tick via equipment bonus
//
// Quality multipliers: rough 0.5, fine 1.0, master 1.5.
const QUALITY_MULT = { rough: 0.5, fine: 1.0, master: 1.5 };
const QUALITY_LABEL = { rough: 'Rough', fine: 'Fine', master: 'Master' };

function buildCraftedEquipment({ slot, material, quality, skill, lane }) {
  const q = QUALITY_MULT[quality] ?? 1.0;
  const qLabel = QUALITY_LABEL[quality] || 'Fine';
  const matStats = material.stats || {};
  const mult = (v) => Math.max(1, Math.round((v || 0) * q));
  const namePrefix = `${qLabel} ${material.name}`;
  const craftedMeta = { slot, materialId: material.id, quality, skill };

  if (slot === 'staff') {
    // Drawable Effect card. Material's `power` stat shapes the numbers,
    // and the crafted staff scales off the player's OWN lane at craft
    // time — so a wit-wizard's Maple Staff is a wit-stat card, a
    // jnsq-wizard's is jnsq-stat, etc. Material identity (Rosewood
    // glass-cannon, Cedar defender, etc.) carries through riders.
    const power = matStats.power || 0;
    const baseAtk = mult(8 + power * 2);
    const multAtk = mult(2 + power);
    // v3.3: lane-agnostic — staff scales off the player's lane, falling
    // back to 'wit' if unknown.
    const castLane = lane || 'wit';
    const effect = {
      scaleBy: castLane,
      base: baseAtk,
      multiplier: multAtk,
      damageType: 'composure',
      exhaust: false,
    };
    const rider = {};
    if ((matStats.defense || 0) > 0) rider.block = mult(matStats.defense * 2);
    if ((matStats.dot || 0)     > 0) rider.weak  = matStats.dot;
    if (Object.keys(rider).length) effect.rider = rider;
    if ((matStats.loseHp || 0) > 0)  effect.loseHpOnPlay = matStats.loseHp;
    if ((matStats.chance || 0) > 0)  effect.chance = { prob: 0.5, success: { enemyVulnerable: 2 }, failure: { selfWeak: 1 } };
    const riderText = [];
    if (rider.block)         riderText.push(`Gain ${rider.block} Block`);
    if (rider.weak)          riderText.push(`apply ${rider.weak} Weak`);
    if (effect.loseHpOnPlay) riderText.push(`lose ${effect.loseHpOnPlay} HP`);
    if (effect.chance)       riderText.push(`50%: +2 Vuln / 50%: gain 1 Weak`);
    const laneLabel = castLane.charAt(0).toUpperCase() + castLane.slice(1);
    const card = {
      id: `eq-staff-${material.id}-${quality}`,
      name: `${namePrefix} Staff`,
      cost: 2,
      type: 'effect',
      lane: castLane,
      rarity: 'rare',
      slot: 'target',
      effect,
      phrase: '…and that is what the Staff says, and the Staff does not say it twice.',
      desc: `Cast: ${baseAtk} + ${laneLabel}×${multAtk} Composure${riderText.length ? '. ' + riderText.join('. ') + '.' : '.'}`,
      flavor: material.flavor,
      crafted: craftedMeta,
    };
    // Cedar also confers passive Defense (the staff has a guard).
    if ((matStats.defense || 0) > 0) card.bonus = { damageReduction: Math.max(0, Math.round(matStats.defense * q / 2)) };
    return { kind: 'card', card };
  }
  if (slot === 'hat') {
    // Drawable Power. Material stats map directly to startOfTurn keys.
    // No more "defense → DR" on hats — hats are turn-based effects.
    const turnBlock  = mult(matStats.block || 0);
    const turnEnergy = matStats.energy || 0; // integer, no quality scaling
    const turnDraw   = matStats.draw || 0;
    const turnVuln   = matStats.vuln || 0;
    const power = { startOfTurn: {} };
    if (turnBlock > 0)  power.startOfTurn.block      = turnBlock;
    if (turnEnergy > 0) power.startOfTurn.energy     = turnEnergy + (quality === 'master' ? 1 : 0);
    if (turnDraw > 0)   power.startOfTurn.draw       = turnDraw + (quality === 'master' ? 1 : 0);
    if (turnVuln > 0)   power.startOfTurn.vulnerable = turnVuln + (quality === 'master' ? 1 : 0);
    const descParts = [];
    if (power.startOfTurn.block)      descParts.push(`+${power.startOfTurn.block} Block`);
    if (power.startOfTurn.energy)     descParts.push(`+${power.startOfTurn.energy} Energy`);
    if (power.startOfTurn.draw)       descParts.push(`+${power.startOfTurn.draw} draw`);
    if (power.startOfTurn.vulnerable) descParts.push(`apply ${power.startOfTurn.vulnerable} Vulnerable`);
    const card = {
      id: `eq-hat-${material.id}-${quality}`,
      name: `${namePrefix} Hat`,
      cost: 1,
      type: 'power',
      rarity: 'rare',
      power,
      desc: `At the start of each turn: ${descParts.join(', ') || 'nothing (a Rough hat is mostly hat).'}`,
      flavor: material.flavor,
      crafted: craftedMeta,
    };
    return { kind: 'card', card };
  }
  if (slot === 'robes') {
    // Permanent install. defense→DR, regen→combat-start heal,
    // draw→turn-1 hand, vuln→applies enemy Vulnerable at combat start.
    const def   = Math.max(0, Math.round((matStats.defense || 0) * q / 2));
    const regen = matStats.regen || 0;
    const drawN = matStats.draw || 0;
    const vuln  = matStats.vuln || 0;
    const bonus = {};
    if (def > 0)   bonus.damageReduction  = def;
    if (regen > 0) bonus.healOnCombatStart = mult(regen * 2);
    if (drawN > 0) bonus.extraStartHand    = drawN + (quality === 'master' ? 1 : 0);
    if (vuln > 0)  bonus.startCombatVulnerable = vuln + (quality === 'master' ? 1 : 0);
    const descParts = [];
    if (bonus.damageReduction)        descParts.push(`+${bonus.damageReduction} Defense`);
    if (bonus.healOnCombatStart)      descParts.push(`Heal ${bonus.healOnCombatStart} HP at combat start`);
    if (bonus.extraStartHand)         descParts.push(`draw +${bonus.extraStartHand} on turn 1`);
    if (bonus.startCombatVulnerable)  descParts.push(`apply ${bonus.startCombatVulnerable} Vulnerable to enemy at combat start`);
    return {
      kind: 'equipment',
      equipment: {
        id: `eq-robes-${material.id}-${quality}`,
        name: `${namePrefix} Robes`,
        bonus,
        desc: descParts.join('. ') + '.',
        flavor: material.flavor,
        crafted: craftedMeta,
      },
    };
  }
  if (slot === 'ring') {
    // Per-combat triggers. defense→DR, energy→permanent energy,
    // draw→turn-1 hand, weak→applies enemy Weak at combat start.
    const bonus = {};
    if ((matStats.energy || 0)  > 0) bonus.permanentEnergyBonus = matStats.energy;
    if ((matStats.draw || 0)    > 0) bonus.extraStartHand       = matStats.draw + (quality === 'master' ? 1 : 0);
    if ((matStats.defense || 0) > 0) bonus.damageReduction      = Math.max(0, Math.round((matStats.defense || 0) * q / 2));
    if ((matStats.weak || 0)    > 0) bonus.startCombatWeak      = matStats.weak + (quality === 'master' ? 1 : 0);
    if (Object.keys(bonus).length === 0) bonus.damageReduction = 1;
    const descParts = [];
    if (bonus.permanentEnergyBonus) descParts.push(`+${bonus.permanentEnergyBonus} Energy per turn`);
    if (bonus.extraStartHand)       descParts.push(`draw +${bonus.extraStartHand} on turn 1`);
    if (bonus.damageReduction)      descParts.push(`+${bonus.damageReduction} Defense`);
    if (bonus.startCombatWeak)      descParts.push(`apply ${bonus.startCombatWeak} Weak to enemy at combat start`);
    return {
      kind: 'equipment',
      equipment: {
        id: `eq-ring-${material.id}-${quality}`,
        name: `${namePrefix} Ring`,
        bonus,
        desc: descParts.join('. ') + '.',
        flavor: material.flavor,
        crafted: craftedMeta,
      },
    };
  }
  return null;
}

// Pathetic salvage material used when the player gathered nothing for
// this act's slot. Boss-drop fallback; forces Rough quality.
function salvageMaterial(slot) {
  return {
    id: `salvage-${slot}`,
    name: 'Salvaged Scrap',
    slot,
    flavor: 'You found it on the boss. Frankly, you wish you had not.',
    stats: { defense: 1 },
  };
}

// v2.4: slot weights to keep target draws healthy as deck grows. Without
// these, the 25/25/15/10 (intro/subject/target/modifier) lane pools
// over-deliver intros/subjects exactly when the player needs targets.
const REWARD_SLOT_WEIGHTS = { target: 35, intro: 25, subject: 25, modifier: 15 };
// v2.60 / v2.64: a reward-pool card is "interesting" only if it brings a
// real mechanic. Targets/skills/powers/annotations/gestures qualify
// directly. WORD-slot cards (intro / subject) qualify only if they are
// UNCOMMON+ rarity OR have a high scaling stat (3+). Common intros and
// subjects — even with a `{ draw: 1 }` or `{ weak: 1 }` rider — read as
// "same generic stat-pump as the starter" per playtest, so they're
// filtered out regardless of trivial side-effects. Modifiers can be
// common (they carry distinct modifierEffect math). Same for targets.
function isInterestingReward(card) {
  if (card.effect) return true;
  if (card.type === 'power' || card.type === 'annotation' || card.type === 'skill' || card.type === 'gesture') return true;
  // Word slots get a tighter test — rarity and/or scaling.
  if (card.slot === 'intro' || card.slot === 'subject') {
    if (card.rarity === 'uncommon' || card.rarity === 'rare') return true;
    if (card.stats) {
      const maxStat = Math.max(0, ...Object.values(card.stats));
      if (maxStat >= 3) return true;
    }
    return false;
  }
  // Modifiers and anything else with an effects block keep the
  // permissive rule (they're not starter-shaped).
  if (card.effects && Object.keys(card.effects).length > 0) return true;
  if (card.stats) {
    const maxStat = Math.max(0, ...Object.values(card.stats));
    if (maxStat >= 3) return true;
  }
  return false;
}

function pickCardByRarity(rarityWeights = { common: 4, uncommon: 1 }, exclude = [], lane = null, opts = {}) {
  // Lane filter: only cards matching the player's lane OR lane-agnostic
  // utility cards (no `lane` field) qualify.
  // v2.99.3: DEFENSIVE — if `lane` is null (caller couldn't read the
  // active character), REJECT lane-specific cards instead of allowing
  // all. The prior shape was a bleed source: a wit player saw handler
  // cards if selectedCharacter was briefly unset (e.g. a render race
  // around startRun's clear+set sequence). Fail-safe means "no lane
  // info → only lane-agnostic c-* cards", never wrong-lane offers.
  const matchesLane = (c) => {
    if (c.notLanes && lane && c.notLanes.includes(lane)) return false; // Excluded for this lane
    if (!c.lane) return true;       // Lane-agnostic — always OK
    if (!lane)   return false;      // No active lane → reject lane-specific
    return c.lane === lane;
  };
  // v3.4.15 (Alan): spell pieces (intro/subject/target) are NEVER offered
  // as standalone rewards anywhere. They only enter the deck as FFT row
  // bundles from elite/boss combat. `opts.excludeSpellPieces` is true on
  // every combat-reward call.
  const isSpellPieceSlot = (c) => c.slot === 'intro' || c.slot === 'subject' || c.slot === 'target';
  // Wit-only — its spell-piece rewards only offer setId-tagged cards so every
  // offered intro/subject/target progresses an existing or new FFT row.
  // Handler retired FFT 2026-05-31 (Animal Summoner pivot).
  const setTaggedOnly = (c) => {
    if (lane !== 'wit') return true;
    if (!isSpellPieceSlot(c)) return true;
    return !!c.setId;
  };
  const supportOnly = (c) => !opts.excludeSpellPieces || !isSpellPieceSlot(c);
  // FFT-only cards (Tutor, intro/subject/target cost-cut powers, FFT amp
  // powers) are hidden from non-FFT lanes (Handler, JNSQ) since they have
  // no spell-piece staging to manipulate. Tagged via fftOnly: true on the
  // card data; new FFT-only cards just need the same flag to inherit this.
  const notFFTOnlyForNonFFTLanes = (c) => !c.fftOnly || lane === 'wit';
  const pool = CARDS.filter(c => rarityWeights[c.rarity] && !exclude.includes(c.id) && matchesLane(c) && isInterestingReward(c) && setTaggedOnly(c) && supportOnly(c) && notFFTOnlyForNonFFTLanes(c));
  if (pool.length === 0) return null;
  // Weight by rarity AND slot together.
  const weightOf = (c) => (rarityWeights[c.rarity] || 0) * (REWARD_SLOT_WEIGHTS[c.slot] || 10);
  const total = pool.reduce((s, c) => s + weightOf(c), 0);
  if (total <= 0) return pool[0];
  let r = Math.random() * total;
  for (const c of pool) {
    r -= weightOf(c);
    if (r <= 0) return c;
  }
  return pool[0];
}

function pickRelicByRarity(rarityWeights = { common: 3, uncommon: 2, rare: 1 }, excludeIds = [], lane = null) {
  // Lane-gated relics (e.g. FFT-only relics) never appear for other lanes —
  // their effect would be inert. A relic with no `lane` is universal.
  const pool = RELICS.filter(r => rarityWeights[r.rarity] && !excludeIds.includes(r.id)
    && (!r.lane || r.lane === lane));
  if (pool.length === 0) return null;
  const total = pool.reduce((s, r) => s + rarityWeights[r.rarity], 0);
  let r = Math.random() * total;
  for (const relic of pool) {
    r -= rarityWeights[relic.rarity];
    if (r <= 0) return relic;
  }
  return pool[0];
}

// STS-style branching DAG generator. Material + skill nodes are
// injected at fixed rows (3/7/11 = material, 5/9 = skill) so the
// player's route choice is deterministic at the strategic level —
// you can see "row 3 has the wood gather, route accordingly".
function generateActMap(rows, width) {
  // v3.4.33 (Alan): collapsed to a single linear path for now. Fixed
  // sequence per act:
  //   0 town → 1-3 combat → 4 elite → 5 rest → 6 material
  //         → 7-10 combat → 11 elite → 12 rest → 13 boss
  // The `rows` / `width` params are ignored — every act runs the same
  // 14-node path. Rendering uses width=1 (single column, centered).
  // Sidequest spur seeding skips linear maps (see seedSidequestSpurs).
  const SEQUENCE = [
    'town', 'combat', 'combat', 'combat', 'elite', 'rest', 'material',
    'combat', 'combat', 'combat', 'combat', 'elite', 'rest', 'boss',
  ];
  const totalRows = SEQUENCE.length;
  const totalCols = width || 4; // viewport width hint; node centers use col=0
  const nodes = [];
  for (let r = 0; r < totalRows; r++) {
    nodes.push({
      id: `n-${r}-0`, row: r, col: 0, type: SEQUENCE[r],
      x: spacedX(0, 1, totalCols), y: rowY(r, totalRows),
    });
  }
  const edges = {};
  for (let r = 0; r < totalRows - 1; r++) {
    edges[`n-${r}-0`] = [`n-${r + 1}-0`];
  }
  return { nodes, edges, linear: true };
}

// Module-level positioning helpers — hoisted out of generateActMap so
// seedSidequestSpurs / spawnRemainingSpur can use the same math without
// re-inlining it. Previously inlined twice and bit us once with a
// rowY-scope ReferenceError.
function spacedX(c, w, totalCols) {
  if (w === 1) return totalCols / 2;
  const pad = 0.5;
  return pad + (c * (totalCols - 1)) / (w - 1);
}
function rowY(r, totalRows) { return totalRows - 1 - r; }

// Add 0-1 sidequest hooks to a placed map. A "hook" is just the FIRST
// node of a sidequest — placed at a normal row, looking like any other
// event/combat (no special visual). Reachable from at least one row-prior
// main node. The REST of the sidequest chain spawns lazily on first
// engagement via spawnRemainingSpur, so the player doesn't see the
// chain until they commit. Each spur node consumes one row of progress,
// keeping the sidequest path at the same boss-distance as the main path.
function seedSidequestSpurs(map, actId, rows, cols) {
  if (!map) return map;
  // v3.4.33 — linear maps (single path) skip sidequest seeding so the
  // "one path" simplification stays one path.
  if (map.linear) return map;
  if (Math.random() > 0.6) return map;
  const pool = SIDEQUESTS_BY_ACT[actId] || [];
  if (pool.length === 0) return map;
  const sqId = pool[Math.floor(Math.random() * pool.length)];
  const tpl = SIDEQUEST_TEMPLATES[sqId];
  if (!tpl) return map;
  const spurLen = tpl.nodes.length;

  // Pick start row R. Boss shortcuts start earlier so the bypass meaningfully
  // skips later-act content. Loop-back quests need (spurLen) rows ahead of R
  // before hitting the pre-boss rest row.
  const minR = 1;
  const maxR = tpl.bossShortcut
    ? Math.min(3, rows - 3)
    : Math.max(minR, rows - 2 - spurLen);
  if (maxR < minR) return map;
  const startR = minR + Math.floor(Math.random() * (maxR - minR + 1));

  // First sidequest node: place at row R, right of the existing row R nodes.
  const existingInRow = map.nodes.filter(n => n.row === startR);
  const maxX = existingInRow.length > 0 ? Math.max(...existingInRow.map(n => n.x)) : (cols / 2);
  const firstBeat = tpl.nodes[0];
  const firstType = firstBeat.kind === 'combat' ? 'combat' : 'event';
  const firstNode = {
    id: `sq-${sqId}-0`,
    row: startR,
    col: -1,
    type: firstType,
    x: Math.min(cols - 0.3, maxX + 0.9),
    y: rowY(startR, rows),
    sidequestRef: { templateId: sqId, nodeIdx: 0 },
    // No isSidequest flag — looks identical to a normal node.
  };

  // Connect from at least one row-(startR-1) main node, picking the
  // rightmost so the visual flow makes geometric sense.
  const prevRow = map.nodes.filter(n => n.row === startR - 1);
  const newEdges = { ...map.edges };
  if (prevRow.length > 0) {
    const entry = prevRow.reduce((a, b) => (a.x > b.x ? a : b));
    newEdges[entry.id] = [...(newEdges[entry.id] || []), firstNode.id];
  }
  return { ...map, nodes: [...map.nodes, firstNode], edges: newEdges };
}

// =============================================================================
// 3. App
// =============================================================================

const STARTING_MAX_HP = 70;
// Composure — the player's "verbal HP." Some enemies (Tapestry's loom song,
// the Headmaster's withering remarks) target this instead of HP. Drops to 0
// = you lose your nerve = defeat. Block and Defense protect both pools.
const STARTING_MAX_COMPOSURE = 35;
// Each craft skill caps at this level. C3's crafting minigame reads
// the current level and widens the gauge / softens the chooser.
const SKILL_MAX = 5;
const ENERGY_PER_TURN = 3;
// v3.4.19 (Alan): hand 5 → 6. Eases the 3-piece spell assembly in a
// 5-card hand; full-FFT cast cadence was 2.8 turns/cast in playtest,
// not failing but the wait felt long. Combined with intro/target
// staging bonuses + juicier partial-row riders so non-cast turns
// generate tempo too.
const HAND_SIZE = 6;

// v3.4.19 — Solo staging bonus per slot ("every card useful right
// now"). Intros open with Block; targets land with chip damage.
// Subjects stay pure stat-banks — they're the specialist piece you
// build around. Layered onto card.effects in the playCard branches
// so per-card riders fire on top of the slot default.
const STAGE_SLOT_BONUS = {
  intro:  { block: 2 },
  target: { compDmg: 1 },
};
// Heal a fraction of max HP between acts (STS-style act transition heal).
// Cycle 3 batch 3: 0.40 → 0.55. Players reaching Act 3+ are too damaged
// to survive late-act bosses. Bigger between-act recovery gives a real
// shot at deep runs.
const INTER_ACT_HEAL_RATIO = 0.35; // v2.22: was 0.55 — too generous; 0.25 was too harsh. 0.35 lands middle.

// v2 tray initial state. The intro/subject/target/modifiers fields are the
// primary truth. Legacy fields (handler/wit/jnsq totals, tags, words array,
// effectCard) are computed mirrors kept populated for back-compat reads
// scattered through the older codebase (previewSway, certain log paths).
function initialV2Tray(overrides = {}) {
  return {
    intro: null, subject: null, target: null, modifiers: [],
    // tactic: persistent Handler-lane card occupying the modifier slot
    // (relabelled "Pack Tactics" for handler). Stays until replaced by
    // another tactic card. null when no tactic is active.
    tactic: null,
    handler: 0, wit: 0, jnsq: 0,
    phrases: [], tags: [], words: [],
    effectCard: null,
    effectFiredThisTurn: false,
    ...overrides,
  };
}

// Rebuild the legacy mirror fields from the v2 slot truth. Called any time
// we mutate intro / subject / target / modifiers. Handler Animal Summoner
// (2026-05-31): lure / animal envelopes can occupy intro/subject/target
// instead of raw cards — skip them when computing wit stat totals so the
// FFT damage formula doesn't see ghost stats.
function isSummonEnvelope(v) {
  return v && (v.kind === 'lure' || v.kind === 'animal');
}
function syncTrayLegacy(t) {
  const cards = [t.intro, t.subject, ...(t.modifiers || [])].filter(c => c && !isSummonEnvelope(c));
  const out = { handler: 0, wit: 0, jnsq: 0, phrases: [], tags: [], words: [...cards] };
  for (const c of cards) {
    out.handler += c.stats?.handler || 0;
    out.wit      += c.stats?.wit      || 0;
    out.jnsq     += c.stats?.jnsq     || 0;
    if (c.phrase) out.phrases.push(c.phrase);
    if (c.tags) out.tags.push(...c.tags);
  }
  const targetCard = isSummonEnvelope(t.target) ? null : t.target;
  return { ...t, ...out, effectCard: targetCard };
}

export default function App() {
  // Stage flow:
  //   menu → map → (combat / event / rest / reward) → map →
  //   act-cleared → map (next act) → ... → graduation / defeat
  //   Equipment is granted only on boss kill (Master tier). Forge
  //   nodes were removed in the simplification pass.
  const [stage, setStage] = useState('menu');

  // Run-wide player state
  const [maxHp, setMaxHp] = useState(STARTING_MAX_HP);
  const [hp, setHp] = useState(STARTING_MAX_HP);
  const [composureMax, setComposureMax] = useState(STARTING_MAX_COMPOSURE);
  const [composure, setComposure] = useState(STARTING_MAX_COMPOSURE);
  const [block, setBlock] = useState(0);
  // v2.9: dual-shield system. `block` (🛡) absorbs PHYSICAL damage; `poise`
  // (🪞) absorbs COMPOSURE damage. Both fade at the start of the enemy's
  // turn. Cards/relics that grant block default to the physical kind;
  // cards that grant poise are explicitly tagged with `poise:` in effects.
  const [poise, setPoise] = useState(0);
  // v2.9: Beetle's first-hit absorb — non-zero only while a combat is
  // ongoing AND the Beetle wielder hasn't yet taken a hit this fight.
  // Consumed once on the first attack the enemy lands; reset on combat
  // enter.
  const [beetleAbsorb, setBeetleAbsorb] = useState(0);
  const [energy, setEnergy] = useState(ENERGY_PER_TURN);
  const [deck, setDeck] = useState([]);
  const [hand, setHand] = useState([]);
  const [discard, setDiscard] = useState([]);
  const [exiled, setExiled] = useState([]);
  const [equipment, setEquipment] = useState([]);
  // Powers — `type: 'power'` cards live here for the duration of one combat
  // and fire their triggers (startOfTurn / endOfTurn / onEffectCardPlayed).
  // Cleared at combat start.
  const [powers, setPowers] = useState([]);
  // Relics — persistent across the whole run. Earned from elites / boss
  // kills / treasure nodes / events. Effects fire via the same hooks
  // dispatcher used by equipment + powers.
  const [relics, setRelics] = useState([]);
  // Relic-acquired announcement queue. Every grant path funnels through
  // grantRelic(), which enqueues here; the overlay shows the front of the
  // queue (name + what it does) and click-to-dismiss pops it. Queue (not
  // a single slot) so back-to-back grants don't swallow each other.
  const [relicToastQueue, setRelicToastQueue] = useState([]);
  // Familiar + chosen name. Both selected during the town intro (supply
  // shop → familiar shop → name screen) before the first map appears.
  // familiar.bonus is treated as a permanent effect source like a relic.
  const [familiar, setFamiliar] = useState(null);
  const [familiarName, setFamiliarName] = useState('');
  // Wizard archetype selected at run start. Determines lane bias for offers
  // and (when v2 card pools ship) the entire draw pool.
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  // Pending minigame prompt. Set when a skill-event choice carries a
  // `minigame` field — the resolver defers the effect, fires the
  // minigame, and applies a graded outcome based on the player's
  // performance instead of the deterministic effect.
  // Shape: { kind: 'trace-whittling', baseEffects: {...}, eventTitle: string }
  const [skillMinigame, setSkillMinigame] = useState(null);
  // Sidequest state. Spurs are now part of the placed map (see
  // seedSidequestSpurs). When the player walks onto a spur node,
  // resolveNodeEnter sets sidequestActive = { templateId, nodeIdx } and
  // routes to the appropriate stage. sidequestCombatActive is the flag
  // onEnemyDefeated reads to skip the normal reward flow.
  const [sidequestActive, setSidequestActive] = useState(null);
  const [sidequestCombatActive, setSidequestCombatActive] = useState(false);
  // Postcard mechanic (sq-jazz-cafe ongoing quest). State machine:
  //   idle      → no quest accepted yet
  //   active    → quest accepted, tracking node-counter
  //   completed → 3 correct sends made; next mailbox click is the reward
  //   failed    → wrong submission; fog active; next mailbox click rebukes
  //   done      → quest fully resolved (reward or rebuke applied)
  // postcardsCorrect counts only while state === 'active'.
  // nodesSincePostcard increments on every node entry; resets on submit.
  const [postcardState, setPostcardState] = useState('idle');
  const [postcardPhrase, setPostcardPhrase] = useState(null);
  const [postcardsCorrect, setPostcardsCorrect] = useState(0);
  const [nodesSincePostcard, setNodesSincePostcard] = useState(0);
  const [postcardModalOpen, setPostcardModalOpen] = useState(false);

  // Insult prompt — when player casts an insult card, this holds the
  // card + a slate of 3 random nouns/verbs/adjectives to pick from.
  // Shape: { card, phase, samples: { noun, verb, adjective }, picks: [] }
  const [insultPrompt, setInsultPrompt] = useState(null);
  // In-game menu / pause overlay.
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  // True if localStorage holds a saved run we can resume.
  const [hasSavedRun, setHasSavedRun] = useState(false);
  // Supply shop draft state. Cleared after exit.
  // v2.8: STS-style 1-of-3 supply shop. One card / one relic / one boon.
  // Shape: { card: <v2-card>, relic: <relic-obj>, boon: <boon-obj> }
  const [supplyOffers, setSupplyOffers] = useState(null);
  // Player debuffs (mirror of enemy ones). Tick down at end of turn.
  // Damage multipliers replace the old Weak/Vulnerable; see combat
  // state declarations below. Helpers clamp to [0.5, 1.5].
  // v3.4.84 (Alan): drift is gone. Each multiplier now carries a turn
  // counter (enemyDmgTurns / playerDmgTurns). Any shift refreshes that
  // counter to STATUS_DURATION; at end of turn the counter ticks down by
  // 1 and the multiplier SNAPS back to 1.0 when it hits 0. The magnitude
  // still stacks (more Saps = bigger −%), but the duration is now a clean
  // integer the player can read off the "In effect" badge instead of an
  // unpredictable fractional drift.
  const WEAK_VULN_DURATION = 3;
  const STATUS_DURATION = WEAK_VULN_DURATION;
  function adjustEnemyDmg(delta)  {
    setEnemyDmgMult(m  => Math.max(0.5, Math.min(1.5, m + delta)));
    setEnemyDmgTurns(STATUS_DURATION);
  }
  // v2.10: pull annotation effect value (0 if no annotation or key missing).
  function annoFx(key) { return enemy?.annotation?.effect?.[key] || 0; }
  function adjustPlayerDmg(delta) {
    setPlayerDmgMult(m => Math.max(0.5, Math.min(1.5, m + delta)));
    setPlayerDmgTurns(STATUS_DURATION);
  }
  // Weak/Vuln appliers fold straight into the multiplier + its turn timer;
  // expiry is handled centrally by the end-of-turn tick (no per-effect
  // scheduledEffect reversal anymore).
  function applyExpiringWeak(stacks) {
    if (!stacks) return;
    adjustEnemyDmg(-0.25 * stacks);
  }
  function applyExpiringVuln(stacks) {
    if (!stacks) return;
    adjustPlayerDmg(+0.25 * stacks);
  }
  // Attack counter for everyNthAttack relic hooks (resets each combat).
  // Count of effect cards cast this run (drives everyNthEffect relic).
  const [effectCount, setEffectCount] = useState(0);

  // Act + map state
  const [currentActIdx, setCurrentActIdx] = useState(0);
  const [map, setMap] = useState(null);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [clearedNodes, setClearedNodes] = useState([]);

  // Combat state
  const [enemy, setEnemy] = useState(null);
  const [enemyComposure, setEnemyComposure] = useState(0);
  const [enemyHp, setEnemyHp] = useState(0);
  const [enemyBlock, setEnemyBlock] = useState(0);
  // Synchronous mirrors of the three enemy damage pools. React batches
  // setState, so when several attacks resolve in ONE tick (the end-of-turn
  // animal loop, the On Three! re-attack loop, thorns, multi-hit) each
  // applyDamageToEnemy* call would otherwise read the same stale closure
  // value and the absolute setState calls clobber each other — only the
  // last hit lands. These refs accumulate within a tick; a useEffect
  // re-syncs them after any external setState (enemy turn, regen, init).
  const enemyComposureRef = useRef(0);
  const enemyHpRef = useRef(0);
  const enemyBlockRef = useRef(0);
  const [enemyIntent, setEnemyIntent] = useState(null);
  // v2.7: peeked next intent (from Jnsq's "the next thing you'll do"
  // subject). Cleared when the enemy actually fires that intent.
  const [peekedNextIntent, setPeekedNextIntent] = useState(null);
  // Track the last 2 intent kinds the enemy actually fired (in order).
  // Used to anti-repetition the next roll: if both are the same kind,
  // the next rollIntent excludes that kind. Reset per combat.
  const [lastIntentKinds, setLastIntentKinds] = useState([]);
  // Loom Familiar steal-cap counter (Alan, 2026-05-31): one discard-hand
  // steal per combat, total. Reset per combat.
  const [enemyDiscardCount, setEnemyDiscardCount] = useState(0);
  // Increments every time a new intent rolls. Used as a render key so
  // the intent box flashes empty-then-back even when the new intent is
  // the same KIND as the previous (e.g. Block after Block) — was hard
  // to tell anything had changed otherwise.
  const [intentTick, setIntentTick] = useState(0);
  // Damage multipliers — replace the old discrete Weak/Vulnerable
  // status. Each modifier card / enemy intent shifts the multiplier
  // by ±0.25, clamped to [0.5, 1.5]. Drifts 0.25 toward 1.0 each
  // end-of-turn so stacks don't lock the fight.
  //   enemyDmgMult  — applied to enemy outgoing damage (was: playerVuln +50%, enemyWeak -25%)
  //   playerDmgMult — applied to player outgoing spell damage (was: enemyVuln +50%, playerWeak -25%)
  const [enemyDmgMult, setEnemyDmgMult] = useState(1.0);
  const [playerDmgMult, setPlayerDmgMult] = useState(1.0);
  // Turn counters for the two multipliers. >0 means the status is live for
  // that many more turns; ticks down 1/turn and snaps its multiplier home
  // at 0. Refreshed to STATUS_DURATION on every shift (see adjustEnemyDmg /
  // adjustPlayerDmg). Surfaced in the "In effect" badges so the player can
  // see exactly how long Weak / Vulnerable will last.
  const [enemyDmgTurns, setEnemyDmgTurns] = useState(0);
  const [playerDmgTurns, setPlayerDmgTurns] = useState(0);
  // Iron Stomach — next handler cast this turn deals +N%. Number, not bool
  // (e.g., 0.5 = +50%). Consumed only when a handler-scaling cast fires.
  const [boostNextHandlerCast, setBoostNextHandlerCast] = useState(0);
  // Visceral feedback — short-lived state flipped when the enemy takes
  // damage. The CombatScreen reads these and applies the hit-shake
  // class + renders damage-number floaters.
  const [enemyHitFlash, setEnemyHitFlash] = useState(0);
  // Mirror of enemyHitFlash for the player HUD — flips when an enemy
  // intent actually lands damage on either pool. Re-keys the player card
  // so the same shake animation runs.
  const [playerHitFlash, setPlayerHitFlash] = useState(0);
  const [dmgFloaters, setDmgFloaters] = useState([]);

  // Push a damage floater + trigger the enemy hit-shake. Auto-removes
  // the floater after the animation duration.
  function showDamageFloater(amount, dmgType) {
    if (amount <= 0) return;
    const id = uid();
    setDmgFloaters(prev => [...prev, { id, amount, dmgType }]);
    setEnemyHitFlash(Date.now());
    setTimeout(() => {
      setDmgFloaters(prev => prev.filter(f => f.id !== id));
    }, 900);
  }

  // Spell tray — accumulates as the player plays word cards this turn.
  // `phrases` is the running list of fragment text; `effectFiredThisTurn`
  // tracks whether ANY effect card has resolved the tray (used to detect
  // fizzles at end-of-turn).
  const [tray, setTray] = useState(initialV2Tray());
  // Amplify escalates: 1st play costs base (1), every play after costs +1.
  // Resets per combat. The cap on playerDmgMult (1.5) already limits how
  // many times it does anything; the escalating cost stops you from cheaply
  // spamming it to reach the cap.
  const [amplifyPlaysThisCombat, setAmplifyPlaysThisCombat] = useState(0);
  // Sap escalates the same way as Amplify: each play this combat adds +1 to
  // its energy cost, so you can't cheaply spam toward the −50% floor.
  const [sapPlaysThisCombat, setSapPlaysThisCombat] = useState(0);
  // v2.9: hard cap on spell casts per turn. Was previously unbounded —
  // a 3-energy turn could comfortably stage+cast twice. Caps player
  // tempo so elites and bosses can actually pressure across multiple
  // rounds instead of getting one-shot.
  const [castsThisTurn, setCastsThisTurn] = useState(0);
  // v2.87: per-turn cast cap REMOVED. Was hard-capped at 1 (Babbling lifted
  // to 2) — but the user's intent for "rarely cast twice per turn" was
  // ABOUT ENERGY BALANCE, not a structural cap. If a player has the energy
  // to stage and cast multiple spells, they should be able to. The energy
  // economy (post-v2.59 wit subjects costing 1, v2.65 amp nerf, etc.) IS
  // the rate-limiter. Babbling's 0.6× 2nd-cast scalar is now vestigial
  // (still fires if installed, but nothing else gates multi-cast).
  const MAX_CASTS_PER_TURN = 99;
  // v2.13: per-combat cast counter (resets at combat enter).
  // Used by Thesis-expanded annotation's bonusSpellDamagePerCast scaling.
  const [castsThisCombat, setCastsThisCombat] = useState(0);
  // ALL IN (stakeAmount) ripped 2026-05-31 with the chutzpah → handler
  // pivot. computeSpellDamage in shared.js still accepts a stakeAmount in
  // its context object (legacy field), so we pass a constant 0 at call
  // sites instead of carrying state.
  const stakeAmount = 0;
  const setStakeAmount = () => {};
  // v2.12: jnsq CHAOS DICE — per-cast optional 1d6 roll that modifies
  // damage and adds side effects per a fixed outcome table. rollOptIn is
  // the toggle for the next cast; lastRoll is the most recent result
  // (for UI feedback); combatRolls is the history this combat (for
  // synergy cards like Cosmic Recoil).
  const [rollOptIn, setRollOptIn] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);
  // v2.89: prominent flash for chaos-die rolls. Was: pushLog only — easy
  // to miss in a busy combat log. Now we surface the die face + outcome
  // name + damage multiplier + side effects in a centered overlay that
  // auto-dismisses after 3.5s (or click to dismiss).
  const [chaosRollFlash, setChaosRollFlash] = useState(null);
  // v2.90: backfire smoother (per HUMAN_PLAY_PROFILE snapshot 5 — player
  // got 4 BACKFIREs in a row). Counts consecutive 1s within a combat;
  // when at 2, the next 1 is nudged to 2 (SPILLED IT) so a third
  // consecutive BACKFIRE never fires. Math is honest in the long run;
  // the smoother only kicks in at the rare emotional cliff. Resets on
  // every combat enter and on any non-1 roll.
  const [backfireStreak, setBackfireStreak] = useState(0);
  // v3.0 (architect refactor #1): collapsed 9 v2.93 + 2 v2.97 one-shot
  // trigger flags into a single pendingTriggers object. Each flag still
  // has the same name and setter shape — they're wrapped via the
  // makeTriggerSetter helper so existing call sites are unchanged. The
  // useState count for the App component dropped by 11 (architect's #11:
  // "useState count signals state fragmentation").
  //
  // Each key holds either `true` (boolean flags) or a number (value flags
  // like nextCastDamageMult, reflectNextDebuff, braceArmedDraw, riposteCharge).
  // The setter helper clears the key when set to `false`/`0`/`1.0` (the
  // neutral value) so the map stays trim. enterFight clears the whole map
  // in one call instead of 11 individual setX(0/false) calls.
  //
  // Captured-state vars (hpAtTurnStart, lastCastDamage, hpLossThisTurn)
  // stay as separate useState because they're snapshots/accumulators,
  // not one-shot triggers (architect's note on Bracing).
  const [pendingTriggers, setPendingTriggers] = useState({});
  const makeTriggerSetter = (key, neutral = false) => (next) => setPendingTriggers(prev => {
    const cur = prev[key];
    const value = typeof next === 'function' ? next(cur ?? neutral) : next;
    if (value === neutral || value === false || value === 0 || value === undefined || value === null) {
      if (!(key in prev)) return prev;
      const n = { ...prev }; delete n[key]; return n;
    }
    return { ...prev, [key]: value };
  });
  const reflectNextDebuff           = pendingTriggers.reflectNextDebuff ?? 0;
  const setReflectNextDebuff        = makeTriggerSetter('reflectNextDebuff', 0);
  const nextCastBonusEqualsLast     = !!pendingTriggers.nextCastBonusEqualsLast;
  const setNextCastBonusEqualsLast  = makeTriggerSetter('nextCastBonusEqualsLast');
  const nextCastBypassEff           = !!pendingTriggers.nextCastBypassEff;
  const setNextCastBypassEff        = makeTriggerSetter('nextCastBypassEff');
  const nextCastDamageMult          = pendingTriggers.nextCastDamageMult ?? 1.0;
  const setNextCastDamageMult       = makeTriggerSetter('nextCastDamageMult', 1.0);
  const nextCastDoubles             = !!pendingTriggers.nextCastDoubles;
  const setNextCastDoubles          = makeTriggerSetter('nextCastDoubles');
  const enemySkipNextAttack         = !!pendingTriggers.enemySkipNextAttack;
  const setEnemySkipNextAttack      = makeTriggerSetter('enemySkipNextAttack');
  const swapNextHitToComp           = !!pendingTriggers.swapNextHitToComp;
  const setSwapNextHitToComp        = makeTriggerSetter('swapNextHitToComp');
  const reflectNextHitAsComp        = !!pendingTriggers.reflectNextHitAsComp;
  const setReflectNextHitAsComp     = makeTriggerSetter('reflectNextHitAsComp');
  const bracingArmed                = !!pendingTriggers.bracingArmed;
  const setBracingArmed             = makeTriggerSetter('bracingArmed');
  const [hpAtTurnStart, setHpAtTurnStart] = useState(0);             // D-4 support — capture at turn start, compare at end
  const [lastCastDamage, setLastCastDamage] = useState(0);           // O-1 support — captured per cast
  // Tunnel Vision / RAGE machinery ripped 2026-05-31 with the chutzpah →
  // handler pivot. Handler combat is now Animal Summoner (lures + animals),
  // not a chip-and-spike rage meter.
  // v2.34: wit LONG THREAD — consecutive-turn scaling counter. Ticks +1
  // at end of every player turn where the player cast a wit Effect (target)
  // AND took zero unblocked HP damage. Block-absorbed hits DON'T break
  // the thread — that's the wit-defender's whole point. Taking actual
  // unblocked HP damage resets the meter to 0. Wit targets with
  // `threadScaling: N` add N × longThread flat damage on cast. Persists
  // across turns; resets between combats.
  const [longThread, setLongThread] = useState(0);
  // v3.3 FFT strategy tiers:
  //   scheduledEffects — unified over-time effect queue, each entry knows
  //     its `trigger` ('enemy-turn-start' | 'player-turn-start'), its
  //     `kind` ('damage' | 'weak' | 'vuln' | 'block' | 'draw' |
  //     'dormantDamage' | 'bankDouble'), `amount`, and `turnsRemaining`.
  //     Replaces v3.3-stage1's enemyDotStacks with a single mechanism
  //     that handles DoT, debuff-over-time, self-boons, and dormant
  //     delayed-payoff cards.
  //   thornsCharges — { amount, count, weakOnReflect } — next N enemy
  //     hits reflect amount, optionally apply weakOnReflect Weak each.
  //   wordsBank — Crescendo currency; +1 per card play.
  const [scheduledEffects, setScheduledEffects] = useState([]);
  const [thornsCharges, setThornsCharges] = useState({ amount: 0, count: 0, weakOnReflect: 0 });
  // v3.4.42 — Thorns redesign: mirrorReflectCharges holds N reflect-100%
  // hits (capped per hit). skipAndReturnArmed deals the skipped attack's
  // damage back to the enemy on the next-attack resolution.
  const [mirrorReflectCharges, setMirrorReflectCharges] = useState({ count: 0, capPerHit: 0 });
  const [skipAndReturnArmed, setSkipAndReturnArmed] = useState(false);
  // v3.4.45 — "You Know What I Mean": next cast's partial FFT resolves as full.
  const [partialAsFullArmed, setPartialAsFullArmed] = useState(false);
  // v3.4.57 — "The Tutor": next intro+subject same-row stage auto-pulls
  // the matching target from deck/discard. Consumed only on pull.
  const [tutorArmed, setTutorArmed] = useState(false);
  // v3.4.59 — "I Know Just What to Say": next card played costs 0.
  const [nextCardFree, setNextCardFree] = useState(false);
  // v3.4.59 — "Speechless": enemy's next intent (any kind) is skipped.
  const [enemySkipNextTurn, setEnemySkipNextTurn] = useState(false);
  // Kangaroo pouch (Alan 2026-06-05): the player ducks into the pouch (ends
  // their turn) and takes NO damage on the next enemy turn. Consumed at the
  // top of applyEnemyIntent.
  const [pouchGuard, setPouchGuard] = useState(false);
  // Per-turn activated-ability usage (slot names). Pigeon's scramble is once
  // per player turn; Mime self-consumes and Kangaroo ends the turn, so only
  // the persistent per-turn verbs need this gate. Reset at player-turn-start.
  const [abilitiesUsedThisTurn, setAbilitiesUsedThisTurn] = useState([]);
  // v3.4.59 — "I'll Take That as a Compliment": HP heal at end of turn for
  // damage absorbed by THIS card's block contribution. Stores the block
  // snapshot right after the card was played + the heal cap (5).
  const [complimentSnap, setComplimentSnap] = useState(null);
  // Defensive temp-HP buffer (formerly Ballooning school; kept as
  // a generic incoming-damage buffer that some events/relics could feed).
  // Loudness state ripped 2026-05-31 with the chutzpah → handler pivot.
  const [tempHp, setTempHp] = useState(0);
  const [tempHpTurns, setTempHpTurns] = useState(0);
  const [playerIncomingMult, setPlayerIncomingMult] = useState(1.0);
  const [playerIncomingMultTurns, setPlayerIncomingMultTurns] = useState(0);
  // v3.4.55 (Alan) — next-spell modifier flags. All single-use; consumed
  // on the next applicable cast. Reset per combat.
  const [nextSpellDoubleInitial, setNextSpellDoubleInitial] = useState(false);
  const [nextSpellDoubleDot, setNextSpellDoubleDot] = useState(false);
  const [nextSpellDoubleDefensive, setNextSpellDoubleDefensive] = useState(false);
  const [nextSpellAddDefensiveDot, setNextSpellAddDefensiveDot] = useState(false);
  const [nextSpellApplyToAll, setNextSpellApplyToAll] = useState(false);
  const [wordsBank, setWordsBank] = useState(0);
  // v3.4.23 — Crescendo "Build then Climax" mechanic. crescendoBuildup
  // counts full-FFT crescendo casts in this combat (0/1/2). Cast 1 deals
  // 0 damage. Cast 2 deals half. Cast 3 (the climax) deals full damage
  // multiplied by buildup × 3 AND consumes the bank. After climax,
  // buildup resets to 0 — multiple crescendos per combat are possible
  // but each requires a fresh 3-cast buildup.
  // crescendoBuildupRows tracks which row(s) drove each buildup cast.
  // If all 3 share the same setId, the climax cast gets a × 1.5 same-row
  // bonus — true "stars aligning" payoff.
  const [crescendoBuildup, setCrescendoBuildup] = useState(0);
  const [crescendoBuildupRows, setCrescendoBuildupRows] = useState([]);
  const [compendiumOpen, setCompendiumOpen] = useState(false);
  const [deckViewOpen, setDeckViewOpen] = useState(false);
  // Track whether the player took unblocked HP damage this turn — read at
  // end-of-turn by the long-thread bookkeeping. Reset at the start of every
  // player turn.
  const [unblockedThisTurn, setUnblockedThisTurn] = useState(false);
  // Track whether the player cast at least one wit Effect (target) this
  // turn. Read at end-of-turn by the long-thread bookkeeping. Reset at
  // the start of every player turn.
  const [castWitEffectThisTurn, setCastWitEffectThisTurn] = useState(false);
  // v2.35: FOOTNOTE prompt — set true when the player plays the
  // "As Hewn-Greaves notes in his footnotes," skill. While true, the
  // hand AND discard piles render their Word cards (intro/subject/
  // modifier) as clickable. Clicking one bumps that card instance's
  // `footnotes` count by 1 and clears the prompt. Esc / cancel dismisses
  // without applying. The skill is exhausted at play time either way —
  // the prompt is the payoff window.
  const [footnotePromptActive, setFootnotePromptActive] = useState(false);
  // Whistle prompt — armed by playing Whistle. Two-click flow: first click
  // sets whistlePick1Slot (any slot — lure / animal / empty); second click
  // swaps contents of the two slots and clears the prompt.
  const [whistlePromptActive, setWhistlePromptActive] = useState(false);
  const [whistlePick1Slot, setWhistlePick1Slot] = useState(null);
  // Treat prompt — armed by playing Treat. Next click on an animal slot
  // adds +1 to that animal's durationRemaining.
  const [treatPromptActive, setTreatPromptActive] = useState(false);
  // Just Eat It prompt — next click on a lure slot transforms that lure
  // into its animal immediately, recycling the lure card to discard via
  // the recycleToDiscard buffer.
  const [eatItPromptActive, setEatItPromptActive] = useState(false);
  // Butcher prompts — Last Supper (sacrifice an animal for Energy + draw)
  // and Gorge (extend +3, plus permanent +3 attack if already fed this turn).
  // Both are single-click animal-target prompts like Treat.
  const [sacrificePromptActive, setSacrificePromptActive] = useState(false);
  const [gorgePromptActive, setGorgePromptActive] = useState(false);
  // Well-Drilled power — armed on install. Next click on an animal slot gives
  // that animal (and every other copy of the same species on the board) a
  // permanent +2 attack for the rest of combat.
  const [wellDrilledPromptActive, setWellDrilledPromptActive] = useState(false);
  // House Rules power — armed on install. Next click on an animal slot gives
  // that animal (and every other copy of the same species on the board) +2
  // duration. Mirrors Well-Drilled's pick-an-animal shape (Alan, 2026-06-02).
  const [houseRulesPromptActive, setHouseRulesPromptActive] = useState(false);
  // The Whisperer power — animal departures bank a draw delivered into the
  // next turn's hand. Instant-play exits (Last Supper / Make It Count)
  // bump this during the turn; the end-of-turn tick adds its own departures
  // via a local accumulator. Flushed into the new hand at the refill block.
  const [whisperDrawsPending, setWhisperDrawsPending] = useState(0);
  // Open Door Policy power — the FIRST lure played each turn costs 0. This
  // flag flips once a lure is staged and resets at end of turn.
  const [firstLureUsedThisTurn, setFirstLureUsedThisTurn] = useState(false);
  // Buffet armed — the NEXT lure played fills EVERY empty stage slot at
  // once (single card consumed; one envelope per slot). Cleared on lure
  // play. Exhausts when played.
  const [buffetArmed, setBuffetArmed] = useState(false);
  // Refund stash for the just-played card that armed a targeting/Buffet prompt
  // (Treat / Gorge / Whistle / Last Supper / Just Eat It / Buffet /
  // Well-Drilled). If the player Dismisses the prompt instead of targeting,
  // the card snaps back to hand and its energy is refunded — dismissing an
  // unresolved prompt shouldn't burn the card. Holds the live card ref (same
  // uid it lands under in discard/exiled/powers) so cancel can pull it back.
  const [armedRefund, setArmedRefund] = useState(null);
  // Lure tutor picker — 'deck' | 'discard' | null. Set when a fetchLure card
  // (Rummage the Satchel / Back of the Bin) is played; opens an overlay to
  // pick which lure from that pile is pulled to hand. Cleared on pick/cancel.
  const [lurePickerSource, setLurePickerSource] = useState(null);
  // Lure narrowing (Acquired Taste) — per-combat map of lure cardId → array
  // of excluded animalIds. A narrowed lure drops those species from its
  // random summon pool, but never below 2 possible creatures (floor enforced
  // at exclusion time). Resets every combat. narrowChooserOpen drives the
  // pick-a-lure-then-a-species overlay.
  const [lureNarrowing, setLureNarrowing] = useState({});
  const [narrowChooserOpen, setNarrowChooserOpen] = useState(false);
  // Feeding ledger — feedKeys of lures played THIS turn. Resets at end of
  // turn. Used for fed-this-turn UI confirmation and to mark new feedReceived
  // on matching slots. The persistent feedReceived flag on each animal slot
  // is the actual gate for the exit bonus (Alan, 2026-05-31): feeding does
  // NOT extend duration — it unlocks the natural final turn AND the onExit
  // bonus. Unfed animals short-stay at their D-1 turn with no bonus.
  const [luresPlayedThisTurn, setLuresPlayedThisTurn] = useState([]);
  // upgradedAnimals — species IDs that have been trained to T2 at an Inn.
  // getAnimal(id) reads this set and merges ANIMALS[id].upgrade when present
  // so all downstream stat reads see the upgraded values. Persists across
  // combats within a run (set is run-wide state, not per-combat).
  const [upgradedAnimals, setUpgradedAnimals] = useState(() => new Set());
  const getAnimal = (id) => {
    const base = ANIMALS[id];
    if (!base) return base;
    if (upgradedAnimals.has(id) && base.upgrade) {
      return { ...base, ...base.upgrade };
    }
    return base;
  };
  // effectiveAnimals — precomputed merged table passed to UI so the
  // CombatScreen / slot pills see the upgraded stats too. Recomputes when
  // the upgradedAnimals set changes.
  const effectiveAnimals = (() => {
    const out = {};
    for (const [id, def] of Object.entries(ANIMALS)) {
      out[id] = (upgradedAnimals.has(id) && def.upgrade) ? { ...def, ...def.upgrade } : def;
    }
    return out;
  })();
  // narrowedPool — apply Acquired Taste exclusions to a lure's summon pool.
  // Given the lure's cardId and its full animalIds array, drops any excluded
  // species; if that would leave fewer than 2 options the exclusion is
  // ignored (floor of 2) so a lure is never reduced to a single species.
  const narrowedPool = (cardId, ids) => {
    if (!ids || ids.length === 0) return ids;
    const excluded = lureNarrowing[cardId];
    if (!excluded || excluded.length === 0) return ids;
    const kept = ids.filter(id => !excluded.includes(id));
    return kept.length >= 2 ? kept : ids;
  };
  // v2.85: pick-one-of-two-to-forget. When an event/sidequest fires the
  // loseRandomCard effect, pre-pick two candidates and surface a modal
  // so the player chooses which one to lose (not silent + not pure RNG).
  // Shape: { cards: [card, card], source: 'event/sidequest title' } | null
  const [forgetTwoPrompt, setForgetTwoPrompt] = useState(null);
  // v2.36: ACTUALLY— state. lastCastSnapshot captures the most recent cast
  // this turn (intro/subject/target/modifiers + the ctx that was used to
  // resolve damage). Reset to null at the start of every player turn AND
  // on combat entry. When the player plays the "Actually—" skill, the
  // refireLastCast effect re-computes damage from this snapshot at ×1.5
  // and applies it to the enemy. We deliberately re-fire DAMAGE ONLY
  // (no rider re-application, no annotation auto-attach, no tray clear)
  // so the side-effects don't double-trigger.
  //
  // arguingBackThisTurn is the player-side stacking debuff. Each Actually—
  // played this turn bumps it +1; enemy attacks this turn add this value
  // to their raw damage. Reset to 0 at end of every player turn.
  const [lastCastSnapshot, setLastCastSnapshot] = useState(null);
  const [arguingBackThisTurn, setArguingBackThisTurn] = useState(0);
  // v2.37: HOLD ON — wit's reactive interrupt. When the player plays the
  // "Hold on, hold on —" skill, holdOnArmed flips true and holdOnValue is
  // SNAPSHOTTED from the player's current longThread at play time (so a
  // later thread-tick or thread-break doesn't change the interrupt's
  // strength). On the very next enemy attack/attack-multi, the first
  // swing's `raw` value is reduced by holdOnValue (clamped at 0) and the
  // flag clears regardless of whether the reduction was meaningful (no
  // free re-cast — you spent the energy). Auto-clears at the START of the
  // player's NEXT turn if no enemy attack consumed it ("you only get to
  // interrupt the NEXT thing they say"). Reset to false / 0 in enterFight.
  const [holdOnArmed, setHoldOnArmed] = useState(false);
  const [holdOnValue, setHoldOnValue] = useState(0);
  // v2.38: SAYING SOMETHING WRONG — pending misstep tokens. Each entry is
  // `{ turnsRemaining: N }`. Created when Saying Something Wrong casts
  // (delay 2). Decrements at end of each player turn AFTER auto-play
  // resolves; when an entry reaches 0, a Misstep token card is delivered
  // into the new turn's hand during the endTurn pile-composition pass.
  // Reset to [] in enterFight (never persists between combats).
  //
  // missTepAutoPlayedThisTurn is the per-turn flag used by the UI banner
  // to surface that an auto-play just fired (so the player sees the cost
  // land even on a busy log). Reset every endTurn.
  const [pendingMissteps, setPendingMissteps] = useState([]);
  // v2.39: combatTurn ticks +1 at every endTurn (turn 1 on enterFight,
  // turn 2 after first endTurn, etc.). Used by UI displays and any
  // remaining turn-aware riders.
  const [combatTurn, setCombatTurn] = useState(1);
  // DOUBLING DOWN (cornerTokens), STORMING OUT (intentHidden +
  // stormOutFiredRef), SAYING IT LOUDER (loudCount) all ripped 2026-05-31
  // with the chutzpah → handler pivot. No card feeds them any more.
  const tutorFiredThisTurnRef = useRef(false);
  // Loom Familiar steal handoff. applyEnemyIntent runs DURING endTurn (after
  // the player's turn, before the new hand is drawn); endTurn then recomposes
  // every pile from closure values, which would silently overwrite any
  // setHand/setDiscard the steal did — recycling the "stolen" card right back.
  // So the steal records the taken cards here, and endTurn exiles them out of
  // the recycle pipeline before committing piles. Cleared each endTurn.
  const stolenCardsRef = useRef([]);
  // Loom Familiar hard cap: exactly one card-steal per combat. A ref (not
  // state) so it reads current synchronously inside applyEnemyIntent and the
  // end-of-turn re-roll, immune to the batched-setState staleness that let
  // the old enemyDiscardCount guard miss and re-roll a second steal. Reset
  // in enterFight.
  const loomStoleThisCombatRef = useRef(false);
  // Re-entrancy guard for onEnemyDefeated. The kill is detected from ~12 sites
  // (every composure/HP-to-0 path), each scheduling setTimeout(onEnemyDefeated,
  // 200). A single killing turn — especially a handler end-of-turn where
  // several animals each drop composure — fires multiple of those callbacks,
  // and `if (!enemy) return` doesn't stop them (enemy is never cleared on a
  // win). For a BOSS kill the body folds hand/discard/exiled/tray into the
  // deck; those piles are closure-constant, so each extra run re-folds them and
  // the whole deck duplicates. Latch on the first run; reset in enterFight.
  const enemyDefeatedHandledRef = useRef(false);
  // Spittle Peck (Rabid Scrubjay onExit): armed synchronously so the redirect
  // survives the same-endTurn stale-closure window between the animal tick and
  // applyEnemyIntent. Consumed (and cleared) when the enemy next attacks.
  const redirectEnemyAttackRef = useRef(false);
  // Maul (Alan, 2026-06-02): the handler end-of-turn tick writes the
  // post-tick board here so applyEnemyIntent — which runs later in the same
  // endTurn, after the tick's setTray has been queued but not yet flushed to
  // the `tray` closure — can read the CURRENT board synchronously. null for
  // non-handler lanes (no animals to maul).
  const boardForMaulRef = useRef(null);
  // Sloth (slowsEnemy, Alan 2026-06-03): toggles each enemy turn while a sloth
  // is on the board so the enemy skips every OTHER turn (time dilation). Reset
  // to false when no sloth is present so the cadence restarts cleanly.
  const slothSkipToggleRef = useRef(false);
  // Hollow Weaver (Alan, 2026-06-02): true once the player has dealt ANY
  // damage to the enemy this turn — a wit cast that hits OR a Handler animal
  // attack. Read at end-of-turn to decide whether the Weave fires. Tracked in
  // a ref (not state) so casts and the synchronous end-of-turn animal tick
  // both register before the weave check reads it in the same endTurn.
  const damagedEnemyThisTurnRef = useRef(false);
  // Composure damage dealt by a Weave fire this endTurn. The fire runs BEFORE
  // applyEnemyIntent in the same synchronous endTurn; applyEnemyIntent then
  // rebuilds the player's composure absolutely from the stale closure value
  // (`let wComp = composure`) and would clobber the fire's functional update.
  // Stash the fire amount here so wComp can subtract it — keeping both writes
  // consistent. Reset at turn start / combat start.
  const weaveFireDamageRef = useRef(0);
  const [tutorFlash, setTutorFlash] = useState(null);
  useEffect(() => {
    if (!tutorFlash) return;
    const id = setTimeout(() => setTutorFlash(null), 5000);
    return () => clearTimeout(id);
  }, [tutorFlash]);
  // HIT ME AGAIN reactive-recoil power ripped 2026-05-31 with the chutzpah
  // → handler pivot. The card no longer exists in the pool.
  // v2.33: Stubborn Block was removed (Power that converted unspent energy
  // to carry-over Block — wit-flavored on a lane whose defensive identity is
  // "bill them for the hit," not "accumulate Block").
  // v2.33: NOT LISTENING refactored from a Power to a one-shot SKILL.
  // notListeningCharges = number of pending "absorb the next debuff" tokens
  // (0 by default; +1 each time the player plays the "Sorry — what?" skill).
  // The on-cast Block rider from the old Power is GONE.
  const [notListeningCharges, setNotListeningCharges] = useState(0);
  // v2.96: Weave debt — Hollow Weaver applies stacks via 'weave' intent.
  // If the player ends a turn WITHOUT casting AND stacks > 0, the stacks
  // fire as composure damage and clear (see endTurn).
  const [weaveStacks, setWeaveStacks] = useState(0);
  // v2.97: Brace draws N at the start of next turn if no unblocked HP
  // damage landed this turn. Tracked: did the player take HP damage this
  // turn (`hpLossThisTurn`) + how many draws are armed.
  // v2.97 trigger flags — collapsed into pendingTriggers (v3.0).
  const braceArmedDraw             = pendingTriggers.braceArmedDraw ?? 0;
  const setBraceArmedDraw          = makeTriggerSetter('braceArmedDraw', 0);
  const riposteCharge              = pendingTriggers.riposteCharge ?? 0;
  const setRiposteCharge           = makeTriggerSetter('riposteCharge', 0);
  const [hpLossThisTurn, setHpLossThisTurn] = useState(0);
  // v3.0 multi-hit cards — Headbutt arms a per-swing reduction on the
  // next enemy attack. One-shot; cleared after the attack resolves.
  const [nextAttackSwingReduction, setNextAttackSwingReduction] = useState(0);
  // v3.1 multi-hit — Word in Edgewise: per-swing damage reduction that
  // ESCALATES with swing index (1st full, 2nd -1, 3rd -2, …). Min 0.
  // One-shot per arm; cleared after the next enemy attack resolves.
  const [escalatingSwingReduction, setEscalatingSwingReduction] = useState(false);
  const [combatRolls, setCombatRolls] = useState([]);
  // v2.44: TANGENT telemetry — counts fires (skill plays), targetsCast
  // (tray was complete + fired), wordsStaged (intro/subject/modifier from
  // discard), fizzles (target hit empty tray). Per-run counters; reported
  // via logEvent so the sim mirror keeps parity.
  const [tangentTelemetry, setTangentTelemetry] = useState({ fires: 0, targetsCast: 0, wordsStaged: 0, fizzles: 0 });
  // v2.45: APOLOGY telemetry. casts = skill plays; hpHealed = total HP gained
  // from the heal rider; trayDiscarded = cards moved tray → discard by the
  // reset (intro+subject+target+modifiers, summed across plays).
  const [apologyTelemetry, setApologyTelemetry] = useState({ casts: 0, hpHealed: 0, trayDiscarded: 0 });
  // v2.46: WON'T SHUT UP — commitment-chain flag. Armed when a target with
  // `mustPlayAnotherJnsq` resolves a cast. Cleared when ANY jnsq-lane card
  // is played AFTER the rider fired (the "kept going" path), OR at end of
  // turn (with a 3 HP penalty if still armed — the "stopped abruptly" path).
  // Telemetry: armed = total times rider fired; damage = times the 3 HP
  // landed; dodges = times the player kept going and dodged the penalty.
  const [wontShutUpArmed, setWontShutUpArmed] = useState(false);
  const [wontShutUpTelemetry, setWontShutUpTelemetry] = useState({ armed: 0, damage: 0, dodges: 0 });

  // v2.47: DRUNKEN CONFIDENCE — jnsq damage-trade Power. While installed:
  // every player Effect/Spell cast scales +50%, AND every enemy attack adds
  // +2 raw damage BEFORE block absorption (so block can still soak some of
  // the chunk). Removed explicitly via the "sober second thought," skill
  // (uninstallPower side effect). Installed state lives on the `powers`
  // array — checked via powers.some(p => p.installPower?.id === 'drunken-
  // confidence'). Telemetry: installs = power plays, castBonus = total
  // bonus damage from the +50%, incomingPenalty = total +2 chunks taken.
  const [drunkenTelemetry, setDrunkenTelemetry] = useState({ installs: 0, castBonus: 0, incomingPenalty: 0 });

  // v2.48: AWKWARD PAUSE — jnsq tray-hold mechanic. Two flags:
  //   - pauseHeld: set on play (this turn). At end-of-turn it graduates to
  //     pauseHeldActive (the doubling-pending bank) and itself clears.
  //   - pauseHeldActive: doubles every staged-card stat contribution on the
  //     NEXT cast. Cleared when the cast fires (single-use). If no cast
  //     fires, the flag stays armed and the doubling persists into the turn
  //     after (multi-turn buildup if the player is patient).
  // Telemetry: pauses = skill plays; doubledCasts = casts that benefited;
  // doubledExtraDamage = total damage delta (post-double minus would-have-
  // been-single, computed at cast time).
  const [pauseHeld, setPauseHeld] = useState(false);
  const [pauseHeldActive, setPauseHeldActive] = useState(false);
  const [awkwardPauseTelemetry, setAwkwardPauseTelemetry] = useState({ pauses: 0, doubledCasts: 0, doubledExtraDamage: 0 });

  // v2.49: BABBLING — jnsq Power that lifts the per-turn cast cap from 1 to
  // 2. Read path: powers.some(p => p.installPower?.id === 'babbling'). The
  // 2nd cast empties the tray as usual, so re-staging is required. Final
  // damage on the 2nd cast multiplies by 0.6 (applied post-effectiveness +
  // mults — same shape as drunken's +50%). Telemetry: installs = power
  // plays, secondCasts = casts that fired with castsThisTurn === 1, second-
  // CastDamage = total damage delivered by those 2nd casts.
  const [babblingTelemetry, setBabblingTelemetry] = useState({ installs: 0, secondCasts: 0, secondCastDamage: 0 });

  // v2.51: UNIVERSE-SIDEWAYS — synergy capstone metrics.
  //   casts            = total resolved casts of jv2-t-universe-sideways
  //   totalDamage      = sum of resolved damage (for avg-per-cast in reports)
  //   tangentOnCastFires = times the on-cast Tangent dispatcher fired (= casts)
  const [universeSidewaysTelemetry, setUniverseSidewaysTelemetry] = useState({
    casts: 0, totalDamage: 0, tangentOnCastFires: 0,
  });

  // v2.52: DRUNKEN STAGGER — jnsq's chaotic defense. `staggerActive` is set by
  // the "sorry, I lost my balance for a second," skill and persists until the
  // start of the next player turn (cleared at the very end of endTurn, AFTER
  // applyEnemyIntent has had its chance to roll dodges). Per-swing 50% roll
  // happens inside applyEnemyIntent's attack/attack-multi branch. Telemetry:
  // plays = skill plays, missesAvoided = swings that fully missed thanks to
  // stagger, damageAvoided = total raw damage prevented (post-multipliers,
  // pre-block — the swing simply zeroes out).
  const [staggerActive, setStaggerActive] = useState(false);
  const [staggerTelemetry, setStaggerTelemetry] = useState({ plays: 0, missesAvoided: 0, damageAvoided: 0 });

  // Tutorial — when active, a scripted Bursar fight teaches the verbal
  // combat system step-by-step. Step advances on specific player actions
  // (see advanceTutorialStep). `tutorialActive` short-circuits onEnemyDefeated
  // and applyDamageToPlayer's KO path so the player can learn safely.
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  // v2.71: which lane the player is practicing — drives lane-specific
  // step content in TutorialOverlay (signature mechanic explainer).
  const [tutorialLane, setTutorialLane] = useState('wit');

  // Reward / event / rest state
  const [rewardChoices, setRewardChoices] = useState([]);
  // v3.4.15 — when an elite/boss grants FFT rows, each entry is
  // { row: WIT_ROWS_ENTRY, cards: [card, card, card], tierBumped: bool }.
  // The reward screen renders rows when this is non-empty.
  const [rewardRowChoices, setRewardRowChoices] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [restNode, setRestNode] = useState(null);
  // When set, shows the "you received this card" modal. Used after
  // events / shops that hand the player cards silently. Shape:
  // { cards: [...card objects...], title?, body? } — null means no modal.
  const [cardGrantPrompt, setCardGrantPrompt] = useState(null);
  const [cardLossNotice, setCardLossNotice] = useState(null);
  const [materialGainNotice, setMaterialGainNotice] = useState(null);
  // v3.4.7: wit player's chosen starting row (WIT_ROWS entry). Survives
  // for the whole run so the Compendium / DeckView can highlight the
  // seeded school. null = non-wit run OR default-row (slowburn-4) wit.
  const [startingRow, setStartingRow] = useState(null);

  // v3.4.13 — Lab Mode: a sandbox for combat testing. Lets Alan pick any
  // wizard, customize the deck with any lane cards, then face any enemy
  // on repeat. Bypasses supply-shop, familiar-shop, map, and rewards.
  // `labMode` gates the post-combat short-circuit in onEnemyDefeated.
  // `labRepeatPrompt` holds {enemyName} when the post-fight modal is up.
  const [labMode, setLabMode] = useState(false);
  const [labRepeatPrompt, setLabRepeatPrompt] = useState(null);

  // ---- Crafting state (Commit 2: gather; Commit 3: craft) ----
  // Inventory of raw materials gathered per slot during this act and
  // carried forward. Each entry is a full material template (id, name,
  // slot, flavor, stats). At end-of-act crafting time (Commit 3) the
  // current act's slot is read out and used in the minigame.
  const [inventory, setInventory] = useState({ staff: [], robes: [], ring: [], hat: [] });
  // Skill levels — earned at Skill nodes. Persistent across acts but
  // only EARNED while the relevant act is still ahead (see
  // isSkillRelevant). Caps at SKILL_MAX.
  const [skills, setSkills] = useState({ whittling: 0, weaving: 0, smithing: 0, felting: 0 });
  // The chooser shown at a Material node: 3 randomly-rolled variants
  // of the current act's slot. null = no chooser open.
  const [materialChoices, setMaterialChoices] = useState(null);
  // The skill event currently being resolved. null = not on a skill node.
  const [activeSkillEvent, setActiveSkillEvent] = useState(null);
  // Crafting screen prompt — set when the act's boss is defeated and the
  // crafting flow opens. Shape:
  //   { slot, materials: [], skill: N, phase: 'choose' | 'gauge' | 'result',
  //     chosenMaterial: matObj | null, quality: 'rough'|'fine'|'master' | null,
  //     gaugeWidth: 0-1, result: cardObj | null }
  const [craftingPrompt, setCraftingPrompt] = useState(null);
  // v3.4.64 (Alan): on boss defeat, the player picks one FFT row they
  // own to upgrade (all 3 cards in that row). Fires BEFORE the crafting
  // prompt. Stored as { rows: [WIT_ROW], pendingCraftPrompt: {...} }.
  // After the player picks or skips, pendingCraftPrompt is launched.
  const [bossFftUpgradeChoice, setBossFftUpgradeChoice] = useState(null);
  // Card-upgrade picker at rest sites. When set, shows the deck and lets
  // the player pick one non-upgraded card to upgrade.
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Log
  const [log, setLog] = useState([]);
  const pushLog = (s) => {
    setLog(prev => [...prev.slice(-20), s]);
    // Relic firings always include 📿 in the log line — piggyback off
    // that convention to emit a telemetry event without instrumenting
    // every onCombatEnd / onEnemyDefeated / onTurnStart / onCardPlay
    // call site individually.
    if (typeof s === 'string' && s.includes('📿')) {
      logEvent('relic.fire', { message: s, hp, composure });
    }
  };

  const currentAct = ACTS[currentActIdx];

  // All passive-effect sources (relics + familiar bonus) flattened into a
  // single list of `{ effect, sourceName }` for the loops that read hooks.
  // Use this everywhere a relic loop reads `r.effect.*`.
  function effectSources() {
    const arr = relics.map(r => ({ effect: r.effect, sourceName: r.name }));
    if (familiar?.bonus) arr.push({ effect: familiar.bonus, sourceName: familiarName || familiar.species });
    return arr;
  }

  // Energy refill per turn — base + permanentEnergyBonus from equipment +
  // relics + familiar bonus.
  const energyPerTurnRefill = () => {
    return ENERGY_PER_TURN
      + equipment.reduce((s, eq) => s + (eq.bonus?.permanentEnergyBonus || 0), 0)
      + effectSources().reduce((s, x) => s + (x.effect?.permanentEnergyBonus || 0), 0);
  };
  // v3.4.56 — extra cards drawn per turn from relics / equipment.
  // Read into the start-of-turn hand draw + initial combat draw.
  const extraDrawPerTurn = () => {
    return effectSources().reduce((s, x) => s + (x.effect?.permanentDrawBonus || 0), 0)
         + equipment.reduce((s, eq) => s + (eq.bonus?.permanentDrawBonus || 0), 0);
  };
  // v3.4.56 — one-shot side effects when a relic is acquired (not on combat
  // entry — those are handled by onCombatStart in the existing pipeline).
  // Handles: maxComposurePlus, upgradeRandomCards, upgradeRandomFFTRow.
  // v3.4.64 — boss FFT upgrade choice resolution. setId = the picked
  // row id, or null if the player skipped. After resolution, kicks the
  // pending craft prompt and stages 'crafting'.
  function resolveBossFftUpgrade(setId) {
    const choice = bossFftUpgradeChoice;
    if (!choice) return;
    if (setId) {
      const upgradeRowCard = (c) => (c.setId === setId && !c.upgraded) ? upgradeCard(c) : c;
      setDeck(prev => prev.map(upgradeRowCard));
      setDiscard(prev => prev.map(upgradeRowCard));
      setHand(prev => prev.map(upgradeRowCard));
      setExiled(prev => prev.map(upgradeRowCard));
      const row = WIT_ROW_BY_ID[setId];
      pushLog(`📜 Upgraded FFT row "${row?.name || setId}" (all 3 cards).`);
    } else {
      pushLog(`📜 No FFT row upgraded (skipped).`);
    }
    setBossFftUpgradeChoice(null);
    setCraftingPrompt(choice.pendingCraftPrompt);
    setStage('crafting');
  }

  function applyRelicOnAcquire(relic) {
    const on = relic?.effect?.onAcquire;
    if (!on) return;
    if (on.maxComposurePlus) {
      const amt = on.maxComposurePlus;
      setComposureMax(m => m + amt);
      setComposure(c => c + amt);
      pushLog(`📿 ${relic.name}: +${amt} max Composure.`);
    }
    if (on.upgradeRandomCards) {
      const want = on.upgradeRandomCards;
      // Look in deck + discard + hand. Skip cards already upgraded.
      // Pick `want` random non-upgraded cards across all piles, then
      // commit per-pile updates.
      const buckets = [
        { name: 'deck', list: deck, setter: setDeck },
        { name: 'discard', list: discard, setter: setDiscard },
        { name: 'hand', list: hand, setter: setHand },
      ];
      const eligible = [];
      for (const b of buckets) {
        b.list.forEach((c, i) => { if (!c.upgraded) eligible.push({ bucket: b.name, idx: i, card: c }); });
      }
      // Shuffle eligible and take first `want`.
      const shuffled = shuffle(eligible).slice(0, want);
      const upgradedNames = [];
      for (const b of buckets) {
        const picksInBucket = shuffled.filter(p => p.bucket === b.name);
        if (picksInBucket.length === 0) continue;
        const idxSet = new Set(picksInBucket.map(p => p.idx));
        b.setter(prev => prev.map((c, i) => {
          if (!idxSet.has(i)) return c;
          const up = upgradeCard(c);
          upgradedNames.push(up.name);
          return up;
        }));
      }
      if (upgradedNames.length > 0) {
        pushLog(`📿 ${relic.name}: upgraded ${upgradedNames.join(', ')}.`);
      } else {
        pushLog(`📿 ${relic.name}: no eligible cards to upgrade.`);
      }
    }
    if (on.upgradeFamiliar) {
      if (!familiar) {
        pushLog(`📿 ${relic.name}: no familiar to upgrade.`);
      } else if (familiar.upgraded) {
        pushLog(`📿 ${relic.name}: ${familiar.species} is already at Tier 2.`);
      } else if (!familiar.bonusUpgrade) {
        pushLog(`📿 ${relic.name}: ${familiar.species} has no Tier 2 (unknown familiar).`);
      } else {
        const before = familiar.bonus || {};
        const after = familiar.bonusUpgrade || before;
        const hpDelta = (after.maxHp || 0) - (before.maxHp || 0);
        setFamiliar(f => f ? { ...f, bonus: f.bonusUpgrade || f.bonus, upgraded: true, desc: f.upgradeDesc || f.desc } : f);
        if (hpDelta > 0) {
          setMaxHp(m => m + hpDelta);
          setHp(h => h + hpDelta);
        }
        pushLog(`📿 ${relic.name}: ${familiar.species} upgraded to Tier 2.`);
      }
    }
    if (on.upgradeRandomFFTRow) {
      // Find FFT rows the player owns at least one card of.
      const owned = {};
      for (const list of [deck, discard, hand, exiled]) {
        for (const c of list) {
          if (c.setId) owned[c.setId] = true;
        }
      }
      const candidateRows = Object.keys(owned);
      if (candidateRows.length === 0) {
        pushLog(`📿 ${relic.name}: no FFT rows owned yet.`);
      } else {
        const pickedRow = candidateRows[Math.floor(Math.random() * candidateRows.length)];
        const upgradeRowCard = (c) => (c.setId === pickedRow && !c.upgraded) ? upgradeCard(c) : c;
        setDeck(prev => prev.map(upgradeRowCard));
        setDiscard(prev => prev.map(upgradeRowCard));
        setHand(prev => prev.map(upgradeRowCard));
        const row = WIT_ROW_BY_ID[pickedRow];
        pushLog(`📿 ${relic.name}: upgraded FFT row "${row?.name || pickedRow}" (all 3 cards).`);
      }
    }
  }

  // Single funnel for every relic grant. Adds to state, fires one-shot
  // onAcquire effects, logs, and queues the "Relic Acquired" overlay so
  // the player actually notices the pickup (previously: silent pushLog
  // only, relics just appeared in the map-screen state bar).
  function grantRelic(relic, source) {
    if (!relic) return;
    setRelics(prev => [...prev, relic]);
    pushLog(`📿 ${source}: ${relic.name}.`);
    applyRelicOnAcquire(relic);
    setRelicToastQueue(q => [...q, { relic, source }]);
  }

  // ---------- TUTORIAL ----------
  // Scripted practice match. Reset player state, build a small fixed
  // deck, force the opening hand so the player always has a Word + a
  // matching Effect on turn 1, and enter combat against the Bursar.
  // Save / Load -------------------------------------------------------------
  // We persist only when the player chooses Save & Quit from the in-game
  // menu. Combat / sidequest-beat states aren't safe to save mid-flight
  // (closure-stale refs, animation timing), so save is only enabled while
  // stage === 'map'. Run state shape is versioned so we can invalidate
  // saves cleanly if the data model changes.
  const SAVE_KEY = 'wg-saved-run-v1';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) setHasSavedRun(true);
    } catch (_) { /* localStorage unavailable; just don't show Continue */ }
  }, []);

  // Keep the synchronous enemy-pool mirrors in lockstep with state after any
  // external setState (enemy turn, regen, init). The applyDamageToEnemy*
  // functions also write these refs synchronously so within-tick accumulation
  // is correct; this effect catches every other mutation path.
  useEffect(() => { enemyComposureRef.current = enemyComposure; }, [enemyComposure]);
  useEffect(() => { enemyHpRef.current = enemyHp; }, [enemyHp]);
  useEffect(() => { enemyBlockRef.current = enemyBlock; }, [enemyBlock]);

  // v2.89: auto-dismiss the chaos-roll flash after 3.5s. Player can also
  // click to dismiss early via the modal's backdrop.
  useEffect(() => {
    if (!chaosRollFlash) return;
    const id = setTimeout(() => setChaosRollFlash(null), 3500);
    return () => clearTimeout(id);
  }, [chaosRollFlash]);

  function saveRunSnapshot() {
    if (stage !== 'map') return false;
    const snapshot = {
      v: 1,
      maxHp, hp, composureMax, composure, energy,
      deck, hand, discard, exiled,
      inventory, skills,
      equipment, powers, relics,
      familiar, familiarName,
      selectedCharacterId: selectedCharacter?.id || null,
      effectCount,
      currentActIdx, map, currentNodeId, clearedNodes,
      sidequestActive,
      log: log.slice(-50),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
      setHasSavedRun(true);
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadRunSnapshot() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return false;
      setMaxHp(s.maxHp); setHp(s.hp);
      setComposureMax(s.composureMax); setComposure(s.composure);
      setBlock(0); setEnergy(s.energy);
      setDeck(s.deck || []); setHand(s.hand || []);
      setDiscard(s.discard || []); setExiled(s.exiled || []);
      setInventory(s.inventory || { staff: [], robes: [], ring: [], hat: [] });
      setSkills(s.skills || { whittling: 0, weaving: 0, smithing: 0, felting: 0 });
      setEquipment(s.equipment || []);
      setPowers(s.powers || []);
      setRelics(s.relics || []);
      setFamiliar(s.familiar || null);
      setFamiliarName(s.familiarName || '');
      setSelectedCharacter(s.selectedCharacterId ? (CHARACTERS_BY_ID[s.selectedCharacterId] || null) : null);
      setEffectCount(s.effectCount || 0);
      setCurrentActIdx(s.currentActIdx || 0);
      setMap(s.map || null);
      setCurrentNodeId(s.currentNodeId || null);
      setClearedNodes(s.clearedNodes || []);
      setSidequestActive(s.sidequestActive || null);
      setLog(s.log || []);
      setStage('map');
      pushLog(`📜 Run resumed.`);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSavedRun() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
    setHasSavedRun(false);
  }

  // Resume from the saved run (called from MenuScreen).
  function continueRun() {
    if (loadRunSnapshot()) return;
    // Failed to load — clear so the Continue button disappears.
    clearSavedRun();
  }

  // Save & Quit: serialize current run, then return to main menu.
  function saveAndQuit() {
    const ok = saveRunSnapshot();
    if (!ok) {
      // Saving failed (e.g., in combat). Tell the user and bail.
      pushLog(`⚠ Cannot save mid-combat. Resolve the current step first.`);
      setGameMenuOpen(false);
      return;
    }
    setGameMenuOpen(false);
    setStage('menu');
  }

  // Give Up: wipe state + saved run, return to main menu.
  function giveUpRun() {
    clearSavedRun();
    setGameMenuOpen(false);
    setStage('menu');
  }

  // v2.71: per-wizard practice match. Tutorial is now lane-aware —
  // forced hand pulls 2 intros + 1 subject + 1 target + Defend from
  // the player's chosen lane so the practice combat actually teaches
  // THEIR lane's spell shape. Called from the character-select "Practice
  // match" button with the selected character's lane.
  const TUTORIAL_HANDS = {
    // v3.4.58 — wit tutorial hand seeds the full slowburn-4 row directly
    // (intro + subject + target all in hand). Player stages all three →
    // FFT fires → 3 dmg/turn × 3 turns DoT lands. No reliance on the
    // partial-row tutor (which is now opt-in via The Tutor card).
    wit: {
      hand: ['wv2-i-frankly', 'wv2-s-boucle-suggestion', 'wv2-t-fabric-stops-asking', 'c-defend', 'c-compose'],
      deck: ['wv2-i-actually', 'wv2-s-your-conclusion', 'wv2-t-thats-not-it', 'c-acuity'],
    },
    handler: {
      hand: ['cv2-l-birdseed', 'cv2-l-tender-greens', 'cv2-l-tender-greens', 'c-pack-tactics', 'c-defend-handler'],
      deck: ['c-defend-handler', 'c-compose'],
    },
    jnsq: {
      hand: ['jv2-i-speaking-of', 'jv2-i-astrally', 'jv2-s-your-aura', 'jv2-t-wrong-color', 'c-defend'],
      deck: ['jv2-i-on-a-tuesday', 'jv2-s-the-moon', 'jv2-t-owes-nothing', 'c-compose'],
    },
  };
  function startTutorial(lane = 'wit') {
    const setup = TUTORIAL_HANDS[lane] || TUTORIAL_HANDS.wit;
    setSelectedCharacter(CHARACTERS.find(c => c.lane === lane) || null);
    setMaxHp(STARTING_MAX_HP);
    setHp(STARTING_MAX_HP);
    setComposureMax(STARTING_MAX_COMPOSURE);
    setComposure(STARTING_MAX_COMPOSURE);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    setSidequestActive(null);
    setSidequestCombatActive(false);
    setPostcardState('idle');
    setPostcardPhrase(null);
    setPostcardsCorrect(0);
    setNodesSincePostcard(0);
    setPostcardModalOpen(false);
    setExiled([]);
    setEquipment([]);
    setPowers([]);
    setRelics([]);
    setFamiliar(null);
    setFamiliarName('');
    setEffectCount(0);
    setTray(initialV2Tray());
    setInventory({ staff: [], robes: [], ring: [], hat: [] });
    setSkills({ whittling: 0, weaving: 0, smithing: 0, felting: 0 });
    setMaterialChoices(null);
    setActiveSkillEvent(null);
    setClearedNodes([]);
    setLog([]);
    setCurrentActIdx(0);
    setMap(null);
    setCurrentNodeId(null);
    setTutorialActive(true);
    setTutorialStep(0);
    setTutorialLane(lane);
    pushLog(`🎓 Practice match — ${lane} wizard vs the Bursar.`);
    enterFight('tutorial-bursar', { forcedHand: setup.hand, forcedDeck: setup.deck });
  }

  // Advance the tutorial step IF the current step is waiting on a
  // matching action. No-op when not in the tutorial.
  function advanceTutorialStep(trigger) {
    if (!tutorialActive) return;
    // v2.88: split intro/subject steps. Was: step 1 → 2 on any 'played-
    // word'; step 2 → 3 on 'cast-spell'. Player would skip subject staging
    // and get a "Need an intro AND a subject" rejection. Now each word
    // slot gets its own step so the tutorial walks them through the
    // sentence shape in order.
    if (tutorialStep === 1 && trigger === 'intro')    setTutorialStep(2);
    if (tutorialStep === 2 && trigger === 'subject')  setTutorialStep(3);
    if (tutorialStep === 3 && trigger === 'cast-spell') setTutorialStep(4);
    // Handler tutorial: the only action-gated step is staging a lure.
    if (tutorialStep === 1 && trigger === 'lure')     setTutorialStep(2);
  }

  function exitTutorial() {
    setTutorialActive(false);
    setTutorialStep(0);
    setSelectedCharacter(null);
    // v2.71: return to character-select (was menu). After practice match
    // the player needs to actually pick a wizard for the real run.
    setStage('character-select');
  }

  // ---------- RUN LIFECYCLE ----------
  // v3.1 DEV QUICK-START: presets per lane × act for fast playtest at
  // mid/late-run states. Each act-N entry CUMULATIVE adds the listed
  // card IDs to a freshly-built starter deck for the lane. Use Final
  // Boss preset to drop directly at the act-3 boss room.
  const DEV_PRESETS = {
    wit: {
      2: ['wv2-k-hewn-greaves-footnotes', 'wv2-i-strikes-me', 'wv2-ann-subtext-italics', 'wv2-t-thats-not-it', 'wv2-t-not-survive-scrutiny'],
      3: ['wv2-t-natural-conclusion', 'wv2-i-i-should-think', 'wv2-ann-thorned-footnote', 'wv2-k-word-in-edgewise', 'c-mend'],
      4: ['wv2-t-generous-error', 'wv2-t-in-summary', 'wv2-ann-thesis-expanded', 'c-bulwark', 'c-acuity'],
    },
    handler: {
      // DEV_PRESETS for the Handler — Animal Summoner build (2026-05-31 pivot).
      // Each tier seeds a deck representative of what the player can build to.
      2: ['cv2-l-fish-food', 'cv2-l-birdseed', 'cv2-l-tender-greens', 'c-treat', 'c-tap-the-glass'],
      3: ['cv2-l-fish-food', 'cv2-l-tender-greens', 'cv2-l-birdseed', 'c-treat', 'c-mend'],
      4: ['cv2-l-fish-food', 'cv2-l-fish-food', 'cv2-l-tender-greens', 'c-bulwark', 'c-acuity'],
    },
    jnsq: {
      2: ['jv2-t-third-tuesday', 'jv2-i-astrally', 'jv2-p-hold-my-drink', 'jv2-k-shouldnt-said-have-you-eaten', 'c-channel'],
      3: ['jv2-p-wait-and-another-thing', 'jv2-k-that-reminds-me', 'jv2-t-getting-away-from-me', 'jv2-k-sober-second-thought', 'c-mend'],
      4: ['jv2-t-universe-sideways', 'jv2-k-sorry-lost-balance', 'jv2-i-on-a-tuesday', 'c-bulwark', 'c-acuity'],
    },
  };

  function startDevRun(lane, startActIdx, dropAtBoss) {
    clearSavedRun();
    const character = CHARACTERS.find(c => c.lane === lane);
    if (!character) return;
    const fam = FAMILIARS_BY_ID['fam-toad'] || FAMILIARS[0];
    setMaxHp(STARTING_MAX_HP + (fam?.bonus?.maxHp || 0));
    setHp(STARTING_MAX_HP + (fam?.bonus?.maxHp || 0));
    setComposureMax(STARTING_MAX_COMPOSURE);
    setComposure(STARTING_MAX_COMPOSURE);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    // Build starter + cumulative presets.
    const starter = buildStartingDeck(lane);
    const presetIds = [];
    for (let a = 2; a <= startActIdx + 1; a++) {
      const ids = DEV_PRESETS[lane]?.[a] || [];
      presetIds.push(...ids);
    }
    const extraCards = presetIds
      .map(id => CARDS_BY_ID[id])
      .filter(Boolean)
      .map(c => ({ ...c, uid: uid() }));
    setDeck(shuffle([...starter, ...extraCards]));
    setHand([]);
    setDiscard([]);
    setExiled([]);
    setEquipment([]);
    setPowers([]);
    setRelics([]);
    setFamiliar(fam);
    setFamiliarName(fam?.species || '');
    setSelectedCharacter(character);
    setEffectCount(0);
    setTray(initialV2Tray());
    setInventory({ staff: [], robes: [], ring: [], hat: [] });
    setSkills({ whittling: 0, weaving: 0, smithing: 0, felting: 0 });
    setMaterialChoices(null);
    setActiveSkillEvent(null);
    setClearedNodes([]);
    setLog([`🧪 Dev start — ${character.name} at ${ACTS[startActIdx]?.name || 'Act ' + (startActIdx + 1)}.`]);
    setCurrentActIdx(startActIdx);
    setSupplyOffers(null);
    const act = ACTS[startActIdx];
    if (!act) return;
    const m = generateActMap(act.rows, act.width);
    const seeded = seedSidequestSpurs(m, act.id, act.rows, act.width);
    setMap(seeded);
    if (dropAtBoss) {
      const bossNode = seeded.find(n => n.type === 'boss');
      setCurrentNodeId(bossNode?.id || null);
      // Pre-clear everything before the boss row to simulate "arrived at boss."
      const cleared = seeded.filter(n => n.row < (bossNode?.row ?? Infinity) && n.id !== bossNode?.id).map(n => n.id);
      setClearedNodes(cleared);
      // Auto-enter the boss fight.
      if (bossNode) {
        setTimeout(() => enterFight(act.bossId), 30);
      }
    } else {
      setCurrentNodeId(null);
      setClearedNodes([]);
      setStage('map');
    }
  }

  // v3.4.13 — Lab Mode entry: instant wizard select → custom deck build
  // → pick enemy → fight → repeat. Bypasses the normal run progression.
  // Triggered from the Lab button on CharacterSelectScreen.
  function pickCharacterLab(characterId) {
    const c = CHARACTERS_BY_ID[characterId];
    if (!c) return;
    clearSavedRun();
    const fam = FAMILIARS_BY_ID['fam-toad'] || FAMILIARS[0];
    const baseMaxHp = STARTING_MAX_HP + (fam?.bonus?.maxHp || 0);
    setMaxHp(baseMaxHp);
    setHp(baseMaxHp);
    setComposureMax(STARTING_MAX_COMPOSURE);
    setComposure(STARTING_MAX_COMPOSURE);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    const starter = buildStartingDeck(c.lane);
    const famCard = { ...fam.card, uid: uid() };
    setDeck([...starter, famCard]);
    setHand([]); setDiscard([]); setExiled([]);
    setEquipment([]); setPowers([]); setRelics([]);
    setFamiliar(fam); setFamiliarName(fam?.species || '');
    setSelectedCharacter(c);
    setEffectCount(0);
    setTray(initialV2Tray());
    setInventory({ staff: [], robes: [], ring: [], hat: [] });
    setSkills({ whittling: 0, weaving: 0, smithing: 0, felting: 0 });
    setClearedNodes([]);
    setLog([`🧪 Lab Mode — ${c.name}.`]);
    setCurrentActIdx(0);
    setSupplyOffers(null);
    setMap(null);
    setCurrentNodeId(null);
    setLabMode(true);
    setStage('lab-deck-build');
  }

  // Add a card to the current lab deck (by template id). The card gets a
  // fresh uid so each addition is a distinct instance.
  function labAddCard(cardId) {
    const tmpl = CARDS_BY_ID[cardId];
    if (!tmpl) return;
    setDeck(d => [...d, { ...tmpl, uid: uid() }]);
  }

  // Remove a specific card instance (by uid) from the lab deck.
  function labRemoveCard(cardUid) {
    setDeck(d => d.filter(c => c.uid !== cardUid));
  }

  // Move from lab-deck-build → lab-enemy-select.
  function labGoToEnemySelect() {
    // Reset combat-state fields between fights so HP/composure/energy
    // start fresh each time (enterFight handles pile shuffling, but not
    // these pools — they normally carry across map combats).
    const baseMaxHp = STARTING_MAX_HP + (familiar?.bonus?.maxHp || 0);
    setMaxHp(baseMaxHp);
    setHp(baseMaxHp);
    setComposureMax(STARTING_MAX_COMPOSURE);
    setComposure(STARTING_MAX_COMPOSURE);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    setStage('lab-enemy-select');
  }

  // Player picked an enemy from the lab list. Drop straight into combat.
  function labFightEnemy(enemyId) {
    enterFight(enemyId);
  }

  // Repeat? Yes — back to the enemy selector with fresh HP.
  function labRepeatYes() {
    setLabRepeatPrompt(null);
    labGoToEnemySelect();
  }

  // Repeat? No — back to the main menu, exit lab mode.
  function labRepeatNo() {
    setLabRepeatPrompt(null);
    setLabMode(false);
    setSelectedCharacter(null);
    setStage('menu');
  }

  function startRun() {
    clearSavedRun();
    // Deck is built per-character after character-select. Initialise empty.
    setMaxHp(STARTING_MAX_HP);
    setHp(STARTING_MAX_HP);
    setComposureMax(STARTING_MAX_COMPOSURE);
    setComposure(STARTING_MAX_COMPOSURE);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    setDeck([]);
    setHand([]);
    setDiscard([]);
    setExiled([]);
    setEquipment([]);
    setPowers([]);
    setRelics([]);
    setFamiliar(null);
    setFamiliarName('');
    setSelectedCharacter(null);
    setEffectCount(0);
    setTray(initialV2Tray());
    setInventory({ staff: [], robes: [], ring: [], hat: [] });
    setSkills({ whittling: 0, weaving: 0, smithing: 0, felting: 0 });
    setMaterialChoices(null);
    setActiveSkillEvent(null);
    setClearedNodes([]);
    setLog([]);
    setCurrentActIdx(0);
    setMap(null);
    setCurrentNodeId(null);
    setSupplyOffers(null);
    // Character select first — the chosen lane drives the supply pool.
    setStage('character-select');
  }

  function pickCharacter(characterId) {
    const c = CHARACTERS_BY_ID[characterId];
    if (!c) return;
    setSelectedCharacter(c);
    logEvent('character.select', { characterId: c.id, lane: c.lane, name: c.name });
    pushLog(`🧙 You are ${c.name}, ${c.title}.`);
    // v3.4.50 / v3.4.72 (Alan): ALL wizards skip the supply shop. Each
    // wizard gets a random common relic auto-strapped on, then goes
    // straight to familiar-shop. Wit additionally defaults to the
    // slowburn-4 starting row (Lingering Point); handler seeds bluster-1
    // automatically via buildStartingDeck; jnsq uses the lane defaults.
    if (c.lane === 'wit') {
      const row = WIT_ROW_BY_ID['slowburn-4'];
      setStartingRow(row);
      logEvent('character.starting_row', { rowId: row.id, name: row.name, schoolId: row.schoolId, auto: true });
      pushLog(`📜 Starter spell: ${row.name} — "${row.canonical}"`);
      const starterDeck = buildStartingDeck('wit', { startingRow: row });
      setDeck(starterDeck);
    } else {
      const starterDeck = buildStartingDeck(c.lane);
      setDeck(starterDeck);
    }
    const commonRelics = RELICS.filter(r => r.rarity === 'common');
    const grantedRelic = commonRelics[Math.floor(Math.random() * commonRelics.length)];
    if (grantedRelic) {
      grantRelic(grantedRelic, 'Starting supplies');
      logEvent(TE.STARTING_PICK, { kind: 'relic', relicId: grantedRelic.id, relicName: grantedRelic.name, rarity: grantedRelic.rarity, auto: true });
    }
    setStage('familiar-shop');
  }

  // v3.4.7 — Wit-only: after character select, the player picks one of
  // the 15 FFT rows as their starter spell. The row's intro/subject/
  // target enter the deck at T1 power (stamped in buildStartingDeck).
  // After the pick, we continue with the same supply-shop offer flow
  // that pickCharacter would have triggered for non-wit lanes.
  function pickStartingRow(rowId) {
    const row = WIT_ROW_BY_ID[rowId];
    if (!row || !selectedCharacter) return;
    setStartingRow(row);
    logEvent('character.starting_row', { rowId: row.id, name: row.name, schoolId: row.schoolId });
    pushLog(`📜 Starter spell chosen: ${row.name} — "${row.canonical}"`);
    const starterDeck = buildStartingDeck('wit', { startingRow: row });
    setDeck(starterDeck);
    // Same supply-shop offer logic as pickCharacter's non-wit branch.
    const lanePool = LANE_POOL['wit'] || [];
    const starterIds = buildStarterDeckForLane('wit', row);
    const uncommons = lanePool.filter(card =>
      card.rarity === 'uncommon' &&
      !starterIds.includes(card.id) &&
      isInterestingReward(card)
    );
    const cardOffer = uncommons.length > 0
      ? uncommons[Math.floor(Math.random() * uncommons.length)]
      : null;
    const commonRelics = RELICS.filter(r => r.rarity === 'common');
    const relicOffer = commonRelics.length > 0
      ? commonRelics[Math.floor(Math.random() * commonRelics.length)]
      : null;
    const boonOffer = SHOP_BOONS[Math.floor(Math.random() * SHOP_BOONS.length)];
    setSupplyOffers({ card: cardOffer, relic: relicOffer, boon: boonOffer });
    setStage('supply-shop');
    pushLog(`🏘 You set out from the school. Town first.`);
  }

  function pickSupplyOffer(kind) {
    if (!supplyOffers) return;
    const offer = supplyOffers[kind];
    if (!offer) return;
    if (kind === 'card') {
      setDeck(d => [...d, { ...offer, uid: uid() }]);
      pushLog(`🛒 Pocketed: ${offer.name || offer.phrase}.`);
      logEvent(TE.STARTING_PICK, { kind: 'card', cardId: offer.id, cardName: offer.name, type: offer.type, rarity: offer.rarity });
    } else if (kind === 'relic') {
      grantRelic(offer, 'Supply shop');
      logEvent(TE.STARTING_PICK, { kind: 'relic', relicId: offer.id, relicName: offer.name, rarity: offer.rarity });
    } else if (kind === 'boon') {
      if (offer.apply === 'maxHpPlus10') {
        setMaxHp(m => m + 10);
        setHp(_ => STARTING_MAX_HP + 10);
      } else if (offer.apply === 'maxCompPlus10') {
        setComposureMax(m => m + 10);
        setComposure(_ => STARTING_MAX_COMPOSURE + 10);
      } else if (offer.apply === 'sturdy') {
        setMaxHp(m => m + 5);
        setHp(h => h + 5);
        setComposureMax(m => m + 5);
        setComposure(c => c + 5);
      }
      pushLog(`🛒 Took the boon: ${offer.name}.`);
      logEvent(TE.STARTING_PICK, { kind: 'boon', boonId: offer.id, boonName: offer.name });
    }
    setSupplyOffers(null);
    setStage('familiar-shop');
  }

  function pickFamiliar(familiarId) {
    const fam = FAMILIARS_BY_ID[familiarId];
    if (!fam) return;
    setFamiliar(fam);
    // v2.99.4: familiar cards now adapt their scaleBy to the player's
    // lane. Beetle's Clatter (jnsq-scale) on a wit wizard used to add a
    // card that scaled from the player's 0 jnsq stat — Alan: "one of my
    // cards as a wit wizard was a jnsq card." Same card, same flavor,
    // but the math respects the wizard you chose.
    const playerLane = selectedCharacter?.lane;
    let famCard = { ...fam.card, uid: uid() };
    if (playerLane && famCard.effect?.scaleBy && famCard.effect.scaleBy !== playerLane) {
      famCard = {
        ...famCard,
        effect: { ...famCard.effect, scaleBy: playerLane },
        upgrade: famCard.upgrade?.effect
          ? { ...famCard.upgrade, effect: { ...famCard.upgrade.effect, scaleBy: playerLane } }
          : famCard.upgrade,
      };
    }
    setDeck(d => [...d, famCard]);
    // Apply maxHp bonus immediately if present.
    if (fam.bonus?.maxHp) {
      setMaxHp(m => m + fam.bonus.maxHp);
      setHp(h => h + fam.bonus.maxHp);
    }
    pushLog(`🐾 You choose the ${fam.species}. ${fam.card.name} added to deck.`);
    logEvent(TE.RUN_START, { familiarId: fam.id, familiarSpecies: fam.species, startingDeckPicks: deck.map(c => c.id) });
    setStage('familiar-name');
  }

  function confirmFamiliarName(name) {
    const trimmed = (name || '').trim();
    const final = trimmed || familiar?.species || 'Familiar';
    setFamiliarName(final);
    pushLog(`🐾 You name your ${familiar?.species || 'familiar'} ${final}.`);
    // Character-select + supply-shop already gave the lane-pure picks the
    // legacy starting-picks screen used to provide. Skip it and head
    // directly to the map.
    {
      const m0 = generateActMap(ACTS[0].rows, ACTS[0].width);
      setMap(seedSidequestSpurs(m0, ACTS[0].id, ACTS[0].rows, ACTS[0].width));
    }
    setStage('map');
    pushLog(`🌅 ${ACTS[0].name} begins.`);
  }

  function advanceToNextAct() {
    const nextIdx = currentActIdx + 1;
    if (nextIdx >= ACTS.length) {
      setStage('graduation');
      return;
    }
    // v3.0: full HP + Composure restore after a boss kill (between acts).
    // Was a partial heal (INTER_ACT_HEAL_RATIO); felt punishing in playtest
    // — boss fights take everything, then act 2 starts at low HP and the
    // wit player especially never recovers. Full restore matches STS's
    // boss → checkpoint → next-floor structure.
    setHp(maxHp);
    setComposure(composureMax);
    pushLog(`🌄 Between acts: HP and Composure fully restored.`);
    setCurrentActIdx(nextIdx);
    const nextAct = ACTS[nextIdx];
    {
      const m = generateActMap(nextAct.rows, nextAct.width);
      setMap(seedSidequestSpurs(m, nextAct.id, nextAct.rows, nextAct.width));
    }
    setCurrentNodeId(null);
    setClearedNodes([]);
    pushLog(`🌅 ${nextAct.name} begins.`);
    // School-granted Master Hat on entry to the final act. The hat slot
    // is no longer a player-crafted equipment — the school provides it
    // as part of graduation outfitting before the deep-forest journey.
    if (nextIdx === ACTS.length - 1) {
      const hat = { ...EQUIPMENT.hat.master, uid: uid() };
      setEquipment(prev => [...prev, hat]);
      applyEquipmentMaxHp(hat);
      pushLog(`🎓 The school sends a runner: "${hat.name} — provided by the bursar's office. Don't lose it."`);
    }
    setStage('map');
  }

  // ---------- MAP NAVIGATION ----------
  function reachableFromCurrent() {
    if (!map) return [];
    if (!currentNodeId) return map.nodes.filter(n => n.row === 0).map(n => n.id);
    return map.edges[currentNodeId] || [];
  }

  function pickNode(nodeId) {
    const node = map.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!reachableFromCurrent().includes(nodeId)) {
      pushLog('That trail is not connected from here.');
      return;
    }
    logEvent(TE.MAP_NODE, { nodeId, nodeType: node.type, row: node.r, col: node.c, sidequestRef: node.sidequestRef || null, offeredNodeIds: reachableFromCurrent(), actIdx: currentActIdx, hp, composure });
    setCurrentNodeId(nodeId);
    // Postcard mechanic: count every node visit toward the 5-node cadence
    // (only while the quest is active and not yet resolved).
    if (postcardState === 'active') {
      setNodesSincePostcard(n => n + 1);
    }
    resolveNodeEnter(node);
  }

  function resolveNodeEnter(node) {
    if (node.type === 'town' || node.type === 'start') {
      pushLog(`You set out from ${nodeLabel(node)}.`);
      return;
    }
    // Sidequest spur nodes: route to the relevant beat instead of the
    // generic event/combat resolver. The map placed them; this fires them.
    if (node.sidequestRef) {
      const { templateId, nodeIdx } = node.sidequestRef;
      const tpl = SIDEQUEST_TEMPLATES[templateId];
      if (!tpl) return;
      const beat = tpl.nodes[nodeIdx];
      logEvent(TE.SIDEQUEST_CHOICE, { action: 'enter', templateId, beatIdx: nodeIdx, beatKind: beat.kind, title: tpl.title, hp, composure });
      setSidequestActive({ templateId, nodeIdx });
      if (beat.kind === 'combat') {
        setSidequestCombatActive(true);
        enterFight(beat.enemyId);
      } else if (beat.kind === 'boss') {
        pushLog(`🌿 The path delivers you to the act boss.`);
        setSidequestActive(null);
        enterFight(currentAct.bossId);
      } else {
        setStage('sidequest-node');
      }
      return;
    }
    if (node.type === 'combat')        return enterFight(pickActEnemyId('normal'));
    if (node.type === 'elite')         return enterFight(pickActEnemyId('elite'));
    if (node.type === 'rest')          { setRestNode(node); setStage('rest'); return; }
    if (node.type === 'event')         {
      const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      setActiveEvent(ev); setStage('event'); return;
    }
    if (node.type === 'material')      return enterMaterialNode();
    if (node.type === 'skill')         return enterSkillNode();
    if (node.type === 'boss')          return enterFight(currentAct.bossId);
  }

  // Material node — v3.3: randomize the material instead of letting the
  // player pick from 3. Alan: "Material gathering should be randomized
  // instead of being able to pick from 3. It's far too easy to get
  // exactly what you want." Roll ONE material from the slot pool and
  // drop it directly in inventory. Bypasses the chooser screen.
  function enterMaterialNode() {
    const slot = currentAct.slot;
    const pool = MATERIAL_TEMPLATES[slot] || [];
    if (pool.length === 0) { pushLog('Nothing of use here.'); return; }
    const m = pool[Math.floor(Math.random() * pool.length)];
    setInventory(prev => ({ ...prev, [m.slot]: [...prev[m.slot], m] }));
    pushLog(`🪵 You gather ${m.name} — the road decided for you.`);
    logEvent(TE.MATERIAL_HARVEST, { materialId: m.id, name: m.name, slot: m.slot, randomized: true });
    // v3.3 (Alan: "When I gain a material, needs a popup modal to show
    // what it is I got"). Show the material via a modal — player can
    // dismiss to return to map.
    setMaterialGainNotice(m);
  }

  function claimMaterial(materialId) {
    if (!materialChoices) return;
    const m = materialChoices.choices.find(c => c.id === materialId);
    if (!m) return;
    logEvent(TE.MATERIAL_HARVEST, { materialId: m.id, name: m.name, slot: m.slot, offered: materialChoices.choices.map(c => c.id) });
    setInventory(prev => ({ ...prev, [m.slot]: [...prev[m.slot], m] }));
    pushLog(`🪵 You gather ${m.name}.`);
    setMaterialChoices(null);
    returnToMap();
  }

  function skipMaterial() {
    pushLog('You leave the material where it is.');
    setMaterialChoices(null);
    returnToMap();
  }

  // Skill node — pick a skill event from the pool, filtered to skills
  // whose act is still ahead OR is the current act. Skills you've moved
  // past don't show events (you've already crafted that piece).
  function enterSkillNode() {
    const eligibleSkills = new Set();
    for (let i = currentActIdx; i < ACTS.length; i++) {
      const c = ACTS[i]?.craft;
      if (c) eligibleSkills.add(c);
    }
    // Filter events: skill === 'any' is OK (it's a chooser), otherwise
    // the event's primary skill must be in the eligible set.
    const pool = SKILL_EVENTS.filter(e => e.skill === 'any' || eligibleSkills.has(e.skill));
    if (pool.length === 0) {
      pushLog('No craft worth practicing on the road here.');
      returnToMap();
      return;
    }
    // For the 'any' cross-skill event, filter its choices to relevant
    // skills only so the player doesn't pick a dead one.
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const filtered = picked.skill === 'any'
      ? { ...picked, choices: picked.choices.filter(c => {
          const sk = c.effects?.skill;
          if (!sk) return true;
          return Object.keys(sk).some(k => eligibleSkills.has(k));
        }) }
      : picked;
    setActiveSkillEvent(filtered);
    setStage('skill-event');
  }

  // Resolves a skill-event choice the same way resolveEventChoice does
  // regular events, but the modal lives on its own stage so we don't
  // mash the two flows together.
  // Apply the graded outcome of a skill-event minigame. The player's
  // grade scales the advertised skill bump (Master = full bump, Fine =
  // half rounded up, Rough = 1 with extra HP penalty) while always
  // applying the labeled max-HP cost (you committed by choosing it).
  function finalizeSkillMinigame(grade) {
    const m = skillMinigame;
    if (!m) return;
    const fx = m.baseEffects || {};
    const logBits = [`🛠 ${m.eventTitle}: ${m.choiceLabel} → ${grade.toUpperCase()}`];
    // Skill scaling by grade — Master full, Fine half, Rough quarter.
    const skillScale = grade === 'master' ? 1.0 : grade === 'fine' ? 0.5 : 0.25;
    applyEffectsCore(fx, { logBits, skillScale });
    // Rough adds an extra -2 HP penalty for fumbling (botch tax).
    if (grade === 'rough') {
      setHp(h => Math.max(1, h - 2));
      logBits.push(`-2 HP (botched)`);
    }
    pushLog(logBits.join(' · '));
    setSkillMinigame(null);
    returnToMap();
  }

  // Unified choice-effects dispatcher. The four call sites (sidequest
  // beats, skill events, skill-minigame finalize, story events) used to
  // each re-implement this vocabulary with subtle log/modal divergences.
  // Per ARCHITECTURE_REVIEW.md #6 — single core, thin wrappers per
  // call site decide whether to open the card-grant modal.
  //
  // Returns { granted } — caller pushes its own preamble to logBits
  // BEFORE calling, then commits the log itself.
  //
  // Options:
  //   logBits  — array the core appends per-effect log fragments to
  //   skillScale — multiplier on `fx.skill` bumps (1.0 default;
  //                minigames pass 0.5/0.25 for Fine/Rough grades)
  function applyEffectsCore(fx, { logBits, skillScale = 1.0 } = {}) {
    const granted = [];
    if (fx.healFull) { setHp(maxHp); logBits.push(`+full HP`); }
    if (fx.heal)    { setHp(h => clamp(h + fx.heal, 0, maxHp)); logBits.push(`+${fx.heal} HP`); }
    if (fx.loseHp)  { setHp(h => Math.max(1, h - fx.loseHp)); logBits.push(`-${fx.loseHp} HP`); }
    if (fx.maxHp) {
      setMaxHp(m => Math.max(1, m + fx.maxHp));
      // On loss: clamp current HP DOWN to the new ceiling.
      // On gain: do NOT auto-heal — labeled cost would otherwise lie.
      if (fx.maxHp < 0) setHp(h => Math.max(1, Math.min(h, maxHp + fx.maxHp)));
      logBits.push(`${fx.maxHp > 0 ? '+' : ''}${fx.maxHp} max HP`);
    }
    if (fx.loseRandomCard) {
      // v2.85: was silently picking 1 random card. Now picks 2 candidates
      // (prefer non-starters) and surfaces a modal so the player chooses
      // which to forget. The chosen card is removed in
      // resolveForgetTwoChoice; the unchosen card stays. Auto-handles
      // edge cases: 0 cards → no-op; 1 card → auto-discard with log.
      const indexed = deck.map((c, i) => ({ c, i }));
      const nonStarters = indexed.filter(({ c }) => !STARTER_DECK.includes(c.id));
      const pool = nonStarters.length > 0 ? nonStarters : indexed;
      if (pool.length === 0) {
        logBits.push(`(no cards to forget)`);
      } else if (pool.length === 1) {
        const only = pool[0];
        setDeck(d => d.filter(c => c.uid !== only.c.uid));
        logBits.push(`− ${only.c.name} (only card available)`);
      } else {
        // Pick 2 distinct candidates (Fisher-Yates is overkill — sort+slice).
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const choices = shuffled.slice(0, 2).map(x => x.c);
        setForgetTwoPrompt({ cards: choices });
        logBits.push(`✋ Choose one to forget…`);
      }
    }
    const grantCardOf = (rarity) => {
      // v2.60: event grants respect lane AND exclude starter-deck cards
      // (same as combat rewards). isInterestingReward applies inside
      // pickCardByRarity — no vanilla stat-pumps.
      // v3.4.49 (Alan caught: "Will Slowly Unravel" offered solo on a
      // hard refresh). Event/rest grants now also exclude spell pieces
      // (intros/subjects/targets) — those only enter the deck as FFT
      // row bundles via the elite/boss reward path.
      const lane = selectedCharacter?.lane || null;
      const starterIds = lane ? buildStarterDeckForLane(lane) : [];
      const c = pickCardByRarity({ [rarity]: 1 }, starterIds, lane, { excludeSpellPieces: true });
      if (c) {
        setDeck(d => [...d, { ...c, uid: uid() }]);
        logBits.push(`+ ${c.name}`);
        granted.push(c);
      }
    };
    if (fx.gainCommonCard)   grantCardOf('common');
    if (fx.gainUncommonCard) grantCardOf('uncommon');
    if (fx.gainRareCard)     grantCardOf('rare');
    if (fx.skill) {
      const eligibleSkills = new Set();
      for (let i = currentActIdx; i < ACTS.length; i++) {
        const c = ACTS[i]?.craft;
        if (c) eligibleSkills.add(c);
      }
      const scale = (bump) => skillScale === 1.0 ? bump : Math.max(1, Math.ceil(bump * skillScale));
      setSkills(prev => {
        const next = { ...prev };
        for (const [skill, bump] of Object.entries(fx.skill)) {
          if (!eligibleSkills.has(skill)) continue;
          next[skill] = Math.min(SKILL_MAX, (next[skill] || 0) + scale(bump));
        }
        return next;
      });
      for (const [skill, bump] of Object.entries(fx.skill)) {
        if (!eligibleSkills.has(skill)) continue;
        logBits.push(`+${scale(bump)} ${CRAFT_LABEL[skill] || skill}`);
      }
    }
    if (fx.grantPostcardPhrase) {
      const phrase = generatePostcardPhrase();
      setPostcardPhrase(phrase);
      setPostcardState('active');
      setPostcardsCorrect(0);
      setNodesSincePostcard(0);
      logBits.push(`📮 phrase: "${phrase}"`);
      logEvent('postcard.granted', { phrase });
    }
    return { granted };
  }

  // Sidequest beat / narrative resolver. No card-grant modal — sidequest
  // rewards land silently in the deck (kept from the pre-refactor
  // behavior; sidequest pacing doesn't benefit from a modal interrupt).
  function applyChoiceEffects(fx, sourceLabel) {
    const logBits = [`📜 ${sourceLabel}`];
    applyEffectsCore(fx, { logBits });
    pushLog(logBits.join(' · '));
  }

  // Postcard mechanic handlers ----------------------------------------------
  function submitPostcard(text) {
    if (postcardState === 'completed') {
      // The man's forgiveness postcard arrives. Heal + max-HP reward.
      setHp(h => clamp(h + 10, 0, maxHp + 5));
      setMaxHp(m => m + 5);
      pushLog(`📮 Postcard from the man: "My cat forgives you." +10 HP, +5 max HP.`);
      logEvent('postcard.reward', { result: 'completed' });
      setPostcardState('done');
      setPostcardModalOpen(false);
      return;
    }
    if (postcardState === 'failed') {
      // Rebuke postcard arrives and lifts the fog.
      pushLog(`📮 Postcard from the man: "You have disgraced my cat. We will not speak again."`);
      logEvent('postcard.reward', { result: 'failed' });
      setPostcardState('done');
      setPostcardModalOpen(false);
      return;
    }
    // Active state — validate input against the phrase exactly.
    const clean = (text || '').trim();
    const correct = clean === (postcardPhrase || '').trim();
    logEvent('postcard.submit', { correct, attemptLength: clean.length, expectedPhrase: postcardPhrase, submitted: clean, currentProgress: postcardsCorrect });
    if (correct) {
      const newCount = postcardsCorrect + 1;
      setPostcardsCorrect(newCount);
      setNodesSincePostcard(0);
      pushLog(`📮 You send the postcard. (${newCount}/3)`);
      if (newCount >= 3) {
        // Quest moves to 'completed'; the NEXT mailbox click is the reward.
        setPostcardState('completed');
        pushLog(`📮 The third postcard sent. Something will arrive.`);
      }
    } else {
      // Wrong text — penalty.
      setHp(h => Math.max(1, h - 5));
      setPostcardState('failed');
      setNodesSincePostcard(0);
      pushLog(`📮 You misremembered. The phrase was: "${postcardPhrase}". -5 HP. The road ahead grows obscured.`);
    }
    setPostcardModalOpen(false);
  }

  // Visibility helper for the mailbox button.
  function postcardMailboxVisible() {
    if (postcardState === 'completed' || postcardState === 'failed') return true;
    if (postcardState === 'active' && nodesSincePostcard >= 5) return true;
    return false;
  }

  // Cut a sidequest spur short — the player picks an early-exit option
  // (e.g. "Look away" in the Jazz Cafe quest). Remove the remaining spur
  // nodes from the map and reroute the current spur node's edge directly
  // to the original rejoin point.
  function endSpurEarly(currentSpurNodeId) {
    setMap(prev => {
      if (!prev) return prev;
      const currentNode = prev.nodes.find(n => n.id === currentSpurNodeId);
      if (!currentNode || !currentNode.sidequestRef) return prev;
      const { templateId } = currentNode.sidequestRef;
      const tpl = SIDEQUEST_TEMPLATES[templateId];
      if (!tpl) return prev;
      const currentIdx = currentNode.sidequestRef.nodeIdx;
      // Inherit the rejoin point from the last spur node's outgoing edge.
      const lastSpurId = `sq-${templateId}-${tpl.nodes.length - 1}`;
      const rejoinIds = prev.edges[lastSpurId] || [];
      const newEdges = { ...prev.edges };
      newEdges[currentSpurNodeId] = rejoinIds;
      for (let i = currentIdx + 1; i < tpl.nodes.length; i++) {
        delete newEdges[`sq-${templateId}-${i}`];
      }
      const newNodes = prev.nodes.filter(n =>
        !n.sidequestRef ||
        n.sidequestRef.templateId !== templateId ||
        n.sidequestRef.nodeIdx <= currentIdx
      );
      return { ...prev, nodes: newNodes, edges: newEdges };
    });
  }

  // SIDEQUEST flow ----------------------------------------------------------
  // Sidequests are now visible map spurs. Each beat is a real map node
  // tagged with sidequestRef. Walking onto a spur node fires the beat;
  // resolving the beat returns control to the map and the player walks
  // forward to the next spur node. The last spur node connects back to
  // the main map (or directly to the boss for shortcut quests).

  function getActiveSidequestBeat() {
    if (!sidequestActive) return null;
    const tpl = SIDEQUEST_TEMPLATES[sidequestActive.templateId];
    if (!tpl) return null;
    return { tpl, node: tpl.nodes[sidequestActive.nodeIdx], idx: sidequestActive.nodeIdx };
  }

  // Resolve a beat. Apply any effects, mark the spur node as cleared,
  // then return to the map. The player clicks the next spur node manually.
  function resolveSidequestBeat(effects) {
    const active = getActiveSidequestBeat();
    if (!active) { returnToMap(); return; }
    if (effects && Object.keys(effects).length > 0) {
      applyChoiceEffects(effects, active.tpl.title);
    }
    // First beat of a sidequest: lazy-spawn the rest of the chain so
    // the player sees the new path appear after engagement.
    if (active.idx === 0 && !(effects && effects.endSpurEarly)) {
      spawnRemainingSpur(active.tpl);
    }
    // Early-exit option (e.g. Jazz Cafe "look away") — collapse the
    // remaining spur and reroute to the rejoin point.
    if (effects && effects.endSpurEarly && currentNodeId) {
      endSpurEarly(currentNodeId);
    }
    setSidequestActive(null);
    setSidequestCombatActive(false);
    returnToMap();
  }

  // After first beat resolves, append the rest of the sidequest chain
  // to the map. Each subsequent beat becomes a node one row forward.
  // Last node connects to a rejoin main-row node (loop-back) or to
  // the boss (boss-shortcut). Idempotent — only runs once per quest.
  function spawnRemainingSpur(tpl) {
    if (!tpl || tpl.nodes.length <= 1) return;
    if (!map) return;
    if (map.nodes.some(n => n.id === `sq-${tpl.id}-1`)) return; // idempotent
    const firstNode = map.nodes.find(n => n.id === `sq-${tpl.id}-0`);
    if (!firstNode) return;
    const totalRows = currentAct?.rows || 15;
    // Build everything OUTSIDE the setMap updater — no Math.random or
    // outer-scope reads inside the updater body per [[feedback_react_pure_updaters]].
    const newNodes = [];
    for (let i = 1; i < tpl.nodes.length; i++) {
      const r = firstNode.row + i;
      if (r >= totalRows - 1) break; // ran out of rows before the boss row
      const beat = tpl.nodes[i];
      const type = beat.kind === 'combat' ? 'combat'
                 : beat.kind === 'boss'   ? 'boss'
                 :                          'event';
      newNodes.push({
        id: `sq-${tpl.id}-${i}`,
        row: r,
        col: -1,
        type,
        x: firstNode.x,
        y: rowY(r, totalRows),
        sidequestRef: { templateId: tpl.id, nodeIdx: i },
      });
    }
    const newEdges = {};
    newEdges[firstNode.id] = [...(map.edges[firstNode.id] || []), `sq-${tpl.id}-1`];
    for (let i = 0; i < newNodes.length - 1; i++) {
      newEdges[newNodes[i].id] = [newNodes[i + 1].id];
    }
    const lastSpur = newNodes[newNodes.length - 1];
    if (lastSpur) {
      if (tpl.bossShortcut) {
        const bossNode = map.nodes.find(n => n.type === 'boss');
        if (bossNode) newEdges[lastSpur.id] = [bossNode.id];
      } else {
        const rejoinRow = Math.min(totalRows - 2, lastSpur.row + 1);
        const candidates = map.nodes.filter(n =>
          n.row === rejoinRow && !n.sidequestRef && n.type !== 'boss');
        if (candidates.length > 0) {
          const rejoin = candidates[Math.floor(Math.random() * candidates.length)];
          newEdges[lastSpur.id] = [rejoin.id];
        }
      }
    }
    // Pure updater: only merges precomputed nodes/edges.
    setMap(prev => prev ? {
      ...prev,
      nodes: [...prev.nodes, ...newNodes],
      edges: { ...prev.edges, ...newEdges },
    } : prev);
  }

  function resolveSidequestChoice(choice) {
    const active = getActiveSidequestBeat();
    logEvent(TE.SIDEQUEST_CHOICE, { action: 'choice', templateId: active?.tpl?.id, beatIdx: active?.idx, title: active?.tpl?.title, choiceLabel: choice.label, effects: Object.keys(choice.effects || {}), hp, composure });
    resolveSidequestBeat(choice.effects || {});
  }

  function resolveSidequestNarrative() {
    const active = getActiveSidequestBeat();
    if (!active) return;
    resolveSidequestBeat(active.node?.next?.effects || {});
  }

  // Abandon: teleport the player off the spur to a rejoin main-map node.
  // We look up the spur's last node in the placed map and use its outgoing
  // edge as the rejoin target. If we can't find one, fall back to the
  // current node (player just stays put with the sidequest cleared).
  function abandonSidequest() {
    const active = getActiveSidequestBeat();
    if (!active) { returnToMap(); return; }
    const tpl = active.tpl;
    logEvent(TE.SIDEQUEST_CHOICE, { action: 'abandon', templateId: tpl.id, beatIdx: active.idx, title: tpl.title, hp, composure });
    pushLog(`🌿 You leave ${tpl.title} unfinished.`);
    // Find the last spur node for this template and follow its rejoin edge.
    const lastIdx = tpl.nodes.length - 1;
    const lastSpurId = `sq-${tpl.id}-${lastIdx}`;
    const rejoinIds = map?.edges?.[lastSpurId] || [];
    const rejoinId = rejoinIds[0];
    setSidequestActive(null);
    setSidequestCombatActive(false);
    if (rejoinId) {
      setCurrentNodeId(rejoinId);
      const rejoinNode = map.nodes.find(n => n.id === rejoinId);
      if (rejoinNode && !clearedNodes.includes(rejoinId)) {
        setClearedNodes(prev => [...prev, rejoinId]);
      }
    }
    returnToMap();
  }

  function resolveSkillChoice(choice) {
    const fx = choice.effects || {};
    logEvent(TE.SKILL_LEVEL, { eventTitle: activeSkillEvent?.title, choiceLabel: choice.label, effects: Object.keys(fx) });
    // Minigame intercept: defer the effect until the player has played
    // the minigame. The grade they achieve replaces the deterministic
    // skill bump with a Master/Fine/Rough variant.
    if (fx.minigame) {
      const title = activeSkillEvent?.title || '';
      setActiveSkillEvent(null);
      setSkillMinigame({
        kind: fx.minigame,
        baseEffects: fx,
        eventTitle: title,
        choiceLabel: choice.label,
      });
      setStage('skill-minigame');
      return;
    }
    const logBits = [`🛠 ${activeSkillEvent.title}: ${choice.label}`];
    const { granted } = applyEffectsCore(fx, { logBits });
    pushLog(logBits.join(' · '));
    const title = activeSkillEvent.title;
    setActiveSkillEvent(null);
    if (granted.length > 0) {
      setCardGrantPrompt({ cards: granted, title: `${title} — added to your deck` });
      setStage('card-grant');
      return;
    }
    returnToMap();
  }

  function pickActEnemyId(tier) {
    const pool = ENEMIES.filter(e => e.act === currentAct.id && e.tier === tier);
    if (pool.length === 0) return ENEMIES[0].id; // fallback
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  // Extract real card objects from the tray for combat-end pile merges.
  // Lure envelopes carry the actual lure CARD in slot.card — extract it.
  // Animal / occupied envelopes have NO card (the original lure was already
  // recycled to discard via luresToRecycle when it transformed). Modifiers
  // are raw cards. Tactic is a raw card and should also return to the deck
  // so it can be replayed next combat. Pre-fix this dropped envelopes into
  // the deck as opaque blobs, causing "blank cards" in subsequent combats
  // (Alan, 2026-05-31 telemetry).
  function extractTrayCardsForReturn(t) {
    if (!t) return [];
    const slotCard = (slot) => {
      if (!slot) return null;
      if (slot.kind === 'lure') return slot.card || null;
      if (slot.kind === 'animal' || slot.kind === 'occupied') return null;
      return slot;
    };
    return [
      slotCard(t.intro),
      slotCard(t.subject),
      slotCard(t.target),
      ...((t.modifiers || []).filter(Boolean)),
      t.tactic || null,
    ].filter(Boolean);
  }

  // v3.4.11 — pile telemetry. Snapshot card-id contents of every pile
  // (deck/hand/discard/exiled/tray) at combat.start, combat.end, and
  // turn_end. Used to diagnose card-loss reports: if a card vanishes
  // between snapshots, the gap tells us which transition dropped it.
  // Closure reads current state — call inline in the same render pass
  // as the logEvent.
  function pilesSnapshot() {
    const trayMods = (tray?.modifiers || []).map(m => m.id);
    const trayCount = (tray?.intro ? 1 : 0) + (tray?.subject ? 1 : 0) + (tray?.target ? 1 : 0) + trayMods.length;
    return {
      deck:    deck.map(c => c.id),
      hand:    hand.map(c => c.id),
      discard: discard.map(c => c.id),
      exiled:  exiled.map(c => c.id),
      tray: {
        intro:     tray?.intro?.id || null,
        subject:   tray?.subject?.id || null,
        target:    tray?.target?.id || null,
        modifiers: trayMods,
      },
      total: deck.length + hand.length + discard.length + exiled.length + trayCount,
    };
  }

  function markCurrentNodeCleared() {
    if (currentNodeId && !clearedNodes.includes(currentNodeId)) {
      setClearedNodes(prev => [...prev, currentNodeId]);
    }
  }

  function returnToMap() {
    markCurrentNodeCleared();
    setStage('map');
  }

  // ---------- COMBAT ----------
  // `opts.forcedHand` / `opts.forcedDeck` — arrays of card IDs. When
  // passed, the opening hand and deck are seeded deterministically
  // (skipping the shuffle). Used by the tutorial; everyone else relies
  // on the normal pile-shuffle draw.
  function enterFight(enemyId, opts = {}) {
    const tmpl = ENEMIES_BY_ID[enemyId];
    if (!tmpl) return;
    // v3.4.44 (Alan: "I'm winning every time with virtually no difficulty").
    // Global difficulty scalar. Bumps composure, HP, and per-behavior attack
    // values for every enemy. 1.25 = 25% harder; tuneable.
    const DIFFICULTY_MULT = 1.25;
    const scaledBehaviors = (tmpl.behaviors || []).map(b => {
      if (b.kind === 'attack' || b.kind === 'attack-multi') {
        const newVal = Math.max(1, Math.round((b.value || 0) * DIFFICULTY_MULT));
        return { ...b, value: newVal, telegraph: b.telegraph ? b.telegraph.replace(/\d+/, String(newVal)) : b.telegraph };
      }
      return b;
    });
    const e = {
      ...tmpl,
      annotation: null,
      composureMax: Math.round((tmpl.composureMax || 0) * DIFFICULTY_MULT),
      hpMax: tmpl.hpMax >= 900 ? tmpl.hpMax : Math.round((tmpl.hpMax || 0) * DIFFICULTY_MULT),
      behaviors: scaledBehaviors,
    };
    logEvent(TE.COMBAT_START, { enemyId: e.id, enemyName: e.name, tier: e.tier, act: e.act, hp, composure, deckSize: deck.length + hand.length + discard.length, equipment: equipment.map(eq => eq.id), piles: pilesSnapshot() });
    setEnemy(e);
    setEnemyComposure(e.composureMax);
    setEnemyHp(e.hpMax);
    setEnemyBlock(0);
    setEnemyHitFlash(0);
    setDmgFloaters([]);
    setEnemyDmgMult(1.0);
    setPlayerDmgMult(1.0);
    setEnemyDmgTurns(0);
    setPlayerDmgTurns(0);
    setBoostNextHandlerCast(0);
    setLastIntentKinds([]);
    setEnemyDiscardCount(0);
    loomStoleThisCombatRef.current = false;
    enemyDefeatedHandledRef.current = false;
    redirectEnemyAttackRef.current = false;
    setEnemySkipNextTurn(false);
    setPouchGuard(false);
    setAbilitiesUsedThisTurn([]);
    setEnemyIntent(rollIntent(e));
    setIntentTick(t => t + 1);
    setPeekedNextIntent(null);
    // Powers don't persist between combats.
    setPowers([]);
    // Reset per-combat counters and player debuffs.
    setTray(initialV2Tray());
    setAmplifyPlaysThisCombat(0);
    setSapPlaysThisCombat(0);
    setCastsThisTurn(0);
    setCastsThisCombat(0);
    setRollOptIn(false);
    setLastRoll(null);
    setCombatRolls([]);
    setBackfireStreak(0);
    // v3.0: all v2.93 + v2.97 one-shot trigger flags live in
    // pendingTriggers. One clear replaces 11 individual setX(0/false).
    setPendingTriggers({});
    setHpAtTurnStart(hp);
    setLastCastDamage(0);
    // Tunnel Vision / RAGE resets removed 2026-05-31 (machinery ripped).
    // v2.34: wit LONG THREAD — meter + per-turn flags reset per combat.
    setLongThread(0);
    // v3.3: FFT strategy resets per combat.
    setScheduledEffects([]);
    setThornsCharges({ amount: 0, count: 0, weakOnReflect: 0, turnsRemaining: 0, schedule: undefined });
    setMirrorReflectCharges({ count: 0, capPerHit: 0 });
    setSkipAndReturnArmed(false);
    setPartialAsFullArmed(false);
    setNextSpellDoubleInitial(false);
    setNextSpellDoubleDot(false);
    setNextSpellDoubleDefensive(false);
    setNextSpellAddDefensiveDot(false);
    setNextSpellApplyToAll(false);
    setTutorArmed(false);
    setNextCardFree(false);
    setEnemySkipNextTurn(false);
    setComplimentSnap(null);
    // Handler defensive temp-HP buffer resets per combat.
    setTempHp(0);
    setTempHpTurns(0);
    setPlayerIncomingMult(1.0);
    setPlayerIncomingMultTurns(0);
    setWordsBank(0);
    // v3.4.23 — Crescendo buildup resets per combat.
    setCrescendoBuildup(0);
    setCrescendoBuildupRows([]);
    setUnblockedThisTurn(false);
    setCastWitEffectThisTurn(false);
    // v2.35: FOOTNOTE prompt — never persists between combats. Card
    // instances are rebuilt at combat start (uids re-issued, footnotes
    // reset to 0 implicitly since no skill has fired yet).
    setFootnotePromptActive(false);
    setWhistlePromptActive(false);
    setWhistlePick1Slot(null);
    setTreatPromptActive(false);
    setEatItPromptActive(false);
    setSacrificePromptActive(false);
    setGorgePromptActive(false);
    setWhisperDrawsPending(0);
    setFirstLureUsedThisTurn(false);
    setBuffetArmed(false);
    setLuresPlayedThisTurn([]);
    setLureNarrowing({});
    setNarrowChooserOpen(false);
    // v2.36: ACTUALLY— state. lastCastSnapshot starts null (no casts yet);
    // arguingBackThisTurn starts 0. Both never persist between combats.
    setLastCastSnapshot(null);
    setArguingBackThisTurn(0);
    // v2.37: HOLD ON — reactive interrupt flag + snapshot reset per combat.
    setHoldOnArmed(false);
    setHoldOnValue(0);
    // v2.38: SAYING SOMETHING WRONG — pending tokens reset per combat. The
    // delay/consequence loop is intra-combat only; a misstep doesn't carry
    // across fights (the apprentice gets a fresh slate when the next enemy
    // walks in).
    setPendingMissteps([]);
    // v2.39: combat turn counter reset to 1.
    setCombatTurn(1);
    // cornerTokens / intentHidden / stormOutFiredRef resets removed
    // 2026-05-31 (handler mechanics ripped).
    tutorFiredThisTurnRef.current = false;
    // Hit Me Again resets removed 2026-05-31 (power ripped).
    // v2.46: jnsq WON'T SHUT UP — commitment flag clears per combat. Per-
    // turn clear lives in endTurn (with the damage/dodge accounting).
    setWontShutUpArmed(false);
    // v2.48: jnsq AWKWARD PAUSE — both pause flags clear per combat. The
    // mechanic is intra-combat only; a doubled cast doesn't carry forward.
    setPauseHeld(false);
    setPauseHeldActive(false);
    // v2.52: jnsq DRUNKEN STAGGER — defensive flag clears per combat. The
    // dodge window is intra-turn / intra-combat only.
    setStaggerActive(false);
    // v2.33: handler Not Listening — pending absorb charges reset per combat.
    setNotListeningCharges(0);
    // v2.96: Hollow Weaver weave debt — reset per combat.
    setWeaveStacks(0);
    damagedEnemyThisTurnRef.current = false;
    weaveFireDamageRef.current = 0;
    // v3.0: braceArmedDraw + riposteCharge live in pendingTriggers and
    // were cleared by the setPendingTriggers({}) above. Only the
    // non-trigger hpLossThisTurn accumulator needs an explicit reset.
    setHpLossThisTurn(0);
    setNextAttackSwingReduction(0);
    setEscalatingSwingReduction(false);
    // v3.4.12: clear any leftover card-loss modal from the previous
    // combat. Belt-and-suspenders for the DoT-kills-before-steal fix —
    // even if some other path leaves the notice set, a fresh combat
    // should never start with a stale modal.
    setCardLossNotice(null);

    // Apply start-of-combat effects from equipment AND relics.
    let startBlockTotal = 0;
    let startEnergyBonus = 0;
    let startHandBonus = 0;
    let healOnStart = 0;
    let startDrawBonus = 0;
    let startCombatVulnTotal = 0;
    let startCombatWeakTotal = 0;
    for (const eq of equipment) {
      if (eq.bonus?.startBlock)              startBlockTotal       += eq.bonus.startBlock;
      if (eq.bonus?.energyOnCombatStart)     startEnergyBonus      += eq.bonus.energyOnCombatStart;
      if (eq.bonus?.extraStartHand)          startHandBonus        += eq.bonus.extraStartHand;
      if (eq.bonus?.healOnCombatStart)       healOnStart           += eq.bonus.healOnCombatStart;
      // Material-driven combat-start enemy debuffs (Burrgrass robes,
      // Cold Iron ring, etc.).
      if (eq.bonus?.startCombatVulnerable)   startCombatVulnTotal  += eq.bonus.startCombatVulnerable;
      if (eq.bonus?.startCombatWeak)         startCombatWeakTotal  += eq.bonus.startCombatWeak;
    }
    for (const { effect } of effectSources()) {
      const oc = effect?.onCombatStart;
      if (oc) {
        if (oc.block)  startBlockTotal += oc.block;
        if (oc.draw)   startDrawBonus  += oc.draw;
        if (oc.energy) startEnergyBonus += oc.energy;
        if (oc.hp)     healOnStart     += oc.hp;
      }
      if (effect?.startCombatVulnerable) startCombatVulnTotal += effect.startCombatVulnerable;
      if (effect?.startCombatWeak)       startCombatWeakTotal += effect.startCombatWeak;
    }
    // Apply familiar startOfTurnBlock for turn 1 as well — every-turn means
    // also turn 1. (Per-turn application happens in endTurn's working block.)
    const startTurnBlockTotal = effectSources().reduce(
      (s, x) => s + (x.effect?.startOfTurnBlock || 0), 0);
    startBlockTotal += startTurnBlockTotal;

    if (healOnStart > 0) {
      setHp(h => clamp(h + healOnStart, 0, maxHp));
      pushLog(`💚 +${healOnStart} HP (start of combat).`);
    }
    if (startCombatVulnTotal > 0) {
      adjustPlayerDmg(+0.25 * startCombatVulnTotal);
      pushLog(`💫 +${25*startCombatVulnTotal}% potency vs ${e.name} (start of combat).`);
    }
    if (startCombatWeakTotal > 0) {
      adjustEnemyDmg(-0.25 * startCombatWeakTotal);
      pushLog(`💢 ${e.name}: −${25*startCombatWeakTotal}% atk (start of combat).`);
    }
    // v2.9: Rabbit's startCombatPoise — combat-start composure shield.
    const startPoiseTotal = effectSources().reduce(
      (s, x) => s + (x.effect?.startCombatPoise || 0), 0);
    setBlock(startBlockTotal);
    setPoise(startPoiseTotal);
    setEnergy(energyPerTurnRefill() + startEnergyBonus);
    // v2.9: Beetle's firstHitReduction — one-shot per combat. Tracked
    // on a state flag consumed by the enemy intent handler.
    const firstHitReduction = effectSources().reduce(
      (s, x) => s + (x.effect?.firstHitReduction || 0), 0);
    setBeetleAbsorb(firstHitReduction);
    // v2.16: wit characters open every combat with a stub annotation
    // already attached. Fixes the act-0/1 floor problem — wit's slow
    // burn was dying before BURST could ever fire. The remark is
    // *already written down*.
    if (selectedCharacter?.lane === 'wit') {
      setEnemy(prevE => prevE ? {
        ...prevE,
        annotation: {
          id: 'wv2-ann-cited',
          name: 'Cited in passing',
          phrase: '*[cited]',
          effect: { damageOnTurnEnd: 1 },
          turnsRemaining: 2,
          stub: true,
        },
      } : prevE);
      pushLog(`📝 You arrive having already taken notes.`);
    }

    if (opts.forcedHand && opts.forcedDeck) {
      // Tutorial path: deterministic deck + hand. Skip shuffle entirely.
      setHand(opts.forcedHand.map(id => ({ ...CARDS_BY_ID[id], uid: uid() })));
      setDeck(opts.forcedDeck.map(id => ({ ...CARDS_BY_ID[id], uid: uid() })));
      setDiscard([]);
    } else {
      // v3.1.3: include tray + exiled in fullDeck pool. The explicit
      // combat-end merges (pickReward, boss-path) already fold these
      // in, but this is the defensive catch — sidequest exits and any
      // other transition path that bypasses those merges still have
      // tray/exiled cards intact here, and we don't want them lost.
      const trayCardsIn = extractTrayCardsForReturn(tray);
      // Powers are once-per-combat installs (removed from circulation when
      // played, can't be re-cast that combat), but the card itself is NOT
      // consumed for the run — it returns to the deck so it's re-drawable in
      // future combats. `powers` still holds last combat's installs here:
      // setPowers([]) above is async and doesn't mutate this closure value.
      // Filter out tokens (e.g. Full Pockets' Snack): generated cards that
      // must never persist into a fresh combat's deck. A played Snack is
      // exiled, and the combat-end merges fold exiled back into the deck —
      // this filter is the single scrub point that keeps them out.
      const fullDeck = [...deck, ...hand, ...discard, ...exiled, ...trayCardsIn, ...powers].filter(c => !c.token);
      setExiled([]);
      // v2.13: jnsq +1 hand size at combat start (chaos dice need full
      // trays to roll). Real-play impact only — sim AI runs both ways.
      const jnsqBonus = selectedCharacter?.lane === 'jnsq' ? 1 : 0;
      const drawn = drawFromPiles(shuffle(fullDeck), [], HAND_SIZE + startHandBonus + startDrawBonus + jnsqBonus + extraDrawPerTurn());
      setDeck(drawn.deck);
      setHand(drawn.hand);
      setDiscard([]);
    }
    setStage('combat');
    const tierTag = e.tier === 'elite' ? ' — elite' : e.tier === 'boss' ? ' — BOSS' : '';
    const composureNote = e.composureMax < 999 ? `Composure ${e.composureMax}` : '';
    const hpNote = e.hpMax < 999 ? `HP ${e.hpMax}` : '';
    const tags = [composureNote, hpNote].filter(Boolean).join(' · ');
    pushLog(`⚔ ${e.name} (${tags})${tierTag}`);
  }

  function drawFromPiles(deckIn, discardIn, n, handIn = []) {
    let deck = [...deckIn];
    let discard = [...discardIn];
    const hand = [...handIn];
    for (let i = 0; i < n; i++) {
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck = shuffle(discard); discard = [];
      }
      const c = deck.shift();
      hand.push({ ...c, uid: uid() });
    }
    return { deck, discard, hand };
  }

  function strikeBonusTotal() {
    return equipment.reduce((s, eq) => s + (eq.bonus?.strikeBonus || 0), 0)
         + effectSources().reduce((s, x) => s + (x.effect?.passiveStrikeBonus || 0), 0);
  }

  // Returns the extra flat damage to add this Effect cast from everyNth-effect
  // triggers across all effect sources. Advances the global effectCount.
  function consumeEveryNthEffectBonus() {
    const nextCount = effectCount + 1;
    setEffectCount(nextCount);
    let bonus = 0;
    for (const { effect, sourceName } of effectSources()) {
      const every = effect?.everyNthEffect;
      if (!every) continue;
      if (nextCount % every.n === 0) {
        bonus += every.extraDamage || 0;
        pushLog(`📿 ${sourceName}: +${every.extraDamage} damage.`);
      }
    }
    return bonus;
  }

  // Effective energy cost for a card right now. Most cards return card.cost
  // unchanged; Amplify escalates by +1 for every prior play this combat.
  function effectiveCardCost(card) {
    if (card?.id === 'c-amplify') return (card.cost || 0) + amplifyPlaysThisCombat;
    if (card?.id === 'c-sap') return (card.cost || 0) + sapPlaysThisCombat;
    let c = card?.cost || 0;
    // v3.4.59 — slot-cost-reduction powers.
    const hasPower = (id) => powers.some(p => p.installPower?.id === id);
    if (card?.slot === 'intro' && hasPower('introCheaper')) c = Math.max(0, c - 1);
    if (card?.slot === 'subject' && hasPower('subjectCheaper')) c = Math.max(0, c - 1);
    if (card?.slot === 'target' && hasPower('targetCheaper')) c = Math.max(0, c - 1);
    // Open Door Policy — the first lure played each turn costs 0.
    if (card?.slot === 'lure' && hasPower('openDoor') && !firstLureUsedThisTurn) c = 0;
    // v3.4.59 — "I Know Just What to Say" makes the next card played free.
    if (nextCardFree) c = 0;
    return c;
  }

  // Click the active Pack Tactic in the tray to dismiss it — sends the
  // tactic card to the discard pile and clears the slot. This is the manual
  // off-switch for whichever Pack Tactic is currently engaged.
  function discardActiveTactic() {
    if (stage !== 'combat') return;
    if (!tray.tactic) return;
    const dismissed = tray.tactic;
    logEvent(TE.TACTIC_CHANGE, { action: 'discard', tacticId: dismissed.tactic?.id || null, enemyId: enemy?.id || null });
    setTray(p => syncTrayLegacy({ ...p, tactic: null }));
    setDiscard(d => [...d, { ...dismissed, uid: uid() }]);
    pushLog(`📜 ${dismissed.name} dismissed — sent to discard.`);
  }

  function playCard(handIdx, opts = {}) {
    if (stage !== 'combat') return;
    const card = hand[handIdx];
    if (!card) return;
    const cost = effectiveCardCost(card);
    if (cost > energy) { pushLog(`Not enough energy for ${card.name}.`); return; }
    setEnergy(e => e - cost);
    // Stash for refund-on-dismiss: if this card only ARMS a prompt (does
    // nothing else until you target), holding it lets a Dismiss snap the card
    // + energy back. Replaced/cleared on every play, so resolving the prompt
    // then acting again can't double-refund. The card ref lands in
    // discard/exiled/powers under this same uid, so cancel pulls it from there.
    const armsCancelablePrompt =
      card.installPower?.id === 'wellDrilled' ||
      card.installPower?.id === 'houseRules' ||
      !!(card.effects && (card.effects.whistleSwap
        || card.effects.treatExtend || card.effects.eatLureNow
        || card.effects.sacrificeForValue || card.effects.gorge
        || card.effects.buffetArmed || card.effects.narrowLure));
    setArmedRefund(armsCancelablePrompt
      ? { card, cost, isPower: card.type === 'power', exhaust: !!card.effects?.exhaust }
      : null);
    // v3.4.59 — consume "I Know Just What to Say" flag if it was the reason
    // this card is free. Don't consume on the card that armed it.
    if (nextCardFree && card?.effects?.nextCardFree !== true) {
      setNextCardFree(false);
    }
    // v3.4.23 (Alan): Words Bank is now Crescendo-school-only. Only
    // cards with schoolId === 'crescendo' tick the bank. Cap halved
    // from 20 → 10 so building feels achievable. The bank is proof of
    // commitment to the school, not a passive resource that fills off
    // any play.
    if (card.schoolId === 'crescendo') {
      setWordsBank(b => Math.min(b + 1, 10));
    }
    // v2.46: WON'T SHUT UP — clear the commitment flag when ANY jnsq-lane
    // card is played AFTER the rider armed. The arming itself happens in
    // castV2SentenceSpell (the soup target's cast), which fires AFTER the
    // playCard splice that staged the target — so the soup card's own play
    // can't clear the flag (armed is still false at that moment). Any
    // subsequent jnsq play (word, modifier, skill) counts as "kept going".
    // v3.0 cycle 4: tighten Won't Shut Up dodge gate. Was: "any jnsq
    // card counts as follow-up" → 89.9% dodge rate (109 arms, 1 damage
    // fire). Now requires either: a jnsq TARGET card, OR a jnsq tier-2+
    // word/modifier. Cheap basic words no longer count — the commitment
    // is real. Per nerd-tester cycle 2: "turns 89.9% dodge into ~70%
    // with collateral pressure to draft real chain pieces."
    const isJnsqFollowUp = card.lane === 'jnsq'
      && (card.slot === 'target' || card.type === 'effect' || (card.tier || 1) >= 2);
    if (wontShutUpArmed && isJnsqFollowUp) {
      setWontShutUpArmed(false);
      setWontShutUpTelemetry(t => ({ ...t, dodges: t.dodges + 1 }));
      pushLog(`🗣 ...kept going.`);
      logEvent('jnsq.wontShutUp.dodge', {
        cardId: card.id, enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    if (card.id === 'c-amplify') setAmplifyPlaysThisCombat(n => n + 1);
    if (card.id === 'c-sap') setSapPlaysThisCombat(n => n + 1);
    logEvent(TE.CARD_PLAY, { cardId: card.id, cardName: card.name, type: card.type, cost, energyBefore: energy, handSize: hand.length, enemyId: enemy?.id });
    const logBits = [card.name];

    // Powers don't apply effects directly — they install themselves on the
    // player's `powers` array and trigger via the turn-hooks instead.
    if (card.type === 'power') {
      setPowers(ps => [...ps, card]);
      setHand(h => h.filter((_, i) => i !== handIdx));
      // Full Pockets — a one-time payoff: drop a single Treat token into hand
      // on install (no longer mints one every turn). uid built outside the
      // updater so the functional setHand stays pure under StrictMode.
      if (card.installPower?.id === 'fullPockets') {
        const treat = CARDS.find(c => c.id === 'c-snack');
        if (treat) {
          const tok = { ...treat, uid: uid() };
          setHand(h => [...h, tok]);
          pushLog(`🍖 Full Pockets — a Treat turns up in your hand.`);
        }
      }
      // Well-Drilled — arm a click-target prompt. armTargetingPrompt is
      // defined later in this function (const, in TDZ here), so set the
      // prompt flags inline, clearing the other click prompts for the same
      // mutual-exclusion guarantee.
      if (card.installPower?.id === 'wellDrilled') {
        setWhistlePromptActive(false); setWhistlePick1Slot(null);
        setTreatPromptActive(false);
        setEatItPromptActive(false);
        setSacrificePromptActive(false);
        setGorgePromptActive(false);
        setHouseRulesPromptActive(false);
        setWellDrilledPromptActive(true);
        pushLog(`🎯 Well-Drilled armed — pick an animal; every copy of it gains +2 attack.`);
      }
      if (card.installPower?.id === 'houseRules') {
        setWhistlePromptActive(false); setWhistlePick1Slot(null);
        setTreatPromptActive(false);
        setEatItPromptActive(false);
        setSacrificePromptActive(false);
        setGorgePromptActive(false);
        setWellDrilledPromptActive(false);
        setHouseRulesPromptActive(true);
        pushLog(`🏠 House Rules armed — pick an animal; every copy of it stays +2 turns.`);
      }
      // Hit Me Again install hook removed 2026-05-31 (power ripped).
      // v2.47: DRUNKEN CONFIDENCE — telemetry-only install count. The read
      // path is `powers.some(p => p.installPower?.id === 'drunken-confidence')`
      // wherever the +50% cast bonus / +2 incoming penalty applies.
      if (card.installPower?.id === 'drunken-confidence' || card.id === 'jv2-p-hold-my-drink') {
        setDrunkenTelemetry(t => ({ ...t, installs: t.installs + 1 }));
        logEvent('jnsq.drunken.install', { enemyId: enemy?.id, enemyTier: enemy?.tier });
      }
      // v2.49: BABBLING — telemetry-only install count. The cap-lift + 0.6×
      // 2nd-cast scaling read `powers.some(p => p.installPower?.id ===
      // 'babbling')` in castStagedSpell and in the MAX_CASTS prop derivation.
      if (card.installPower?.id === 'babbling' || card.id === 'jv2-p-wait-and-another-thing') {
        setBabblingTelemetry(t => ({ ...t, installs: t.installs + 1 }));
        logEvent('jnsq.babbling.install', { enemyId: enemy?.id, enemyTier: enemy?.tier });
      }
      pushLog(`📿 ${card.name} — power active.`);
      return;
    }

    // bumpTunnelVisionIfHandler + requiresRage gate removed 2026-05-31
    // with the chutzpah → handler pivot. No-op shim retained where called.
    const bumpTunnelVisionIfHandler = () => {};

    // Handler Animal Summoner — lure cards stage into a specific tray slot.
    // TACTIC card — persistent slot card for handler. Replaces any
    // existing tactic (old one → discard). Birds of a Feather has a
    // play-time validator (requires exactly one animal in play).
    if (card.slot === 'tactic' && card.tactic) {
      if (card.tactic.requiresExactlyOneAnimal) {
        const animalCount = ['intro', 'subject', 'target']
          .filter(s => tray[s]?.kind === 'animal').length;
        if (animalCount !== 1) {
          setEnergy(e => e + (card.cost || 0));
          pushLog(`📜 ${card.name} requires exactly one animal in play — currently ${animalCount}.`);
          return;
        }
      }
      const previous = tray.tactic;
      // Fountain of Youth is the only charge-limited tactic: it lasts for 3
      // lure plays (a Buffet spread counts as one), then exhausts.
      const tacticEnvelope = card.tactic.id === 'youth'
        ? { ...card, usesRemaining: 3 }
        : { ...card };
      logEvent(TE.TACTIC_CHANGE, {
        action: previous ? 'replace' : 'engage',
        tacticId: card.tactic.id,
        replacedTacticId: previous?.tactic?.id || null,
        enemyId: enemy?.id || null,
      });
      setTray(p => syncTrayLegacy({ ...p, tactic: tacticEnvelope }));
      setHand(h => h.filter((_, i) => i !== handIdx));
      if (previous) {
        setDiscard(d => [...d, { ...previous, uid: uid() }]);
        pushLog(`📜 ${previous.name} replaced by ${card.name}.`);
      } else {
        pushLog(`📜 Tactic engaged: ${card.name}.`);
      }
      // Feather is the combine-setup tactic: drawing 1 makes it card-neutral
      // and digs for the matching lures you need to stack a three-of-a-kind.
      if (card.tactic.id === 'feather') { drawCards(1); pushLog(`🪶 Birds of a Feather — draw 1.`); }
      return;
    }

    if (card.slot === 'lure' && card.summon) {
      const order = ['intro', 'subject', 'target'];
      // Special-lure FEED-TO-EXTEND (Alan, 2026-06-03): a special lure
      // replayed while its named animal is already on the board doesn't stage
      // a second copy — it feeds the resident, extending its stay by one turn.
      // The lure card is consumed to discard. Foundational lures keep their
      // own feedKey family-feeding path (feedAnimalsWithLure) and skip this.
      if (card.special && card.summon.animalId) {
        const fedSlot = order.find(s => tray[s]?.kind === 'animal' && tray[s].animalId === card.summon.animalId);
        if (fedSlot) {
          setTray(p => syncTrayLegacy({ ...p, [fedSlot]: { ...p[fedSlot], durationRemaining: (p[fedSlot].durationRemaining || 0) + 1, feedReceived: true } }));
          setHand(h => h.filter((_, i) => i !== handIdx));
          setDiscard(d => [...d, { ...card, uid: uid() }]);
          if (buffetArmed) setBuffetArmed(false); // playing a lure to extend still disarms Buffet
          const animal = getAnimal(card.summon.animalId);
          pushLog(`🍖 ${animal?.icon || ''} ${animal?.name || card.summon.animalId} fed — stays one turn longer.`);
          return;
        }
      }
      // Occupied placeholder slots (Mouse House spans) are NOT empty.
      const emptySlots = order.filter(s => tray[s] == null);
      if (emptySlots.length === 0) {
        // Refund the EFFECTIVE cost (Open Door may have made this lure free).
        setEnergy(e => e + cost);
        pushLog(`🪱 No empty stage slot for ${card.name} — refunded.`);
        return;
      }
      // Buffet — if armed, place the lure in EVERY empty slot at once
      // (one envelope per slot, single card consumed). Otherwise stage in
      // the explicit targetSlot (drag-and-drop) or fall back to first empty.
      // EXCEPTION (Alan, 2026-06-01): a predator-chain lure (Fish Food →
      // Salmon → Bear) under Buffet spreads to the two END slots only — never
      // the middle — so the salmon land on opposite ends and don't sit
      // adjacent (a bear eats an adjacent salmon). Up to two, matching the
      // 2-bear cap.
      const summonIds = card.summon?.animalIds || (card.summon?.animalId ? [card.summon.animalId] : []);
      const isChainLure = summonIds.some(id => ANIMALS[id]?.predatorChain);
      const endSlotNames = [order[0], order[order.length - 1]];
      let targetSlots;
      if (buffetArmed && isChainLure) {
        const ends = endSlotNames.filter(s => tray[s] == null);
        targetSlots = ends.length > 0 ? ends : [emptySlots[0]];
      } else if (buffetArmed) {
        targetSlots = emptySlots;
      } else if (opts.targetSlot && order.includes(opts.targetSlot) && tray[opts.targetSlot] == null) {
        targetSlots = [opts.targetSlot];
      } else {
        targetSlots = [emptySlots[0]];
      }
      // Build one envelope per target slot. Lures may carry either a
      // single `summon.animalId` (deterministic — Birdseed → Sparrow) or
      // `summon.animalIds` (random — Tender Greens). Random choice is
      // resolved at TRANSFORM, not stage. summonSet (e.g. 'tender-greens')
      // flows through for row-bonus detection.
      //
      // BUFFET SPREAD: only the FIRST envelope carries `card` (the actual
      // played card resource); the others get `card: null` so they don't
      // each recycle a copy to discard on transform.
      // NURTURE TACTIC: the lure resolves immediately on placement —
      // animal envelopes go straight into the slots, card lands in discard
      // right now. Birds of a Feather tactic overrides the random pool so
      // the spawned animal matches the one already in play. Fountain of
      // Youth grants +1 duration to summoned animals.
      const activeTacticId = tray.tactic?.tactic?.id;
      const isNurture = activeTacticId === 'nurture';
      const isFeather = activeTacticId === 'feather';
      const isYouth   = activeTacticId === 'youth';
      // Pick the species for Birds of a Feather: use the first existing
      // animal in play. Same species applies to ALL spread slots.
      let featherSpecies = null;
      if (isFeather) {
        const existing = ['intro', 'subject', 'target'].map(s => tray[s]).find(v => v?.kind === 'animal');
        if (existing) featherSpecies = existing.animalId;
      }
      const newSlots = {};
      for (let i = 0; i < targetSlots.length; i++) {
        const s = targetSlots[i];
        if (isNurture) {
          // Resolve the animal NOW, build animal envelope directly.
          const nurturePool = card.summon.animalIds ? narrowedPool(card.id, card.summon.animalIds) : null;
          let resolvedId = featherSpecies
            || card.summon.animalId
            || (nurturePool ? nurturePool[Math.floor(Math.random() * nurturePool.length)] : null);
          // 3.5% elite roll on instant Nurture summons too.
          const baseForRoll = ANIMALS[resolvedId];
          if (baseForRoll?.elite && Math.random() < 0.035) {
            resolvedId = baseForRoll.elite;
            const eliteDef = ANIMALS[resolvedId];
            pushLog(`✨ Rare summon! ${eliteDef?.icon} ${eliteDef?.name} arrives instead of a ${baseForRoll.name}.`);
          }
          const animal = getAnimal(resolvedId);
          newSlots[s] = {
            kind: 'animal',
            animalId: resolvedId,
            durationRemaining: (animal?.duration || 3) + (isYouth ? 1 : 0),
            predatorProgress: 0,
            adjacentSpawnProgress: 0,
            summonSet: card.summon.summonSet || null,
          };
        } else {
          newSlots[s] = {
            kind: 'lure',
            uid: uid(),
            cardId: card.id,
            cardName: card.name,
            card: i === 0 ? card : null,
            turnsRemaining: card.summon.turnsToArrive,
            // Birds of a Feather: force the species via animalId.
            animalId: featherSpecies || card.summon.animalId || null,
            animalIds: featherSpecies ? null : (card.summon.animalIds || null),
            summonSet: card.summon.summonSet || null,
            youthBonus: isYouth ? 1 : 0,
          };
        }
      }
      // Fountain of Youth: this lure play (buffet spread = one play) consumes
      // one of three charges. When the last charge is spent, the tactic
      // exhausts to the exile pile.
      let tacticUpdate = {};
      let youthExhaustedCard = null;
      if (isYouth) {
        const remaining = (tray.tactic.usesRemaining ?? 3) - 1;
        if (remaining <= 0) {
          youthExhaustedCard = tray.tactic;
          tacticUpdate = { tactic: null };
        } else {
          tacticUpdate = { tactic: { ...tray.tactic, usesRemaining: remaining } };
        }
      }
      setTray(p => syncTrayLegacy({ ...p, ...newSlots, ...tacticUpdate }));
      if (youthExhaustedCard) {
        setExiled(ex => [...ex, { ...youthExhaustedCard, uid: uid() }]);
        pushLog(`📜 Fountain of Youth runs dry — the tactic exhausts.`);
      } else if (isYouth) {
        pushLog(`💧 Fountain of Youth — ${tacticUpdate.tactic.usesRemaining} use${tacticUpdate.tactic.usesRemaining === 1 ? '' : 's'} left.`);
      }
      setHand(h => h.filter((_, i) => i !== handIdx));
      // Open Door Policy: this lure consumed the free-first-lure slot.
      setFirstLureUsedThisTurn(true);
      // Record the feed type for the starvation check at end of turn.
      if (card.feedKey) setLuresPlayedThisTurn(prev => [...prev, card.feedKey]);
      if (isNurture) {
        // Nurture consumed the card — push to discard immediately. The lure
        // skipped the envelope-recycle path so do it here.
        setDiscard(d => [...d, { ...card, uid: uid() }]);
        pushLog(`🌿 Nurture — ${card.name} resolves immediately in ${targetSlots.join(', ')}.`);
      }
      if (targetSlots.length > 1 && !isNurture) {
        pushLog(`🍽 Buffet — ${card.name} spreads across ${targetSlots.length} slots (${targetSlots.join(', ')}).`);
      }
      // Buffet disarms the moment a lure is staged — ANY lure, even one that
      // (with the board nearly full) only landed in a single slot. The card
      // text promises it "stays armed until you play a lure," so the spread
      // count is irrelevant. (Bug fix 2026-06-05: previously only disarmed on a
      // 2+ slot spread or a chain lure, so a 1-slot buffet play left it armed.)
      if (buffetArmed) setBuffetArmed(false);
      if (targetSlots.length === 1 && !isNurture) {
        if (card.summon.animalId || featherSpecies) {
          const animalId = featherSpecies || card.summon.animalId;
          const animal = getAnimal(animalId);
          pushLog(`🪱 ${card.name} placed in slot ${order.indexOf(targetSlots[0]) + 1}. ${animal?.icon || ''} ${animal?.name || animalId} arrives in ${card.summon.turnsToArrive} turn${card.summon.turnsToArrive === 1 ? '' : 's'}.`);
        } else {
          pushLog(`🪱 ${card.name} placed in slot ${order.indexOf(targetSlots[0]) + 1}. Something arrives in ${card.summon.turnsToArrive} turn${card.summon.turnsToArrive === 1 ? '' : 's'}.`);
        }
      }
      logEvent(TE.HANDLER_SUMMON, {
        cardId: card.id,
        slots: targetSlots.length,
        buffet: targetSlots.length > 1 && !isNurture,
        instant: isNurture,
        feedKey: card.feedKey || null,
        tactic: activeTacticId || null,
        enemyId: enemy?.id || null,
      });
      advanceTutorialStep('lure');
      return;
    }

    // v2 sentence engine routing by slot.
    if (card.slot === 'intro' || card.slot === 'subject') {
      const prev = tray[card.slot];
      if (prev) {
        setHand(h => [...h, prev]);
        setEnergy(e => e + (prev.cost || 0));
        pushLog(`↩ Replaced ${card.slot} ${prev.name}.`);
      }
      setTray(p => syncTrayLegacy({ ...p, [card.slot]: card }));
      // v3.4.19 (Alan): solo staging bonus per slot — intros add Block,
      // subjects stay pure stat-banks (the "specialist piece"), targets
      // get their bonus in the target branch below. Layered before the
      // card's own effects so per-card riders still fire on top.
      const slotBonus = STAGE_SLOT_BONUS[card.slot] || {};
      applySideEffects({ ...slotBonus, ...(card.effects || {}) }, logBits);
      setHand(h => h.filter((_, i) => i !== handIdx));
      bumpTunnelVisionIfHandler();
      pushLog(logBits.join(' · ') + `  →  📜 ${card.slot} staged`);
      // v3.4.57 (Alan) — Auto partial-row tutor was too strong. Now the
      // ONLY way to trigger sentence-finishes-itself is to play "The Tutor"
      // buff card first (sets tutorArmed = true). When armed AND the
      // just-staged card completes an intro+subject same-row match with
      // an empty target slot, pull the matching target from deck or
      // discard. Single-fire; consumes tutorArmed only on actual pull.
      // v3.4.66 — wizard-agnostic. Any lane can play The Tutor; it only
      // FIRES when an intro+subject pair sharing setId exists (i.e., the
      // player has FFT rows in their deck — currently only wit).
      if (tutorArmed && card.setId) {
        const post = { ...tray, [card.slot]: card };
        const introSet = post.intro?.setId;
        const subjectSet = post.subject?.setId;
        if (introSet && subjectSet && introSet === subjectSet && !post.target) {
          const findFn = c => c.setId === introSet && c.slot === 'target';
          // v3.4.72 (Alan) — Tutor now also checks hand. Previously a target
          // already in your hand wouldn't qualify, which felt like a bug
          // ("why didn't my Tutor fire?"). Hand pull places it into the tray
          // for free, same as deck/discard — saving the target's energy cost.
          //
          // v3.4.79 (Alan) — CRITICAL FIX: this block previously called
          // setHand/setDeck/setDiscard with stale closure snapshots
          // (e.g. `setHand(hand.filter(...))`). The just-staged card's own
          // setHand on line 5699 uses a functional updater — React batches
          // both, but the snapshot-based call here would clobber the
          // functional update, leaving the staged card in hand. Net result:
          // the player ended up with TWO copies of the staged intro after
          // every Tutor fire. Fixed by switching to functional updaters
          // that filter by card uid, immune to state-batching order.
          const targetInHand = hand.find(findFn);
          const targetInDeck = !targetInHand ? deck.find(findFn) : null;
          const targetInDiscard = !targetInHand && !targetInDeck ? discard.find(findFn) : null;
          let pulled = null;
          let fromPile = null;
          if (targetInHand) {
            pulled = targetInHand;
            fromPile = 'hand';
            const pulledUid = pulled.uid;
            setHand(h => h.filter(c => c.uid !== pulledUid));
          } else if (targetInDeck) {
            pulled = targetInDeck;
            fromPile = 'deck';
            const pulledUid = pulled.uid;
            setDeck(d => d.filter(c => c.uid !== pulledUid));
          } else if (targetInDiscard) {
            pulled = targetInDiscard;
            fromPile = 'discard';
            const pulledUid = pulled.uid;
            setDiscard(d => d.filter(c => c.uid !== pulledUid));
          }
          if (pulled) {
            // v3.4.65 (Alan): The Tutor places the target DIRECTLY IN THE
            // SPELL TRAY so the cast is ready to fire. Energy is NOT
            // charged — the 3E + exhaust cost on The Tutor itself is the
            // payment. Target slot bonus (compDmg +1) still applies.
            const stagedCard = { ...pulled, uid: uid() };
            setTray(p => syncTrayLegacy({ ...p, target: stagedCard }));
            const slotBonus = STAGE_SLOT_BONUS.target || {};
            applySideEffects({ ...slotBonus, ...(pulled.effects || {}) }, []);
            setTutorArmed(false);
            setTutorFlash({ cardName: pulled.name || pulled.phrase || 'card', fromPile, t: Date.now() });
            pushLog(`📚 The Tutor stages ${pulled.name || pulled.phrase} from ${fromPile} — your effect is ready to cast.`);
          }
        }
      }
      // v2.88: pass the slot so the tutorial advances on intro / subject
      // separately. Was a generic 'played-word' that conflated both.
      advanceTutorialStep(card.slot);
      return;
    }

    if (card.slot === 'modifier') {
      if ((tray.modifiers || []).length >= 2) {
        setEnergy(e => e + (card.cost || 0));
        pushLog(`Two modifiers already staged — can't add a third.`);
        return;
      }
      // v2.41: footnoteSelfOnStage — the staged instance gains +1 footnote on
      // itself before it lands in the tray. Self-referential rhetorical move;
      // the cast immediately reads the bumped stat through computeSpellDamage's
      // footnote-aware stat sum. Bumps the in-tray copy only — the source
      // card object in hand (already removed via setHand below) doesn't
      // need updating.
      const stagedCard = card.effects?.footnoteSelfOnStage
        ? { ...card, footnotes: (card.footnotes || 0) + 1 }
        : card;
      setTray(p => syncTrayLegacy({ ...p, modifiers: [...(p.modifiers || []), stagedCard] }));
      applySideEffects(card.effects || {}, logBits);
      if (card.effects?.footnoteSelfOnStage) {
        logBits.push(`📖 self-footnoted (+1 wit on this card)`);
      }
      setHand(h => h.filter((_, i) => i !== handIdx));
      bumpTunnelVisionIfHandler();
      pushLog(logBits.join(' · ') + `  →  ✨ modifier staged`);
      return;
    }

    if (card.slot === 'target') {
      if (!tray.intro || !tray.subject) {
        setEnergy(e => e + (card.cost || 0));
        pushLog(`Need an intro AND a subject before playing a target.`);
        return;
      }
      // Replace any existing target the way intro/subject replacement works.
      if (tray.target) {
        setHand(h => [...h, tray.target]);
        setEnergy(e => e + (tray.target.cost || 0));
        pushLog(`↩ Replaced target ${tray.target.name || tray.target.phrase}.`);
      }
      setTray(p => syncTrayLegacy({ ...p, target: card }));
      // v3.4.19 — solo staging bonus for targets: small composure chip
      // damage on stage. The "the moment you finish a thought it lands
      // a little" beat. Per-card card.effects (rare on targets) still
      // fire on top.
      const slotBonus = STAGE_SLOT_BONUS[card.slot] || {};
      applySideEffects({ ...slotBonus, ...(card.effects || {}) }, logBits);
      setHand(h => h.filter((_, i) => i !== handIdx));
      bumpTunnelVisionIfHandler();
      pushLog((logBits.length > 0 ? logBits.join(' · ') + ' · ' : '') + `🎯 Target staged: ${card.phrase} — hit CAST when ready.`);
      return;
    }

    // v2.5: GESTURE slot — fires immediate damage and exhausts. Bypasses
    // the tray entirely. The "I just hit them" attack archetype:
    // hand gestures, shouts, familiar interjections.
    // v2.10: ANNOTATION — wit-only. Attaches to enemy as a persistent
    // debuff (3-4 turns). One slot per enemy; new ones overwrite. The
    // card itself goes to discard (cycles like a skill card). Annotations
    // don't enter the tray and don't count against the cast cap.
    if (card.slot === 'annotation') {
      if (!enemy) return;
      const prev = enemy.annotation;
      if (prev) pushLog(`📝 The old note (${prev.name}) is overwritten.`);
      setEnemy(e => e ? {
        ...e,
        annotation: {
          id: card.id, name: card.name, phrase: card.phrase,
          effect: card.annotationEffect || {},
          turnsRemaining: card.duration || 3,
        },
      } : e);
      pushLog(`📝 Annotated ${enemy.name}: ${card.phrase}`);
      // NOTE: energy was already deducted by playCard's outer gate.
      setDiscard(d => [...d, card]);
      setHand(h => h.filter((_, i) => i !== handIdx));
      return;
    }
    if (card.slot === 'gesture') {
      const ge = card.gestureEffect || {};
      const lane = card.lane || 'wit';
      const trayStat = tray[lane] || 0;
      const trayBonus = trayStat * (ge.trayMultiplier || 0);
      let dmg = (ge.damage || 0) + trayBonus;
      const dmgType = ge.damageType || 'composure';
      const mult = (dmgType === 'physical')
        ? (enemy?.effectiveness?.physical ?? 1.0)
        : (enemy?.effectiveness?.[lane] ?? 1.0);
      dmg = Math.round(dmg * mult * playerDmgMult);
      pushLog(`${ge.icon || '✊'} ${card.phrase || card.name} → ${dmg} ${dmgType === 'physical' ? 'phys' : 'comp'}`);
      if (dmgType === 'physical') applyDamageToEnemyHp(dmg);
      else                        applyDamageToEnemyComposure(dmg);
      // Apply riders (weak/vulnerable on the enemy).
      if (ge.rider?.weak)       { applyExpiringWeak(ge.rider.weak);  pushLog(`💢 enemy −${25*ge.rider.weak}% atk (3 turns)`); }
      if (ge.rider?.vulnerable) { applyExpiringVuln(ge.rider.vulnerable); pushLog(`🩸 enemy Vulnerable +${ge.rider.vulnerable} (your spells +${25*ge.rider.vulnerable}%, 3 turns)`); }
      if (ge.rider?.block)      { setBlock(b => b + ge.rider.block); pushLog(`🛡 +${ge.rider.block}`); }
      // v3.0 multi-hit: gestures can arm a per-swing reduction.
      if (ge.rider?.nextAttackSwingReduction) {
        setNextAttackSwingReduction(n => Math.max(n, ge.rider.nextAttackSwingReduction));
        pushLog(`🪨 next enemy attack: −${ge.rider.nextAttackSwingReduction} per swing`);
      }
      if (ge.draw) drawCards(ge.draw);
      if (ge.stripEnemyBlock)   { setEnemyBlock(b => Math.max(0, b - ge.stripEnemyBlock)); pushLog(`🛇 Stripped ${ge.stripEnemyBlock} enemy block.`); }
      // +1 Loudness on handler gestures removed 2026-05-31 — Loudness mechanic
      // dormant under the Animal Summoner pivot. No consumers exist for it.
      // Exhaust by default — gestures are one-shot per acquisition.
      if (ge.exhaust !== false) setExiled(ex => [...ex, card]);
      else                      setDiscard(d => [...d, card]);
      setHand(h => h.filter((_, i) => i !== handIdx));
      return;
    }

    // ---- BACK-COMPAT (pre-v2 word/effect cards from event-grants etc.) ----
    if (card.type === 'word') {
      const stats = card.stats || {};
      const cardTags = card.tags || [];
      setTray(prev => ({
        ...prev,
        handler: prev.handler + (stats.handler || 0),
        wit:      prev.wit      + (stats.wit      || 0),
        jnsq:     prev.jnsq     + (stats.jnsq     || 0),
        phrases:  [...prev.phrases, card.phrase || card.name],
        tags:     [...prev.tags, ...cardTags],
        words:    [...prev.words, card],
      }));
      applySideEffects(card.effects || {}, logBits);
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(logBits.join(' · ') + `  →  📜 staged`);
      advanceTutorialStep('played-word');
      return;
    }
    if (card.type === 'effect') {
      const prevEffect = tray.effectCard;
      setTray(prev => ({ ...prev, effectCard: card, target: card }));
      if (prevEffect) {
        setHand(h => [...h, prevEffect]);
        setEnergy(e => e + (prevEffect.cost || 0));
        pushLog(`↩ Replaced ${prevEffect.name} — returned to hand.`);
      }
      setHand(h => h.filter((_, i) => i !== handIdx));
      pushLog(`🎯 ${card.name} sealed — ready to CAST.`);
      return;
    }

    // v2.38: SAYING SOMETHING WRONG — Misstep token manual discard. The
    // token enters the regular skill-play path; we intercept here to log
    // the "took it back" choice cleanly and add telemetry. The token's
    // `exhaust: true` flag routes it to exiled via the standard path
    // below, so we fall through after the log + event.
    if (card.id === MISSTEP_TOKEN.id) {
      pushLog(`📜 Misstep discarded (1 Energy spent). The room moves on.`);
      logEvent('wit.missTepDiscarded', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // SKILL CARD — pure utility, no stat / spell. Fires immediately.
    const fx = card.effects || {};
    // v3.1.5 BUGFIX: handle discardHand INLINE here, before applySideEffects.
    // Two bugs the old order caused (Decisively Inconclusive = discardHand
    // + draw + exhaust):
    //   1. applySideEffects swept the FULL hand (including the played card)
    //      to discard via closure `hand`, then fx.exhaust ALSO sent the
    //      played card to exile → duplicate on combat-end pile merge.
    //   2. After applySideEffects ran draw 5, the post-applySideEffects
    //      `setHand(h => h.filter((_, i) => i !== handIdx))` operated on a
    //      stale handIdx pointing into the OLD hand layout — applied to
    //      the new 5-drawn hand it removed a random drawn card forever
    //      (no pile to recover from). This is how subject cards
    //      vanished mid-game.
    // Fix: sweep hand-minus-played to discard, clear hand to [], then skip
    // the stale-index filter when discardHand was set. The played card's
    // own disposition (exile via fx.exhaust, else discard) runs as normal.
    if (fx.discardHand) {
      const handMinusPlayed = hand.filter((_, i) => i !== handIdx);
      if (handMinusPlayed.length > 0) {
        setDiscard(d => [...d, ...handMinusPlayed]);
      }
      setHand([]);
      logBits.push(`discard hand`);
    }
    const fxRest = fx.discardHand ? { ...fx, discardHand: undefined } : fx;
    applySideEffects(fxRest, logBits);
    if (!fx.discardHand) {
      setHand(h => h.filter((_, i) => i !== handIdx));
    }
    if (fx.exhaust) setExiled(ex => [...ex, card]);
    else            setDiscard(d => [...d, card]);
    pushLog(logBits.join(' · '));
  }

  // Take a staged card back to hand + refund its energy. Word cards
  // restore their stat contributions; effects clear the sealer slot.
  function unstageCard(cardUid) {
    if (stage !== 'combat') return;
    logEvent('combat.unstage', { cardUid, enemyId: enemy?.id });

    // v2 slot-aware unstage: check intro, subject, target, then modifiers.
    if (tray.intro?.uid === cardUid) {
      const c = tray.intro;
      setTray(p => syncTrayLegacy({ ...p, intro: null }));
      setHand(h => [...h, c]);
      setEnergy(e => e + (c.cost || 0));
      pushLog(`↩ Unstaged intro ${c.name}.`);
      return;
    }
    if (tray.subject?.uid === cardUid) {
      const c = tray.subject;
      setTray(p => syncTrayLegacy({ ...p, subject: null }));
      setHand(h => [...h, c]);
      setEnergy(e => e + (c.cost || 0));
      pushLog(`↩ Unstaged subject ${c.name}.`);
      return;
    }
    if (tray.target?.uid === cardUid) {
      const c = tray.target;
      setTray(p => syncTrayLegacy({ ...p, target: null }));
      setHand(h => [...h, c]);
      setEnergy(e => e + (c.cost || 0));
      pushLog(`↩ Unstaged target ${c.name}.`);
      return;
    }
    const modIdx = (tray.modifiers || []).findIndex(m => m.uid === cardUid);
    if (modIdx >= 0) {
      const c = tray.modifiers[modIdx];
      setTray(p => syncTrayLegacy({ ...p, modifiers: p.modifiers.filter((_, i) => i !== modIdx) }));
      setHand(h => [...h, c]);
      setEnergy(e => e + (c.cost || 0));
      pushLog(`↩ Unstaged modifier ${c.name}.`);
      return;
    }

    // ---- BACK-COMPAT: legacy word/effectCard unstage ----
    const wordIdx = tray.words.findIndex(w => w.uid === cardUid);
    if (wordIdx >= 0) {
      const w = tray.words[wordIdx];
      setTray(prev => {
        const newWords = prev.words.filter((_, i) => i !== wordIdx);
        const c = { handler: 0, wit: 0, jnsq: 0 };
        const phrases = []; const allTags = [];
        for (const x of newWords) {
          if (x.stats?.handler) c.handler += x.stats.handler;
          if (x.stats?.wit)      c.wit      += x.stats.wit;
          if (x.stats?.jnsq)     c.jnsq     += x.stats.jnsq;
          phrases.push(x.phrase || x.name);
          if (x.tags) allTags.push(...x.tags);
        }
        return { ...prev, words: newWords, phrases, tags: allTags, ...c };
      });
      setHand(h => [...h, w]);
      setEnergy(e => e + (w.cost || 0));
      pushLog(`↩ Unstaged ${w.name}.`);
      return;
    }
    if (tray.effectCard && tray.effectCard.uid === cardUid) {
      const e = tray.effectCard;
      setTray(prev => ({ ...prev, effectCard: null, target: null }));
      setHand(h => [...h, e]);
      setEnergy(en => en + (e.cost || 0));
      pushLog(`↩ Unstaged ${e.name}.`);
    }
  }

  // CAST — resolve the staged spell. Requires at least one word AND a
  // staged effect. Computes the full damage (including resonance, Strike
  // bonus, every-nth-effect, weak/vuln, effectiveness), applies damage
  // and any riders, and clears the tray.
  // Compute Sway success probability + matched-bonus breakdown for a card
  // against the current tray + enemy. Pure read; used by both castStagedSpell
  // and the cast-preview UI.
  function previewSway(card) {
    if (!card?.effect?.sway || !enemy) return null;
    const eff = card.effect;
    const tacticTags = eff.tacticTags || [];
    const matchedTacticTagsCount = (tray.tags || []).filter(t => tacticTags.includes(t)).length;
    const resonanceTags = eff.resonatesWith || [];
    const matchedResonance = (tray.tags || []).filter(t => resonanceTags.includes(t)).length;
    const softSpotMatch = enemy.softSpot === eff.tactic;
    const upgradeBonus = eff.successBonus || 0;
    const raw = 0.35
              + (matchedTacticTagsCount * 0.15)
              + (softSpotMatch ? 0.20 : 0)
              + (matchedResonance * 0.10)
              + upgradeBonus;
    const prob = Math.max(0.10, Math.min(0.90, raw));
    return { prob, matchedTacticTagsCount, matchedResonance, softSpotMatch,
             target: eff.swayTarget, tactic: eff.tactic, currentEff: enemy.effectiveness?.[eff.swayTarget] ?? 1 };
  }

  // v2.12: CHAOS DICE outcome table. Indexed 1-6. EV ~+4% damage,
  // tuned post-sim to keep jnsq from leaping past handler's risk-reward
  // identity.
  const CHAOS_OUTCOMES = {
    1: { name: 'BACKFIRE',   dmgMult: 0.5,  hpDelta: -3, draw: 0, energyNext: 0, vuln: 0, discardRandom: 0 },
    2: { name: 'SPILLED IT', dmgMult: 1.0,  hpDelta: 0,  draw: 0, energyNext: 0, vuln: 0, discardRandom: 1 },
    3: { name: 'HALF-BAKED', dmgMult: 0.75, hpDelta: 0,  draw: 0, energyNext: 1, vuln: 0, discardRandom: 0 },
    4: { name: 'STICKS',     dmgMult: 1.0,  hpDelta: 0,  draw: 1, energyNext: 0, vuln: 0, discardRandom: 0 },
    5: { name: 'SINGS',      dmgMult: 1.25, hpDelta: 0,  draw: 1, energyNext: 0, vuln: 0, discardRandom: 0 },
    6: { name: 'COSMIC',     dmgMult: 1.75, hpDelta: 0,  draw: 2, energyNext: 0, vuln: 1, discardRandom: 0 },
  };

  // v2.12: roll a chaos die. Applies intro reroll-on-1/2 and modifier
  // diceShift if present. Returns 1-6.
  function rollChaosDie(intro, modifiers) {
    let roll = 1 + Math.floor(Math.random() * 6);
    const shift = (modifiers || []).reduce((s, m) => s + (m?.modifierEffect?.diceShift || 0), 0);
    roll = Math.min(6, Math.max(1, roll + shift));
    // Reroll low rolls if intro permits ("I have a feeling about this —").
    const rerollList = intro?.diceReroll?.onResults;
    if (rerollList && rerollList.includes(roll)) {
      const reroll = 1 + Math.floor(Math.random() * 6);
      roll = Math.min(6, Math.max(1, reroll + shift));
    }
    return roll;
  }

  // Route the staged tray to discard/exile after a cast. Honors each
  // word's own exhaust flag AND the effect card's exhaust flag — so a
  // non-exhaust word in a tray cast through an exhaust Effect lands in
  // discard, not the void. (Previously they vanished — caught by the
  // architect review 2026-05-20.)
  function dischargeStagedCards(words, effectCard, effExhausts) {
    const exhaustWords = words.filter(w =>  w.effects?.exhaust);
    const discardWords = words.filter(w => !w.effects?.exhaust);
    if (exhaustWords.length) setExiled(ex => [...ex, ...exhaustWords]);
    if (discardWords.length) setDiscard(d => [...d, ...discardWords]);
    if (effExhausts) setExiled(ex => [...ex, effectCard]);
    else             setDiscard(d => [...d, effectCard]);
  }

  // v2 sentence-engine cast. Resolves a fully-staged intro+subject+target
  // (plus 0-2 modifiers) into composed sentence text + tier-multiplied
  // damage + rider application + card discharge.
  function castV2SentenceSpell(t) {
    const { intro, subject, target } = t;
    const modifiers = t.modifiers || [];

    logEvent(TE.SPELL_CAST, {
      lane: target.lane,
      introId: intro.id, subjectId: subject.id, targetId: target.id,
      modifierIds: modifiers.map(m => m.id),
      enemyId: enemy?.id, enemyHp, enemyComposure,
    });

    // Damage formula handled in shared/cards/shared.js. Pass world state
    // so v2.5 scaling mechanics (perDiscardCard, perDeckCard,
    // missingHpBonus) can read current values.
    // v2.12: roll chaos die if opt-in OR if any staged card forces it.
    const forceRoll = modifiers.some(m => m?.modifierEffect?.forceRoll) ||
                      target.effect?.alwaysRolls === true;
    const willRoll = (rollOptIn || forceRoll);
    let chaosRoll = null;
    let chaosOutcome = null;
    if (willRoll) {
      chaosRoll = rollChaosDie(intro, modifiers);
      // v2.90: backfire smoother. If this would be the THIRD consecutive
      // 1 (BACKFIRE), nudge to 2 (SPILLED IT). The math is honest in the
      // long run; the smoother only catches the rare 0.4% emotional
      // cliff. Logged + telemetry-flagged so we can see how often it
      // engages.
      let smoothed = false;
      if (chaosRoll === 1 && backfireStreak >= 2) {
        chaosRoll = 2;
        smoothed = true;
        pushLog(`🎲 Pity smoother: chained backfires nudged to SPILLED IT.`);
      }
      chaosOutcome = CHAOS_OUTCOMES[chaosRoll];
      setLastRoll(chaosRoll);
      setCombatRolls(rs => [...rs, chaosRoll]);
      setBackfireStreak(chaosRoll === 1 ? backfireStreak + 1 : 0);
      logEvent('jnsq.roll', {
        result: chaosRoll, outcome: chaosOutcome.name,
        forced: forceRoll, smoothed, enemyId: enemy?.id,
      });
      // v2.13: intro diceDraw — "I have a feeling about this —"
      // becomes a sustain card.
      const diceDraw = intro?.diceDraw || 0;
      if (diceDraw > 0) {
        drawCards(diceDraw);
        pushLog(`📥 +${diceDraw} draw (rolling)`);
      }
    }

    // v2.91: 2nd-cast scalar is UNIVERSAL (was Babbling-gated). Any cast
    // after the first this turn applies a 0.6× damage scalar. Restores
    // "rarely cast twice per turn" via diminishing returns rather than a
    // structural cap. Babbling Power is repurposed below. Same flag
    // ctxIsSecondCast still drives the doubleOnSecondCast rider on
    // Getting-Away-From-Me; that combo is now achievable without Babbling.
    const ctxIsSecondCast = castsThisTurn >= 1;
    const ctx = {
      discardSize: discard.length,
      deckSize: deck.length + hand.length + discard.length + exiled.length,
      missingHpFrac: maxHp > 0 ? (maxHp - hp) / maxHp : 0,
      stakeAmount, // v2.11: handler ALL IN (legacy, retained for shared.js call)
      // v2.30: handler SMELL WEAKNESS — predator rider reads enemy debuff state
      playerDmgMult, enemyDmgMult,
      // v2.34: wit LONG THREAD — threadScaling targets read this for +N × LT
      longThread,
      // v2.39: combatTurn is still passed for any remaining turn-aware reads.
      combatTurn,
      // v2.42: wit INSULT VULNERABILITIES — pierceVulnerableInsult targets
      // read the enemy's list of vulnerable tags. Default to [] if the enemy
      // has none — rider just won't fire.
      insultVulnerabilities: enemy?.insultVulnerabilities || [],
      // v2.48: AWKWARD PAUSE — if pauseHeldActive is armed (player held +
      // queued the doubling last turn), every staged-card stat contribution
      // doubles for THIS cast. Flag is cleared post-cast (single-use).
      pauseDoubled: pauseHeldActive,
      // v2.50: BABBLING 2nd-cast flag — doubleOnSecondCast targets fire here.
      isSecondCast: ctxIsSecondCast,
    };
    const { damage: rawDamage, tier, riders, flippedDmgType, sideEffects, stakeBonus, predatorBonus, threadBonus, footnoteBonus, insultBonus, insultMatches, insultMatchedTags } =
      computeSpellDamage(intro, subject, target, modifiers, ctx);
    // v2.48: AWKWARD PAUSE — compute the doubling delta for telemetry by
    // re-running the formula WITHOUT the doubling. Only when actually paused.
    let pauseDelta = 0;
    if (pauseHeldActive) {
      const singleResult = computeSpellDamage(intro, subject, target, modifiers, { ...ctx, pauseDoubled: false });
      pauseDelta = Math.max(0, rawDamage - singleResult.damage);
      pushLog(`🤫 AWKWARD PAUSE → staged stats doubled (+${pauseDelta} dmg over single).`);
      setAwkwardPauseTelemetry(t => ({
        doubledCasts: t.doubledCasts + 1,
        doubledExtraDamage: t.doubledExtraDamage + pauseDelta,
        pauses: t.pauses,
      }));
      logEvent('jnsq.awkwardPause.cast', {
        bonusDamage: pauseDelta,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
      setPauseHeldActive(false);
    }
    // SAYING IT LOUDER block removed 2026-05-31.
    // v2.30: SMELL WEAKNESS — surface the predator rider when it fired.
    if (predatorBonus > 0) {
      pushLog(`🩸 PREDATOR — enemy debuffed → +${predatorBonus} dmg`);
      logEvent('handler.predator', {
        bonusDamage: predatorBonus,
        playerDmgMult, enemyDmgMult,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.34: LONG THREAD — surface the thread-scaling bonus when it fired.
    if (threadBonus > 0) {
      pushLog(`🧵 LONG THREAD ×${longThread} → +${threadBonus} dmg`);
      logEvent('wit.thread', {
        longThread, bonusDamage: threadBonus,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.35: FOOTNOTE — surface the stat-rider bonus when it fired. Each
    // footnote unit feeds through statTotal → eff.multiplier × tierMult.
    if (footnoteBonus > 0) {
      pushLog(`📖 FOOTNOTE → +${footnoteBonus} dmg`);
      logEvent('wit.footnote.cast', {
        bonusDamage: footnoteBonus,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.42: INSULT VULNERABILITIES — surface tag-match bonus when it fired.
    // matchedTags surfaces WHICH tags landed so the player can read the
    // enemy correctly next time.
    if ((insultBonus || 0) > 0) {
      const tagList = (insultMatchedTags || []).slice(0, 3).join(', ');
      pushLog(`🎯 INSULT HIT (${tagList}) → +${insultBonus} dmg`);
      logEvent('wit.insult', {
        bonusDamage: insultBonus,
        matchCount: insultMatches,
        matchedTags: insultMatchedTags,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.34: any wit-lane target that resolves counts as casting a wit
    // Effect this turn — the player has "stayed on topic". End-of-turn
    // checks this together with unblockedThisTurn to tick the thread.
    if (target.lane === 'wit') {
      setCastWitEffectThisTurn(true);
    }
    // loudCount reset on loudScaling cast removed 2026-05-31.
    // v3.4.77 — ALL IN mechanic pulled. stakeAmount stays at 0 (state
    // declared but no UI to change it); HP-deduction + log line gone.

    const eff = target.effect || {};
    const stat = eff.scaleBy || target.lane || 'wit';
    // v2.6: damageTypeFlip from "words to actions"-style modifiers.
    const dmgType = flippedDmgType || eff.damageType || 'composure';
    const enemyMult = enemy?.effectiveness?.[stat] ?? 1.0;
    const physMult = enemy?.effectiveness?.physical ?? 1.0;
    let dmg = rawDamage;
    if (dmgType === 'physical') dmg = Math.round(dmg * physMult);
    else                        dmg = Math.round(dmg * enemyMult);
    dmg = Math.round(dmg * playerDmgMult);
    // v2.47: DRUNKEN CONFIDENCE — +50% damage on every Effect/Spell cast
    // while the power is installed. Applied AFTER playerDmgMult so it
    // composes naturally with Vulnerable / Weak / annotation potency.
    // Reads the powers array directly (no fast-flag — install/uninstall
    // happen often enough that the per-cast walk is fine).
    const drunkenInstalled = powers.some(p => p.installPower?.id === 'drunken-confidence' || p.id === 'jv2-p-hold-my-drink');
    // v2.91: 2nd-cast scalar is UNIVERSAL (was Babbling-gated since v2.49).
    // Any cast after the first this turn scales to 60% damage — restores the
    // "rarely cast twice" feel via diminishing returns instead of a structural
    // cap. Applied AFTER drunken's +50% so the trade-offs compose cleanly:
    // 1.5 * 0.6 = 0.9× on a 2nd cast under both. Babbling Power is being
    // retired in this version's cleanup.
    const isSecondCast = castsThisTurn >= 1;
    if (drunkenInstalled) {
      const preDrunk = dmg;
      // v3.1.4: Drunken Confidence +50% → +35%. Real-play: jnsq one-
      // shotting enemies pre-boss. Combo math: 1.35 × 2.0 (Awkward
      // Pause double) × 0.85 (Babbling 2nd cast) = 2.3× still strong,
      // but not nuclear. Was 2.55× at 1.5×.
      dmg = Math.round(dmg * 1.35);
      const bonus = dmg - preDrunk;
      if (bonus > 0) {
        setDrunkenTelemetry(t => ({ ...t, castBonus: t.castBonus + bonus }));
        pushLog(`🍺 DRUNKEN CONFIDENCE → +${bonus} dmg (×1.5)`);
        logEvent('jnsq.drunken.castBonus', {
          bonusDamage: bonus, enemyId: enemy?.id, enemyTier: enemy?.tier,
        });
      }
    }
    // v2.12: chaos dice damage multiplier. Stronger if "is going to go
    // interesting." target is staged (1.5× the roll's effect — so a 1.5
    // becomes 1.75, a 2.0 becomes 2.5, etc.).
    if (chaosOutcome) {
      const scale = target.effect?.rollDamageScale || 1.0;
      // Scale the deviation from 1.0 by `scale` so a 0.5 becomes 0.5,
      // a 1.5 becomes (1 + 0.5*scale), a 2.0 becomes (1 + 1.0*scale).
      const effectiveMult = 1.0 + (chaosOutcome.dmgMult - 1.0) * scale;
      dmg = Math.round(dmg * effectiveMult);
      pushLog(`🎲 ROLLED ${chaosRoll} — ${chaosOutcome.name} (×${effectiveMult.toFixed(2)} dmg)`);
      // v2.89: prominent flash so the player actually sees the outcome.
      setChaosRollFlash({ roll: chaosRoll, outcome: chaosOutcome, effectiveMult });
    }
    // v2.10: annotation bonusSpellDamage adds AFTER all multipliers
    // (so the +3 is a flat bonus, not amplified by tier multipliers).
    const annBonus = annoFx('bonusSpellDamage');
    if (annBonus > 0) dmg += annBonus;
    // v2.15: wit BURST — Cash In annotation for damage = turns × N.
    // Captures annotation turns BEFORE auto-attach can fire (we'll
    // clear/exile the annotation in the post-damage block below).
    const cashIn = target.effect?.cashInAnnotation;
    let cashedTurns = 0;
    if (cashIn && enemy?.annotation) {
      cashedTurns = enemy.annotation.turnsRemaining || 0;
      const cashBonus = cashedTurns * (cashIn.damagePerTurn || 0);
      dmg += cashBonus;
      pushLog(`📝 Cash-in: ${cashedTurns} turn${cashedTurns === 1 ? '' : 's'} → +${cashBonus} dmg`);
    }
    // v2.13: scaling annotation — Thesis-expanded bonus per prior cast.
    const annPerCast = annoFx('bonusSpellDamagePerCast');
    if (annPerCast > 0) dmg += annPerCast * castsThisCombat;
    setCastsThisCombat(c => c + 1);
    // requiresRage safety-net removed 2026-05-31 with RAGE rip.
    const rageMissing = false;
    // STORM OUT mechanic ripped 2026-05-31 (handler ALL IN family gone).
    const stormOut = false;

    // Compose + log the full sentence.
    const sentence = composeSpellText(intro, subject, target, modifiers);
    pushLog(`✨ "${sentence}"`);

    // Strip enemy block before damage if modifier requested it.
    if (sideEffects.stripBlock) {
      setEnemyBlock(b => Math.max(0, b - sideEffects.stripBlock));
      pushLog(`🛇 Stripped ${sideEffects.stripBlock} enemy block.`);
    }
    // v2.93: Passing Thought cast modifiers — applied BEFORE the 2nd-cast
    // scalar so the 0.6× compounds last. Each flag is one-shot; consumed
    // and cleared after this cast.
    if (nextCastBonusEqualsLast) {
      const bonus = lastCastDamage;
      if (bonus > 0) {
        dmg += bonus;
        pushLog(`✦ A Precedent, Cited: +${bonus} dmg (mirrors last cast).`);
      }
      setNextCastBonusEqualsLast(false);
    }
    if (nextCastBypassEff) {
      // Strip the enemy-effectiveness factor that was already baked into dmg.
      // dmg was computed using `mult` (enemy eff × playerDmgMult). Re-derive.
      const restored = mult !== 0 ? Math.round(dmg / mult * playerDmgMult) : dmg;
      const delta = restored - dmg;
      if (delta !== 0) {
        dmg = restored;
        pushLog(`🎯 Find the Seam: ignored ×${(mult / (playerDmgMult || 1)).toFixed(2)} effectiveness (${delta > 0 ? '+' : ''}${delta} dmg).`);
      }
      setNextCastBypassEff(false);
    }
    if (nextCastDamageMult !== 1.0) {
      const preMult = dmg;
      dmg = Math.round(dmg * nextCastDamageMult);
      pushLog(`✦ Adding Insult to Injury: ×${nextCastDamageMult.toFixed(2)} (+${dmg - preMult} dmg).`);
      setNextCastDamageMult(1.0);
    }
    // v2.91: UNIVERSAL 2nd-cast 0.6× scalar (was v2.49 Babbling-gated).
    // v3.0 cycle 4: Babbling Power resurrected — when installed, 2nd
    // cast scales 0.85× instead of 0.6×. This is jnsq's identity-
    // specific multi-cast bonus and rewards the lane's "chain another
    // sentence" fiction.
    if (isSecondCast) {
      const babblingInstalled = powers.some(p => p.installPower?.id === 'babbling' || p.id === 'jv2-p-wait-and-another-thing');
      const scalar = babblingInstalled ? 0.85 : 0.6;
      const preScale = dmg;
      dmg = Math.round(dmg * scalar);
      const delta = preScale - dmg;
      pushLog(`🔁 ${castsThisTurn + 1}${castsThisTurn + 1 === 2 ? 'nd' : 'th'} cast this turn → ${dmg} dmg (×${scalar}${babblingInstalled ? ' — Babbling' : ''}, -${delta})`);
      setBabblingTelemetry(t => ({ ...t, secondCasts: t.secondCasts + 1, secondCastDamage: t.secondCastDamage + dmg }));
      logEvent('jnsq.secondCast', {
        castsThisTurn: castsThisTurn + 1,
        damage: dmg, reduction: delta, babblingActive: babblingInstalled,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v3.2: FULLY FORMED THOUGHT — set-collection overlay. Hierarchy:
    //   1. fft         — all 3 share setId → row's per-row unique rider
    //   2. partialRow  — any 2 share setId → tier-flavored half-formed bonus
    //   3. schoolId      — all 3 share schoolId (no row match) → tier sub-bonus
    //   4. neither     — no bonus
    // Most specific match wins; only one bonus fires per cast. Damage-
    // mutating rider keys apply HERE; state-setting ones apply post-damage.
    const fftResult = detectFFT(intro, subject, target);
    // v3.4.45 — "You Know What I Mean": if armed AND we have a partial row,
    // promote it to the full FFT this cast. Flag is ONLY consumed on actual
    // promotion (Alan: "until it actually promotes a partial").
    if (partialAsFullArmed && fftResult.partialRow) {
      const promotedRow = WIT_ROW_BY_ID[fftResult.partialRow.id];
      if (promotedRow) {
        fftResult.fft = promotedRow;
        fftResult.partialRow = null;
        pushLog(`📐 "You know what I meant." Half-formed → full FFT.`);
        setPartialAsFullArmed(false);
      }
    }
    if (fftResult.fft) {
      const row = fftResult.fft;
      const rider = row.rider || {};
      if (rider.damageMult)  dmg = Math.round(dmg * rider.damageMult);
      if (rider.bonus)       dmg += rider.bonus;
      // v3.4.67 — Handler school riders (PRE-damage).
      //   Bluster: pressureBonus reads enemy.pressure as flat damage;
      //   consumePressureMult eats all pressure for multiplier bonus.
      //   Ballistic: rageDouble doubles damage while in RAGE (TV≥5);
      //   missingHpScaling adds (maxHp-hp) × N flat.
      //   Ballooning: consumeTempHpAsDamage cashes tempHp for damage.
      if (rider.pressureBonus && (enemy?.pressure || 0) > 0) {
        const bonus = enemy.pressure;
        dmg += bonus;
        pushLog(`🔥 Pressure bonus: +${bonus} flat damage.`);
      }
      if (rider.consumePressureMult && (enemy?.pressure || 0) > 0) {
        const bonus = enemy.pressure * rider.consumePressureMult;
        dmg += bonus;
        pushLog(`🔥 Pressure spike: ${enemy.pressure} × ${rider.consumePressureMult} = +${bonus} damage. Pressure cleared.`);
        setEnemy(e => e ? { ...e, pressure: 0 } : e);
      }
      // consumeLoudnessMult + rageDouble riders removed 2026-05-31 with
      // chutzpah → handler pivot. Both were chutzpah-school finisher hooks.
      if (rider.missingHpScaling) {
        const missing = Math.max(0, maxHp - hp);
        const bonus = missing * rider.missingHpScaling;
        if (bonus > 0) {
          dmg += bonus;
          pushLog(`🩸 Missing-HP scaling: +${bonus} damage.`);
        }
      }
      if (rider.consumeTempHpAsDamage && tempHp > 0) {
        const bonus = Math.round(tempHp * rider.consumeTempHpAsDamage);
        dmg += bonus;
        pushLog(`🎈 Pop Off: ${tempHp} Temp HP × ${rider.consumeTempHpAsDamage} = +${bonus} damage. Temp HP cleared.`);
        setTempHp(0);
        setTempHpTurns(0);
      }
      // v3.4.42 — Crescendo Build-then-Climax REMOVED. The cycle-3-5
      // stage-mult gating made Crescendo unplayable (cast 1 = 0 dmg
      // required three consecutive Crescendo casts). New design:
      //   - Bank Aura ticks composure every player turn (see player-
      //     turn-start handler) — the bank is a visible growing threat.
      //   - Crescendo cards use consumeBankFlat to spend the bank for
      //     Bank × N flat damage (applied as a rider in applyRider).
      //   - Cast damage itself is unmodified by Crescendo school.
      pushLog(`✨✨ FULLY FORMED THOUGHT — ${row.name}.`);
      if (row.canonical) pushLog(`📜 "${row.canonical}"`);
      // v3.4.61 (Alan) — every FFT cast restores +1 Composure (player HP).
      // Small per-cast sustain so the late-act elite isn't always hit at
      // a depleted composure pool.
      setComposure(c => Math.min(composureMax, c + 1));
      pushLog(`✨ +1 Composure (FFT bonus).`);
      logEvent('wit.fft.cast', {
        rowId: row.id, rowName: row.name, schoolId: row.schoolId,
        rider: { ...rider }, damageAfterRider: dmg,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    } else if (fftResult.partialRow) {
      const row = fftResult.partialRow;
      // v3.4.20 (Alan): surface the SCHOOL of the partial so the
      // half-formed rider effects (Slow Burn DoT, Thorns reflect,
      // Crescendo bank) don't read as mystery procs.
      const partialBonus = WIT_PARTIAL_ROW_BONUSES[row.schoolId];
      const schoolName = partialBonus?.name?.replace(' (half-formed)', '') || row.schoolId;
      pushLog(`📐 Half-formed ${schoolName} — ${row.name} (the third word would have landed harder).`);
      logEvent('wit.fft.partial', {
        rowId: row.id, rowName: row.name, schoolId: row.schoolId,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    } else if (fftResult.schoolId) {
      const sub = WIT_SAME_SCHOOL_BONUSES[fftResult.schoolId];
      if (sub) {
        pushLog(`🎵 Same-school ${sub.name} — flavor stitched together.`);
        logEvent('wit.fft.sameSchool', {
          schoolId: fftResult.schoolId, schoolName: sub.name,
          enemyId: enemy?.id, enemyTier: enemy?.tier,
        });
      }
    }
    // v3.4.4 — REVERTED the "Slow Burn target always deposits DoT"
    // behavior. Alan: "We're losing the flavor of the mechanic if any
    // combination of cards still triggers DoT if the effect is DoT."
    // Slow Burn targets now deal NORMAL damage on cast (base + WIT ×
    // multiplier × tierMult, same as any other target). DoT mechanics
    // are gated behind FULL FFT match only — the row's rider (fired
    // via applyRider below) is the SOLE path to DoT in the school.
    // This makes school commitment the unlock, not just card type.
    // v2.93: O-1 support — capture the damage value for the NEXT Precedent
    // cast. Also captures last cast for any future card that wants it.
    setLastCastDamage(dmg);
    // v3.4.55 — next-spell modifiers. Verbal Smack doubles initial cast
    // damage to the enemy (NOT Block damage — defensive cast is unaffected).
    if (nextSpellDoubleInitial && dmg > 0 && dmgType !== 'block') {
      const before = dmg;
      dmg *= 2;
      pushLog(`💥 Verbal Smack: ${before} → ${dmg} composure (×2).`);
      setNextSpellDoubleInitial(false);
    }
    // v3.4.59 — Keynote Speaker power: +25% damage on offensive FFTs.
    // FFT detection happens later; check rider here on full FFT only.
    const fftRowForKeynote = detectFFT(intro, subject, target).fft;
    if (fftRowForKeynote && powers.some(p => p.installPower?.id === 'offensiveFftAmp25') && dmg > 0 && dmgType !== 'block') {
      const before = dmg;
      dmg = Math.round(dmg * 1.25);
      pushLog(`🎤 Keynote Speaker: ${before} → ${dmg} (×1.25).`);
    }
    // v3.4.55 — That Goes For All of You! flag: single-enemy combat means
    // no extra targets, but consume the flag and log so the player sees
    // that it triggered. Will become real when multi-enemy combat lands.
    if (nextSpellApplyToAll && dmgType !== 'block') {
      pushLog(`📣 That Goes For All of You! — (single enemy; full effect when multi-enemy lands)`);
      setNextSpellApplyToAll(false);
    }
    // Apply damage.
    // v3.4.22 (Alan): Thorns targets carry damageType: 'block'. The cast
    // 'damage' number is granted as Block to the player instead of dealt
    // to the enemy — the school's identity hook ("Defense over Time").
    let after = 0;
    if (dmg > 0) {
      if (dmgType === 'block')         {
        let blockGrant = dmg;
        // v3.4.59 — Speak to My Agent power: defensive FFT block +25%.
        if (powers.some(p => p.installPower?.id === 'defensiveFftAmp25') && detectFFT(intro, subject, target).fft) {
          blockGrant = Math.round(blockGrant * 1.25);
        }
        setBlock(b => b + blockGrant);
        pushLog(`🛡 +${blockGrant} Block.`);
      }
      else if (dmgType === 'physical') after = applyDamageToEnemyHp(dmg);
      else                              after = applyDamageToEnemyComposure(dmg);
    }
    // v3.2/v3.3: post-damage FFT/partial/tier rider effects — state-
    // setting keys fire here so they compose with the cast's combat-
    // state mutations. Hierarchy: fft > partialRow > schoolId.
    //
    // v3.3 strategy keys:
    //   dot: { amount, turns } — push onto enemyDotStacks; ticks each
    //     enemy turn-start until turns expire.
    //   thorns: { amount, count } — set/extend thornsCharges; next
    //     `count` enemy hits reflect `amount` composure dmg.
    //   addBank: N — increment wordsBank.
    //   consumeBank: N — handled PRE-damage above (consumes for bonus).
    const applyRider = (rider) => {
      if (!rider) return;
      if (rider.longThreadPerm) setLongThread(lt => lt + rider.longThreadPerm);
      if (rider.composure)      setComposure(c => clamp(c + rider.composure, 0, composureMax));
      if (rider.block)          setBlock(b => b + rider.block);
      if (rider.energy)         setEnergy(e => e + rider.energy);
      if (rider.draw)           drawCards(rider.draw);
      if (rider.poise)          setPoise(p => p + rider.poise);
      // v3.3 scheduledEffects (non-DoT over-time effects):
      //   enemyWeakPerTurn:    { amount, turns } — Weak applied each enemy turn
      //   enemyVulnPerTurn:    { amount, turns } — Vuln applied each enemy turn
      //   dormantDamage:       { amount, delay }  — fires after `delay` enemy turns
      //   selfBlockPerTurn:    { amount, turns } — block at start of player turn
      //   selfDrawPerTurn:     { amount, turns } — draw at start of player turn
      //   bankDoublePerTurn:   { turns }          — Words Bank doubles each enemy turn
      const scheduleQueue = [];
      if (rider.enemyWeakPerTurn) scheduleQueue.push({ trigger: 'enemy-turn-start', kind: 'weak',   amount: rider.enemyWeakPerTurn.amount, turnsRemaining: rider.enemyWeakPerTurn.turns });
      if (rider.enemyVulnPerTurn) scheduleQueue.push({ trigger: 'enemy-turn-start', kind: 'vuln',   amount: rider.enemyVulnPerTurn.amount, turnsRemaining: rider.enemyVulnPerTurn.turns });
      if (rider.dormantDamage)    scheduleQueue.push({ trigger: 'enemy-turn-start', kind: 'dormantDamage', amount: rider.dormantDamage.amount, turnsRemaining: rider.dormantDamage.delay });
      // v3.4.55 — defensive-DoT amount modifiers.
      //   Cited Source relic: +1 to amount on every defensive per-turn rider.
      //   I Won't Hear of It (nextSpellDoubleDefensive): ×2 the amount once.
      //   Speak to My Agent power: ×1.25 to every defensive per-turn rider.
      const hasCitedSource = relics.some(r => r.id === 'r-cited-source');
      const hasAgent = powers.some(p => p.installPower?.id === 'defensiveFftAmp25');
      const doubleDef = nextSpellDoubleDefensive;
      const modifyDefAmount = (n) => {
        let v = n;
        if (hasCitedSource) v += 1;
        if (hasAgent) v = Math.round(v * 1.25);
        if (doubleDef) v *= 2;
        return v;
      };
      let defModifiedThisCast = false;
      if (rider.selfBlockPerTurn) { scheduleQueue.push({ trigger: 'player-turn-start', kind: 'block', amount: modifyDefAmount(rider.selfBlockPerTurn.amount), turnsRemaining: rider.selfBlockPerTurn.turns }); defModifiedThisCast = true; }
      if (rider.selfDrawPerTurn)  scheduleQueue.push({ trigger: 'player-turn-start', kind: 'draw',  amount: rider.selfDrawPerTurn.amount, turnsRemaining: rider.selfDrawPerTurn.turns });
      if (rider.bankDoublePerTurn) scheduleQueue.push({ trigger: 'enemy-turn-start', kind: 'bankDouble', amount: 0, turnsRemaining: rider.bankDoublePerTurn.turns });
      // v3.4.22 — Thorns (Defense over Time) scheduled effects.
      if (rider.selfPoisePerTurn)        { scheduleQueue.push({ trigger: 'player-turn-start', kind: 'poise',     amount: modifyDefAmount(rider.selfPoisePerTurn.amount), turnsRemaining: rider.selfPoisePerTurn.turns }); defModifiedThisCast = true; }
      if (rider.selfHpRegenPerTurn)      { scheduleQueue.push({ trigger: 'player-turn-start', kind: 'hpRegen',   amount: modifyDefAmount(rider.selfHpRegenPerTurn.amount), turnsRemaining: rider.selfHpRegenPerTurn.turns }); defModifiedThisCast = true; }
      if (rider.stripEnemyBlockPerTurn)  scheduleQueue.push({ trigger: 'player-turn-start', kind: 'stripBlock',amount: rider.stripEnemyBlockPerTurn.amount, turnsRemaining: rider.stripEnemyBlockPerTurn.turns });
      // Thorns reflect aura (flat duration). At player-turn-start the
      // turn counter ticks down; while > 0, every enemy hit reflects.
      if (rider.selfThornsPerTurn) {
        const amt = modifyDefAmount(rider.selfThornsPerTurn.amount);
        defModifiedThisCast = true;
        setThornsCharges(t => ({
          amount: Math.max(t.amount, amt),
          count: t.count || 0,
          weakOnReflect: t.weakOnReflect || 0,
          turnsRemaining: Math.max(t.turnsRemaining || 0, rider.selfThornsPerTurn.turns),
        }));
      }
      // Thorns reflect SCHEDULE (Sharp Reflection — [5,7,10] over 3 turns).
      // Sets the schedule directly; first turn uses schedule[0], shifts at
      // player-turn-start.
      if (Array.isArray(rider.selfThornsSchedule) && rider.selfThornsSchedule.length > 0) {
        const sched = rider.selfThornsSchedule.map(v => modifyDefAmount(v));
        defModifiedThisCast = true;
        setThornsCharges(t => ({
          amount: sched[0],
          count: t.count || 0,
          weakOnReflect: t.weakOnReflect || 0,
          turnsRemaining: sched.length,
          schedule: sched,
        }));
      }
      if (defModifiedThisCast && doubleDef) {
        pushLog(`🛡 I Won't Hear of It: defensive DoT doubled.`);
        setNextSpellDoubleDefensive(false);
      }
      if (scheduleQueue.length > 0) {
        setScheduledEffects(s => [...s, ...scheduleQueue]);
      }
      // v3.4 — DoT Poison-style mechanic (Alan: "DoT spells should do
      // way less up front damage and significantly more DoT damage …
      // like the poison mechanic in STS"). Six new rider keys
      // manipulate enemy.dot.{damage, turnsRemaining} as a single
      // counter. Each enemy turn: comp -= damage, turnsRemaining--,
      // turns=0 → dot cleared. Cards stack the counter rather than
      // each casting its own independent DoT stack.
      const updateDot = (mutator) => {
        setEnemy(e => {
          if (!e) return e;
          const cur = e.dot || { damage: 0, turnsRemaining: 0, total: 0 };
          const next = mutator({ ...cur });
          // Normalize: if either field zero, clear the whole thing.
          if ((next.damage || 0) <= 0 || (next.turnsRemaining || 0) <= 0) return { ...e, dot: null };
          return { ...e, dot: next };
        });
      };
      // v3.4.18 (Alan): DoT spells STACK onto existing DoT instead of
      // replacing. Each DoT contribution is treated as a "wave" — an
      // array of per-turn damage — and summed element-wise onto the
      // enemy's schedule. The dot is internally schedule-driven now;
      // dot.damage is always schedule[0] for display compat.
      const addDotWave = (rawWave) => {
        if (!rawWave || rawWave.length === 0) return;
        // v3.4.55 — relic + buff-card modifiers on incoming DoT wave.
        // The Footnote: +1 to every tick. Blow to the Ego: ×2 the whole wave.
        // v3.4.59 — Keynote Speaker power: ×1.25 to every tick.
        const hasFootnote = relics.some(r => r.id === 'r-the-footnote');
        const hasKeynote = powers.some(p => p.installPower?.id === 'offensiveFftAmp25');
        const doubleDot = nextSpellDoubleDot;
        let wave = rawWave.slice();
        if (hasFootnote) wave = wave.map(v => (v || 0) + 1);
        if (hasKeynote) wave = wave.map(v => Math.round((v || 0) * 1.25));
        if (doubleDot) {
          wave = wave.map(v => (v || 0) * 2);
          pushLog(`🌡 Blow to the Ego: DoT wave doubled.`);
          setNextSpellDoubleDot(false);
        }
        // Solid Argument: ALSO push a matching selfBlockPerTurn schedule
        // (per-turn block matching each DoT tick value).
        if (nextSpellAddDefensiveDot) {
          const defWave = wave.slice();
          for (let i = 0; i < defWave.length; i++) {
            if ((defWave[i] || 0) > 0) {
              setScheduledEffects(s => [...s, {
                trigger: 'player-turn-start',
                kind: 'block',
                amount: defWave[i],
                turnsRemaining: i + 1,
              }]);
            }
          }
          pushLog(`🛡 Solid Argument: matching block-per-turn scheduled.`);
          setNextSpellAddDefensiveDot(false);
        }
        setEnemy(e => {
          if (!e) return e;
          const cur = e.dot;
          const existing = (cur && Array.isArray(cur.schedule))
            ? cur.schedule.slice()
            : (cur && (cur.damage || 0) > 0 && (cur.turnsRemaining || 0) > 0)
              ? Array(cur.turnsRemaining).fill(cur.damage)
              : [];
          const len = Math.max(existing.length, wave.length);
          const merged = new Array(len);
          for (let i = 0; i < len; i++) merged[i] = (existing[i] || 0) + (wave[i] || 0);
          // Trim trailing zeros — no ghost turns.
          while (merged.length > 0 && (merged[merged.length - 1] || 0) <= 0) merged.pop();
          if (merged.length === 0) return { ...e, dot: null };
          return { ...e, dot: { damage: merged[0], turnsRemaining: merged.length, schedule: merged } };
        });
      };
      // Flat constant DoT: { setDotMinDamage: N, setDotMinTurns: M } →
      // wave [N, N, ..., N] (M times). Key names kept for data-compat;
      // the "Min" semantic was replaced by additive stacking.
      if (rider.setDotMinDamage && rider.setDotMinTurns) {
        addDotWave(new Array(rider.setDotMinTurns).fill(rider.setDotMinDamage));
      } else if (rider.setDotMinDamage) {
        addDotWave([rider.setDotMinDamage]);
      }
      // Explicit per-turn curve: { setDotSchedule: [5,4,3,2,1] } → same
      // wave, summed onto existing schedule.
      if (Array.isArray(rider.setDotSchedule) && rider.setDotSchedule.length > 0) {
        addDotWave(rider.setDotSchedule.slice());
      }
      // Legacy stacking helpers — keep schedule-aware so they don't
      // silently no-op when a schedule-based dot is active.
      if (rider.addDotDamage) {
        updateDot(d => ({
          ...d,
          damage: (d.damage || 0) + rider.addDotDamage,
          schedule: Array.isArray(d.schedule)
            ? d.schedule.map(v => (v || 0) + rider.addDotDamage)
            : d.schedule,
          turnsRemaining: Math.max(d.turnsRemaining, 1),
        }));
      }
      if (rider.addDotTurns) {
        updateDot(d => {
          let schedule = d.schedule;
          if (Array.isArray(schedule)) {
            const fill = schedule[schedule.length - 1] || d.damage || 0;
            schedule = [...schedule, ...new Array(rider.addDotTurns).fill(fill)];
          }
          return { ...d, schedule, turnsRemaining: d.turnsRemaining + rider.addDotTurns };
        });
      }
      if (rider.dotMultiply) {
        updateDot(d => ({
          ...d,
          damage: Math.round((d.damage || 0) * rider.dotMultiply),
          schedule: Array.isArray(d.schedule)
            ? d.schedule.map(v => Math.round((v || 0) * rider.dotMultiply))
            : d.schedule,
        }));
      }
      if (rider.dotConsumeBig) {
        // Detonate the entire remaining DoT now: sum of schedule (or
        // damage × turns if no schedule). v3.4.18 — schedule-aware so
        // detonating a variable curve actually pays out the right total.
        const cur = enemy?.dot;
        if (cur && cur.turnsRemaining > 0) {
          const total = Array.isArray(cur.schedule)
            ? cur.schedule.reduce((s, v) => s + (v || 0), 0)
            : cur.damage * cur.turnsRemaining;
          setEnemyComposure(c => {
            const after = Math.max(0, c - total);
            if (after === 0 && c > 0) setTimeout(() => onEnemyDefeated(), 200);
            return after;
          });
          showDamageFloater(total, 'composure');
          pushLog(`💥 Slow Burn detonates: ${cur.damage} × ${cur.turnsRemaining} = ${total} composure damage.`);
          setEnemy(e => e ? { ...e, dot: null } : e);
        }
      }
      // Thorns: extended rider shape now { amount, count, weakOnReflect }.
      if (rider.thorns) {
        setThornsCharges(t => ({
          amount: Math.max(t.amount, rider.thorns.amount),
          count: t.count + rider.thorns.count,
          weakOnReflect: Math.max(t.weakOnReflect || 0, rider.thorns.weakOnReflect || 0),
        }));
      }
      // Thorns one-shot strip-block (sparkles): remove N enemy block on cast.
      if (rider.stripEnemyBlock) {
        setEnemyBlock(b => Math.max(0, b - rider.stripEnemyBlock));
        pushLog(`🌹 Thorns — strip ${rider.stripEnemyBlock} block.`);
      }
      // Thorns one-shot force-skip-next-attack: arms the existing
      // enemySkipNextAttack flag (used by colorless Passing Thoughts).
      if (rider.forceSkipNextAttack) {
        setEnemySkipNextAttack(true);
        pushLog(`🌹 Thorns — their next attack will be answered before it lands.`);
      }
      if (rider.addBank)        setWordsBank(b => b + rider.addBank);
      // v3.4.67 — Handler school riders (POST-damage state mutations).
      if (rider.addPressure) {
        setEnemy(e => e ? { ...e, pressure: (e.pressure || 0) + rider.addPressure } : e);
        pushLog(`🔥 +${rider.addPressure} Pressure on enemy.`);
      }
      // addLoudness rider removed 2026-05-31 (Loudness mechanic ripped).
      if (rider.addTempHp) {
        const { amount, turns } = rider.addTempHp;
        setTempHp(t => t + amount);
        setTempHpTurns(t => Math.max(t, turns));
        pushLog(`🎈 +${amount} Temp HP for ${turns} turn${turns > 1 ? 's' : ''}.`);
      }
      if (rider.selfVulnerable) {
        const { amount, turns } = rider.selfVulnerable;
        setPlayerIncomingMult(m => Math.min(2.0, m + 0.25 * amount));
        setPlayerIncomingMultTurns(t => Math.max(t, turns));
        pushLog(`🩸 Self-Vuln +${amount} for ${turns} turn${turns > 1 ? 's' : ''}.`);
      }
      // addTunnelVision rider removed 2026-05-31.
      // v3.4.42 — Thorns/Crescendo redesign riders.
      // mirrorReflectCharges: N enemy hits each reflect 100% of damage taken,
      // capped per hit. Stored as a count-based charge that the attack
      // resolution path checks BEFORE the regular thornsCharges aura.
      if (rider.mirrorReflectCharges) {
        setMirrorReflectCharges(m => ({
          count: (m?.count || 0) + (rider.mirrorReflectCharges.count || 0),
          capPerHit: Math.max(m?.capPerHit || 0, rider.mirrorReflectCharges.capPerHit || 999),
        }));
        pushLog(`🪞 Mirror line set — next ${rider.mirrorReflectCharges.count} hits reflect 100% (cap ${rider.mirrorReflectCharges.capPerHit}).`);
      }
      // skipAndReturnNext: skip enemy's next attack AND deal that same
      // damage to them. Sets BOTH the skip flag AND the return-damage flag.
      if (rider.skipAndReturnNext) {
        setEnemySkipNextAttack(true);
        setSkipAndReturnArmed(true);
        pushLog(`🪞 Their next attack will be returned to them.`);
      }
      // consumeBankFlat: consume entire wordsBank for Bank × N flat damage
      // on top of cast. Resolved here so the cast damage already landed.
      if (rider.consumeBankFlat) {
        const bank = wordsBank;
        if (bank > 0) {
          const flat = bank * rider.consumeBankFlat;
          setEnemyComposure(c => {
            const after = Math.max(0, c - flat);
            if (after === 0 && c > 0) setTimeout(() => onEnemyDefeated(), 200);
            return after;
          });
          showDamageFloater(flat, 'composure');
          pushLog(`🎺 Crescendo cash-in — ${bank} bank × ${rider.consumeBankFlat} = ${flat} composure.`);
          setWordsBank(0);
        }
      }
      // doubleBankNow: immediate bank ×2.
      if (rider.doubleBankNow) {
        setWordsBank(b => {
          const next = Math.min(b * 2, 40);
          if (b > 0) pushLog(`🎺 Bank doubled: ${b} → ${next}.`);
          return next;
        });
      }
      // bankAuraDoublePerTurn: for N enemy turns, the bank-aura tick doubles.
      if (rider.bankAuraDoublePerTurn) {
        setScheduledEffects(s => [...s, {
          trigger: 'enemy-turn-start',
          kind: 'bankAuraDouble',
          amount: 0,
          turnsRemaining: rider.bankAuraDoublePerTurn.turns,
        }]);
      }
    };
    if (fftResult.fft) {
      applyRider(fftResult.fft.rider);
    } else if (fftResult.partialRow) {
      applyRider(WIT_PARTIAL_ROW_BONUSES[fftResult.partialRow.schoolId]);
    } else if (fftResult.schoolId) {
      applyRider(WIT_SAME_SCHOOL_BONUSES[fftResult.schoolId]);
    }
    // v3.4.22 (Alan): Mixed-school cast bonus. Fires in ADDITION to any
    // hierarchy match above, whenever the cast contains cards from 2+
    // different schools. Detects by sorted school-pair key (e.g.
    // 'slowburn+thorns'). Currently only the slowburn+thorns pair is
    // specced; other pairs ignored until they get rider data.
    const castSchools = new Set([intro?.schoolId, subject?.schoolId, target?.schoolId].filter(Boolean));
    if (castSchools.size >= 2) {
      const key = [...castSchools].sort().join('+');
      const mixed = WIT_MIXED_SCHOOL_BONUSES[key];
      if (mixed) {
        pushLog(`🎨 Mixed-school ${mixed.name} — schools combined.`);
        logEvent('wit.fft.mixedSchool', {
          schools: [...castSchools].sort(), name: mixed.name,
          enemyId: enemy?.id, enemyTier: enemy?.tier,
        });
        applyRider(mixed);
      }
    }
    // v2.93: O-6 (The Doubletake) — apply damage a second time. Same dmg
    // value, same type, no second cast counter / scalar (it's a copy, not
    // a re-cast). Flag is one-shot.
    if (nextCastDoubles && dmg > 0) {
      pushLog(`✦✦ The Doubletake: ${dmg} dmg again.`);
      if (dmgType === 'block')         { setBlock(b => b + dmg); pushLog(`🛡 +${dmg} Block (doubletake).`); }
      else if (dmgType === 'physical') after = applyDamageToEnemyHp(dmg);
      else                              after = applyDamageToEnemyComposure(dmg);
      setNextCastDoubles(false);
    }
    // v3.4.77 — ALL IN stake-refund + post-cast reset gone. stakeAmount
    // is always 0 (no UI to set it); the cards that triggered refunds
    // are also out of the pool.
    // v2.15: BURST card exiles the annotation it cashed in.
    if (cashedTurns > 0) {
      setEnemy(e => e ? { ...e, annotation: null } : e);
      pushLog(`📝 The footnote closes.`);
    }
    // v2.15: wit characters auto-attach a STUB annotation when casting
    // into a non-annotated enemy. The stub now does damageOnTurnEnd:1
    // (chip damage every turn) — even casual wit casts leave a sting,
    // and humans who manually attach get the upgraded version.
    // Skip if we just cashed in (don't re-attach what was just exiled).
    if (selectedCharacter?.lane === 'wit' && dmg > 0 && enemy && !enemy.annotation && cashedTurns === 0) {
      setEnemy(e => e ? {
        ...e,
        annotation: {
          id: 'wv2-ann-cited',
          name: 'Cited in passing',
          phrase: '*[cited]',
          effect: { damageOnTurnEnd: 1 },
          turnsRemaining: 2,
          stub: true,
        },
      } : e);
      pushLog(`📝 The remark lingers as a citation.`);
    }
    // v2.12: chaos roll side effects (after damage lands).
    if (chaosOutcome) {
      if (chaosOutcome.hpDelta < 0) {
        setHp(h => Math.max(1, h + chaosOutcome.hpDelta));
        pushLog(`💔 ${chaosOutcome.hpDelta} HP (chaos)`);
      }
      if (chaosOutcome.draw > 0) {
        drawCards(chaosOutcome.draw);
        pushLog(`📥 +${chaosOutcome.draw} draw (chaos)`);
      }
      if (chaosOutcome.discardRandom > 0 && hand.length > 0) {
        // Pick a random non-staged hand card to discard.
        const idx = Math.floor(Math.random() * hand.length);
        const lost = hand[idx];
        setHand(h => h.filter((_, i) => i !== idx));
        setDiscard(d => [...d, lost]);
        pushLog(`💨 Spilled: ${lost.name || lost.phrase} (chaos)`);
      }
      if (chaosOutcome.energyNext > 0) {
        // Granted as an immediate energy bump — the cast already happened
        // so "next turn" semantically means "the next thing you do".
        setEnergy(e => e + chaosOutcome.energyNext);
        pushLog(`⚡ +${chaosOutcome.energyNext} Energy (chaos)`);
      }
      if (chaosOutcome.vuln > 0) {
        applyExpiringVuln(chaosOutcome.vuln);
        pushLog(`💫 +${25*chaosOutcome.vuln}% potency (cosmic alignment, 3 turns)`);
      }
      // Roll consumed; reset the opt-in toggle.
      setRollOptIn(false);
    }

    const tierLabel = tier === 3 ? 'DEVASTATING' : tier === 2 ? 'RESONANT' : 'COHERENT';
    const dmgTagSuffix = dmgType === 'physical'
      ? `${dmg} phys → ${after} HP${physMult === 0 ? ' (IMMUNE)' : ''}`
      : `${dmg} comp → ${after}${enemyMult === 0 ? ' (IMMUNE)' : enemyMult >= 1.5 ? ' (susceptible)' : enemyMult <= 0.5 ? ' (resistant)' : ''}`;
    pushLog(`🎯 ${tierLabel} (×${TIER_MULTIPLIER[tier] || 1.0}) → ${dmgTagSuffix}`);

    // Riders.
    if (riders.weak)       { applyExpiringWeak(riders.weak);  pushLog(`💢 enemy −${25*riders.weak}% atk (3 turns)`); }
    if (riders.vulnerable) { applyExpiringVuln(riders.vulnerable); pushLog(`💫 +${25*riders.vulnerable}% potency (3 turns)`); }
    if (riders.block)      { setBlock(b => b + riders.block); pushLog(`🛡 +${riders.block}`); }

    // Side effects (draw, self-composure cost, self-HP cost).
    if (sideEffects.drawCount) {
      drawCards(sideEffects.drawCount);
      pushLog(`📥 +${sideEffects.drawCount} draw`);
    }
    if (sideEffects.selfComposureCost) {
      setComposure(c => Math.max(0, c - sideEffects.selfComposureCost));
      pushLog(`💔 -${sideEffects.selfComposureCost} composure (self)`);
    }
    if (sideEffects.selfHpCost) {
      setHp(h => Math.max(0, h - sideEffects.selfHpCost));
      pushLog(`🩸 -${sideEffects.selfHpCost} HP (self)`);
    }

    // DOUBLING DOWN (doubleDown / cornerTokens) ripped 2026-05-31.

    // v2.38: SAYING SOMETHING WRONG — queue a delayed Misstep token. The
    // rider fires on every successful cast of the target (including
    // RAGE-missing casts and tier-3 fails — the words were said either
    // way, the realisation arrives on the same timetable). `turnsRemaining`
    // starts at delay+1 because the endTurn decrement fires BEFORE the
    // delivery check, so an initial value of 2 means "lands two end-of-turns
    // from now" — i.e. delivered to hand at the start of turn N+2.
    if (target.effect?.delayedMisstep) {
      const dm = target.effect.delayedMisstep;
      const delay = dm.delay || 2;
      setPendingMissteps(arr => [...arr, { turnsRemaining: delay, selfDamage: dm.selfDamage || 3 }]);
      pushLog(`📜 A misstep is in motion — lands in ${delay} turn${delay === 1 ? '' : 's'}.`);
      logEvent('wit.missTepQueued', {
        delay, selfDamage: dm.selfDamage || 3,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }

    // v2.36: ACTUALLY— snapshot. Capture intro/subject/target/modifiers plus
    // the ctx that drove damage, BEFORE we discharge the cards. The
    // re-fire path re-calls computeSpellDamage on this snapshot at ×1.5,
    // so the staged-card references must be the SAME objects (footnote
    // riders, tier, tags, etc.) that resolved this cast — not freshly-
    // drawn copies. Snapshot taken on every successful cast (last write
    // wins), reset to null at end-of-turn.
    setLastCastSnapshot({
      intro, subject, target, modifiers,
      ctx, // re-use the same context that drove the original cast
      // Capture the resolved damage path so the re-fire applies through
      // the same effectiveness + pool routing. flippedDmgType wins over
      // eff.damageType when set (modifier-driven physical/composure flip).
      dmgType,
      enemyMult, physMult, // captured AFTER pierce resolved
      // playerDmgMult drifts each turn; capture the value used so the
      // re-fire on the SAME turn matches what the original cast saw.
      playerDmgMult,
    });

    // v2.46: WON'T SHUT UP — arm the commitment flag if the cast's target
    // carries `mustPlayAnotherJnsq`. The flag stays armed until the player
    // plays ANY jnsq-lane card this turn (cleared in playCard), OR end of
    // turn (3 HP penalty in endTurn). Armed on every successful resolve,
    // including RAGE-missing casts and tier-3 fails — the words were said.
    if (target.effect?.mustPlayAnotherJnsq) {
      setWontShutUpArmed(true);
      setWontShutUpTelemetry(t => ({ ...t, armed: t.armed + 1 }));
      pushLog(`🗣 Going on...`);
      logEvent('jnsq.wontShutUp.armed', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }

    // v2.51: TANGENT-ON-CAST — universe-sideways capstone fires the Tangent
    // dispatcher AS PART OF this resolve. Reuses applyEffectsCore's
    // `tangentFire` branch (v2.44) so the discard-from-draw + fire-random-
    // jnsq-from-discard pipeline matches the skill exactly. The tray was
    // just consumed by the capstone itself, so a surfaced target will
    // fizzle (resolveTangentCard guards on missing intro/subject) — that's
    // fine; the chaos is the point. Word/skill surfacing still has value.
    if (target.effect?.tangentOnCast) {
      setUniverseSidewaysTelemetry(t => ({
        ...t,
        tangentOnCastFires: (t.tangentOnCastFires || 0) + 1,
      }));
      pushLog(`🌀 ...and tangentially —`);
      // Defer to setTimeout to avoid running this inside the cast's
      // synchronous setState chain ([[feedback_react_pure_updaters]]).
      const tangentBits = [];
      setTimeout(() => applyEffectsCore({ tangentFire: true }, { logBits: tangentBits }), 0);
    }
    // v2.51: synergy-capstone cast counter (universe-sideways specifically).
    // Tracked alongside the tangent fires so a session report can compute
    // avg damage per capstone cast in-App.
    if (target.id === 'jv2-t-universe-sideways') {
      setUniverseSidewaysTelemetry(t => ({
        ...t,
        casts: (t.casts || 0) + 1,
        totalDamage: (t.totalDamage || 0) + dmg,
      }));
    }

    // Discharge cards. Intro / subject / modifiers → discard. Target →
    // exile if requiresTier3 failed AND exhaustOnFail is set; else discard.
    // v2.24: RAGE-required targets also exile on a rage-missing cast.
    // v3.0 fix: strip the per-stage footnote bump from footnoteSelfOnStage
    // modifiers before discarding so the +1 doesn't persist across casts
    // (Alan: "'as previously stated' is keeping its +1 between combats").
    const cleanedModifiers = modifiers.map(m => {
      if (m?.effects?.footnoteSelfOnStage && (m.footnotes || 0) > 0) {
        return { ...m, footnotes: Math.max(0, (m.footnotes || 0) - 1) };
      }
      return m;
    });
    setDiscard(d => [...d, intro, subject, ...cleanedModifiers]);
    if (sideEffects.exhaustTarget || rageMissing) setExiled(ex => [...ex, target]);
    else                                          setDiscard(d => [...d, target]);

    setTray(initialV2Tray({ effectFiredThisTurn: true }));
    applyPowerTriggers('onEffectCardPlayed');
    advanceTutorialStep('cast-spell');

    // STORM OUT post-cast turn-end-immediately path removed 2026-05-31.
  }

  function castStagedSpell() {
    if (stage !== 'combat') return;
    // v2.9: enforce per-turn cast cap. Was uncapped, which let a player
    // stage+cast twice in a single turn at 3 energy. Now the second cast
    // is gated until next turn.
    if (castsThisTurn >= MAX_CASTS_PER_TURN) {
      pushLog(`✋ One spell per turn. End your turn to cast again.`);
      return;
    }
    const t = tray;

    // v2 path: intro + subject + target all filled → sentence-engine cast.
    if (t.intro && t.subject && t.target) {
      // requiresStake gate removed 2026-05-31 (ALL IN ripped).
      // v2.12: target may require a prior 6 ("is the cosmic recoil.").
      const reqRoll = t.target.effect?.requiresPriorRoll || 0;
      if (reqRoll > 0 && !combatRolls.includes(reqRoll)) {
        pushLog(`🎯 ${t.target.phrase || t.target.name} requires a prior ${reqRoll} rolled this combat.`);
        return;
      }
      // v2.15: wit BURST gate — target may require an attached annotation.
      if (t.target.effect?.requiresAnnotation && !enemy?.annotation) {
        pushLog(`🎯 ${t.target.phrase || t.target.name} requires an annotation attached.`);
        return;
      }
      setCastsThisTurn(n => n + 1);
      return castV2SentenceSpell(t);
    }

    if (!t.intro && !t.subject && !t.target) { pushLog('Nothing staged yet — play an intro, subject, and target.'); return; }
    if (!t.target && !t.effectCard) { pushLog('Need a target (the spell-finisher) before you can cast.'); return; }
    if (!t.intro || !t.subject) { pushLog('Need both an intro and a subject before casting.'); return; }
    // Legacy fallback for back-compat event-grant cards: keep older
    // "words + effect" path alive but unreachable in normal v2 play.
    if (!t.effectCard) return;
    if ((t.words || []).length === 0) return;
    setCastsThisTurn(n => n + 1);

    const card = t.effectCard;
    const eff = card.effect || {};
    logEvent(TE.SPELL_CAST, { effectId: card.id, effectName: card.name, stagedWords: (t.words || []).map(w => w.id), trayStats: { handler: t.handler, wit: t.wit, jnsq: t.jnsq }, tags: t.tags, enemyId: enemy?.id, enemyHp, enemyComposure });

    // INSULT branch: open the 3-pick word prompt. The cast resolves
    // asynchronously from the prompt screen via finalizeInsult.
    if (eff.insult) {
      // Send staged cards to discard immediately (the cost is paid).
      dischargeStagedCards(tray.words, card, false);
      // Sample 3 random words for each part of speech.
      const sample = (pool) => {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3);
      };
      setInsultPrompt({
        card,
        phase: 0, // 0 = noun, 1 = verb, 2 = adjective
        samples: {
          noun:      sample(INSULT_NOUNS),
          verb:      sample(INSULT_VERBS),
          adjective: sample(INSULT_ADJECTIVES),
        },
        picks: [],
      });
      setTray(initialV2Tray({ effectFiredThisTurn: true }));
      setStage('insult-prompt');
      return;
    }

    // SWAY branch: no damage, instead try to shift one enemy resistance up
    // by +0.5 (cap 1.0). Success rolled from tray-tags + enemy.softSpot.
    if (eff.sway) {
      const pv = previewSway(card);
      const phrase = [...tray.phrases, card.phrase || ''].filter(Boolean).join(' ');
      if (phrase) pushLog(`✨ "${phrase}"`);
      const roll = Math.random();
      const succeeded = roll < pv.prob;
      const dim = eff.swayTarget;
      const before = enemy?.effectiveness?.[dim] ?? 1;
      if (succeeded) {
        const after = Math.min(1.0, before + 0.5);
        if (after > before) {
          setEnemy(e => e ? { ...e, effectiveness: { ...e.effectiveness, [dim]: after } } : e);
          pushLog(`🤝 ${enemy.name} listens. ${dim} ×${before} → ×${after}.`);
        } else {
          pushLog(`🤝 ${enemy.name} listens — but their ${dim} is already at the cap.`);
        }
        if (eff.successFlavor) pushLog(`"${eff.successFlavor}"`);
      } else {
        pushLog(`🛇 ${enemy.name} is unmoved. (${Math.round(pv.prob * 100)}% chance — rolled ${Math.round(roll * 100)}.)`);
        if (eff.failFlavor) pushLog(`"${eff.failFlavor}"`);
      }
      // Send staged cards to discard / exile (same rule as a normal cast).
      dischargeStagedCards(tray.words, card, !!eff.exhaust);
      setTray(initialV2Tray({ effectFiredThisTurn: true }));
      applyPowerTriggers('onEffectCardPlayed');
      return;
    }
    let base = eff.base || 0;
    if (card.name === 'Strike' || card.name === 'Strike+') base += strikeBonusTotal();
    base += consumeEveryNthEffectBonus();
    const stat = eff.scaleBy || 'wit';
    // Polymath-style: sum all three verbal stats instead of using one.
    const trayVal = eff.sumAllStats
      ? (tray.handler || 0) + (tray.wit || 0) + (tray.jnsq || 0)
      : (tray[stat] || 0);
    const rawSpell = base + trayVal * (eff.multiplier || 0);
    const dmgType = eff.damageType || 'composure';
    const eff_mult = enemy?.effectiveness?.[stat] ?? 1.0;
    const phys_mult = enemy?.effectiveness?.physical ?? 1.0;
    let dmg = rawSpell;
    if (dmgType === 'physical') dmg = Math.round(dmg * phys_mult);
    else                        dmg = Math.round(dmg * eff_mult);
    // Don't-Hold-Back: damage doubles when below the HP threshold.
    if (eff.hpThresholdDouble && hp < eff.hpThresholdDouble) {
      dmg *= 2;
      pushLog(`💥 below ${eff.hpThresholdDouble} HP — damage doubled.`);
    }
    // Iron Stomach: next handler-scaling cast gets the boost.
    if (boostNextHandlerCast > 0 && stat === 'handler') {
      dmg = Math.round(dmg * (1 + boostNextHandlerCast));
      pushLog(`💪 handler cast boosted +${Math.round(boostNextHandlerCast * 100)}%.`);
      setBoostNextHandlerCast(0);
    }
    const rWith = eff.resonatesWith || [];
    const perTag = eff.resonanceBonus?.perTag || 0;
    const matchedTags = (tray.tags || []).filter(t => rWith.includes(t));
    const resonanceBonus = matchedTags.length * perTag;
    if (resonanceBonus > 0) dmg += resonanceBonus;
    dmg = Math.round(dmg * playerDmgMult);

    const phrase = [...tray.phrases, card.phrase || ''].filter(Boolean).join(' ');
    if (phrase) pushLog(`✨ "${phrase}"`);
    if (matchedTags.length > 0) {
      const uniq = Array.from(new Set(matchedTags));
      pushLog(`✦ Resonance ×${matchedTags.length} (${uniq.join(', ')}) → +${resonanceBonus} damage`);
    }

    let after = 0;
    if (dmgType === 'physical') after = applyDamageToEnemyHp(dmg);
    else                        after = applyDamageToEnemyComposure(dmg);
    const stickyTag = eff_mult === 0 ? ' (IMMUNE)' : (eff_mult >= 1.5 ? ' (susceptible)' : eff_mult <= 0.5 ? ' (resistant)' : '');
    const dmgTag = dmgType === 'physical' ? `${dmg} phys → ${after} HP${phys_mult === 0 ? ' (IMMUNE)' : ''}` : `${dmg} comp → ${after}${stickyTag}`;
    pushLog(`🎯 ${(card.name || '').toUpperCase()} — ${dmgTag}`);

    const rider = eff.rider || {};
    if (rider.weak)       { applyExpiringWeak(rider.weak);  pushLog(`💢 enemy −${25*rider.weak}% atk (3 turns)`); }
    if (rider.vulnerable) { applyExpiringVuln(rider.vulnerable); pushLog(`💫 +${25*rider.vulnerable}% potency (3 turns)`); }
    if (rider.block)      { setBlock(b => b + rider.block);          pushLog(`🛡 +${rider.block}`); }
    if (rider.draw)       { drawCards(rider.draw);                   pushLog(`+${rider.draw} draw`); }
    // Handler-archetype effects: pay HP to cast.
    if (eff.loseHpOnPlay)  { setHp(h => clamp(h - eff.loseHpOnPlay, 0, maxHp)); pushLog(`💔 -${eff.loseHpOnPlay} HP (self)`); }
    // Jnsq-archetype effects: weighted gamble.
    if (eff.chance) {
      const chanceBits = [];
      applyChance(eff.chance, chanceBits);
      if (chanceBits.length) pushLog(chanceBits.join(' · '));
    }

    // Send all staged cards to discard / exile based on flags.
    dischargeStagedCards(tray.words, card, !!eff.exhaust);

    setTray(initialV2Tray({ effectFiredThisTurn: true }));
    applyPowerTriggers('onEffectCardPlayed');
    advanceTutorialStep('cast-spell');

    // Cycle 4 batch 5: drawAfterCast (handler engine card hook).
    if (eff.drawAfterCast) {
      drawCards(eff.drawAfterCast);
      pushLog(`📥 Drew ${eff.drawAfterCast} after cast.`);
    }
  }

  // Insult prompt — player picks a word from the current phase's samples.
  // Auto-pick triggers when the 4s timer elapses (InsultPromptScreen calls
  // this with the first sample as a fallback).
  function pickInsultWord(wordObj) {
    if (!insultPrompt) return;
    const nextPicks = [...insultPrompt.picks, wordObj];
    const nextPhase = insultPrompt.phase + 1;
    if (nextPhase >= 3) {
      // All 3 picks made — resolve.
      finalizeInsult(nextPicks);
      return;
    }
    setInsultPrompt({ ...insultPrompt, picks: nextPicks, phase: nextPhase });
  }

  function finalizeInsult(picks) {
    const card = insultPrompt?.card;
    if (!card || !enemy) { setInsultPrompt(null); setStage('combat'); return; }
    const eff = card.effect || {};
    const vulns = enemy.insultVulnerabilities || ['dismissive', 'sarcastic'];
    // Score: each word counts as a vote if any of its tags align with
    // the enemy's vulnerability set. 3/3 = 100%, 2/3 = 67%, etc.
    let matches = 0;
    for (const pick of picks) {
      const tags = pick?.tags || [];
      if (tags.some(t => vulns.includes(t))) matches++;
    }
    const pct = picks.length > 0 ? matches / picks.length : 0;
    const outcome = pct >= 0.5 ? 'land' : pct >= 0.25 ? 'unfaze' : 'backfire';

    // Build the actual insult sentence for log narration.
    const adj = picks.find(p => INSULT_ADJECTIVES.some(a => a.word === p.word));
    const noun = picks.find(p => INSULT_NOUNS.some(n => n.word === p.word));
    const verb = picks.find(p => INSULT_VERBS.some(v => v.word === p.word));
    const sentence = `You ${adj?.word || ''} ${noun?.word || ''}. ${(verb?.word || '').replace(/.$/, m => m)}, all of you.`;
    pushLog(`💢 "${sentence}"`);

    // Pay the player composure cost (always).
    const cost = eff.playerComposureCost || 3;
    setComposure(c => Math.max(0, c - cost));
    pushLog(`🎭 −${cost} Composure (you lose some of yourself doing this).`);

    if (outcome === 'land') {
      const dmg = Math.round((eff.landDamage || 10) * playerDmgMult);
      const witMult = enemy?.effectiveness?.wit ?? 1.0; // verbal channel
      const finalDmg = Math.round(dmg * witMult);
      const after = applyDamageToEnemyComposure(finalDmg);
      pushLog(`✓ LAND — ${finalDmg} composure → ${after}`);
      if (eff.successFlavor) pushLog(`"${eff.successFlavor}"`);
    } else if (outcome === 'unfaze') {
      pushLog(`◌ UNFAZE — ${enemy.name} does not register the insult.`);
      const hint = INSULT_HINT_BY_TAG[vulns[0]] || 'You\'d need to try a different angle.';
      pushLog(`${enemy.name}: "${hint}"`);
    } else {
      // Backfire — enemy retorts, player takes extra composure damage.
      const retort = INSULT_BACKFIRE_RETORTS[Math.floor(Math.random() * INSULT_BACKFIRE_RETORTS.length)];
      pushLog(`✗ BACKFIRE — ${enemy.name}: "${retort}"`);
      const back = eff.backfireDamage || 5;
      setComposure(c => Math.max(0, c - back));
      pushLog(`🎭 −${back} Composure (their retort lands).`);
      const hint = vulns.length > 0
        ? (INSULT_HINT_BY_TAG[vulns[0]] || 'A more cutting angle would have stuck.')
        : 'It does not appear to hear you. Or care.';
      pushLog(`Hint: ${hint}`);
      // KO check projected against the closure value — no side-effect
      // inside a setState updater ([[feedback_react_pure_updaters]]).
      const projected = Math.max(0, composure - cost - back);
      if (projected <= 0) {
        setTimeout(() => setStage('defeat'), 200);
        setInsultPrompt(null);
        return;
      }
    }

    setInsultPrompt(null);
    setStage('combat');
  }

  // Compute the predicted damage if you CAST right now. Used by the
  // tray UI's preview. Pure read of current state — no mutations.
  function previewCastDamage() {
    if (!tray.effectCard) return null;
    const card = tray.effectCard;
    const eff = card.effect || {};
    // Sway cards don't deal damage — return a sway-shaped preview instead.
    if (eff.sway) {
      const pv = previewSway(card);
      return pv ? { kind: 'sway', ...pv } : null;
    }
    let base = eff.base || 0;
    if (card.name === 'Strike' || card.name === 'Strike+') base += strikeBonusTotal();
    // Peek the everyNth bonus (don't consume).
    for (const { effect } of effectSources()) {
      const every = effect?.everyNthEffect;
      if (!every) continue;
      if ((effectCount + 1) % every.n === 0) base += every.extraDamage || 0;
    }
    const stat = eff.scaleBy || 'wit';
    const trayVal = eff.sumAllStats
      ? (tray.handler || 0) + (tray.wit || 0) + (tray.jnsq || 0)
      : (tray[stat] || 0);
    const rawSpell = base + trayVal * (eff.multiplier || 0);
    const dmgType = eff.damageType || 'composure';
    const eff_mult = enemy?.effectiveness?.[stat] ?? 1.0;
    const phys_mult = enemy?.effectiveness?.physical ?? 1.0;
    let dmg = rawSpell;
    if (dmgType === 'physical') dmg = Math.round(dmg * phys_mult);
    else                        dmg = Math.round(dmg * eff_mult);
    if (eff.hpThresholdDouble && hp < eff.hpThresholdDouble) dmg *= 2;
    if (boostNextHandlerCast > 0 && stat === 'handler') dmg = Math.round(dmg * (1 + boostNextHandlerCast));
    const rWith = eff.resonatesWith || [];
    const perTag = eff.resonanceBonus?.perTag || 0;
    const matchedTags = (tray.tags || []).filter(t => rWith.includes(t));
    const resonanceBonus = matchedTags.length * perTag;
    if (resonanceBonus > 0) dmg += resonanceBonus;
    dmg = Math.round(dmg * playerDmgMult);
    return { dmg, dmgType, resonanceBonus, matchedTags, eff_mult, phys_mult, base, trayVal, multiplier: eff.multiplier || 0, stat };
  }

  // Side-effects shared between skill cards and word cards' on-play block.
  // Mutates the logBits array in place.
  function applySideEffects(fx, logBits) {
    if (fx.block) {
      setBlock(b => b + fx.block);
      logBits.push(`🛡 +${fx.block}`);
    }
    // v2.9: poise — composure-pool shield.
    if (fx.poise) {
      setPoise(p => p + fx.poise);
      logBits.push(`🪞 +${fx.poise} Poise`);
    }
    if (fx.boostNextHandlerCast) {
      setBoostNextHandlerCast(fx.boostNextHandlerCast);
      logBits.push(`💪 next Handler cast +${Math.round(fx.boostNextHandlerCast * 100)}%`);
    }
    if (fx.vulnerable) {
      applyExpiringVuln(fx.vulnerable);
      logBits.push(`🩸 enemy Vulnerable +${fx.vulnerable} (your spells +${25*fx.vulnerable}%, 3 turns)`);
    }
    // Direct multiplier ops (Sap / Amplify / Dispel and any new modifier card).
    if (fx.enemyDmgMod) {
      adjustEnemyDmg(fx.enemyDmgMod);
      const pct = Math.round(fx.enemyDmgMod * 100);
      logBits.push(`💢 enemy ${pct > 0 ? '+' : ''}${pct}% atk`);
    }
    if (fx.playerDmgMod) {
      adjustPlayerDmg(fx.playerDmgMod);
      const pct = Math.round(fx.playerDmgMod * 100);
      logBits.push(`💫 ${pct > 0 ? '+' : ''}${pct}% potency`);
    }
    if (fx.weak) {
      applyExpiringWeak(fx.weak);
      logBits.push(`💢 enemy −${25*fx.weak}% atk (3 turns)`);
    }
    // v2.32: NOT LISTENING — debuff cleanse. removeWeak scrubs player-side
    // weakness (playerDmgMult below 1.0) back toward neutral; removeVulnerable
    // scrubs incoming-damage vulnerability (enemyDmgMult above 1.0) back
    // toward 1.0. Each stack adjusts 0.25, clamped at 1.0 so it can't flip
    // into a buff. No-op if already at/past neutral.
    if (fx.removeWeak && playerDmgMult < 1.0) {
      const target = Math.min(1.0, playerDmgMult + 0.25 * fx.removeWeak);
      setPlayerDmgMult(target);
      logBits.push(`🙉 cleansed Weak`);
    }
    if (fx.removeVulnerable && enemyDmgMult > 1.0) {
      const target = Math.max(1.0, enemyDmgMult - 0.25 * fx.removeVulnerable);
      setEnemyDmgMult(target);
      logBits.push(`🙉 cleansed Vulnerable`);
    }
    // v2.33: NOT LISTENING — absorbNextDebuff arms a one-shot token that
    // intercepts the next enemy Weak OR Vulnerable application this combat.
    // Tokens stack (replaying the skill arms +1). Decremented in the enemy-
    // attack flow (intent.kind === 'weak'/'vulnerable' and the rider checks).
    if (fx.absorbNextDebuff) {
      setNotListeningCharges(c => c + fx.absorbNextDebuff);
      logBits.push(`🙉 +${fx.absorbNextDebuff} Sorry — what?`);
    }
    // v2.47: DRUNKEN CONFIDENCE removal — uninstallPower: <id>. Walks the
    // powers array, removes the first match. No-op if nothing's installed.
    // Currently used only by the "sober second thought," skill, but the
    // dispatcher is id-driven so any future opt-out skill can reuse it.
    if (fx.uninstallPower) {
      const targetId = fx.uninstallPower;
      let removed = null;
      setPowers(ps => {
        const idx = ps.findIndex(p => p.installPower?.id === targetId || p.id === targetId);
        if (idx < 0) return ps;
        removed = ps[idx];
        const next = ps.slice();
        next.splice(idx, 1);
        return next;
      });
      // Defer the log to the next tick — setPowers is async so the
      // closure-captured `removed` lands after the state update commits.
      setTimeout(() => {
        if (removed) {
          pushLog(`🍺 ${removed.name} dispelled.`);
          logEvent('jnsq.drunken.uninstall', { enemyId: enemy?.id, enemyTier: enemy?.tier });
        }
      }, 0);
      logBits.push(`🍺 power dispelled`);
    }
    // v2.35: FOOTNOTE skill — arm the picker. Hand AND discard cards (intros,
    // subjects, modifiers) become clickable until the player picks one or
    // cancels. The skill itself is exhausted by playCard's normal exhaust
    // handling; the prompt is the payoff layer.
    if (fx.footnotePrompt) {
      setFootnotePromptActive(true);
      logBits.push(`📖 pick a phrase to footnote`);
    }
    // v2.36: ACTUALLY— re-fire the last cast at ×1.5. Reads lastCastSnapshot
    // captured at the end of castV2SentenceSpell. If null (no cast this turn),
    // no-op — the UI should have disabled the card already. Re-applies DAMAGE
    // ONLY (we deliberately skip rider re-application, annotation auto-attach,
    // sideEffect re-resolution, and tray clearing — the spec says "directly
    // re-resolve the last cast's damage formula"). Also stacks +1 to
    // arguingBackThisTurn (player-side debuff that bumps enemy raw damage).
    if (fx.refireLastCast) {
      if (lastCastSnapshot) {
        const snap = lastCastSnapshot;
        const reResult = computeSpellDamage(
          snap.intro, snap.subject, snap.target, snap.modifiers || [], snap.ctx || {});
        let reDmg = reResult.damage;
        // Re-apply the same effectiveness + playerDmgMult routing the snapshot
        // resolved through. We use the captured per-fire multipliers so any
        // drift between the original cast and the re-fire (turn-end decay)
        // doesn't change the math — Actually— recasts the room as it was.
        if (snap.dmgType === 'physical') reDmg = Math.round(reDmg * (snap.physMult ?? 1.0));
        else                              reDmg = Math.round(reDmg * (snap.enemyMult ?? 1.0));
        reDmg = Math.round(reDmg * (snap.playerDmgMult ?? 1.0));
        reDmg = Math.round(reDmg * 1.5);
        if (snap.dmgType === 'physical') applyDamageToEnemyHp(reDmg);
        else                              applyDamageToEnemyComposure(reDmg);
        pushLog(`✏ Actually— ${reDmg} ${snap.dmgType === 'physical' ? 'phys' : 'comp'} (re-fire ×1.5).`);
        logEvent('wit.actually', {
          bonusDamage: reDmg, dmgType: snap.dmgType,
          enemyId: enemy?.id, enemyTier: enemy?.tier,
        });
      } else {
        // Defensive — UI should have blocked this, but log if it slipped.
        pushLog(`✏ Actually— … but there's nothing to correct.`);
      }
      // The "arguing back" cost stacks regardless of whether a snapshot
      // existed (cast already exhausted via playCard, so the energy was
      // spent — the bill comes due either way).
      setArguingBackThisTurn(n => n + 1);
      logBits.push(`🗣 +1 arguing back`);
    }
    // v2.37: HOLD ON — arm a reactive interrupt that reduces the next
    // enemy attack's first swing by the player's CURRENT longThread
    // (snapshotted at play time). The flag arms regardless of LT value
    // — even at LT=0 the play still burns the slot (no free re-cast).
    // Consumed when applyEnemyIntent processes the next attack/attack-
    // multi; otherwise auto-clears at the start of the player's next
    // turn (see endTurn).
    if (fx.holdOnPrep) {
      const snap = longThread || 0;
      setHoldOnArmed(true);
      setHoldOnValue(snap);
      if (snap > 0) logBits.push(`🛑 Hold on — armed (−${snap} next swing)`);
      else          logBits.push(`🛑 Hold on — armed (no thread)`);
    }
    if (fx.energy) {
      setEnergy(e => e + fx.energy);
      logBits.push(`+${fx.energy} Energy`);
    }
    // v3.1.5: discardHand is handled INLINE in playCard's skill branch
    // (see comment there). It MUST NOT fire here, because applySideEffects
    // runs with stale closure `hand` that still contains the played card
    // → duplicate + lost-card cascade. Intentionally absent.
    if (fx.draw) {
      drawCards(fx.draw);
      logBits.push(`+${fx.draw} draw`);
    }
    if (fx.hp) {
      setHp(h => clamp(h + fx.hp, 0, maxHp));
      logBits.push(`+${fx.hp} HP`);
    }
    // v2.92: new fx keys for Passing Thoughts (colorless one-shot cards).
    if (fx.composure) {
      setComposure(c => clamp(c + fx.composure, 0, composureMax));
      logBits.push(`+${fx.composure} Composure`);
    }
    if (fx.compDmg) {
      applyDamageToEnemyComposure(fx.compDmg);
      logBits.push(`🎭 ${fx.compDmg} comp dmg`);
    }
    // Whistle / Treat / Just Eat It all arm a click-on-slot prompt and
    // share the same slot-pill click dispatch (precedence Treat → Whistle in
    // CombatScreen). They MUST be mutually exclusive: if two are armed at
    // once, the higher-precedence one silently eats the click — e.g. arming
    // Treat then another prompt made a Treat-click do the wrong thing
    // ("I used Treat and it disappeared"). Arming any one cancels the others
    // so the most-recently-played card owns the next click.
    const armTargetingPrompt = (which) => {
      setWhistlePromptActive(which === 'whistle');
      if (which !== 'whistle') setWhistlePick1Slot(null);
      setTreatPromptActive(which === 'treat');
      setEatItPromptActive(which === 'eatIt');
      setSacrificePromptActive(which === 'sacrifice');
      setGorgePromptActive(which === 'gorge');
      setWellDrilledPromptActive(which === 'wellDrilled');
      setHouseRulesPromptActive(which === 'houseRules');
    };
    // Whistle — arm a 2-click swap. First click sets one slot; second click
    // swaps that slot's contents with the second-clicked slot.
    if (fx.whistleSwap) {
      armTargetingPrompt('whistle');
      logBits.push(`🎶 Whistle armed — pick two slots to swap.`);
    }
    // Treat — arm a 1-click prompt. Click any animal slot → +1 duration.
    if (fx.treatExtend) {
      armTargetingPrompt('treat');
      logBits.push(`🍖 Treat armed — pick an animal to extend.`);
    }
    // Just Eat It — arm a 1-click prompt. Click any lure slot → transforms
    // immediately into the animal it summons; lure card → discard.
    if (fx.eatLureNow) {
      armTargetingPrompt('eatIt');
      logBits.push(`🍴 Just Eat It armed — pick a staged lure to summon now.`);
    }
    // Last Supper — arm a 1-click prompt. Click an animal → it departs for
    // Energy equal to its remaining turns plus a card (resolved in
    // sacrificeAnimalFromSlot).
    if (fx.sacrificeForValue) {
      armTargetingPrompt('sacrifice');
      logBits.push(`🍽 Last Supper armed — pick an animal to send off.`);
    }
    // Gorge — arm a 1-click prompt. Click an animal → +3 turns (and +3
    // permanent attack if already fed this turn; resolved in gorgeAnimalFromSlot).
    if (fx.gorge) {
      armTargetingPrompt('gorge');
      logBits.push(`🍖 Gorge armed — pick an animal to overfeed.`);
    }
    // Murmuration — deal composure for each bird currently in play. Birds are
    // animals with feedKey 'bird' (rabid-scrubjay / goose / raven / owl).
    if (fx.compDmgPerBird) {
      const birds = ['intro', 'subject', 'target'].filter(s => {
        const slot = tray[s];
        return slot?.kind === 'animal' && getAnimal(slot.animalId)?.feedKey === 'bird';
      }).length;
      const dmg = fx.compDmgPerBird * birds;
      if (dmg > 0) {
        applyDamageToEnemyComposure(dmg);
        logBits.push(`🐦 Murmuration: ${dmg} composure (${birds} bird${birds === 1 ? '' : 's'})`);
      } else {
        logBits.push(`🐦 Murmuration — no birds in play.`);
      }
    }
    // Stampede — arm an extra attack on every small-land animal. Like On
    // Three!, the damage lands on the animals' turn (end-of-turn loop), not
    // at play time (Alan, 2026-06-01), narrowed to feedKey 'small-land'.
    if (fx.smallLandAttackAgain) {
      const updates = {};
      let count = 0;
      for (const slotName of ['intro', 'subject', 'target']) {
        const slot = tray[slotName];
        if (!slot || slot.kind !== 'animal') continue;
        const animal = getAnimal(slot.animalId);
        if (!animal || animal.feedKey !== 'small-land' || (animal.attack || 0) <= 0) continue;
        updates[slotName] = { ...slot, extraAttacks: (slot.extraAttacks || 0) + 1 };
        count++;
      }
      if (count > 0) setTray(p => syncTrayLegacy({ ...p, ...updates }));
      logBits.push(count > 0
        ? `🦌 Stampede — ${count} small-land ${count === 1 ? 'animal' : 'animals'} primed for an extra attack this turn.`
        : `🦌 Stampede — no small-land animals.`);
    }
    // Make It Count — every animal attacks for double, then leaves play.
    if (fx.sacrificeAllForBurst) {
      const whisp = hasHandlerPower('whisperer');
      let count = 0;
      let whisperBank = 0;
      for (const slotName of ['intro', 'subject', 'target']) {
        const slot = tray[slotName];
        if (!slot || slot.kind !== 'animal') continue;
        const animal = getAnimal(slot.animalId);
        const atk = animalAttackValue(animal, slot) * 2;
        if (atk > 0) {
          if (animal.attackPool === 'composure') applyDamageToEnemyComposure(atk);
          else                                   applyDamageToEnemyHp(atk);
          pushLog(`${animal.icon} ${animal.name} gives everything: ${atk} ${animal.attackPool === 'composure' ? 'composure' : 'HP'}.`);
        }
        applyAnimalExitEffects(animal);
        if (whisp) whisperBank++;
        count++;
      }
      if (count > 0) {
        setTray(p => {
          const n = { ...p };
          for (const s of ['intro', 'subject', 'target']) if (n[s]?.kind === 'animal') n[s] = null;
          return syncTrayLegacy(n);
        });
        if (whisperBank > 0) setWhisperDrawsPending(d => d + whisperBank);
      }
      logBits.push(count > 0 ? `💥 Make It Count — ${count} sent` : `💥 Make It Count — no animals in play.`);
    }
    // Buffet — arm a flag. Next lure played fills every empty stage slot.
    if (fx.buffetArmed) {
      setBuffetArmed(true);
      logBits.push(`🍽 Buffet armed — your next lure spreads across every empty slot.`);
    }
    // Lure tutors — fetchLure opens a picker over the named pile; the chosen
    // lure moves to hand (handled in pickLureFromPile). If the pile holds no
    // lure the card whiffs (logged) rather than opening an empty picker.
    if (fx.fetchLure) {
      const src = fx.fetchLure === 'deck' ? deck : discard;
      const label = fx.fetchLure === 'deck' ? 'draw pile' : 'discard';
      if (src.some(c => c.type === 'lure')) {
        setLurePickerSource(fx.fetchLure);
        logBits.push(`🪤 Pick a lure from your ${label}.`);
      } else {
        logBits.push(`🪤 No lure in your ${label}.`);
      }
    }
    // fetchLureRandom — pull a random lure straight to hand from the draw
    // pile (falling back to discard if the draw pile holds none), no picker.
    if (fx.fetchLureRandom) {
      const deckLures = deck.filter(c => c.type === 'lure');
      const fromDeck = deckLures.length > 0;
      const lures = fromDeck ? deckLures : discard.filter(c => c.type === 'lure');
      if (lures.length === 0) {
        logBits.push(`🪤 No lure to summon to hand.`);
      } else {
        const pick = lures[Math.floor(Math.random() * lures.length)];
        if (fromDeck) setDeck(d => d.filter(c => c.uid !== pick.uid));
        else          setDiscard(d => d.filter(c => c.uid !== pick.uid));
        setHand(h => [...h, pick]);
        logBits.push(`🪤 ${pick.name} turns up in your hand.`);
      }
    }
    // Acquired Taste — open the narrow chooser. Player picks a lure (from any
    // pile, or a staged one) and a species to drop from its summon pool. The
    // exclusion is applied at resolveLureSpecies for the rest of combat; the
    // 2-species floor is enforced in addNarrowExclusion.
    if (fx.narrowLure) {
      const candidates = buildNarrowCandidates();
      if (candidates.length === 0) {
        logBits.push(`🍂 No variable lure to narrow.`);
      } else {
        setNarrowChooserOpen(true);
        logBits.push(`🍂 Pick a lure and a creature to refuse.`);
      }
    }
    // Tap the Glass — agitate the menagerie. Every summoned animal's NEXT
    // attack hits harder by multiplying the slot's nextAttackMult (so it
    // stacks with the Tender Greens row bonus and is consumed/reset by the
    // end-of-turn attack like any other mult). No-op with an empty tank.
    // Mutations collected then committed via setTray after the loop to
    // respect the React pure-updater rule.
    if (fx.agitateMenagerie) {
      const mult = fx.agitateMenagerie;
      const updates = {};
      let count = 0;
      for (const slotName of ['intro', 'subject', 'target']) {
        const slot = tray[slotName];
        if (!slot || slot.kind !== 'animal') continue;
        updates[slotName] = { ...slot, nextAttackMult: (slot.nextAttackMult || 1) * mult };
        count++;
      }
      if (count > 0) {
        setTray(p => syncTrayLegacy({ ...p, ...updates }));
        logBits.push(`🐟 Tap the Glass — ${count} ${count === 1 ? 'animal' : 'animals'} agitated (+${Math.round((mult - 1) * 100)}% next attack).`);
      } else {
        logBits.push(`🐟 Tap the Glass — the tank is empty. Nothing stirs.`);
      }
    }
    // On Three! — arm an extra attack on every animal in play. The damage
    // lands on the animals' turn (end-of-turn attack loop), NOT at play time
    // (Alan, 2026-06-01) — so the re-attack reads the same board state the
    // natural swing does and all the menagerie's damage arrives together.
    // Salmon (0 attack) is skipped. eatenThisTurn isn't checked here: at
    // play time it's always false, and the end-of-turn loop gates the extra
    // attacks behind it anyway (an animal that eats this turn won't swing).
    if (fx.packTactics) {
      const updates = {};
      let count = 0;
      for (const slotName of ['intro', 'subject', 'target']) {
        const slot = tray[slotName];
        if (!slot || slot.kind !== 'animal') continue;
        const animal = getAnimal(slot.animalId);
        if (!animal || (animal.attack || 0) <= 0) continue;
        updates[slotName] = { ...slot, extraAttacks: (slot.extraAttacks || 0) + 1 };
        count++;
      }
      if (count > 0) setTray(p => syncTrayLegacy({ ...p, ...updates }));
      logBits.push(count > 0
        ? `🐾 On Three! — ${count} ${count === 1 ? 'animal' : 'animals'} primed for an extra attack this turn.`
        : `🐾 On Three! — no animals to rally.`);
    }
    // consumeLoudnessAsDamage (Punchline-style payoff) removed 2026-05-31
    // with the chutzpah → handler pivot. Loudness mechanic ripped entirely.
    // v3.4.19 — tutor a card by slot. Walks the deck for the first
    // matching slot and pulls it into hand. Random draws stay random
    // for general draw events; tutoring is the deliberate "I'm
    // reaching for a specific word" move.
    if (fx.tutorSlot) {
      const wantedSlot = fx.tutorSlot;
      // v3.4.45 (Alan: "the cards that pull a random subject/intro/target
      // seem to be broken"). Old impl searched ONLY the deck; if the
      // matching slot was sitting in the discard pile, the pull silently
      // failed. Also violated the React pure-updater rule by mutating an
      // outer closure variable inside setDeck. Rewritten: read deck +
      // discard directly, pick once, splice.
      const deckMatches = deck.map((c, i) => (c.slot === wantedSlot ? i : -1)).filter(i => i >= 0);
      const discardMatches = discard.map((c, i) => (c.slot === wantedSlot ? i : -1)).filter(i => i >= 0);
      const pool = [
        ...deckMatches.map(i => ({ from: 'deck', i })),
        ...discardMatches.map(i => ({ from: 'discard', i })),
      ];
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick.from === 'deck') {
          const pulled = deck[pick.i];
          setDeck(deck.filter((_, i) => i !== pick.i));
          setHand(h => [...h, { ...pulled, uid: uid() }]);
          pushLog(`📚 Tutored ${wantedSlot} (from deck): ${pulled.name || pulled.phrase}.`);
        } else {
          const pulled = discard[pick.i];
          setDiscard(discard.filter((_, i) => i !== pick.i));
          setHand(h => [...h, { ...pulled, uid: uid() }]);
          pushLog(`📚 Tutored ${wantedSlot} (from discard): ${pulled.name || pulled.phrase}.`);
        }
      } else {
        pushLog(`📚 No ${wantedSlot} found in deck or discard.`);
      }
      logBits.push(`📚 tutor ${wantedSlot}`);
    }
    // v3.4.45 — Buff cards (Alan-designed wit utility).
    if (fx.tutorSlots && Array.isArray(fx.tutorSlots)) {
      // Pull one card per requested slot, from deck or discard. Same
      // semantics as tutorSlot but for multiple slots in one fire.
      let workingDeck = [...deck];
      let workingDiscard = [...discard];
      const pulled = [];
      for (const wantedSlot of fx.tutorSlots) {
        const deckMatches = workingDeck.map((c, i) => (c.slot === wantedSlot ? i : -1)).filter(i => i >= 0);
        const discMatches = workingDiscard.map((c, i) => (c.slot === wantedSlot ? i : -1)).filter(i => i >= 0);
        const pool = [
          ...deckMatches.map(i => ({ from: 'deck', i })),
          ...discMatches.map(i => ({ from: 'discard', i })),
        ];
        if (pool.length === 0) {
          pushLog(`📚 No ${wantedSlot} found in deck or discard.`);
          continue;
        }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick.from === 'deck') {
          pulled.push({ ...workingDeck[pick.i], uid: uid(), _from: 'deck', _slot: wantedSlot });
          workingDeck = workingDeck.filter((_, i) => i !== pick.i);
        } else {
          pulled.push({ ...workingDiscard[pick.i], uid: uid(), _from: 'discard', _slot: wantedSlot });
          workingDiscard = workingDiscard.filter((_, i) => i !== pick.i);
        }
      }
      if (pulled.length > 0) {
        setDeck(workingDeck);
        setDiscard(workingDiscard);
        setHand(h => [...h, ...pulled.map(p => { const { _from, _slot, ...rest } = p; return rest; })]);
        for (const p of pulled) pushLog(`📚 Tutored ${p._slot} (from ${p._from}): ${p.name || p.phrase}.`);
      }
      logBits.push(`📚 tutor ${fx.tutorSlots.join('+')}`);
    }
    if (fx.extendEnemyDot) {
      setEnemy(e => {
        if (!e || !e.dot) { pushLog(`⏳ No enemy DoT to extend.`); return e; }
        const turns = fx.extendEnemyDot;
        const tail = Array.isArray(e.dot.schedule) && e.dot.schedule.length > 0
          ? e.dot.schedule[e.dot.schedule.length - 1]
          : (e.dot.damage || 0);
        const newSchedule = Array.isArray(e.dot.schedule)
          ? [...e.dot.schedule, ...new Array(turns).fill(tail)]
          : new Array((e.dot.turnsRemaining || 0) + turns).fill(e.dot.damage || tail);
        return { ...e, dot: { ...e.dot, schedule: newSchedule, turnsRemaining: (e.dot.turnsRemaining || 0) + turns } };
      });
      logBits.push(`⏳ DoT +${fx.extendEnemyDot} turns`);
    }
    if (fx.extendSelfThorns) {
      setThornsCharges(t => {
        if (!t || (t.turnsRemaining || 0) <= 0) { pushLog(`🛡 No defensive aura active to extend.`); return t; }
        const turns = fx.extendSelfThorns;
        const newSchedule = Array.isArray(t.schedule)
          ? [...t.schedule, ...new Array(turns).fill(t.schedule[t.schedule.length - 1] || t.amount || 0)]
          : t.schedule;
        return { ...t, turnsRemaining: (t.turnsRemaining || 0) + turns, schedule: newSchedule };
      });
      logBits.push(`🛡 Thorns aura +${fx.extendSelfThorns} turns`);
    }
    if (fx.boostEnemyDot) {
      setEnemy(e => {
        if (!e || !e.dot) { pushLog(`💢 No enemy DoT to boost.`); return e; }
        const amt = fx.boostEnemyDot;
        const schedule = Array.isArray(e.dot.schedule) ? e.dot.schedule : new Array(e.dot.turnsRemaining || 0).fill(e.dot.damage || 0);
        const boosted = schedule.map(v => (v || 0) + amt);
        return { ...e, dot: { ...e.dot, schedule: boosted, damage: boosted[0] || e.dot.damage || amt } };
      });
      logBits.push(`💥 DoT +${fx.boostEnemyDot} per tick`);
    }
    if (fx.boostThornsReflect) {
      const amt = fx.boostThornsReflect;
      let boostedAny = false;
      setThornsCharges(t => {
        if (!t || ((t.turnsRemaining || 0) <= 0 && (t.count || 0) <= 0)) return t;
        boostedAny = true;
        const nextSched = Array.isArray(t.schedule) ? t.schedule.map(v => (v || 0) + amt) : t.schedule;
        return { ...t, amount: (t.amount || 0) + amt, schedule: nextSched };
      });
      if (!boostedAny) pushLog(`🌹 No Thorns aura active to boost.`);
      logBits.push(`🌹 Thorns reflect +${amt}/tick`);
    }
    if (fx.partialAsFullNextCast) {
      setPartialAsFullArmed(true);
      logBits.push(`📐 next half-formed cast counts as full row`);
    }
    if (fx.tutorArmNextSentence) {
      setTutorArmed(true);
      logBits.push(`📚 The Tutor is watching — next matching intro+subject auto-places the target`);
    }
    // v3.4.59 — new universal-lane skill handlers.
    if (fx.complimentHealOnAbsorb) {
      // Snap = current block + block granted by THIS card right now.
      // At end of turn, heal = min(cap, snap - block_now).
      const cap = fx.complimentHealOnAbsorb;
      const grantedThisCard = fx.block || 0;
      const snap = (block || 0) + grantedThisCard;
      setComplimentSnap({ snap, cap });
      logBits.push(`💞 +${cap} HP heal pending if Block absorbs`);
    }
    if (fx.enemySkipNextTurn) {
      setEnemySkipNextTurn(true);
      setEnemySkipNextAttack(true); // also covers attack-shaped intents
      logBits.push(`🤐 Enemy is stunned — they lose their next turn`);
    }
    if (fx.delayedComposureDamage) {
      const { amount, delay } = fx.delayedComposureDamage;
      setScheduledEffects(s => [...s, {
        trigger: 'enemy-turn-start',
        kind: 'dormantDamage',
        amount,
        turnsRemaining: delay,
      }]);
      logBits.push(`⏳ +${amount} comp in ${delay} turns`);
    }
    if (fx.nextCardFree) {
      setNextCardFree(true);
      logBits.push(`🎁 next card played costs 0`);
    }
    // v3.4.55 — next-spell modifier flags. Each consumed on the
    // applicable next cast.
    if (fx.nextSpellDoubleInitial) {
      setNextSpellDoubleInitial(true);
      logBits.push(`💥 next offensive cast: DOUBLE initial composure damage`);
    }
    if (fx.nextSpellDoubleDot) {
      setNextSpellDoubleDot(true);
      logBits.push(`🌡 next offensive cast: DOUBLE DoT damage`);
    }
    if (fx.nextSpellDoubleDefensive) {
      setNextSpellDoubleDefensive(true);
      logBits.push(`🛡 next defensive cast: DOUBLE defensive-DoT amounts`);
    }
    if (fx.nextSpellAddDefensiveDot) {
      setNextSpellAddDefensiveDot(true);
      logBits.push(`🛡 next offensive DoT also grants matching block/turn`);
    }
    if (fx.nextSpellApplyToAll) {
      setNextSpellApplyToAll(true);
      logBits.push(`📣 next offensive cast applies to ALL enemies`);
    }
    // v3.4.55 — To the Rafters: cast a random Crescendo FFT row's rider
    // by finding any Crescendo-school card in hand or discard.
    if (fx.castRandomCrescendoFFT) {
      const pool = [...hand, ...discard].filter(c => c.schoolId === 'crescendo' && c.setId);
      if (pool.length === 0) {
        logBits.push(`🎺 To the Rafters — no Crescendo card found.`);
      } else {
        const picked = pool[Math.floor(Math.random() * pool.length)];
        const row = WIT_ROW_BY_ID[picked.setId];
        if (row && row.rider) {
          // Apply the rider via the same applyRider path. We need access
          // to it from the cast pipeline; here in applySideEffects we
          // call a thin emulation: just fire consumeBankFlat / addBank /
          // doubleBankNow / bankAuraDoublePerTurn since those are the
          // Crescendo riders. Other rider keys are no-ops here.
          const r = row.rider;
          if (r.consumeBankFlat && (wordsBank || 0) > 0) {
            const bank = wordsBank;
            const flat = bank * r.consumeBankFlat;
            setEnemyComposure(c => {
              const after = Math.max(0, c - flat);
              if (after === 0 && c > 0) setTimeout(() => onEnemyDefeated(), 200);
              return after;
            });
            showDamageFloater(flat, 'composure');
            setWordsBank(0);
            logBits.push(`🎺 To the Rafters → ${row.name}: ${flat} composure (${bank} bank × ${r.consumeBankFlat})`);
          } else if (r.doubleBankNow) {
            setWordsBank(b => Math.min(40, b * 2));
            logBits.push(`🎺 To the Rafters → ${row.name}: bank doubled`);
          } else {
            logBits.push(`🎺 To the Rafters → ${row.name}: rider triggered`);
          }
          if (r.addBank) setWordsBank(b => (b || 0) + r.addBank);
          if (r.bankAuraDoublePerTurn) {
            setScheduledEffects(s => [...s, {
              trigger: 'enemy-turn-start',
              kind: 'bankAuraDouble',
              amount: 0,
              turnsRemaining: r.bankAuraDoublePerTurn.turns,
            }]);
          }
          if (r.draw) drawCards(r.draw);
        }
      }
    }
    if (fx.physDmg) {
      applyDamageToEnemyHp(fx.physDmg);
      logBits.push(`⚔ ${fx.physDmg} phys dmg`);
    }
    if (fx.stripBlock) {
      setEnemyBlock(b => Math.max(0, b - fx.stripBlock));
      logBits.push(`🛇 strip ${fx.stripBlock} block`);
    }
    if (fx.discardRandom) {
      setHand(h => {
        if (h.length === 0) return h;
        const n = Math.min(fx.discardRandom, h.length);
        const next = [...h];
        const dropped = [];
        for (let i = 0; i < n; i++) {
          const idx = Math.floor(Math.random() * next.length);
          dropped.push(next[idx]);
          next.splice(idx, 1);
        }
        setDiscard(d => [...d, ...dropped]);
        return next;
      });
      logBits.push(`discard ${fx.discardRandom} random`);
    }
    // v3.1.4: discardHand moved above draw — see top of this function.
    if (fx.returnDiscardToHand) {
      setDiscard(d => {
        if (d.length === 0) return d;
        const n = Math.min(fx.returnDiscardToHand, d.length);
        const next = [...d];
        const picked = [];
        for (let i = 0; i < n; i++) {
          const idx = Math.floor(Math.random() * next.length);
          picked.push(next[idx]);
          next.splice(idx, 1);
        }
        setHand(h => [...h, ...picked]);
        return next;
      });
      logBits.push(`+${fx.returnDiscardToHand} from discard`);
    }
    // v2.93: Passing Thought flag setters. Each card sets one flag that
    // a downstream hook consumes (enemy attack / cast resolve / end of
    // turn). The flag-vs-effect split keeps each card readable and the
    // dispatch graph testable.
    if (fx.enemySkipNextAttack)   { setEnemySkipNextAttack(true);     logBits.push('🤐 enemy attack will skip'); }
    if (fx.swapNextHitToComp)     { setSwapNextHitToComp(true);       logBits.push('💢→🎭 next HP hit becomes Comp'); }
    if (fx.reflectNextHitAsComp)  { setReflectNextHitAsComp(true);    logBits.push('🪞 next hit reflects as Comp dmg to enemy'); }
    if (fx.bracingArmed)          { setBracingArmed(true);            logBits.push('🛡✦ bracing — draw 3 at EoT if hit'); }
    if (fx.reflectNextDebuff)     { setReflectNextDebuff(n => n + fx.reflectNextDebuff); logBits.push('🪞 next enemy debuff reflects'); }
    if (fx.nextCastBonusEqualsLast) { setNextCastBonusEqualsLast(true); logBits.push(`✦ next cast +${lastCastDamage} bonus dmg (from last)`); }
    if (fx.nextCastBypassEff)     { setNextCastBypassEff(true);       logBits.push('🎯 next cast ignores effectiveness'); }
    if (fx.nextCastDamageMult)    { setNextCastDamageMult(fx.nextCastDamageMult); logBits.push(`✦ next cast ×${fx.nextCastDamageMult}`); }
    if (fx.nextCastDoubles)       { setNextCastDoubles(true);         logBits.push('✦✦ next cast damage applies twice'); }
    // v2.97: defense-variant flags. Brace pays out next turn if no HP
    // damage landed this turn; Riposte arms a counter-attack on the
    // next enemy swing (damage = charge value, comp pool).
    if (fx.braceDrawNext) { setBraceArmedDraw(n => n + fx.braceDrawNext); logBits.push(`🛡✦ brace — draw ${fx.braceDrawNext} next turn if safe`); }
    if (fx.riposteArmed)  { setRiposteCharge(n => Math.max(n, fx.riposteArmed)); logBits.push(`🛡⚔ riposte armed — ${fx.riposteArmed} comp on next enemy swing`); }
    // v3.0 multi-hit cards.
    if (fx.bracePerSwing) {
      // Peek enemy intent and compute block based on swing count. 4×3
      // multi gives 4×bracePerSwing block; single 12-attack gives 1×.
      // Pre-computed at play time; the block doesn't update if intent
      // changes later (acceptable — player commits at play time).
      const swings = enemyIntent?.kind === 'attack-multi' ? (enemyIntent.count || 1) : 1;
      const blockGain = fx.bracePerSwing * swings;
      setBlock(b => b + blockGain);
      logBits.push(`🛡✕${swings} +${blockGain} Block (${fx.bracePerSwing}×${swings} swings)`);
    }
    if (fx.nextAttackSwingReduction) {
      setNextAttackSwingReduction(n => Math.max(n, fx.nextAttackSwingReduction));
      logBits.push(`🪨 −${fx.nextAttackSwingReduction} per swing on next enemy attack`);
    }
    if (fx.escalatingSwingReduction) {
      setEscalatingSwingReduction(true);
      logBits.push(`💬 next attack: each successive swing -1 more dmg`);
    }
    if (fx.blockFromComposure) {
      // D-5 (A Measured Response): block = floor(comp / 3) at cast time.
      const bonus = Math.floor(composure / 3);
      if (bonus > 0) {
        setBlock(b => b + bonus);
        logBits.push(`🛡 +${bonus} (⅓ of Composure)`);
      }
    }
    if (fx.compDmgFromEnemyMissing) {
      // O-3 (Pile-On): direct comp dmg = floor(missing / 3). Read from
      // the enemy snapshot — `enemy` is in App scope.
      const missing = enemy ? Math.max(0, (enemy.composureMax || 0) - (enemy.annotation ? enemyComposure : enemyComposure)) : 0;
      const dmg = Math.floor(missing * fx.compDmgFromEnemyMissing);
      if (dmg > 0) {
        applyDamageToEnemyComposure(dmg);
        logBits.push(`🎭 ${dmg} (Pile-On — ⅓ of missing)`);
      }
    }
    // Self-damage cost on the card (Handler identity — risk for damage).
    if (fx.loseHp) {
      setHp(h => clamp(h - fx.loseHp, 0, maxHp));
      logBits.push(`-${fx.loseHp} HP (self)`);
    }
    // v2.7: NOVEL subject mechanics ----------------------------------------
    // Block steal — strip enemy block AND give player block. The "your
    // hidden defenses" wit subject.
    if (fx.stealBlock) {
      const strip = fx.stealBlock.strip || 0;
      const gain = fx.stealBlock.gain || 0;
      if (strip > 0) setEnemyBlock(b => Math.max(0, b - strip));
      if (gain > 0)  setBlock(b => b + gain);
      logBits.push(`🛇 strip ${strip} · 🛡 +${gain}`);
    }
    // Refund energy — staging this card returns N energy. Tempo subject.
    if (fx.refundEnergy) {
      setEnergy(e => e + fx.refundEnergy);
      logBits.push(`⚡ +${fx.refundEnergy} refund`);
    }
    // Apply enemy DOT (damage-over-time). Handler "your every breath".
    if (fx.applyDot) {
      const d = fx.applyDot;
      setEnemy(e => e ? { ...e, dot: { damage: d.damage, turnsRemaining: d.turns, total: d.turns } } : e);
      logBits.push(`🩸 Bleed ${d.damage}/turn × ${d.turns}`);
    }
    // fx.tunnelVision handler removed 2026-05-31.
    // Reveal enemy's next intent. Jnsq "the next thing you'll do".
    if (fx.revealNextIntent) {
      // Pre-roll the upcoming intent and store it for UI display.
      if (enemy) {
        const peeked = rollIntent(enemy, [enemyIntent?.kind].filter(Boolean));
        setPeekedNextIntent(peeked);
        logBits.push(`👁 peek: ${peeked.telegraph || peeked.kind}`);
      }
    }
    // Player-side debuff (e.g., Cantrip Roulette failure).
    if (fx.selfWeak) {
      adjustPlayerDmg(-0.25 * fx.selfWeak);
      logBits.push(`💢 self −${25*fx.selfWeak}% potency`);
    }
    // Apply Vulnerable to the enemy from a side-effect path (used by
    // chance.success in some Jnsq effects).
    if (fx.enemyVulnerable) {
      applyExpiringVuln(fx.enemyVulnerable);
      logBits.push(`💫 +${25*fx.enemyVulnerable}% potency (3 turns)`);
    }
    // v2.45: APOLOGY — discard the entire spell tray (intro/subject/target/
    // modifiers all go to discard, no energy refund). The hp+4 and
    // vulnerable+1 keys ride alongside and are handled by the existing
    // branches above. Read current `tray` state directly (closure) to avoid
    // nesting setState inside another updater — [[feedback_react_pure_updaters]].
    if (fx.apologize) {
      // v3.0 cycle 4: was "tray cleared, no refund" — Apology played
      // 0/100 in sim because losing the staged cards was too punishing.
      // Now the cards REFUND TO HAND. The skill becomes a "reset this
      // turn's setup" tool — heal 4 HP, +1 Vuln on enemy, re-stage next
      // turn with the same cards. The cost is the 1 energy spent on
      // Apology itself + the turn's lost cast tempo.
      const moved = [];
      if (tray.intro) moved.push(tray.intro);
      if (tray.subject) moved.push(tray.subject);
      if (tray.target) moved.push(tray.target);
      if (tray.modifiers && tray.modifiers.length) moved.push(...tray.modifiers);
      if (moved.length > 0) {
        setHand(h => [...h, ...moved]);
        logBits.push(`🙇 refunded ${moved.length} from tray to hand`);
      } else {
        logBits.push(`🙇 cleared the (empty) tray`);
      }
      setTray(p => initialV2Tray({ effectFiredThisTurn: p.effectFiredThisTurn }));
      setApologyTelemetry(t => ({
        casts: t.casts + 1,
        hpHealed: t.hpHealed + (fx.hp || 0),
        trayDiscarded: t.trayDiscarded + moved.length,
      }));
    }
    // v2.45: IGNORE NEXT DEBUFF — alias onto the existing notListeningCharges
    // plumbing (the wit "Sorry — what?" absorb-token system). Each charge
    // intercepts the next enemy Weak/Vulnerable application this combat.
    if (fx.ignoreNextDebuff) {
      setNotListeningCharges(c => c + fx.ignoreNextDebuff);
      logBits.push(`🙉 +${fx.ignoreNextDebuff} sorry — restarting`);
    }
    // v2.44: SPEAKING OF WHICH — staging deepens the Tangent pool by
    // dumping one random hand card into the discard. Skipped if the hand
    // has 0 other cards. Read from `hand` (state); the card being staged
    // is already removed by the playCard splice above.
    if (fx.discardOnPlay) {
      setHand(h => {
        if (h.length === 0) return h;
        const idx = Math.floor(Math.random() * h.length);
        const lost = h[idx];
        setDiscard(d => [...d, lost]);
        logBits.push(`🌀 discarded ${lost.name || lost.phrase || 'a card'}`);
        return h.filter((_, i) => i !== idx);
      });
    }
    // v2.48: AWKWARD PAUSE — jnsq "...go on, I'm listening." skill. Arms
    // pauseHeld for the rest of THIS turn. At endTurn the flag graduates to
    // pauseHeldActive (the doubling bank for NEXT turn's cast). The tray
    // already persists by default (v2.1 persistent-tray rule), so this
    // mechanic is purely about the doubling — the "skip a turn" cost is
    // implicit (player can't cast usefully on the pause-played turn unless
    // they had already staged + had energy for both, which is rare).
    if (fx.awkwardPause) {
      setPauseHeld(true);
      setAwkwardPauseTelemetry(t => ({ ...t, pauses: t.pauses + 1 }));
      logBits.push(`🤫 paused — next cast doubles`);
      logEvent('jnsq.awkwardPause.play', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.52: DRUNKEN STAGGER — jnsq "sorry, I lost my balance for a second,"
    // skill. Arms staggerActive for the rest of THIS turn (until endTurn
    // clears it AFTER the enemy intent has had its chance to roll). While
    // armed, every enemy attack swing in applyEnemyIntent rolls 50/50 to
    // fully miss. Tracked via setStaggerTelemetry — plays here, hits/damage
    // in the enemy-intent branch.
    if (fx.staggerOn) {
      setStaggerActive(true);
      setStaggerTelemetry(t => ({ ...t, plays: t.plays + 1 }));
      pushLog(`🌀 Staggered — they might miss.`);
      logEvent('jnsq.stagger.play', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    // v2.44: TANGENT — "That reminds me," jnsq skill. (1) Discard 1 random
    // from draw pile. (2) Find all jnsq-lane cards in discard. (3) Pick
    // one at random and fire it: word → stage (replacing if filled,
    // refunded to hand for free); target → cast immediately if tray
    // intro+subject filled, else fizzle. The fired card is removed from
    // discard for free (no cost paid; no entry to hand).
    if (fx.tangentFire) {
      setTangentTelemetry(t => ({ ...t, fires: t.fires + 1 }));
      // Step 1: random discard from draw pile.
      setDeck(d => {
        if (d.length === 0) return d;
        const idx = Math.floor(Math.random() * d.length);
        const lost = d[idx];
        setDiscard(dd => [...dd, lost]);
        logBits.push(`📤 lost ${lost.name || lost.phrase || 'a card'} from draw`);
        return d.filter((_, i) => i !== idx);
      });
      // Step 2 + 3: pull a jnsq card from discard and resolve it. Defer to
      // setDiscard's callback form so we read the post-step-1 discard.
      setDiscard(discardPile => {
        const jnsqIdxs = discardPile
          .map((c, i) => (c.lane === 'jnsq' ? i : -1))
          .filter(i => i >= 0);
        if (jnsqIdxs.length === 0) {
          pushLog(`🌀 That reminds me... no, nothing.`);
          return discardPile;
        }
        const pick = jnsqIdxs[Math.floor(Math.random() * jnsqIdxs.length)];
        const fired = discardPile[pick];
        const newDiscard = discardPile.filter((_, i) => i !== pick);
        pushLog(`🌀 Tangent: ${fired.phrase || fired.name}`);
        // Defer the side-effect application via setTimeout so it runs
        // OUTSIDE this setState updater ([[feedback_react_pure_updaters]]).
        setTimeout(() => resolveTangentCard(fired), 0);
        return newDiscard;
      });
    }
  }

  // v2.44: TANGENT resolver — runs the fired card's effect outside of any
  // setState updater. Words stage into their slot (replacing if filled, with
  // the displaced card refunded to hand for free). Modifiers stage (up to 2).
  // Targets cast immediately if intro+subject filled; otherwise log fizzle.
  // No energy cost, no hand entry, no staging-discard cleanup (the source
  // card was already lifted out of discard before this fires).
  function resolveTangentCard(fired) {
    if (!fired) return;
    if (fired.slot === 'intro' || fired.slot === 'subject') {
      setTray(p => {
        const prev = p[fired.slot];
        if (prev) {
          setHand(h => [...h, prev]);
          pushLog(`↩ Tangent replaced ${fired.slot} ${prev.name || prev.phrase}.`);
        }
        return syncTrayLegacy({ ...p, [fired.slot]: fired });
      });
      // Stage-side effects fire for free (block, draw, vulnerable, etc.).
      const sideBits = [];
      applySideEffects(fired.effects || {}, sideBits);
      if (sideBits.length) pushLog(`🌀 ${sideBits.join(' · ')}`);
      setTangentTelemetry(t => ({ ...t, wordsStaged: t.wordsStaged + 1 }));
      return;
    }
    if (fired.slot === 'modifier') {
      setTray(p => {
        const mods = p.modifiers || [];
        if (mods.length >= 2) {
          // Replace the oldest modifier; refund to hand for free.
          const displaced = mods[0];
          setHand(h => [...h, displaced]);
          pushLog(`↩ Tangent replaced modifier ${displaced.name || displaced.phrase}.`);
          return syncTrayLegacy({ ...p, modifiers: [...mods.slice(1), fired] });
        }
        return syncTrayLegacy({ ...p, modifiers: [...mods, fired] });
      });
      const sideBits = [];
      applySideEffects(fired.effects || {}, sideBits);
      if (sideBits.length) pushLog(`🌀 ${sideBits.join(' · ')}`);
      setTangentTelemetry(t => ({ ...t, wordsStaged: t.wordsStaged + 1 }));
      return;
    }
    if (fired.slot === 'target' || fired.type === 'effect') {
      // Need intro + subject filled to cast. Read latest tray via setTray
      // callback form. If incomplete, fizzle — the target slides into the
      // discard pile (not exiled — Tangent is chaos, not punishment).
      setTray(p => {
        if (!p.intro || !p.subject) {
          pushLog(`🌀 That reminds me... [fizzled — no setup].`);
          setDiscard(d => [...d, fired]);
          setTangentTelemetry(t => ({ ...t, fizzles: t.fizzles + 1 }));
          return p;
        }
        // Replace any existing target; refund to hand for free.
        if (p.target) {
          setHand(h => [...h, p.target]);
          pushLog(`↩ Tangent replaced target ${p.target.name || p.target.phrase}.`);
        }
        const next = syncTrayLegacy({ ...p, target: fired });
        // Defer the actual cast — staging is now complete; the cast needs
        // to read the new tray. setTimeout pushes it after this updater.
        setTimeout(() => {
          castStagedSpell();
          setTangentTelemetry(t => ({ ...t, targetsCast: t.targetsCast + 1 }));
        }, 0);
        return next;
      });
      return;
    }
    // Gesture / skill / power / annotation — uncommon for jnsq pools, but
    // gracefully drop them back to discard so they're not lost.
    setDiscard(d => [...d, fired]);
    pushLog(`🌀 Tangent: ${fired.name || fired.phrase} — slipped past the table.`);
  }

  // Resolve a `chance: { prob, success, failure }` block — used by Jnsq
  // archetype cards. Rolls once and applies one of the two effect
  // payloads through the same applySideEffects dispatcher.
  function applyChance(chanceBlock, logBits) {
    if (!chanceBlock) return;
    const roll = Math.random();
    const fired = roll < (chanceBlock.prob ?? 0.5) ? chanceBlock.success : chanceBlock.failure;
    if (fired) {
      logBits.push(roll < chanceBlock.prob ? `🎲 lucky` : `🎲 unlucky`);
      applySideEffects(fired, logBits);
    }
  }

  // Apply the effects payload from a power trigger. Mirrors playCard's
  // dispatcher but reads from a plain effects object (no card metadata).
  // `composure` here is the new analogue of the old `attack` key — Ostensible
  // Inferno etc. deal composure damage through the enemy's wit effectiveness
  // (treat it as wit-channelled for resistance purposes — flame-shaped magic
  // bypasses the social system but enemies who are unflappable still no-sell).
  function applyPowerTriggerEffects(effects, sourceName) {
    if (!effects) return;
    const bits = [`📿 ${sourceName}`];
    if (effects.composure) {
      const eff_mult = enemy?.effectiveness?.wit ?? 1.0;
      let dmg = Math.round(effects.composure * eff_mult);
      dmg = Math.round(dmg * playerDmgMult);
      const after = applyDamageToEnemyComposure(dmg);
      bits.push(`✨ ${dmg} comp → ${after}`);
    }
    if (effects.block) {
      setBlock(b => b + effects.block);
      bits.push(`🛡 +${effects.block}`);
    }
    if (effects.vulnerable) {
      applyExpiringVuln(effects.vulnerable);
      bits.push(`💫 +${25*effects.vulnerable}% potency (3 turns)`);
    }
    if (effects.weak) {
      applyExpiringWeak(effects.weak);
      bits.push(`💢 enemy −${25*effects.weak}% atk (3 turns)`);
    }
    if (effects.energy) {
      setEnergy(e => e + effects.energy);
      bits.push(`+${effects.energy} Energy`);
    }
    if (effects.draw) {
      drawCards(effects.draw);
      bits.push(`+${effects.draw} draw`);
    }
    pushLog(bits.join(' · '));
  }

  // Walk all installed powers and fire any that have a trigger matching
  // `hook` (one of: startOfTurn / onEffectCardPlayed). For endOfTurn use
  // `applyEndOfTurnPowerTriggers` instead — it tracks enemy composure / hp
  // synchronously so the caller knows whether the enemy was defeated.
  function applyPowerTriggers(hook) {
    for (const p of powers) {
      const trig = p.power?.[hook];
      if (trig) applyPowerTriggerEffects(trig, p.name);
    }
  }

  // Specialised end-of-turn trigger pass that batches all damage / debuff
  // / block changes into local working variables, then commits to state
  // once. Returns true if the enemy was defeated as a result. This is so
  // the caller can short-circuit the enemy's intent resolution.
  function applyEndOfTurnPowerTriggers() {
    let wComposure = enemyComposure;
    let wHp = enemyHp;
    let wEnemyBlock = enemyBlock;
    let wEnemyDmg  = enemyDmgMult;
    let wPlayerDmg = playerDmgMult;
    let wPlayerBlock = block;
    const clamp01 = (m) => Math.max(0.5, Math.min(1.5, m));
    for (const p of powers) {
      const trig = p.power?.endOfTurn;
      if (!trig) continue;
      const bits = [`📿 ${p.name}`];
      if (trig.composure) {
        const eff_mult = enemy?.effectiveness?.wit ?? 1.0;
        // Power-trigger composure damage uses the live player potency.
        let dmg = Math.round(trig.composure * eff_mult * wPlayerDmg);
        const absorbed = Math.min(wEnemyBlock, dmg);
        wEnemyBlock -= absorbed; dmg -= absorbed;
        wComposure = Math.max(0, wComposure - dmg);
        bits.push(`✨ → ${wComposure} comp`);
      }
      if (trig.block) { wPlayerBlock += trig.block; bits.push(`🛡 +${trig.block}`); }
      // Old vuln/weak power triggers shift the multipliers (player-side
      // potency for vuln, enemy-side attack for weak).
      if (trig.vulnerable) { wPlayerDmg = clamp01(wPlayerDmg + 0.25 * trig.vulnerable); bits.push(`💫 +${25*trig.vulnerable}% potency`); }
      if (trig.weak)       { wEnemyDmg  = clamp01(wEnemyDmg  - 0.25 * trig.weak);       bits.push(`💢 enemy −${25*trig.weak}% atk`); }
      pushLog(bits.join(' · '));
      if (wComposure <= 0 || wHp <= 0) break;
    }
    setBlock(wPlayerBlock);
    setEnemyBlock(wEnemyBlock);
    setEnemyComposure(wComposure);
    setEnemyHp(wHp);
    setEnemyDmgMult(wEnemyDmg);
    setPlayerDmgMult(wPlayerDmg);
    if (wComposure <= 0 || wHp <= 0) {
      setTimeout(() => onEnemyDefeated(), 200);
      return true;
    }
    return false;
  }

  // v2.35: FOOTNOTE — apply +1 footnote to the card instance with the given
  // uid. Searches hand AND discard. The rider scales the card's wit stat
  // in computeSpellDamage (introStat / subjectStat / modStat all read it).
  // Persists through reshuffles because drawCards spreads the card object;
  // the uid will change but `footnotes` rides along on the spread.
  // No-op if the uid can't be found. Clears the prompt either way (the
  // skill has already exhausted).
  function applyFootnote(cardUid) {
    if (!footnotePromptActive) return;
    let applied = false;
    setHand(h => h.map(c => {
      if (c.uid === cardUid) {
        applied = true;
        return { ...c, footnotes: (c.footnotes || 0) + 1 };
      }
      return c;
    }));
    if (!applied) {
      setDiscard(d => d.map(c => {
        if (c.uid === cardUid) {
          applied = true;
          return { ...c, footnotes: (c.footnotes || 0) + 1 };
        }
        return c;
      }));
    }
    setFootnotePromptActive(false);
    if (applied) {
      pushLog(`📖 Footnote attached.`);
      logEvent('wit.footnote', { cardUid });
    } else {
      pushLog(`📖 Footnote skill expired (no eligible card).`);
    }
  }

  // v2.35: FOOTNOTE — cancel an active prompt (Esc / click-outside / explicit
  // dismiss button). The skill is already exhausted; the player just loses
  // the install opportunity.
  // v2.85: resolve the pick-one-of-two forget prompt. Player clicked one
  // of the two candidates to lose. Remove it by uid (not index — the
  // deck order may have changed by reshuffles between offer and pick).
  function resolveForgetTwoChoice(cardUid) {
    if (!forgetTwoPrompt) return;
    const chosen = forgetTwoPrompt.cards.find(c => c.uid === cardUid);
    if (!chosen) { setForgetTwoPrompt(null); return; }
    setDeck(d => d.filter(c => c.uid !== cardUid));
    pushLog(`📜 Forgotten: ${chosen.name || chosen.phrase}.`);
    logEvent('forget.choose', { cardId: chosen.id, cardName: chosen.name, offered: forgetTwoPrompt.cards.map(c => c.id) });
    setForgetTwoPrompt(null);
  }

  function cancelFootnotePrompt() {
    if (!footnotePromptActive) return;
    setFootnotePromptActive(false);
    pushLog(`📖 Footnote skill dismissed without picking a phrase.`);
  }

  // Lure tutor — resolve the pick from the open pile picker. Move the chosen
  // lure (by uid) from its source pile to hand and close the overlay.
  function pickLureFromPile(cardUid) {
    const src = lurePickerSource;
    if (!src) return;
    const pile = src === 'deck' ? deck : discard;
    const card = pile.find(c => c.uid === cardUid);
    setLurePickerSource(null);
    if (!card) return;
    if (src === 'deck') setDeck(d => d.filter(c => c.uid !== cardUid));
    else                setDiscard(d => d.filter(c => c.uid !== cardUid));
    setHand(h => [...h, card]);
    pushLog(`🪤 ${card.name} pulled from your ${src === 'deck' ? 'draw pile' : 'discard'} to hand.`);
  }

  // Handler power read — installed powers live on the `powers` array; the
  // Trainer/Glutton powers (wellDrilled, houseRules, whisperer, openDoor,
  // fullPockets) are all read via their installPower id.
  const hasHandlerPower = (id) => powers.some(p => p.installPower?.id === id);

  // Effective per-hit attack for an animal in a given slot. Folds in the
  // Permanent per-slot attackBonus — Gorge's overfeed payoff and Well-Drilled's
  // per-animal +2 both stamp this. The tactic multipliers (Rabid) and the
  // slot's nextAttackMult are applied by the callers on top of this.
  const animalAttackValue = (animal, slot) => {
    let a = animal?.attack || 0;
    if (a <= 0) return a; // a flopper stays a flopper
    a += (slot?.attackBonus || 0);
    return a;
  };

  // Sheepdog (any `amplifyAdjacent` animal): an animal standing in a slot next
  // to an amplifier deals +amplifyAdjacent. The middle slot touches BOTH
  // neighbours, so it can stack two amplifiers. Reads a tray snapshot so the
  // same math works in the live tray and the end-of-turn workingTray pass.
  const adjacentAmplifyMult = (slotName, trayObj) => {
    const idx = SLOT_ORDER.indexOf(slotName);
    let mult = 1;
    for (const ni of [idx - 1, idx + 1]) {
      if (ni < 0 || ni >= SLOT_ORDER.length) continue;
      const ns = trayObj[SLOT_ORDER[ni]];
      if (ns?.kind !== 'animal') continue;
      const na = getAnimal(ns.animalId);
      if (na?.amplifyAdjacent > 0) mult += na.amplifyAdjacent;
    }
    return mult;
  };

  // Lyrebird (`copiesLeft`): its effective base attack this turn is whatever
  // the animal to its LEFT is swinging for (its own attack if there's nothing
  // there or the neighbour is a non-attacker). Reads the neighbour through
  // animalAttackValue so per-slot attackBonus carries through.
  const copyLeftAttack = (slotName, animal, trayObj) => {
    const idx = SLOT_ORDER.indexOf(slotName);
    const own = animal?.attack || 0;
    if (idx <= 0) return own;
    let ls = trayObj[SLOT_ORDER[idx - 1]];
    // A multi-slot animal (e.g. the McCloven combine) fills its extra cells
    // with an `occupied` placeholder pointing back to the anchor. Resolve
    // through it so the Lyrebird copies the spanning animal, not its stand-in.
    if (ls?.kind === 'occupied' && ls.occupiedBy) ls = trayObj[ls.occupiedBy];
    if (ls?.kind !== 'animal') return own;
    const lv = animalAttackValue(getAnimal(ls.animalId), ls);
    return lv > 0 ? lv : own;
  };

  // Fire an animal's onExit payload immediately (Last Supper / Make It
  // Count). Mirrors the end-of-turn applyAnimalOnExit but without the hTick
  // telemetry accumulator, which only exists inside endTurn.
  const applyAnimalExitEffects = (animal) => {
    const fx = animal?.onExit;
    if (!fx) return;
    if (fx.damage > 0) {
      if (fx.damageType === 'physical') applyDamageToEnemyHp(fx.damage);
      else                              applyDamageToEnemyComposure(fx.damage);
      pushLog(`${animal.icon} ${animal.name} parting kick: ${fx.damage} ${fx.damageType === 'physical' ? 'HP' : 'composure'}.`);
    }
    if (fx.block > 0) { setBlock(b => b + fx.block); pushLog(`${animal.icon} ${animal.name} drops +${fx.block} Block on the way out.`); }
    if (fx.applyWeak > 0) { applyExpiringWeak(fx.applyWeak); pushLog(`${animal.icon} ${animal.name} parting screech — Weak ${fx.applyWeak} on enemy.`); }
    if (fx.healComp > 0) { setComposure(c => Math.min(composureMax, c + fx.healComp)); pushLog(`${animal.icon} ${animal.name} nuzzles you — +${fx.healComp} composure.`); }
    if (fx.healHp > 0) { setHp(h => Math.min(maxHp, h + fx.healHp)); pushLog(`${animal.icon} ${animal.name} leaves you a kindness — +${fx.healHp} HP.`); }
    if (fx.redirectEnemyAttack) { redirectEnemyAttackRef.current = true; pushLog(`${animal.icon} ${animal.name} — Spittle Peck: the enemy's next attack turns on itself.`); }
  };

  // Note an animal leaving play for The Whisperer — banks a draw delivered
  // into the next turn's hand. No-op unless the power is installed.
  const noteAnimalDeparted = (n = 1) => {
    if (hasHandlerPower('whisperer')) setWhisperDrawsPending(d => d + n);
  };


  // Maul — when an enemy's mauling attack leaks any damage past Block, it also
  // tears the strongest animal off the board (Alan, 2026-06-02; handler-only).
  // The leftover HP damage is dealt by the normal attack path in
  // applyEnemyIntent; this just removes the body. No exit payoff — it's
  // killed, not sent off. Reads boardForMaulRef (the post-tick snapshot)
  // because applyEnemyIntent runs after the end-of-turn tick's tray setState
  // is queued but not yet flushed to the `tray` closure.
  const maulStrongestAnimal = () => {
    const board = boardForMaulRef.current;
    if (!board) return;
    // Pecking Order redirects the maul to the WEAKEST animal instead of the
    // strongest — the player's insurance against losing their bomb.
    const redirect = hasHandlerPower('peckingOrder');
    let best = null, bestAtk = redirect ? Infinity : -1;
    for (const s of ['intro', 'subject', 'target']) {
      const slot = board[s];
      if (slot?.kind !== 'animal') continue;
      const atk = animalAttackValue(getAnimal(slot.animalId), slot);
      if (redirect ? atk < bestAtk : atk > bestAtk) { bestAtk = atk; best = s; }
    }
    if (!best) return;
    const slot = board[best];
    const animal = getAnimal(slot.animalId);
    const updates = {};
    if (Array.isArray(slot.spans)) for (const s of slot.spans) updates[s] = null;
    else updates[best] = null;
    setTray(p => syncTrayLegacy({ ...p, ...updates }));
    noteAnimalDeparted();
    pushLog(`🦷 ${animal?.icon || '🐾'} ${animal?.name || slot.animalId} is mauled off the board${redirect ? ' — Pecking Order sent the runt forward' : " — you didn't block it all"}.`);
  };

  // Last Supper — send off an animal for Energy equal to its remaining turns
  // and a card. Single-click animal target, like Treat.
  // Snap a dismissed prompt's arming card back to hand and refund its energy.
  // The card sits in discard / exiled (or the powers row, for Well-Drilled)
  // under its original uid, so pull it from the right pile — never duplicate
  // it. Returns a log suffix (empty when there was nothing to refund).
  function refundArmedCard() {
    const r = armedRefund;
    if (!r || !r.card) return '';
    setArmedRefund(null);
    setEnergy(e => e + (r.cost || 0));
    if (r.isPower)       setPowers(ps => ps.filter(p => p.uid !== r.card.uid));
    else if (r.exhaust)  setExiled(ex => ex.filter(c => c.uid !== r.card.uid));
    else                 setDiscard(d => d.filter(c => c.uid !== r.card.uid));
    setHand(h => [...h, r.card]);
    return ` ${r.card.name} returns to hand (+${r.cost} energy).`;
  }

  function sacrificeAnimalFromSlot(slotName) {
    if (!sacrificePromptActive) return;
    const slot = tray?.[slotName];
    if (!slot || slot.kind !== 'animal') return;
    const animal = getAnimal(slot.animalId);
    // "Remaining turns" = the value the pill shows the player (durationRemaining - 1),
    // floored at 1 so a sacrifice is always worth at least the card it cost.
    const turnsLeft = Math.max(1, (slot.durationRemaining || 1) - 1);
    setEnergy(e => e + turnsLeft);
    drawCards(1);
    noteAnimalDeparted();
    setTray(p => syncTrayLegacy({ ...p, [slotName]: null }));
    setSacrificePromptActive(false);
    pushLog(`🍽 Last Supper — ${animal?.name || slot.animalId} departs. +${turnsLeft} Energy, draw 1.`);
  }

  function cancelSacrificePrompt() {
    if (!sacrificePromptActive) return;
    setSacrificePromptActive(false);
    const refunded = refundArmedCard();
    pushLog(`🍽 Last Supper dismissed without picking an animal.${refunded}`);
  }

  // Gorge — overfeed one animal: +3 turns, and if it was already fed this
  // turn, a permanent +3 attack. Single-click animal target.
  function gorgeAnimalFromSlot(slotName) {
    if (!gorgePromptActive) return;
    const slot = tray?.[slotName];
    if (!slot || slot.kind !== 'animal') return;
    const animal = getAnimal(slot.animalId);
    const wasFed = !!slot.fedThisTurn;
    const next = { ...slot, durationRemaining: (slot.durationRemaining || 0) + 3 };
    if (wasFed) next.attackBonus = (slot.attackBonus || 0) + 3;
    setTray(p => syncTrayLegacy({ ...p, [slotName]: next }));
    setGorgePromptActive(false);
    pushLog(wasFed
      ? `🍖 Gorge — ${animal?.name || slot.animalId} stays +3 turns AND gains +3 attack permanently.`
      : `🍖 Gorge — ${animal?.name || slot.animalId} stays +3 turns.`);
  }

  function cancelGorgePrompt() {
    if (!gorgePromptActive) return;
    setGorgePromptActive(false);
    const refunded = refundArmedCard();
    pushLog(`🍖 Gorge dismissed without picking an animal.${refunded}`);
  }

  // Player-activated animal abilities (Alan, 2026-06-05): Mime / Pigeon /
  // Kangaroo bring a VERB the player spends by CLICKING the on-board animal —
  // not a passive each-turn effect. The animal's `activatedAbility.id` branches
  // here. No prompt-arm step: animals with an activatedAbility are themselves
  // the click target (CombatScreen builds the handler when nothing else is
  // armed). Mirrored in sim/playSimV2.js (handlerActivateAbility).
  function activateAnimalFromSlot(slotName) {
    const slot = tray?.[slotName];
    if (!slot || slot.kind !== 'animal') return;
    const animal = getAnimal(slot.animalId);
    const ability = animal?.activatedAbility;
    if (!ability) return;
    // Per-turn verbs fire at most once per player turn.
    if (ability.cadence === 'per-turn' && abilitiesUsedThisTurn.includes(slotName)) return;

    if (ability.id === 'mime-wall') {
      // Self-consume: the invisible wall makes the enemy skip its next FULL
      // turn, then the Mime takes its bow and leaves the board.
      setEnemySkipNextTurn(true);
      const updates = {};
      if (Array.isArray(slot.spans)) for (const s of slot.spans) updates[s] = null;
      else updates[slotName] = null;
      setTray(p => syncTrayLegacy({ ...p, ...updates }));
      noteAnimalDeparted();
      pushLog(`🧱 ${animal.icon} Mime throws up an invisible wall — ${enemy?.name || 'the enemy'} skips its next turn. The Mime bows out.`);
      return;
    }
    if (ability.id === 'pigeon-scramble') {
      // Scramble the telegraphed intent into a DIFFERENT kind (a gamble — it
      // might land on something worse). Once per turn; the Pigeon stays.
      if (enemy) {
        const before = enemyIntent?.kind;
        const exclude = [before].filter(Boolean);
        // Loom Familiar's one-steal-per-combat cap holds NO MATTER WHAT: once
        // it has taken its card, a scramble must never re-roll back into
        // discard-hand (which would threaten a second steal). Mirrors the
        // end-of-turn re-roll exclude (loomStoleThisCombatRef).
        if (enemy.id === 'e2-loom-familiar' && loomStoleThisCombatRef.current && !exclude.includes('discard-hand')) {
          exclude.push('discard-hand');
        }
        setEnemyIntent(rollIntent(enemy, exclude));
        setIntentTick(t => t + 1);
      }
      setAbilitiesUsedThisTurn(u => [...u, slotName]);
      pushLog(`🐦 ${animal.icon} Pigeon struts through the plans — ${enemy?.name || 'the enemy'}'s intent is scrambled.`);
      return;
    }
    if (ability.id === 'kangaroo-pouch') {
      // Duck into the pouch: take NO damage on the next enemy turn, but give up
      // the rest of THIS turn. Guard consumed at the top of applyEnemyIntent.
      // Costs 2 energy (Alan 2026-06-06): without a cost the pouch was a
      // free End-Turn button. The 2-energy tax forces the player to spend a
      // chunk of their turn on it while still leaving room for one card play.
      if (energy < 2) {
        pushLog(`🦘 ${animal.icon} Not enough energy to duck into the pouch (needs 2).`);
        return;
      }
      setEnergy(e => e - 2);
      setPouchGuard(true);
      setAbilitiesUsedThisTurn(u => [...u, slotName]);
      pushLog(`🦘 ${animal.icon} You duck into the pouch — no damage next turn. (−2 energy, your turn ends.)`);
      endTurn();
      return;
    }
  }

  // Well-Drilled — designate an animal; it and every other copy of the same
  // animal currently on the board gain a permanent +2 attack (rest of combat).
  // Single-click animal target. Stacks via slot.attackBonus, the same channel
  // Gorge's overfeed bonus uses.
  function wellDrilledClickSlot(slotName) {
    if (!wellDrilledPromptActive) return;
    const slot = tray?.[slotName];
    if (!slot || slot.kind !== 'animal') return;
    const species = slot.animalId;
    const animal = getAnimal(species);
    let buffed = 0;
    setTray(p => {
      const next = { ...p };
      for (const sn of ['intro', 'subject', 'target']) {
        const s = next[sn];
        if (s?.kind === 'animal' && s.animalId === species) {
          next[sn] = { ...s, attackBonus: (s.attackBonus || 0) + 2 };
          buffed++;
        }
      }
      return syncTrayLegacy(next);
    });
    setWellDrilledPromptActive(false);
    pushLog(buffed > 1
      ? `🎯 Well-Drilled — all ${buffed} ${animal?.name || species} gain +2 attack for the rest of combat.`
      : `🎯 Well-Drilled — ${animal?.name || species} gains +2 attack for the rest of combat.`);
  }

  function cancelWellDrilledPrompt() {
    if (!wellDrilledPromptActive) return;
    setWellDrilledPromptActive(false);
    const refunded = refundArmedCard();
    pushLog(`🎯 Well-Drilled dismissed without picking an animal.${refunded}`);
  }

  // House Rules — designate an animal; it and every other copy of the same
  // species currently on the board stay +2 turns. Single-click animal target,
  // mirroring Well-Drilled. Stacks onto durationRemaining.
  function houseRulesClickSlot(slotName) {
    if (!houseRulesPromptActive) return;
    const slot = tray?.[slotName];
    if (!slot || slot.kind !== 'animal') return;
    const species = slot.animalId;
    const animal = getAnimal(species);
    let buffed = 0;
    setTray(p => {
      const next = { ...p };
      for (const sn of ['intro', 'subject', 'target']) {
        const s = next[sn];
        if (s?.kind === 'animal' && s.animalId === species) {
          next[sn] = { ...s, durationRemaining: (s.durationRemaining || 0) + 2 };
          buffed++;
        }
      }
      return syncTrayLegacy(next);
    });
    setHouseRulesPromptActive(false);
    setArmedRefund(null);
    pushLog(buffed > 1
      ? `🏠 House Rules — all ${buffed} ${animal?.name || species} stay +2 turns.`
      : `🏠 House Rules — ${animal?.name || species} stays +2 turns.`);
  }

  function cancelHouseRulesPrompt() {
    if (!houseRulesPromptActive) return;
    setHouseRulesPromptActive(false);
    const refunded = refundArmedCard();
    pushLog(`🏠 House Rules dismissed without picking an animal.${refunded}`);
  }

  // Acquired Taste — scan every pile (and staged lures) for variable lures
  // that can still be narrowed: their summon pool, after current exclusions,
  // must hold ≥3 species so removing one more keeps the 2-species floor.
  // Returns one entry per unique lure cardId with the species still on offer.
  function buildNarrowCandidates() {
    const seen = new Set();
    const out = [];
    const stagedLures = ['intro', 'subject', 'target']
      .map(s => tray?.[s])
      .filter(v => v?.kind === 'lure')
      .map(v => ({ id: v.cardId, name: v.cardName, summon: { animalIds: v.animalIds } }));
    const pileCards = [...deck, ...hand, ...discard, ...exiled].filter(c => c?.type === 'lure');
    for (const c of [...stagedLures, ...pileCards]) {
      const ids = CARDS_BY_ID[c.id]?.summon?.animalIds || c.summon?.animalIds;
      if (!ids || ids.length < 3 || seen.has(c.id)) continue;
      const excluded = lureNarrowing[c.id] || [];
      const kept = ids.filter(id => !excluded.includes(id));
      if (kept.length < 3) continue;
      seen.add(c.id);
      out.push({
        cardId: c.id,
        cardName: CARDS_BY_ID[c.id]?.name || c.name,
        species: kept.map(id => ({ id, name: ANIMALS[id]?.name || id, icon: ANIMALS[id]?.icon || '🐾' })),
      });
    }
    return out;
  }

  function addNarrowExclusion(cardId, animalId) {
    const ids = CARDS_BY_ID[cardId]?.summon?.animalIds || [];
    const after = [...(lureNarrowing[cardId] || []), animalId];
    const kept = ids.filter(id => !after.includes(id));
    if (kept.length < 2) return; // floor of 2 — shouldn't reach via gated UI
    setLureNarrowing(prev => ({ ...prev, [cardId]: after }));
    setNarrowChooserOpen(false);
    setArmedRefund(null);
    const animal = ANIMALS[animalId];
    pushLog(`🍂 ${CARDS_BY_ID[cardId]?.name || cardId} will no longer summon ${animal?.icon || ''} ${animal?.name || animalId}.`);
  }

  function cancelNarrowChooser() {
    if (!narrowChooserOpen) return;
    setNarrowChooserOpen(false);
    const refunded = refundArmedCard();
    pushLog(`🍂 Acquired Taste dismissed without narrowing a lure.${refunded}`);
  }

  // Feed-by-drop: drop a lure card onto a Feed slot on the Summoning Pitch
  // to feed the animals of that group without summoning a new one. The lure
  // card pays its energy cost, goes to discard, and adds its feedKey to the
  // turn's ledger so matching animals don't starve at end-of-turn.
  function feedAnimalsWithLure(handIdx, feedKey) {
    const card = hand[handIdx];
    if (!card || card.feedKey !== feedKey) return;
    const cost = effectiveCardCost(card);
    if (cost > energy) { pushLog(`Not enough energy to feed with ${card.name}.`); return; }
    setEnergy(e => e - cost);
    setHand(h => h.filter((_, i) => i !== handIdx));
    setDiscard(d => [...d, { ...card, uid: uid() }]);
    setLuresPlayedThisTurn(prev => [...prev, feedKey]);
    // Count how many animals this feed actually satisfies (durationRemaining===2
    // with matching feedKey) — the make-or-break feeds, the player's real
    // decision. Computed from the tray closure so the emit stays out of the
    // pure setTray updater below.
    const feedTargets = ['intro', 'subject', 'target'].filter(sn => {
      const slot = tray[sn];
      if (slot?.kind !== 'animal' || slot.durationRemaining !== 2) return false;
      return getAnimal(slot.animalId)?.feedKey === feedKey;
    });
    logEvent(TE.HANDLER_FEED, {
      cardId: card.id, feedKey, fed: feedTargets.length,
      enemyId: enemy?.id || null,
    });
    // Stamp ONLY animals on their make-or-break turn (durationRemaining===2)
    // with feedReceived=true. Earlier-in-stay animals don't get free credit
    // from this turn's feeding — they'll need their own feed next turn when
    // their counter hits 2 (Alan, 2026-05-31).
    setTray(prev => {
      const next = { ...prev };
      let touched = false;
      for (const sn of ['intro', 'subject', 'target']) {
        const slot = next[sn];
        if (slot?.kind !== 'animal') continue;
        if (slot.durationRemaining !== 2) continue;
        const a = getAnimal(slot.animalId);
        if (a?.feedKey === feedKey) {
          next[sn] = { ...slot, feedReceived: true, fedThisTurn: true };
          touched = true;
        }
      }
      return touched ? syncTrayLegacy(next) : prev;
    });
    pushLog(`🍴 ${card.name} consumed as feed — ${feedKey} animals satisfied.`);
  }

  // Whistle click — first click picks slot 1; second click swaps slot 1 and
  // slot 2. Clicking the same slot twice cancels the prompt.
  function whistleClickSlot(slotName) {
    if (!whistlePromptActive) return;
    if (!whistlePick1Slot) {
      setWhistlePick1Slot(slotName);
      pushLog(`🎶 Whistle — first slot: ${slotName}. Click a second slot to swap.`);
      return;
    }
    if (slotName === whistlePick1Slot) {
      setWhistlePromptActive(false);
      setWhistlePick1Slot(null);
      const refunded = refundArmedCard();
      pushLog(`🎶 Whistle cancelled (same slot picked twice).${refunded}`);
      return;
    }
    const a = whistlePick1Slot, b = slotName;
    setTray(p => syncTrayLegacy({ ...p, [a]: tray[b], [b]: tray[a] }));
    setWhistlePromptActive(false);
    setWhistlePick1Slot(null);
    pushLog(`🎶 Whistle — swapped slots ${a} and ${b}.`);
  }

  function cancelWhistlePrompt() {
    if (!whistlePromptActive) return;
    setWhistlePromptActive(false);
    setWhistlePick1Slot(null);
    const refunded = refundArmedCard();
    pushLog(`🎶 Whistle dismissed without swapping.${refunded}`);
  }

  // Treat click — pick an animal; its durationRemaining +1.
  function treatClickSlot(slotName) {
    if (!treatPromptActive) return;
    const slot = tray?.[slotName];
    if (!slot || slot.kind !== 'animal') return;
    const animal = getAnimal(slot.animalId);
    // A Treat (or Snack) counts as feeding this turn — it satisfies the feed
    // gate AND enables Gorge's overfeed attack bonus if played afterward.
    setTray(p => syncTrayLegacy({ ...p, [slotName]: { ...slot, durationRemaining: (slot.durationRemaining || 0) + 1, feedReceived: true, fedThisTurn: true } }));
    setTreatPromptActive(false);
    pushLog(`🍖 Treat — ${animal?.name || slot.animalId} stays one more turn.`);
  }

  function cancelTreatPrompt() {
    if (!treatPromptActive) return;
    setTreatPromptActive(false);
    const refunded = refundArmedCard();
    pushLog(`🍖 Treat dismissed without extending.${refunded}`);
  }

  // Just Eat It click — pick a staged lure; it transforms immediately into
  // its summoned animal. The lure card cycles back to discard via the
  // recycleToDiscard buffer (same pattern as the normal transform path,
  // but eatLureNow fires during the player turn, not end-of-turn, so we
  // setDiscard directly — there's no later overwrite to dodge).
  function eatItClickSlot(slotName) {
    if (!eatItPromptActive) return;
    const slot = tray?.[slotName];
    if (!slot || slot.kind !== 'lure') return;
    const animal = getAnimal(slot.animalId);
    pushLog(`🍴 Just Eat It — ${animal?.icon || '🐾'} ${animal?.name || slot.animalId} arrives now.`);
    if (slot.card) setDiscard(d => [...d, { ...slot.card, uid: uid() }]);
    setTray(p => syncTrayLegacy({ ...p, [slotName]: {
      kind: 'animal',
      animalId: slot.animalId,
      durationRemaining: (animal?.duration || 3) + (hasHandlerPower('houseRules') ? 1 : 0),
      predatorProgress: 0,
    } }));
    setEatItPromptActive(false);
  }

  function cancelEatItPrompt() {
    if (!eatItPromptActive) return;
    setEatItPromptActive(false);
    const refunded = refundArmedCard();
    pushLog(`🍴 Just Eat It dismissed without summoning.${refunded}`);
  }

  // Synchronous draw. Reads deck/discard/hand from closure (the state at
  // the start of the current event handler) and computes the result in
  // working locals before committing each pile once. The nested-setState
  // pattern this replaced was broken — inner updaters don't fire
  // synchronously inside the outer one, so `result` was undefined and
  // `setHand(undefined.hand)` crashed the render → blank screen on endTurn.
  function drawCards(n) {
    let wDeck = [...deck];
    let wDiscard = [...discard];
    const wHand = [...hand];
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      if (wDeck.length === 0) {
        if (wDiscard.length === 0) break;
        wDeck = shuffle(wDiscard);
        wDiscard = [];
      }
      const c = wDeck.shift();
      wHand.push({ ...c, uid: uid() });
      drawn++;
    }
    setDeck(wDeck);
    setDiscard(wDiscard);
    setHand(wHand);
    // v2.10: annotation damageOnDraw — composure damage per card drawn.
    const perDraw = annoFx('damageOnDraw');
    if (perDraw > 0 && drawn > 0) {
      applyDamageToEnemyComposure(perDraw * drawn);
      pushLog(`📝 Marginalia stings: -${perDraw * drawn} comp.`);
    }
  }

  // Composure damage: block absorbs first, then composure drops.
  function applyDamageToEnemyComposure(damage) {
    if (damage > 0) damagedEnemyThisTurnRef.current = true;
    let remaining = damage;
    // Read from the synchronous mirrors, not the closure state, so repeated
    // calls in the same tick (animal loops, On Three!, thorns) accumulate.
    let newBlock = enemyBlockRef.current;
    let newComposure = enemyComposureRef.current;
    if (newBlock > 0) {
      const absorbed = Math.min(newBlock, remaining);
      newBlock -= absorbed; remaining -= absorbed;
    }
    newComposure = Math.max(0, newComposure - remaining);
    enemyBlockRef.current = newBlock;
    enemyComposureRef.current = newComposure;
    setEnemyBlock(newBlock);
    setEnemyComposure(newComposure);
    showDamageFloater(damage, 'composure');
    // v2.97: Silk Wraith phase shift — at ≤50% comp, becomes wit-resistant
    // and regenerates comp each turn. Hard-coded by enemy.id for the
    // act-1 prototype; if more phase-shifters land, generalize via a
    // phaseTrigger field on the enemy template.
    // v2.99.1 (post-playtest tuning): wit-immunity (0) → wit-resistance
    // (0.5) and regen 3 → 1. Wit-scholar with starter deck couldn't beat
    // the post-shift Wraith — cast damage zeroed out while it healed 3/turn.
    // Resistance still distinguishes the mechanic for wit (slower grind)
    // without being a hard wall.
    if (enemy?.id === 'e2-silk-wraith' && !enemy.phaseShifted
        && newComposure > 0 && newComposure <= enemy.composureMax * 0.5) {
      // 2026-05-31: enemy effectiveness-per-stat removed game-wide. Phase
      // shift now drops only the composure-regen tick (a distinct mechanic
      // from the lane-resistance multiplier that used to ride alongside it).
      setEnemy(e => e ? { ...e, phaseShifted: true } : e);
      pushLog('━━━━━━━━━━━━━━━━━━━━━━━');
      pushLog('🕸 PHASE SHIFT — Silk Wraith thins!');
      pushLog('   • Re-weaves +1 Composure at the start of every enemy turn.');
      pushLog('━━━━━━━━━━━━━━━━━━━━━━━');
    }
    if (newComposure <= 0) setTimeout(() => onEnemyDefeated(), 200);
    return newComposure;
  }

  // Physical damage: same block-then-pool flow, but pool is enemy HP.
  function applyDamageToEnemyHp(damage) {
    if (damage > 0) damagedEnemyThisTurnRef.current = true;
    let remaining = damage;
    let newBlock = enemyBlockRef.current;
    let newHp = enemyHpRef.current;
    if (newBlock > 0) {
      const absorbed = Math.min(newBlock, remaining);
      newBlock -= absorbed; remaining -= absorbed;
    }
    newHp = Math.max(0, newHp - remaining);
    enemyBlockRef.current = newBlock;
    enemyHpRef.current = newHp;
    setEnemyBlock(newBlock);
    setEnemyHp(newHp);
    showDamageFloater(damage, 'physical');
    if (newHp <= 0) setTimeout(() => onEnemyDefeated(), 200);
    return newHp;
  }

  // End the player's turn. Sequence:
  //   1. End-of-turn power triggers (sync local — may kill enemy).
  //   2. Enemy resolves intent (may KO player).
  //   3. Tick down debuff stacks (1 step each).
  //   4. Discard hand, reset block.
  //   5. Refill energy + draw new hand + run start-of-turn power triggers,
  //      all computed in sync working locals before commit. This replaces
  //      a nested-setState + setTimeout pattern that was unsafe — inner
  //      updaters don't fire synchronously inside the outer one and the
  //      hand-set ended up reading undefined, blanking the screen.
  function endTurn() {
    if (stage !== 'combat') return;
    logEvent(TE.TURN_END, {
      enemyId: enemy?.id, hp, composure, energyLeft: energy, handSize: hand.length,
      trayStaged: (tray.intro ? 1 : 0) + (tray.subject ? 1 : 0) + (tray.target ? 1 : 0) + (tray.modifiers?.length || 0),
      // Handler board state going into end-of-turn (null for other lanes).
      // animalsOnBoard = summoned animals; pendingLures = staged lures still
      // counting down to arrival; activeTactic = pack-tactic uptime; block =
      // defensive cushion (shield routing); luresPlayedThisTurn = feeds +
      // summons issued this turn.
      handler: selectedCharacter?.lane === 'handler' ? {
        animalsOnBoard: ['intro', 'subject', 'target']
          .map(s => tray[s]).filter(v => v?.kind === 'animal').map(v => v.animalId),
        pendingLures: ['intro', 'subject', 'target']
          .map(s => tray[s]).filter(v => v?.kind === 'lure').length,
        activeTactic: tray.tactic?.tactic?.id || null,
        block,
        luresPlayedThisTurn: (luresPlayedThisTurn || []).length,
      } : null,
      // v2.84: surface multiplier state so vulnerability/sap stories can
      // be diagnosed from telemetry. playerDmgMult > 1 = enemy Vulnerable
      // to our spells; enemyDmgMult > 1 = we're Vulnerable to their
      // attacks. Same fields for the post-drift snapshot.
      playerDmgMult: Number(playerDmgMult?.toFixed?.(2) ?? 1),
      enemyDmgMult:  Number(enemyDmgMult?.toFixed?.(2) ?? 1),
      // v3.4.11: full pile snapshot — diagnose card-loss across turns.
      piles: pilesSnapshot(),
    });

    // RAGE turn-end reset removed 2026-05-31 (machinery ripped).
    // DOUBLING DOWN endTurn billing removed 2026-05-31 (cornerTokens ripped).
    // v2.48: AWKWARD PAUSE — at end of turn, graduate pauseHeld (this turn's
    // skill-armed flag) into pauseHeldActive (the doubling bank for NEXT
    // turn's cast). The tray already persists (v2.1), so the doubling is
    // the only side-effect. If pauseHeldActive was ALREADY true coming
    // into this endTurn (player held + didn't cast), it stays true — the
    // bank carries forward into the turn after, mirroring the "multi-turn
    // buildup if patient" spec.
    if (pauseHeld) {
      setPauseHeld(false);
      setPauseHeldActive(true);
      pushLog(`🤫 The silence stretches. Next cast: ×2 staged stats.`);
    }
    // v2.46: WON'T SHUT UP — if still armed at end of turn, the player
    // didn't follow through. Eat 3 unblocked HP. Telemetry: damage++.
    // Clear flag either way (the contract is per-turn).
    if (wontShutUpArmed) {
      setHp(h => Math.max(0, h - 3));
      setWontShutUpTelemetry(t => ({ ...t, damage: t.damage + 1 }));
      pushLog(`🗣 Stopped abruptly. -3 HP.`);
      logEvent('jnsq.wontShutUp.damage', {
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
      setWontShutUpArmed(false);
    }

    // v2.38: SAYING SOMETHING WRONG — auto-play any Misstep tokens still in
    // hand at end of turn. Each token = -3 HP self-damage (snapshotted from
    // the queue, default 3) and exhausts. This happens BEFORE the hand
    // merges into discard so the tokens are diverted to exile, not cycled
    // back into the deck. The "did the player let it ride" branch — they
    // either pay 1 Energy to discard during their turn, or eat it now.
    // Telemetry routed through logEvent so the report can read aggregate
    // auto-play counts.
    const missteppedInHand = hand.filter(c => c?.id === MISSTEP_TOKEN.id);
    let endTurnHand = hand;
    let postMisstepHp = hp;
    if (missteppedInHand.length > 0) {
      let totalSelfDmg = 0;
      for (const tok of missteppedInHand) totalSelfDmg += (tok.selfDamage || 3);
      postMisstepHp = Math.max(0, hp - totalSelfDmg);
      setHp(postMisstepHp);
      setExiled(ex => [...ex, ...missteppedInHand]);
      pushLog(`📜 Misstep × ${missteppedInHand.length} auto-played: -${totalSelfDmg} HP. (You should not have said that.)`);
      logEvent('wit.missTepAutoPlay', {
        count: missteppedInHand.length, selfDamage: totalSelfDmg,
        enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
      endTurnHand = hand.filter(c => c?.id !== MISSTEP_TOKEN.id);
      // If the misstep just killed the player, route into the defeat screen
      // (same path as enemy KO) and short-circuit the rest of endTurn so
      // we don't run the enemy intent / hand reshuffle on a corpse.
      if (postMisstepHp <= 0) {
        logEvent(TE.COMBAT_END, { enemyId: enemy?.id, outcome: 'lost', tier: enemy?.tier, hpAfter: 0, composureAfter: composure, piles: pilesSnapshot() });
        logEvent(TE.RUN_END, { outcome: 'lost', killedBy: 'misstep', actIdx: currentActIdx, finalDeckSize: deck.length + hand.length + discard.length + exiled.length });
        setTimeout(() => setStage('defeat'), 200);
        return;
      }
    }

    // v2.1: persistent tray. Cards staged into intro/subject/target/modifier
    // slots carry across turns until the spell casts. This replaces the old
    // fizzle-on-turn-end behavior — players can now compose a sentence
    // across multiple turns, casting partial spells for tempo or holding
    // for a higher-tier cast next turn.
    // (Tray clears only when a cast fires or combat ends.)
    //
    // v2.82: PRE-STAGING COST. The carry-over wasn't free anymore — if you
    // didn't cast this turn AND any cards remain staged in the tray, each
    // one costs 1 composure. You're focusing on what you'll say next,
    // which means you're not paying as much attention to the enemy now.
    // Applies whether the player skipped on purpose (Awkward Pause) or
    // just didn't complete the spell. Doesn't apply if you cast — the
    // tray empties on cast, so there's nothing to carry.
    if (selectedCharacter?.lane !== 'handler' && castsThisTurn === 0) {
      // Pre-staging penalty + Weave debt are wit/jnsq-only — they hinge on
      // "did you finish a spell this turn?" Handler doesn't cast spells
      // (animals attack automatically), so neither check applies. Without
      // this gate the handler ate the penalty every turn because animal
      // envelopes in intro/subject/target counted as "staged words" and
      // castsThisTurn was always 0 (Alan, 2026-05-31).
      // Belt-and-suspenders: exclude summon envelopes from the count too —
      // even if the lane gate misfires somehow, animal/lure envelopes
      // shouldn't be billed as "carried staged words."
      const isWord = (s) => !!s && !isSummonEnvelope(s);
      const staged = (isWord(tray.intro) ? 1 : 0) + (isWord(tray.subject) ? 1 : 0) + (isWord(tray.target) ? 1 : 0) + ((tray.modifiers || []).filter(isWord).length);
      if (staged > 0) {
        const cost = staged;
        setComposure(c => Math.max(0, c - cost));
        pushLog(`🧠 Pre-staging: -${cost} composure (focused on next turn, not on them).`);
      }
    }

    // 1. End-of-turn power triggers.
    const killedByPowers = applyEndOfTurnPowerTriggers();
    if (killedByPowers) return;

    // Buffer for cards the rest of endTurn needs to fold into stagedDiscard.
    // Used by the Handler lure-recycle path (and anything else that wants to
    // recycle cards into the new discard without losing them to the
    // subsequent setDiscard(wDiscard) overwrite).
    const recycleToDiscard = [];
    // The Whisperer power — count animals that leave during this end-of-turn
    // tick. Folded (with whisperDrawsPending from instant-play exits this
    // turn) into the new hand at the refill block. endTurn-scoped so the
    // refill block can read it after the handler tick mutates it.
    let whisperFromTick = 0;
    const whispererInstalled = hasHandlerPower('whisperer');

    // Handler Animal Summoner end-of-turn tick (2026-05-31, slice 1).
    // Process order:
    //   PRE-PASS — adjacency cannibalism (2026-05-31, slice 2 mechanic):
    //     If a lure is adjacent to an already-summoned animal of the species
    //     the lure would summon (e.g. Birdseed next to a Sparrow), the animal
    //     JUMPS into the lure's slot and EATS the bait. The lure is consumed
    //     (sent to exiled, no discard cycle), the animal's original slot
    //     becomes empty, and the animal's attack this turn is skipped — eating
    //     is the action. Duration is NOT extended.
    //   a. ANIMALS act: attack the enemy, decrement duration, advance
    //      predator-chain progress, transform to predator if chain completes,
    //      empty the slot if duration reaches 0. Animals that ate this turn
    //      skip the attack step.
    //   b. LURES tick: decrement turnsRemaining, transform into the
    //      summoned animal in-place when it reaches 0. Newly arrived
    //      animals wait until the NEXT end-of-turn to act.
    if (selectedCharacter?.lane === 'handler') {
      // Telemetry accumulator for the menagerie's end-of-turn output — the
      // Handler's "cast." Plain locals (not React state), incremented at each
      // attack/exit/arrival/block site, emitted once after the tick. Lets a
      // Handler run be gauged the way wit casts/FFT signals gauge a wit run.
      const hTick = {
        composureDealt: 0, hpDealt: 0, blockGained: 0,
        attacks: 0, arrivals: [], exits: [], shortStays: 0,
      };
      // Working copy of the tray — pre-pass mutates this before the main loop
      // iterates so the loop sees the post-cannibalism state.
      const workingTray = { intro: tray.intro, subject: tray.subject, target: tray.target };
      // Maul (Alan, 2026-06-02): which slots held an animal DURING the player's
      // turn, before this tick transforms any staged lures. Only these are
      // maul-eligible — a lure that becomes an animal on this very end-turn
      // tick (or a fresh adjacent-spawn) isn't "out" until next turn begins.
      const preTickAnimalSlots = new Set(SLOT_ORDER.filter(s => tray[s]?.kind === 'animal'));
      const luresEaten = []; // lure cards sent to exiled (eaten, not cycled)

      // onExit helper — fires when an animal departs by natural duration
      // expiry. Handles damage (Young Buck's 6-comp kick), block (Field
      // Mouse's +3 block), and Weak debuff (Hawk's parting screech).
      // Doesn't fire on predator-chain / adjacent-spawn transforms
      // — only natural exit.
      const applyAnimalOnExit = (animal) => {
        const fx = animal?.onExit;
        if (!fx) return;
        if (fx.damage > 0) {
          if (fx.damageType === 'physical') { applyDamageToEnemyHp(fx.damage); hTick.hpDealt += fx.damage; }
          else                              { applyDamageToEnemyComposure(fx.damage); hTick.composureDealt += fx.damage; }
          pushLog(`${animal.icon} ${animal.name} parting kick: ${fx.damage} ${fx.damageType === 'physical' ? 'HP' : 'composure'}.`);
        }
        if (fx.block > 0) {
          setBlock(b => b + fx.block);
          hTick.blockGained += fx.block;
          pushLog(`${animal.icon} ${animal.name} drops +${fx.block} Block on the way out.`);
        }
        if (fx.applyWeak > 0) {
          applyExpiringWeak(fx.applyWeak);
          pushLog(`${animal.icon} ${animal.name} parting screech — Weak ${fx.applyWeak} on enemy.`);
        }
        if (fx.healComp > 0) {
          setComposure(c => Math.min(composureMax, c + fx.healComp));
          pushLog(`${animal.icon} ${animal.name} nuzzles you on the way out — +${fx.healComp} composure.`);
        }
        if (fx.healHp > 0) {
          setHp(h => Math.min(maxHp, h + fx.healHp));
          pushLog(`${animal.icon} ${animal.name} leaves you with a kindness — +${fx.healHp} HP.`);
        }
        if (fx.redirectEnemyAttack) {
          redirectEnemyAttackRef.current = true;
          pushLog(`${animal.icon} ${animal.name} — Spittle Peck: the enemy's next attack turns on itself.`);
        }
      };

      // Pre-pass: cannibalism check. Walk lures; for each, check both
      // neighbors for a matching-species animal. First match wins.
      for (let i = 0; i < SLOT_ORDER.length; i++) {
        const lureSlot = workingTray[SLOT_ORDER[i]];
        if (!lureSlot || lureSlot.kind !== 'lure') continue;
        const neighborIndices = [i - 1, i + 1].filter(n => n >= 0 && n < SLOT_ORDER.length);
        for (const ni of neighborIndices) {
          const neighbor = workingTray[SLOT_ORDER[ni]];
          if (!neighbor || neighbor.kind !== 'animal') continue;
          if (neighbor.animalId !== lureSlot.animalId) continue;
          // Match — the neighbor animal eats this lure.
          const animal = getAnimal(neighbor.animalId);
          pushLog(`${animal?.icon || '🐾'} ${animal?.name || neighbor.animalId} jumps over and eats the ${lureSlot.cardName || 'lure'}!`);
          if (lureSlot.card) luresEaten.push({ ...lureSlot.card, uid: uid() });
          // Move the animal into the lure's slot, marked as having acted.
          workingTray[SLOT_ORDER[i]] = { ...neighbor, eatenThisTurn: true };
          workingTray[SLOT_ORDER[ni]] = null;
          break; // animal can only eat one lure per turn
        }
      }

      // Pre-pass: cannibalism only considers real animals — skip occupied
      // placeholder slots (Mouse House's second cell). Already handled
      // naturally because workingTray[s].kind === 'animal' check excludes
      // 'occupied' kind. Same for Hawk strike and row bonus below.

      // Pre-pass: RAPTOR SWOOP (Alan, 2026-06-02). Each turn there is a 5%
      // chance per Field Mouse on the board that a raptor swoops in and eats
      // it. The raptor is a Hawk (65%) or an Owl (35%). The eaten animal
      // forfeits this turn (no attack/draw); the raptor takes the slot with
      // full duration and acts normally next turn (eatenThisTurn). Salmon is
      // no longer eligible — it now attracts predators via its own
      // predatorRoll gamble (Alan, 2026-06-02).
      const swoopRaptor = (slotName, slot, verb, forcedId) => {
        const raptorId = forcedId || (Math.random() < 0.65 ? 'hawk' : 'owl');
        const raptor = getAnimal(raptorId);
        const preyName = getAnimal(slot.animalId)?.name || slot.animalId;
        pushLog(`${raptor?.icon || '🦅'} A ${raptor?.name || 'raptor'} swoops in and ${verb} the ${preyName} — its turn is forfeited.`);
        workingTray[slotName] = {
          kind: 'animal',
          animalId: raptorId,
          durationRemaining: raptor?.duration || 3,
          predatorProgress: 0,
          adjacentSpawnProgress: 0,
          summonSet: slot.summonSet || null,
          eatenThisTurn: true, // raptor took the action this turn — wait until next.
        };
      };
      for (const slotName of SLOT_ORDER) {
        const slot = workingTray[slotName];
        if (!slot || slot.kind !== 'animal') continue;
        if (slot.animalId !== 'field-mouse') continue;
        // E2E hook: ?forceSwoop=owl|hawk forces the first eligible prey to be
        // swooped (once per combat), bypassing the 5% roll. window.__forceSwoop
        // is only ever set by devSeed from the URL, so normal play is untouched.
        const forced = (typeof window !== 'undefined') ? window.__forceSwoop : null;
        if (forced === 'owl' || forced === 'hawk') {
          window.__forceSwoop = null;
          swoopRaptor(slotName, slot, 'snatches', forced);
          continue;
        }
        if (Math.random() >= 0.05) continue;
        swoopRaptor(slotName, slot, 'snatches');
      }

      // Declared before the combine pre-pass: the combine-detonation burst
      // below can KO the enemy and must set this flag, so it can't live further
      // down with the other end-of-turn locals (that was a TDZ render crash).
      let summonerKilledEnemy = false;

      // Pre-pass: THREE-OF-A-KIND COMBINES. When all 3 slots hold the same
      // species AND that species has a combine target, merge into the
      // combine animal anchored at intro spanning into subject. target
      // empties. Combine animals never need feeding (no feedKey) and
      // attack/grant defense on the turn they form (no eatenThisTurn).
      const COMBINE_BY_SPECIES = {
        'field-mouse': 'mouse-house',
        'rabbit':      'long-hare',
        'young-buck':  'mccloven',
      };
      const firstSlot = workingTray[SLOT_ORDER[0]];
      const matchedSpecies = (firstSlot?.kind === 'animal' && COMBINE_BY_SPECIES[firstSlot.animalId])
        ? firstSlot.animalId
        : null;
      const allSameSpecies = matchedSpecies && SLOT_ORDER.every(s =>
        workingTray[s]?.kind === 'animal' && workingTray[s].animalId === matchedSpecies);
      if (allSameSpecies) {
        const combineId = COMBINE_BY_SPECIES[matchedSpecies];
        const combineAnim = getAnimal(combineId);
        pushLog(`✨ Three ${getAnimal(matchedSpecies)?.name || matchedSpecies}s combine into ${combineAnim?.icon || ''} ${combineAnim?.name || combineId} — it spans two slots.`);
        workingTray.intro = {
          kind: 'animal',
          animalId: combineId,
          durationRemaining: combineAnim?.duration || 2,
          predatorProgress: 0,
          adjacentSpawnProgress: 0,
          summonSet: matchedSpecies === 'field-mouse' ? 'tender-greens' : null,
          spans: ['intro', 'subject'],
          justCombined: true, // formation turn: attack but don't burn a duration tick
        };
        workingTray.subject = { kind: 'occupied', occupiedBy: 'intro' };
        workingTray.target = null;
        // COMBINE DETONATION (cycle 2): assembling a three-of-a-kind is the
        // Handler's burst valve — a one-time spike the turn it forms, on top
        // of the combine's normal same-turn attack. Rewards narrowing lures
        // hard enough to stack three of a species. Mirrored in sim.
        const onForm = combineAnim?.onForm;
        if (onForm) {
          const bits = [];
          if (onForm.damage > 0) {
            if (onForm.pool === 'composure') {
              const post = applyDamageToEnemyComposure(onForm.damage);
              hTick.composureDealt += onForm.damage;
              if (post <= 0) summonerKilledEnemy = true;
              bits.push(`${onForm.damage} composure`);
            } else {
              const post = applyDamageToEnemyHp(onForm.damage);
              hTick.hpDealt += onForm.damage;
              if (post <= 0) summonerKilledEnemy = true;
              bits.push(`${onForm.damage} HP`);
            }
          }
          if (onForm.applyVulnerable > 0) { applyExpiringVuln(onForm.applyVulnerable); bits.push(`Vulnerable ${onForm.applyVulnerable}`); }
          if (onForm.applyWeak > 0) { applyExpiringWeak(onForm.applyWeak); bits.push(`Weak ${onForm.applyWeak}`); }
          hTick.attacks++;
          pushLog(`💥 ${combineAnim.icon} ${combineAnim.name} forms with a burst — ${bits.join(', ')}.`);
        }
      }

      // Pre-pass: TENDER GREENS ROW BONUS. If every slot holds an animal
      // summoned via Tender Greens (summonSet === 'tender-greens') AND the
      // bonus hasn't already fired for the current row composition, fire it:
      // each animal's NEXT ATTACK is +50% AND each grants +3 Block per turn
      // for the rest of its stay. (Alan, 2026-05-31: dropped legacy +1
      // duration extension that fought the feeding tick; toned next-attack
      // multiplier from 2.0 → 1.5 and added a per-turn block grant to
      // smooth the bonus across multiple turns instead of one big burst.)
      // tenderGreensRowBonusFired marker on each envelope prevents re-fire
      // for the same row; when an animal leaves or the set changes, the
      // bonus is available again on the next full row.
      const slotEntries = SLOT_ORDER.map(s => workingTray[s]);
      const allTenderGreens = slotEntries.every(s => s && s.kind === 'animal' && s.summonSet === 'tender-greens');
      const allAlreadyFired = allTenderGreens && slotEntries.every(s => s.tenderGreensRowBonusFired);
      if (allTenderGreens && !allAlreadyFired) {
        pushLog(`🥬 TENDER GREENS row complete — each animal's next attack ×1.5 AND +3 Block per turn.`);
        for (const slotName of SLOT_ORDER) {
          const s = workingTray[slotName];
          workingTray[slotName] = {
            ...s,
            nextAttackMult: 1.5,
            turnGrantTemp: { ...(s.turnGrantTemp || {}), block: ((s.turnGrantTemp?.block) || 0) + 3 },
            tenderGreensRowBonusFired: true,
          };
        }
      }

      // Pre-pass: RAPTOR EATS ADJACENT PREY (Alan, 2026-06-02). On its EXIT
      // turn (durationRemaining === 1) a Hawk or Owl can eat ONE adjacent prey
      // (Field Mouse / Rabbit / Salmon), MOVE into that square, and stay one
      // more turn — once only (ateAdjacentOnce). It cannot be fed again after.
      // Runs after combines so a full mouse-row still merges first.
      for (const slotName of SLOT_ORDER) {
        const raptorSlot = workingTray[slotName];
        if (!raptorSlot || raptorSlot.kind !== 'animal') continue;
        const raptor = getAnimal(raptorSlot.animalId);
        const prey = raptor?.eatsAdjacent;
        if (!prey || !prey.length) continue;
        if (raptorSlot.durationRemaining !== 1 || raptorSlot.ateAdjacentOnce) continue;
        const hi = SLOT_ORDER.indexOf(slotName);
        for (const ni of [hi - 1, hi + 1]) {
          if (ni < 0 || ni >= SLOT_ORDER.length) continue;
          const ns = SLOT_ORDER[ni];
          const neighbor = workingTray[ns];
          if (neighbor && neighbor.kind === 'animal' && prey.includes(neighbor.animalId)) {
            const preyName = getAnimal(neighbor.animalId)?.name || neighbor.animalId;
            workingTray[ns] = {
              ...raptorSlot,
              durationRemaining: 2, // attacks this turn + one more, then exits
              ateAdjacentOnce: true,
            };
            workingTray[slotName] = null;
            pushLog(`${raptor.icon} The ${raptor.name} takes the adjacent ${preyName} and moves into its place — it stays one more turn.`);
            break; // one prey per raptor per turn
          }
        }
      }

      // Pre-pass: OWL VULNERABLE (Alan, 2026-06-02). A standing Owl applies its
      // Vulnerable to the enemy BEFORE any animal attacks, so the whole
      // menagerie's hits land into the debuff this same turn. Skips an Owl
      // still in its swoop-forfeit turn (eatenThisTurn) — not settled in yet.
      for (const slotName of SLOT_ORDER) {
        const slot = workingTray[slotName];
        if (!slot || slot.kind !== 'animal' || slot.eatenThisTurn) continue;
        const animal = getAnimal(slot.animalId);
        if (!animal?.prePassVulnerable) continue;
        applyExpiringVuln(animal.prePassVulnerable);
        pushLog(`${animal.icon} ${animal.name} unsettles the enemy — Vulnerable ${animal.prePassVulnerable} (before the swarm).`);
      }

      // Pre-pass: RAVEN BIRD THEFT (2026-06-02). On the turn a Raven is set to
      // exit (durationRemaining === 1, i.e. its last attack happens this tick),
      // it strips `birdTheft` Block from the enemy BEFORE any animal attacks —
      // so the burst that follows lands on bare composure. Uses enemyBlockRef
      // for the synchronous value (setEnemyBlock is async). Skips unfed ravens,
      // which short-stay and never reach their payoff turn.
      for (const slotName of SLOT_ORDER) {
        const slot = workingTray[slotName];
        if (!slot || slot.kind !== 'animal') continue;
        const animal = getAnimal(slot.animalId);
        if (!animal?.birdTheft || slot.durationRemaining !== 1) continue;
        if (animal.feedKey && !slot.feedReceived) continue; // unfed short-stays; no payoff
        const stripped = Math.min(enemyBlockRef.current, animal.birdTheft);
        if (stripped > 0) {
          enemyBlockRef.current = Math.max(0, enemyBlockRef.current - animal.birdTheft);
          setEnemyBlock(b => Math.max(0, b - animal.birdTheft));
          pushLog(`${animal.icon} ${animal.name} — Bird Theft: strips ${stripped} Block from the enemy.`);
        } else {
          pushLog(`${animal.icon} ${animal.name} — Bird Theft: the enemy had no Block to take.`);
        }
      }

      const nextSlots = {};
      const luresToRecycle = []; // lure cards returned to discard on transform
      // Feed gate (Alan, 2026-05-31): feeding does NOT extend duration. It
      // unlocks the natural-exit onExit bonus AND the final turn. If never
      // fed by the make-or-break turn (animal's D-1 turn on the board), the
      // animal short-stays — leaves one turn early with no exit bonus.
      // feedReceived is set persistently on the slot envelope when a matching
      // feed-key lure is consumed.
      const isUnfed = (slot, animal) => animal?.feedKey && !slot.feedReceived;

      // Pre-pass: ADJACENCY COMBOS (Alan, 2026-06-02). Two specific species in
      // adjacent slots perform a joint special attack — once per pair-type per
      // turn. Animals can't be repositioned (they land where the lure was
      // placed), so lining a combo up is a planned-but-luck-influenced payoff;
      // the lure-narrowing skill is what makes a pair reliable. Fires here,
      // before the per-animal loop, so a combo's debuff (Weak/Vuln) lands
      // before the swarm's normal swings. Mirrored in sim/playSimV2.js.
      const comboFiredPairs = new Set();
      for (let i = 0; i < SLOT_ORDER.length - 1; i++) {
        const sA = workingTray[SLOT_ORDER[i]];
        const sB = workingTray[SLOT_ORDER[i + 1]];
        if (!sA || sA.kind !== 'animal' || sA.eatenThisTurn) continue;
        if (!sB || sB.kind !== 'animal' || sB.eatenThisTurn) continue;
        const combo = ADJACENCY_COMBOS.find(c =>
          (c.a === sA.animalId && c.b === sB.animalId) ||
          (c.a === sB.animalId && c.b === sA.animalId));
        if (!combo) continue;
        const key = [combo.a, combo.b].sort().join('+');
        if (comboFiredPairs.has(key)) continue; // one fire per pair-type per turn
        comboFiredPairs.add(key);
        hTick.attacks++;
        const bits = [];
        if (combo.damage > 0) {
          if (combo.pool === 'composure') {
            const post = applyDamageToEnemyComposure(combo.damage);
            hTick.composureDealt += combo.damage;
            if (post <= 0) summonerKilledEnemy = true;
            bits.push(`${combo.damage} composure`);
          } else {
            const post = applyDamageToEnemyHp(combo.damage);
            hTick.hpDealt += combo.damage;
            if (post <= 0) summonerKilledEnemy = true;
            bits.push(`${combo.damage} HP`);
          }
        }
        if (combo.applyWeak > 0) { applyExpiringWeak(combo.applyWeak); bits.push(`Weak ${combo.applyWeak}`); }
        if (combo.applyVulnerable > 0) { applyExpiringVuln(combo.applyVulnerable); bits.push(`Vulnerable ${combo.applyVulnerable}`); }
        if (combo.draw > 0) { drawCards(combo.draw); bits.push(`draw ${combo.draw}`); }
        if (combo.block > 0) { setBlock(b => b + combo.block); hTick.blockGained += combo.block; bits.push(`+${combo.block} Block`); }
        pushLog(`✨ ${combo.icon} COMBO — ${combo.name}: ${bits.join(', ')}.`);
      }

      for (const slotName of SLOT_ORDER) {
        const slot = workingTray[slotName];
        if (!slot) { nextSlots[slotName] = null; continue; }
        // Occupied placeholder cells are mirrored from their anchor. Skip
        // here — when the anchor processes, it'll set both slots in
        // nextSlots. If the anchor was processed FIRST and cleared this
        // slot to null, we'd never reach here. If processed LATER, leave
        // the placeholder in place until the anchor commits.
        if (slot.kind === 'occupied') {
          if (nextSlots[slotName] === undefined) nextSlots[slotName] = slot;
          continue;
        }
        if (slot.kind === 'animal') {
          const animal = getAnimal(slot.animalId);
          if (!animal) { nextSlots[slotName] = null; continue; }
          // Skip attack if the animal already acted this turn by eating a
          // lure / being snatched by a Hawk (eatenThisTurn flag), or for
          // 0-attack animals (Salmon — flops by design). nextAttackMult
          // multiplies this attack only (consumed below; reset in the
          // duration-tick branches).
          if (!slot.eatenThisTurn && animal.attack > 0) {
            const atkMult = slot.nextAttackMult || 1;
            const ampMult = adjacentAmplifyMult(slotName, workingTray);
            const baseAtk = animal.copiesLeft ? copyLeftAttack(slotName, animal, workingTray) : animalAttackValue(animal, slot);
            let atk = Math.round(baseAtk * atkMult * ampMult);
            const multLabel = atkMult > 1 ? ` (×${atkMult})` : '';
            const ampLabel = ampMult > 1 ? ` (🐕 +${Math.round((ampMult - 1) * 100)}%)` : '';
            const copyLabel = animal.copiesLeft ? ' (🎙️ copies left)' : '';
            const tacticId = tray.tactic?.tactic?.id;
            const isShield = tacticId === 'shield';
            const isRabid  = tacticId === 'rabid';
            if (isRabid) atk = Math.round(atk * 1.5);
            const tacticLabel = isRabid ? ' (Rabid ×1.5)' : isShield ? ' (Shield → Block & Poise)' : '';
            hTick.attacks++;
            if (isShield) {
              setBlock(b => b + atk);
              setPoise(p => p + atk);
              hTick.blockGained += atk;
              pushLog(`${animal.icon} ${animal.name} braces: +${atk} Block & Poise${multLabel}${ampLabel}${copyLabel}${tacticLabel}.`);
            } else {
              // Capture the POST-damage pool from the ref-backed damage
              // helpers — they accumulate across the loop, so this catches a
              // cumulative kill (two animals that each fall short alone but
              // together drop the enemy). The old check read the stale
              // closure `enemyComposure`/`enemyHp` and missed those, letting
              // a dead enemy still fire its intent at the player.
              if (animal.attackPool === 'composure') {
                const post = applyDamageToEnemyComposure(atk);
                hTick.composureDealt += atk;
                if (post <= 0) summonerKilledEnemy = true;
                pushLog(`${animal.icon} ${animal.name} attacks: ${atk} composure${multLabel}${ampLabel}${copyLabel}${tacticLabel}.`);
              } else {
                const post = applyDamageToEnemyHp(atk);
                hTick.hpDealt += atk;
                if (post <= 0) summonerKilledEnemy = true;
                pushLog(`${animal.icon} ${animal.name} attacks: ${atk} HP${multLabel}${ampLabel}${copyLabel}${tacticLabel}.`);
              }
              if (isRabid) {
                const recoil = Math.max(1, Math.round(atk * 0.1));
                setComposure(c => Math.max(0, c - recoil));
                pushLog(`💢 Rabid recoil: -${recoil} composure.`);
              }
            }
            if (animal.onAttack?.draw) drawCards(animal.onAttack.draw);
            // Per-attack debuff rider (Mouse House Vuln 1; Long Hare Weak 1).
            if (animal.onAttackEffect?.applyVulnerable > 0) {
              applyExpiringVuln(animal.onAttackEffect.applyVulnerable);
              pushLog(`${animal.icon} ${animal.name} unsettles the enemy — Vulnerable ${animal.onAttackEffect.applyVulnerable}.`);
            }
            if (animal.onAttackEffect?.applyWeak > 0) {
              applyExpiringWeak(animal.onAttackEffect.applyWeak);
              pushLog(`${animal.icon} ${animal.name} blurs the enemy's swing — Weak ${animal.onAttackEffect.applyWeak}.`);
            }
            // Deferred re-attacks armed by On Three! / Stampede this turn.
            // They resolve here on the animals' turn (not at play time) using
            // the animal's base attack — the one-shot nextAttackMult was spent
            // by the natural swing above. Tactic modifiers (Rabid/Shield) still
            // apply since the same tactic is in the tray.
            const extraAttacks = slot.extraAttacks || 0;
            for (let e = 0; e < extraAttacks; e++) {
              let xatk = Math.round(baseAtk * ampMult);
              if (isRabid) xatk = Math.round(xatk * 1.5);
              hTick.attacks++;
              if (isShield) {
                setBlock(b => b + xatk);
                setPoise(p => p + xatk);
                hTick.blockGained += xatk;
                pushLog(`${animal.icon} ${animal.name} braces again: +${xatk} Block & Poise (Pack Tactics).`);
              } else if (animal.attackPool === 'composure') {
                const post = applyDamageToEnemyComposure(xatk);
                hTick.composureDealt += xatk;
                if (post <= 0) summonerKilledEnemy = true;
                pushLog(`${animal.icon} ${animal.name} attacks again: ${xatk} composure (Pack Tactics${isRabid ? ' · Rabid' : ''}).`);
              } else {
                const post = applyDamageToEnemyHp(xatk);
                hTick.hpDealt += xatk;
                if (post <= 0) summonerKilledEnemy = true;
                pushLog(`${animal.icon} ${animal.name} attacks again: ${xatk} HP (Pack Tactics${isRabid ? ' · Rabid' : ''}).`);
              }
              if (!isShield && isRabid) {
                const recoil = Math.max(1, Math.round(xatk * 0.2));
                setComposure(c => Math.max(0, c - recoil));
                pushLog(`💢 Rabid recoil: -${recoil} composure.`);
              }
              if (animal.onAttack?.draw) drawCards(animal.onAttack.draw);
            }
          }
          // Per-turn passive grants (Long Hare / McCloven / Tender Greens row
          // bonus). Fires every turn the animal is on board, regardless of
          // eatenThisTurn or whether the animal attacked. Also fires for
          // turnGrantTemp riders the row-bonus pre-pass stamps on slots.
          const grant = animal.turnGrant || slot.turnGrantTemp;
          if (grant) {
            if (grant.block > 0) {
              setBlock(b => b + grant.block);
              hTick.blockGained += grant.block;
              pushLog(`${animal.icon} ${animal.name} braces: +${grant.block} Block.`);
            }
            if (grant.poise > 0) {
              setPoise(p => p + grant.poise);
              pushLog(`${animal.icon} ${animal.name} steadies you: +${grant.poise} Poise.`);
            }
          }
          // Decrement duration and tick chain counters. A combine on its
          // formation turn attacks (payoff) but does NOT spend a duration
          // tick — otherwise a duration-2 combine that forms and ticks in
          // the same pass only survives one more turn. It mirrors a fresh
          // summon waiting a turn, except the combine also gets to swing.
          let nextDuration = slot.justCombined ? slot.durationRemaining : slot.durationRemaining - 1;
          const nextPredator = (slot.predatorProgress || 0) + 1;
          const nextAdjSpawn = (slot.adjacentSpawnProgress || 0) + 1;

          // Predator chain (Salmon → Bear): in-place transform, fresh duration.
          // TERRITORIAL (Alan, 2026-06-01): an apex predator won't share range
          // with its own kind — the chain target only spawns if no animal of
          // that species is already on the projected board. This caps the
          // Buffet + Fish-Food "three bears at once" burst that one-shot
          // normal enemies. Extra salmon keep flopping (normal tick, progress
          // held high) and pop into a bear only once the resident bear leaves.
          // FEED GATE (Alan, 2026-06-01): the predator chain is the PAYOFF for
          // feeding. An unfed animal never summons its predator — it just slips
          // away on its short-stay turn like any other unfed animal. Gating the
          // chain on !isUnfed lets an unfed salmon fall through to the short-stay
          // branch below instead of turning into a free bear.
          const chainReady = animal.predatorChain && !isUnfed(slot, animal)
            && nextPredator >= animal.predatorChain.turnsToTrigger;
          const chainTargetId = animal.predatorChain?.animalId;
          // TERRITORIAL CAP (Alan, 2026-06-01): at most MAX_CHAIN_TARGET of the
          // chain species (bears) may hold the board at once. Raised from an
          // effective 1 to 2 — extra salmon keep flopping until a bear leaves.
          const MAX_CHAIN_TARGET = 2;
          const chainTargetCount = chainReady ? SLOT_ORDER.reduce((n, s) => {
            if (s === slotName) return n;
            const proj = (nextSlots[s] !== undefined) ? nextSlots[s] : workingTray[s];
            return n + ((proj && proj.kind === 'animal' && proj.animalId === chainTargetId) ? 1 : 0);
          }, 0) : 0;
          const chainTargetCapped = chainReady && chainTargetCount >= MAX_CHAIN_TARGET;
          if (chainReady && chainTargetCapped) {
            pushLog(`${animal.icon} The ${animal.name} waits — the range already holds ${chainTargetCount} ${getAnimal(chainTargetId)?.name || chainTargetId}${chainTargetCount === 1 ? '' : 's'}.`);
          }
          // Predator ROLL (Salmon, 2026-06-02): a probabilistic, no-feed
          // gamble. Each tick the salmon is on the board it rolls
          // predatorRoll.chance to attract a predator; on a hit it transforms
          // IN PLACE into a weighted pick from predatorRoll.table (uniform
          // within the chosen ids). A salmon that never hits just departs with
          // no bonus — the high-risk version of the old Salmon→Bear chain.
          let rollTargetId = null;
          if (animal.predatorRoll) {
            // E2E hook: ?forceSalmonRoll forces the next roll to succeed with a
            // specific species (consumed once). Normal play is untouched.
            const forcedRoll = (typeof window !== 'undefined') ? window.__forceSalmonRoll : null;
            if (forcedRoll) {
              window.__forceSalmonRoll = null;
              rollTargetId = forcedRoll;
            } else if (Math.random() < animal.predatorRoll.chance) {
              const table = animal.predatorRoll.table || [];
              const totalW = table.reduce((s, e) => s + (e.weight || 0), 0);
              let r = Math.random() * totalW;
              let chosen = table[0];
              for (const e of table) { if ((r -= (e.weight || 0)) < 0) { chosen = e; break; } }
              const ids = chosen?.ids || [];
              if (ids.length > 0) rollTargetId = ids[Math.floor(Math.random() * ids.length)];
            }
          }
          if (rollTargetId) {
            const newAnimal = getAnimal(rollTargetId);
            pushLog(`${animal.icon}→${newAnimal?.icon || '?'} The ${animal.name} draws a ${newAnimal?.name || rollTargetId}!`);
            nextSlots[slotName] = {
              kind: 'animal',
              animalId: rollTargetId,
              durationRemaining: newAnimal?.duration || 3,
              predatorProgress: 0,
              adjacentSpawnProgress: 0,
              summonSet: slot.summonSet || null,
            };
          } else if (chainReady && !chainTargetCapped) {
            const newAnimalId = chainTargetId;
            const newAnimal = getAnimal(newAnimalId);
            pushLog(`${animal.icon}→${newAnimal?.icon || '?'} The ${animal.name} attracts a ${newAnimal?.name || newAnimalId}!`);
            nextSlots[slotName] = {
              kind: 'animal',
              animalId: newAnimalId,
              durationRemaining: newAnimal?.duration || 3,
              predatorProgress: 0,
              adjacentSpawnProgress: 0,
              summonSet: slot.summonSet || null,
            };
          } else if (animal.adjacentSpawn && !slot.adjacentSpawned
                     && nextAdjSpawn >= animal.adjacentSpawn.turnsToTrigger
                     && !isUnfed(slot, animal)
                     && (() => {
                          const si = SLOT_ORDER.indexOf(slotName);
                          return [si - 1, si + 1].some(n => {
                            if (n < 0 || n >= SLOT_ORDER.length) return false;
                            const ns = SLOT_ORDER[n];
                            const proj = (nextSlots[ns] !== undefined) ? nextSlots[ns] : workingTray[ns];
                            return proj == null;
                          });
                        })()) {
            // Adjacent-spawn chain (Rabbit): spawn a copy of the configured
            // animalId in each adjacent EMPTY slot. Original extends self
            // duration by extendSelfTurns. Fires ONCE per animal (`adjacentSpawned`
            // flag) and only when a neighbor is open — otherwise the rabbit would
            // re-arm every cycle and its turns-left counter would bounce back up,
            // reading as a glitch. A full board falls through to normal exit logic.
            const slotIdx = SLOT_ORDER.indexOf(slotName);
            const neighborIdxs = [slotIdx - 1, slotIdx + 1].filter(n => n >= 0 && n < SLOT_ORDER.length);
            const spawnId = animal.adjacentSpawn.animalId;
            const spawnAnimal = getAnimal(spawnId);
            let spawned = 0;
            for (const ni of neighborIdxs) {
              const ns = SLOT_ORDER[ni];
              // Check the WORKING tray for the neighbor's current state —
              // but we want the END state. Since we're mid-loop, any slot
              // processed earlier in this iteration is in nextSlots. Slots
              // not yet processed are in workingTray. Compose.
              const projected = (nextSlots[ns] !== undefined) ? nextSlots[ns] : workingTray[ns];
              if (projected == null) {
                nextSlots[ns] = {
                  kind: 'animal',
                  animalId: spawnId,
                  durationRemaining: spawnAnimal?.duration || 3,
                  predatorProgress: 0,
                  adjacentSpawnProgress: 0,
                  adjacentSpawned: true,
                  summonSet: slot.summonSet || null,
                };
                spawned++;
              }
            }
            const extend = animal.adjacentSpawn.extendSelfTurns || 0;
            nextDuration = (slot.durationRemaining - 1) + extend;
            pushLog(`${animal.icon} ${animal.name} multiplies: +${spawned} ${spawnAnimal?.name || spawnId} adjacent. Original stays ${extend} more turn${extend === 1 ? '' : 's'}.`);
            // Continue to duration logic; one-shot guard set below.
            if (nextDuration <= 0) {
              if (animal.onExit && !isUnfed(slot, animal)) applyAnimalOnExit(animal);
              hTick.exits.push({ animalId: slot.animalId, fed: !isUnfed(slot, animal) });
              if (whispererInstalled) whisperFromTick++;
              pushLog(isUnfed(slot, animal)
                ? `${animal.icon} ${animal.name} departs unfed — no exit bonus.`
                : `${animal.icon} ${animal.name} departs.`);
              if (slot.spans && slot.spans.length > 0) {
                for (const s of slot.spans) nextSlots[s] = null;
              } else {
                nextSlots[slotName] = null;
              }
            } else {
              nextSlots[slotName] = {
                ...slot,
                durationRemaining: nextDuration,
                predatorProgress: nextPredator,
                adjacentSpawnProgress: 0,
                adjacentSpawned: true,
                eatenThisTurn: false,
                fedThisTurn: false,
                // FEED RETRIGGER: adjacent-spawn extension is a new cycle —
                // clear stale fed status (see normal-tick branch below).
                feedReceived: nextDuration >= 2 ? false : slot.feedReceived,
                nextAttackMult: 1,
                extraAttacks: 0,
              };
            }
          } else if (nextDuration <= 0) {
            if (animal.onExit && !isUnfed(slot, animal)) applyAnimalOnExit(animal);
            hTick.exits.push({ animalId: slot.animalId, fed: !isUnfed(slot, animal) });
            if (whispererInstalled) whisperFromTick++;
            pushLog(isUnfed(slot, animal)
              ? `${animal.icon} ${animal.name} departs unfed — no exit bonus.`
              : `${animal.icon} ${animal.name} departs.`);
            if (slot.spans && slot.spans.length > 0) {
              for (const s of slot.spans) nextSlots[s] = null;
            } else {
              nextSlots[slotName] = null;
            }
          } else if (nextDuration === 1 && isUnfed(slot, animal)) {
            // SHORT-STAY: the animal hits its D-1 turn unfed. It leaves now,
            // one turn before its natural exit, with no exit bonus. This is
            // the consequence of never feeding during its stay. (Alan,
            // 2026-05-31: "feeding doesn't add an extra turn — it grants
            // the last turn AND the exit bonus.")
            hTick.shortStays++;
            hTick.exits.push({ animalId: slot.animalId, fed: false });
            if (whispererInstalled) whisperFromTick++;
            pushLog(`${animal.icon} ${animal.name} slips away unfed — no exit bonus.`);
            if (slot.spans && slot.spans.length > 0) {
              for (const s of slot.spans) nextSlots[s] = null;
            } else {
              nextSlots[slotName] = null;
            }
          } else {
            // Normal tick — clear flags that were consumed this turn.
            nextSlots[slotName] = {
              ...slot,
              durationRemaining: nextDuration,
              predatorProgress: nextPredator,
              adjacentSpawnProgress: nextAdjSpawn,
              eatenThisTurn: false,
              fedThisTurn: false,
              // FEED RETRIGGER (Alan, 2026-06-02): a feed satisfies ONE cycle
              // (the dur-2 make-or-break → dur-1 → exit). If an extension
              // (Gorge / Treat / adjacent-spawn) pushes the animal back to 2+
              // turns, that's a fresh cycle — clear the stale fed status so it
              // must be fed again before its next make-or-break. Preserved at
              // nextDuration===1 so the original dur-2 feed still carries the
              // last turn AND the exit bonus.
              feedReceived: nextDuration >= 2 ? false : slot.feedReceived,
              nextAttackMult: 1,
              extraAttacks: 0,
              justCombined: false,
            };
          }
        } else if (slot.kind === 'lure') {
          const nextTurns = slot.turnsRemaining - 1;
          if (nextTurns <= 0) {
            // Resolve species. Birds of a Feather tactic overrides with the
            // species of any existing animal currently on the board.
            const tacticId = tray.tactic?.tactic?.id;
            let resolvedAnimalId = null;
            if (tacticId === 'feather') {
              const existing = SLOT_ORDER.map(s => (nextSlots[s] !== undefined ? nextSlots[s] : workingTray[s]))
                .find(v => v?.kind === 'animal');
              if (existing) resolvedAnimalId = existing.animalId;
            }
            if (!resolvedAnimalId) {
              const pool = slot.animalIds && slot.animalIds.length > 0
                ? narrowedPool(slot.cardId, slot.animalIds)
                : null;
              // E2E hook: ?forceSpecies=field-mouse pins every random pool pick
              // to that species (when the pool offers it), so a three-of-a-kind
              // combine is deterministically reachable in Lab Mode.
              // 2026-06-06: also accepts a comma list (field-mouse,rabbit) —
              // entries are consumed IN ORDER, one per resolved summon, so
              // mixed-species adjacency pairs are deterministically reachable
              // too. (Safe to consume here: endTurn() is imperative code, not
              // a pure setState updater.)
              const forcedRaw = (typeof window !== 'undefined') ? window.__forceSpecies : null;
              let forcedSpecies = forcedRaw;
              if (forcedRaw && String(forcedRaw).includes(',')) {
                const queue = String(forcedRaw).split(',');
                forcedSpecies = queue[0];
                if (pool && pool.includes(forcedSpecies)) {
                  // Consume the entry; an exhausted list pins its final entry.
                  window.__forceSpecies = queue.slice(1).join(',') || forcedSpecies;
                }
              }
              if (forcedSpecies && pool && pool.includes(forcedSpecies)) {
                resolvedAnimalId = forcedSpecies;
              } else {
                resolvedAnimalId = pool && pool.length > 0
                  ? pool[Math.floor(Math.random() * pool.length)]
                  : slot.animalId;
              }
            }
            // 3.5% elite-summon roll. If the chosen species has an elite
            // variant (mecha-mouse, bonzai-bunaroo, james-deer), there's a
            // small chance the summon arrives as the upgraded form.
            const baseForRoll = ANIMALS[resolvedAnimalId];
            if (baseForRoll?.elite && Math.random() < 0.035) {
              const eliteId = baseForRoll.elite;
              const eliteDef = ANIMALS[eliteId];
              if (eliteDef) {
                pushLog(`✨ Rare summon! ${eliteDef.icon} ${eliteDef.name} arrives instead of a ${baseForRoll.name}.`);
                resolvedAnimalId = eliteId;
              }
            }
            const animal = getAnimal(resolvedAnimalId);
            hTick.arrivals.push(resolvedAnimalId);
            pushLog(`${animal?.icon || '🐾'} ${animal?.name || resolvedAnimalId} arrives!`);
            // Lure card cycles back to discard so it can be redrawn.
            if (slot.card) luresToRecycle.push({ ...slot.card, uid: uid() });
            // Fountain of Youth tactic: +1 duration to fresh summons.
            const youthBonus = (tacticId === 'youth' ? 1 : 0) + (slot.youthBonus || 0);
            nextSlots[slotName] = {
              kind: 'animal',
              animalId: resolvedAnimalId,
              durationRemaining: (animal?.duration || 3) + youthBonus,
              predatorProgress: 0,
              adjacentSpawnProgress: 0,
              summonSet: slot.summonSet || null,
            };
          } else {
            nextSlots[slotName] = { ...slot, turnsRemaining: nextTurns };
          }
        } else {
          nextSlots[slotName] = slot;
        }
      }
      // (Starvation post-pass removed 2026-05-31 — short-stay branch in the
      // main loop now handles unfed exits one turn earlier.)

      // Birds of a Feather self-exhaust: if the tactic is active AND three
      // animals of the SAME species are on the board after this tick, the
      // tactic card exhausts (→ exiled) and the slot clears.
      const activeTacticId = tray.tactic?.tactic?.id;
      if (activeTacticId === 'feather') {
        const speciesCounts = {};
        for (const s of SLOT_ORDER) {
          const slot = nextSlots[s];
          if (slot?.kind === 'animal') {
            speciesCounts[slot.animalId] = (speciesCounts[slot.animalId] || 0) + 1;
          }
        }
        const hasTriple = Object.values(speciesCounts).some(n => n >= 3);
        if (hasTriple) {
          const exhaustCard = tray.tactic;
          pushLog(`📜 Birds of a Feather — three of a kind, the tactic exhausts.`);
          logEvent(TE.TACTIC_CHANGE, { action: 'exhaust', tacticId: 'feather', enemyId: enemy?.id || null });
          setExiled(ex => [...ex, { ...exhaustCard, uid: uid() }]);
          setTray(p => syncTrayLegacy({ ...p, ...nextSlots, tactic: null }));
        } else {
          setTray(p => syncTrayLegacy({ ...p, ...nextSlots }));
        }
      } else {
        setTray(p => syncTrayLegacy({ ...p, ...nextSlots }));
      }
      if (luresToRecycle.length > 0) {
        // Push into the shared recycle buffer instead of setDiscard — the
        // end-of-turn refill block reads `discard` from closure and then
        // overwrites it with setDiscard(wDiscard), which would clobber any
        // setDiscard call we made here. Folding into stagedDiscard avoids
        // the state-batching race entirely.
        recycleToDiscard.push(...luresToRecycle);
        pushLog(`🪱 ${luresToRecycle.length === 1 ? 'Lure' : 'Lures'} → discard.`);
      }
      if (luresEaten.length > 0) {
        // Eaten lures cycle to discard, same as transformed lures (Alan
        // 2026-05-31: "You don't lose the birdseed card permanently. You
        // just have to replay it now because the seed was eaten by the
        // bird"). The bait is consumed in-fiction; the card resource is
        // not. Same stagedDiscard buffer the transform path uses to dodge
        // the closure-vs-functional batching race.
        recycleToDiscard.push(...luresEaten);
        pushLog(`🪱 Eaten ${luresEaten.length === 1 ? 'lure' : 'lures'} → discard.`);
      }
      // Emit the menagerie's end-of-turn output as the Handler's "cast" —
      // the wit-equivalent per-turn combat signal. Board pressure (animals
      // left standing + pending lures) lets us read engine cadence/uptime.
      logEvent(TE.HANDLER_TICK, {
        enemyId: enemy?.id || null,
        composureDealt: hTick.composureDealt,
        hpDealt: hTick.hpDealt,
        blockGained: hTick.blockGained,
        attacks: hTick.attacks,
        arrivals: hTick.arrivals,
        exits: hTick.exits,
        shortStays: hTick.shortStays,
        activeTactic: tray.tactic?.tactic?.id || null,
        animalsOnBoard: SLOT_ORDER.map(s => nextSlots[s] !== undefined ? nextSlots[s] : workingTray[s])
          .filter(v => v?.kind === 'animal').map(v => v.animalId),
        pendingLures: SLOT_ORDER.map(s => nextSlots[s] !== undefined ? nextSlots[s] : workingTray[s])
          .filter(v => v?.kind === 'lure').length,
      });
      // Maul: snapshot the post-tick board for applyEnemyIntent, which runs
      // later this endTurn before the tray setState has flushed to closure.
      // Only slots that ALREADY held an animal during the player's turn are
      // eligible — animals that just arrived on this tick (lure transforms,
      // adjacent-spawns) aren't "out" until next turn and can't be mauled.
      boardForMaulRef.current = Object.fromEntries(
        SLOT_ORDER.map(s => {
          const v = nextSlots[s] !== undefined ? nextSlots[s] : workingTray[s];
          return [s, (v?.kind === 'animal' && preTickAnimalSlots.has(s)) ? v : null];
        }));
      if (summonerKilledEnemy) {
        // Combat is over — this early return skips the end-of-turn refill
        // block that normally folds recycleToDiscard into stagedDiscard
        // (and on into setDiscard). Without flushing here, any lure that
        // transformed into an animal — or was eaten — on this killing tick
        // is lost: its card sits only in the local recycleToDiscard buffer,
        // while its tray slot now holds an animal (no .card), so the next
        // enterFight's deck rebuild can't recover it. Flush directly; no
        // batching race exists on this path because the setDiscard(wDiscard)
        // overwrite lives past this return.
        if (recycleToDiscard.length > 0) {
          setDiscard(d => [...d, ...recycleToDiscard]);
        }
        return;
      }
    }

    // v2.10: annotation damageOnTurnEnd — composure tick at end of player turn.
    const annTurnEnd = annoFx('damageOnTurnEnd');
    if (annTurnEnd > 0) {
      applyDamageToEnemyComposure(annTurnEnd);
      pushLog(`📝 Margin notes: -${annTurnEnd} comp.`);
    }

    // Hollow Weaver — Weave debt resolves here, AFTER every player-side
    // end-of-turn damage source (the Handler animal tick above, annotation
    // ticks, casts during the turn). The rule is now lane-agnostic (Alan,
    // 2026-06-02): if you dealt ANY damage to the enemy this turn the weave is
    // interrupted and clears silently; if you didn't, all stacks fire as
    // composure damage. Wit clears it by landing a cast; the Handler clears it
    // by having an animal attack. The damagedEnemyThisTurnRef is reset below,
    // once the new player turn's hand is drawn.
    if (weaveStacks > 0) {
      if (damagedEnemyThisTurnRef.current) {
        setWeaveStacks(0);
      } else {
        const dmg = weaveStacks;
        setComposure(c => Math.max(0, c - dmg));
        // Folded into applyEnemyIntent's wComp below so its absolute
        // setComposure(wComp) doesn't overwrite this fire on attack turns.
        weaveFireDamageRef.current = dmg;
        pushLog(`🪡 Weave fires: -${dmg} composure (you struck nothing this turn — the thought finishes itself).`);
        setWeaveStacks(0);
      }
    }

    // v3.4.12 (Alan bug): DoT tick MOVED ABOVE the enemy intent. Previously
    // the enemy intent fired first, then DoT killed the enemy — but the
    // intent's side effects (e.g. Loom Familiar's steal-card modal) had
    // already triggered, leaving a stale CardLossOverlay that re-popped
    // on the next combat. DoT killing on enemy turn-start should pre-empt
    // the intent entirely. Local `dotKilled` flag short-circuits the
    // intent block below.
    // v2.7 / v3.4 — Poison-style DoT tick. Bypasses enemy block
    // (matches STS Poison semantic AND avoids the stale-closure
    // double-write that was restoring faded block). DoT goes
    // straight to composure. Decrements turnsRemaining; expires at 0.
    // v3.4.3 (Alan): kill check — composure→0 from DoT now ends combat.
    let dotKilled = false;
    if (enemy?.dot?.turnsRemaining > 0) {
      const dot = enemy.dot;
      // v3.4.17 — schedule-driven DoT (Slow Decay / Steady Erosion).
      // When dot.schedule exists, the first entry is THIS turn's damage
      // and the rest shifts down for future turns. Flat-rate dot has
      // no schedule and uses dot.damage every turn.
      const sched = Array.isArray(dot.schedule) ? dot.schedule : null;
      const dmg = sched && sched.length > 0 ? sched[0] : dot.damage;
      const remaining = dot.turnsRemaining - 1;
      const nextSched = sched ? sched.slice(1) : undefined;
      const nextDamage = nextSched && nextSched.length > 0 ? nextSched[0] : dot.damage;
      if (dmg > 0) {
        const compBefore = enemyComposure;
        const compAfter = Math.max(0, compBefore - dmg);
        setEnemy(e => {
          if (!e) return e;
          const nextDot = remaining > 0 && (nextDamage > 0 || dot.damage > 0)
            ? { ...dot, damage: nextDamage, schedule: nextSched, turnsRemaining: remaining }
            : null;
          return { ...e, composure: compAfter, dot: nextDot };
        });
        setEnemyComposure(compAfter);
        showDamageFloater(dmg, 'composure');
        if (compAfter <= 0 && compBefore > 0) {
          dotKilled = true;
          setTimeout(() => onEnemyDefeated(), 200);
        }
      } else if (remaining > 0) {
        setEnemy(e => e ? { ...e, dot: { ...dot, damage: nextDamage, schedule: nextSched, turnsRemaining: remaining } } : e);
      } else {
        setEnemy(e => e ? { ...e, dot: null } : e);
      }
      pushLog(`🩸 DoT: ${dmg} composure (${remaining} turn${remaining === 1 ? '' : 's'} left).`);
    }

    // 2. Enemy turn begins. Enemy block expires here, before the intent
    // fires — so an enemy that blocks on consecutive turns gets a fresh
    // pool each time, and player attacks during the previous turn can't
    // free-rider through stale block.
    if (enemyBlock > 0) {
      pushLog(`👹 ${enemy?.name || 'Enemy'}: 🛡 fades.`);
      logEvent(TE.ENEMY_BLOCK_CHANGE, {
        before: enemyBlock, after: 0, reason: 'turn-start-fade',
        enemyId: enemy?.id, intentKind: enemyIntent?.kind,
      });
    }
    setEnemyBlock(0);

    // 3. Enemy intent — skipped if DoT just killed the enemy this turn, OR
    // if any end-of-turn player damage (Handler menagerie, annotation tick)
    // already dropped the enemy. Reads the synchronous refs so a kill that
    // lands this tick pre-empts the intent instead of letting a dead enemy
    // get one last swing in before onEnemyDefeated's setTimeout resolves.
    // Composure-only enemies have hpMax 0, so only gate on HP when they
    // actually have an HP pool.
    const enemyDeadNow = enemyComposureRef.current <= 0
      || (enemy?.hpMax > 0 && enemyHpRef.current <= 0);
    if (enemyIntent && !dotKilled && !enemyDeadNow) applyEnemyIntent(enemyIntent);
    if (hp <= 0 || composure <= 0) return;

    // v2.34: LONG THREAD bookkeeping. Runs AFTER the enemy intent resolves
    // so `unblockedThisTurn` is final. Rules:
    //   - Took unblocked HP/composure damage → meter resets to 0.
    //   - Otherwise, if the player cast a wit Effect this turn → meter +1.
    //   - Otherwise (no wit cast, no unblocked hit) → meter is unchanged.
    // Reset the per-turn flags either way.
    // v3.0 cycle 5: Long Thread now DECAYS by 1 instead of full reset
    // on unblocked hit. The thread is wit's identity defense; making it
    // resilient lets thread defense actually compound across a combat.
    // Sim cycle-3 stats: avg peak LT 1.12 / 179 breaks per 100 wit runs.
    // The full-reset made thread effectively unusable; decay-by-1 keeps
    // damage taken meaningful without invalidating multiple safe turns.
    if (unblockedThisTurn) {
      if (longThread > 0) {
        const next = Math.max(0, longThread - 1);
        pushLog(`🧵 Thread frays — Long Thread: ${next}.`);
        setLongThread(next);
      }
    } else if (castWitEffectThisTurn) {
      setLongThread(n => {
        const next = n + 1;
        pushLog(`🧵 Long Thread: ${next}`);
        return next;
      });
    }
    // v2.93: D-4 (Bracing for Impact) — if armed AND HP dropped this turn,
    // draw 3 cards. Compare current hp to the snapshot captured at turn
    // start. Flag is one-shot; clears either way.
    if (bracingArmed) {
      if (hp < hpAtTurnStart) {
        drawCards(3);
        pushLog(`🛡✦ Bracing for Impact: drew 3 (took ${hpAtTurnStart - hp} HP).`);
      } else {
        pushLog(`🛡✦ Bracing for Impact: dropped, no damage taken.`);
      }
      setBracingArmed(false);
    }
    // v2.93: capture HP for the NEXT turn's bracing check. Updated AFTER
    // bracing fires so the snapshot rolls forward cleanly.
    setHpAtTurnStart(hp);
    setUnblockedThisTurn(false);
    setCastWitEffectThisTurn(false);
    // v3.4.59 — "I'll Take That as a Compliment" end-of-turn heal.
    // Heal HP for damage that came out of the snapshotted block pool
    // this turn (capped at cap). Then clear snap.
    if (complimentSnap) {
      const absorbed = Math.max(0, complimentSnap.snap - (block || 0));
      const healed = Math.min(complimentSnap.cap, absorbed);
      if (healed > 0) {
        setHp(h => Math.min(maxHp, h + healed));
        pushLog(`💞 I'll Take That as a Compliment: +${healed} HP (Block absorbed ${absorbed}).`);
      }
      setComplimentSnap(null);
    }
    // v3.4.59 — clear "I Know Just What to Say" if it was unused this turn.
    if (nextCardFree) setNextCardFree(false);
    // v3.4.67 — Handler school over-time decay.
    //   Temp HP: each end-of-turn the turn counter decrements; at 0,
    //   any remaining Temp HP evaporates.
    //   Self-Vulnerable: counter decrements; at 0, reset playerIncomingMult.
    if (tempHpTurns > 0) {
      const next = tempHpTurns - 1;
      setTempHpTurns(next);
      if (next === 0 && tempHp > 0) {
        pushLog(`🎈 Temp HP expired (${tempHp} lost).`);
        setTempHp(0);
      }
    }
    if (playerIncomingMultTurns > 0) {
      const next = playerIncomingMultTurns - 1;
      setPlayerIncomingMultTurns(next);
      if (next === 0 && playerIncomingMult !== 1.0) {
        pushLog(`🩸 Self-Vulnerable expired.`);
        setPlayerIncomingMult(1.0);
      }
    }

    // v2.36: ACTUALLY— reset per-turn state. arguingBackThisTurn is the
    // enemy-side surcharge; it cleared during the enemy intent that already
    // resolved above (the bill came due this turn). lastCastSnapshot is the
    // re-fire target; nuking it ensures Actually— on turn N+1 has no cast
    // from N-1 to re-fire — only THIS turn's casts qualify. Both clear
    // post-enemy-intent so the damage bump and re-fire both fire this turn.
    setArguingBackThisTurn(0);
    setLastCastSnapshot(null);

    // v2.52: DRUNKEN STAGGER — clear the dodge window AFTER the enemy intent
    // resolved. The skill arms staggerActive on play turn N; the enemy intent
    // at endTurn N rolls dodges; the flag clears here so player turn N+1
    // starts fresh (no carry-over). Defensive only — strictly one-turn window.
    if (staggerActive) {
      setStaggerActive(false);
    }

    // v2.37: HOLD ON — auto-clear if unused. The flag is meant to interrupt
    // the NEXT enemy attack, not linger as a delayed counter. If applyEnemyIntent
    // already consumed it, holdOnArmed is already false — this is a no-op.
    if (holdOnArmed) {
      pushLog(`🛑 Hold on — released, no one was talking.`);
      setHoldOnArmed(false);
      setHoldOnValue(0);
    }

    // 2.5. Block fades — explicit log so the player sees expiry happen even
    //      when a Hedgehog/Felt re-grant immediately tops it back up below.
    //      `block` here is the closure value at the top of the event handler;
    //      good enough for "you had block; it's gone now."
    if (block > 0) pushLog(`🛡 Block fades.`);
    if (poise > 0) pushLog(`🪞 Poise fades.`);
    setPoise(0);

    // 3. Debuff decay.
    // v3.4.84 (Alan): drift removed — it was impossible to track in your
    // head and made damage planning fuzzy. Weak / Vulnerable now run on a
    // discrete turn counter: tick it down by 1, and when it reaches 0 the
    // multiplier snaps cleanly back to 1.0. Reading enemyDmgTurns /
    // playerDmgTurns from the render closure (their pre-decrement values)
    // keeps both setState updaters pure — no nested reads.
    setEnemyDmgMult(m  => (enemyDmgTurns <= 1 ? 1.0 : m));
    setPlayerDmgMult(m => (playerDmgTurns <= 1 ? 1.0 : m));
    setEnemyDmgTurns(t => Math.max(0, t - 1));
    setPlayerDmgTurns(t => Math.max(0, t - 1));

    // 4-5. Compose the new turn's piles + start-of-turn triggers
    //      synchronously, then commit all related state in one pass.
    // v2.38: endTurnHand is hand minus any Misstep tokens that auto-played
    // above — those went to exile, not discard, and shouldn't recycle.
    // Loom Familiar steal: cards taken by applyEnemyIntent (which already ran
    // above) are recorded in stolenCardsRef. Pull them OUT of the recycle so
    // they don't shuffle back, and exile them — that's what makes the steal
    // actually remove a card from play instead of cycling it back into hand.
    const stolenCards = stolenCardsRef.current;
    stolenCardsRef.current = [];
    const stolenUids = new Set(stolenCards.map(c => c.uid));
    const recyclableHand = (stolenUids.size > 0
      ? endTurnHand.filter(c => !stolenUids.has(c.uid))
      : endTurnHand)
      // Tokens (Full Pockets' Snack) never recycle — an unplayed one simply
      // vanishes at end of turn rather than polluting the discard/deck.
      .filter(c => !c.token);
    if (stolenCards.length > 0) setExiled(ex => [...ex, ...stolenCards]);
    const stagedDiscard = [...discard, ...recyclableHand, ...recycleToDiscard];
    const drawn = drawFromPiles(deck, stagedDiscard, HAND_SIZE + extraDrawPerTurn());
    let wDeck     = drawn.deck;
    let wDiscard  = drawn.discard;
    const wHand   = [...drawn.hand];
    let wEnergy   = energyPerTurnRefill();
    // v2.33: Stubborn Block removed — block always resets to 0 at start of turn.
    let wBlock    = 0;

    // v2.10: annotation start-of-turn effects fire BEFORE the decrement.
    const annTurnStartDmg = annoFx('damageOnTurnStart');
    const annTurnStartEnergy = annoFx('energyOnTurnStart');
    if (annTurnStartDmg > 0) {
      applyDamageToEnemyComposure(annTurnStartDmg);
      pushLog(`📝 Read aloud: -${annTurnStartDmg} comp.`);
    }
    if (annTurnStartEnergy > 0) {
      wEnergy += annTurnStartEnergy;
      pushLog(`📝 +${annTurnStartEnergy} Energy (read aloud).`);
    }
    // v2.10: tick annotation duration. Annotations live 3-4 player turns;
    // tick fires AFTER the start-of-turn effect lands, so the player gets
    // every turn's benefit before expiry.
    if (enemy?.annotation) {
      const nextTurns = enemy.annotation.turnsRemaining - 1;
      if (nextTurns <= 0) {
        pushLog(`📝 The note on ${enemy.name} fades from memory.`);
        setEnemy(e => e ? { ...e, annotation: null } : e);
      } else {
        setEnemy(e => e ? { ...e, annotation: { ...e.annotation, turnsRemaining: nextTurns } } : e);
      }
    }
    // Familiar-style startOfTurnBlock (e.g. Hedgehog): fires every turn,
    // including turn 1 (handled separately in enterFight's startBlockTotal).
    // This is the SAME source the player sees as "Block: 2 every turn"
    // — it's not lingering, it's being re-granted.
    for (const { effect, sourceName } of effectSources()) {
      if (effect?.startOfTurnBlock) {
        wBlock += effect.startOfTurnBlock;
        pushLog(`🛡 +${effect.startOfTurnBlock} (${sourceName || 'aura'}).`);
      }
    }
    // Apply start-of-turn power triggers in working locals. Multiplier
    // shifts dispatch live via adjustEnemyDmg/adjustPlayerDmg.
    for (const p of powers) {
      const trig = p.power?.startOfTurn;
      if (!trig) continue;
      const bits = [`📿 ${p.name}`];
      if (trig.block)      { wBlock += trig.block;   bits.push(`🛡 +${trig.block}`); }
      if (trig.energy)     { wEnergy += trig.energy; bits.push(`+${trig.energy} Energy`); }
      if (trig.vulnerable) { applyExpiringVuln(trig.vulnerable); bits.push(`💫 +${25*trig.vulnerable}% potency (3 turns)`); }
      if (trig.weak)       { applyExpiringWeak(trig.weak);       bits.push(`💢 enemy −${25*trig.weak}% atk (3 turns)`); }
      if (trig.draw) {
        for (let i = 0; i < trig.draw; i++) {
          if (wDeck.length === 0) {
            if (wDiscard.length === 0) break;
            wDeck = shuffle(wDiscard);
            wDiscard = [];
          }
          const c = wDeck.shift();
          wHand.push({ ...c, uid: uid() });
        }
        bits.push(`+${trig.draw} draw`);
      }
      pushLog(bits.join(' · '));
    }

    // The Whisperer — deliver the banked draws (instant-play exits earlier
    // this turn + this end-of-turn tick's departures) into the new hand.
    const whisperTotal = whisperDrawsPending + whisperFromTick;
    if (whisperTotal > 0) {
      for (let i = 0; i < whisperTotal; i++) {
        if (wDeck.length === 0) {
          if (wDiscard.length === 0) break;
          wDeck = shuffle(wDiscard);
          wDiscard = [];
        }
        const c = wDeck.shift();
        wHand.push({ ...c, uid: uid() });
      }
      pushLog(`🐾 The Whisperer — +${whisperTotal} card${whisperTotal === 1 ? '' : 's'} from departed animals.`);
      setWhisperDrawsPending(0);
    }

    // v2.38: SAYING SOMETHING WRONG — decrement pending Misstep timers and
    // deliver any that hit zero into the new turn's hand. Decrement runs
    // EVERY endTurn (it's the "two turns later" clock); a delay-2 cast on
    // turn N ticks at end of turn N (→1), end of turn N+1 (→0, delivered
    // into the wHand for turn N+2). The fresh token has a new uid and the
    // selfDamage payload it was created with, so a future card variant
    // that delivers heavier missteps can ride the same pipe.
    let nextPending = [];
    let deliveredCount = 0;
    for (const pm of pendingMissteps) {
      const next = (pm.turnsRemaining || 0) - 1;
      if (next <= 0) {
        wHand.push({ ...MISSTEP_TOKEN, uid: uid(), selfDamage: pm.selfDamage || 3 });
        deliveredCount += 1;
      } else {
        nextPending.push({ ...pm, turnsRemaining: next });
      }
    }
    if (deliveredCount > 0) {
      pushLog(`📜 Misstep × ${deliveredCount} surfaces in your hand. Play it (1 Energy) or eat -3 HP.`);
      logEvent('wit.missTepDelivered', {
        count: deliveredCount, enemyId: enemy?.id, enemyTier: enemy?.tier,
      });
    }
    setPendingMissteps(nextPending);

    // v2.97: Brace payout — if no unblocked HP damage landed this turn AND
    // the player armed Brace, draw N bonus cards into the new hand. Resets
    // the trackers either way (next turn's window is fresh).
    if (braceArmedDraw > 0 && hpLossThisTurn === 0) {
      for (let i = 0; i < braceArmedDraw; i++) {
        if (wDeck.length === 0) {
          if (wDiscard.length === 0) break;
          wDeck = shuffle(wDiscard);
          wDiscard = [];
        }
        const c = wDeck.shift();
        wHand.push({ ...c, uid: uid() });
      }
      pushLog(`🛡✦ Brace paid out: +${braceArmedDraw} card${braceArmedDraw === 1 ? '' : 's'} drawn (no HP damage taken).`);
    }
    setBraceArmedDraw(0);
    setHpLossThisTurn(0);

    // Commit.
    setDeck(wDeck);
    setDiscard(wDiscard);
    setHand(wHand);
    setBlock(wBlock);
    setEnergy(wEnergy);
    // v2.9: reset per-turn cast cap.
    setCastsThisTurn(0);
    // Hollow Weaver — arm a fresh "did you strike this turn?" window for the
    // new player turn. The weave check above already consumed last turn's.
    damagedEnemyThisTurnRef.current = false;
    weaveFireDamageRef.current = 0;
    // Handler feeding ledger — clear for next turn after starvation check ran.
    setLuresPlayedThisTurn([]);
    // Open Door Policy — the free-first-lure window refreshes next turn.
    setFirstLureUsedThisTurn(false);
    // Stake reset removed 2026-05-31 (ALL IN ripped).
    // v2.12: forget uncommitted roll-toggle at turn boundary.
    setRollOptIn(false);
    // v2.39: OPENING STATEMENT — bump the combat-turn counter. The first
    // player turn is combatTurn=1 (set on enterFight); after the first
    // endTurn we move to turn 2, etc. openingExtended persists across
    // turns until consumed by a wit target cast.
    setCombatTurn(n => n + 1);

    // v3.3 unified scheduled-effects tick (player-turn-start trigger).
    // Self-boons fire here so the player sees block/draw before the
    // enemy attacks. Iterates the same scheduledEffects state but only
    // touches entries with trigger='player-turn-start'.
    if (scheduledEffects.length > 0) {
      const remaining = [];
      let blockGained = 0;
      let drawGained = 0;
      let poiseGained = 0;
      let hpRegen = 0;
      let blockStripped = 0;
      let bankAuraDoubled = false;
      for (const eff of scheduledEffects) {
        if (eff.trigger !== 'player-turn-start') {
          // Detect bankAuraDouble (lives on enemy-turn-start trigger but
          // affects THIS player-turn's aura tick).
          if (eff.kind === 'bankAuraDouble' && eff.turnsRemaining > 0) bankAuraDoubled = true;
          remaining.push(eff);
          continue;
        }
        if      (eff.kind === 'block')      blockGained += eff.amount;
        else if (eff.kind === 'draw')       drawGained += eff.amount;
        else if (eff.kind === 'poise')      poiseGained += eff.amount;
        else if (eff.kind === 'hpRegen')    hpRegen += eff.amount;
        else if (eff.kind === 'stripBlock') blockStripped += eff.amount;
        if (eff.turnsRemaining > 1) {
          remaining.push({ ...eff, turnsRemaining: eff.turnsRemaining - 1 });
        }
      }
      if (blockGained > 0)   { setBlock(b => b + blockGained);           pushLog(`🛡 Thorns boon: +${blockGained} Block.`); }
      if (poiseGained > 0)   { setPoise(p => p + poiseGained);           pushLog(`🪞 Thorns boon: +${poiseGained} Poise.`); }
      if (hpRegen > 0)       { setHp(h => clamp(h + hpRegen, 0, maxHp)); pushLog(`💚 Thorns boon: +${hpRegen} HP.`); }
      if (drawGained > 0)    { drawCards(drawGained);                    pushLog(`📥 Slow Burn boon: drew ${drawGained}.`); }
      if (blockStripped > 0) {
        setEnemyBlock(b => Math.max(0, b - blockStripped));
        pushLog(`🛇 Thorns boon: stripped ${blockStripped} enemy Block.`);
      }
      // v3.4.42 — Bank Aura tick. While wordsBank > 0, deal floor(bank/5)
      // composure damage, cap 4. Crescendo's Delivered card doubles this
      // for 3 turns via bankAuraDouble.
      if (wordsBank > 0) {
        let auraDmg = Math.min(4, Math.floor(wordsBank / 5));
        if (bankAuraDoubled) auraDmg *= 2;
        if (auraDmg > 0 && enemy) {
          setEnemyComposure(c => {
            const after = Math.max(0, c - auraDmg);
            if (after === 0 && c > 0) setTimeout(() => onEnemyDefeated(), 200);
            return after;
          });
          showDamageFloater(auraDmg, 'composure');
          pushLog(`🎺 Bank Aura: ${wordsBank} bank → ${auraDmg} comp${bankAuraDoubled ? ' (×2)' : ''}.`);
        }
      }
      setScheduledEffects(remaining);
    }
    // v3.4.22 — Thorns reflect aura tick. Decrement turnsRemaining; if
    // a schedule is active, shift it and update amount to schedule[0].
    if (thornsCharges.turnsRemaining && thornsCharges.turnsRemaining > 0) {
      setThornsCharges(t => {
        const nextTurns = (t.turnsRemaining || 0) - 1;
        if (nextTurns <= 0) {
          // Aura expires. Discrete count-based reflects (if any) remain.
          return { amount: t.count > 0 ? t.amount : 0, count: t.count, weakOnReflect: t.weakOnReflect, turnsRemaining: 0, schedule: undefined };
        }
        if (Array.isArray(t.schedule) && t.schedule.length > 0) {
          const nextSched = t.schedule.slice(1);
          return { ...t, turnsRemaining: nextTurns, schedule: nextSched, amount: nextSched.length > 0 ? nextSched[0] : t.amount };
        }
        return { ...t, turnsRemaining: nextTurns };
      });
    }

    // RAGE entry on turn start removed 2026-05-31 (machinery ripped).

    // Reset per-turn activated-ability usage (Pigeon scramble) for the new
    // player turn.
    setAbilitiesUsedThisTurn([]);

    // 6. New intent. Track what just fired and force a switch if the
    // enemy has already done the same kind twice in a row — saves the
    // "spammed Block 15 turns in a row" mind-numbing fights.
    const justFiredKind = enemyIntent?.kind;
    const newHistory = justFiredKind
      ? [...lastIntentKinds, justFiredKind].slice(-2)
      : lastIntentKinds;
    setLastIntentKinds(newHistory);
    const exclude = (newHistory.length === 2 && newHistory[0] === newHistory[1])
      ? [newHistory[0]] : [];
    // Loom Familiar steal-cap (Alan, 2026-05-31): one discard-hand steal per
    // combat, total. After the first fires, exclude the kind for the rest of
    // the fight. Excluding the kind from the roll cleanly removes it.
    const justFiredDiscard = justFiredKind === 'discard-hand';
    if (enemy?.id === 'e2-loom-familiar' && (justFiredDiscard || loomStoleThisCombatRef.current)) {
      if (!exclude.includes('discard-hand')) exclude.push('discard-hand');
    }
    if (enemy) {
      // v2.7: if a peeked intent is queued (from "the next thing you'll do"),
      // it locks the next intent — the peek is honest.
      if (peekedNextIntent) {
        setEnemyIntent(peekedNextIntent);
        setPeekedNextIntent(null);
      } else {
        setEnemyIntent(rollIntent(enemy, exclude));
      }
      setIntentTick(t => t + 1);
    }
    // v2.26: storm-out intent-hiding lifecycle. If THIS endTurn was the one
    // triggered by the storm-out cast itself, the ref is true — the intent
    // we just rolled is the one we want to hide for the upcoming turn, so
    // STORM OUT intentHidden carry-over flag removed 2026-05-31.
    tutorFiredThisTurnRef.current = false;
  }

  // Pure, side-effect-free projection of how much an enemy attack will ACTUALLY
  // land for, after every deterministic reduction the player has standing.
  // Mirrors the attack path of applyEnemyIntent EXACTLY — same order, same
  // per-swing floors, same shield routing — so the math bar can't lie. It
  // deliberately omits the RNG layer (Drunken Stagger 50% dodge) and the
  // reflect layers (Thorns / Mirror / Riposte) because those don't reduce what
  // hits YOU; stagger is surfaced separately as a "may dodge" note. Returns
  // null for non-attack intents (block / debuff / weave handle their own
  // telegraph). Kept next to applyEnemyIntent so the two can't drift.
  function projectIncomingDamage(intent) {
    if (!intent) return null;
    if (intent.kind !== 'attack' && intent.kind !== 'attack-multi') return null;
    const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
    const targetsComposure = intent.pool === 'composure' || !!swapNextHitToComp;
    const mult = enemyDmgMult || 1;

    // Per-swing base after the multiplier (Weak/Vuln) and self-vulnerability.
    let perSwing = Math.round(intent.value * mult * (playerIncomingMult || 1));
    const afterMult = perSwing;
    // Flat pre-routing adds (apply to every swing, mirroring `raw` reuse).
    const arguing = arguingBackThisTurn > 0 ? arguingBackThisTurn : 0;
    if (arguing > 0) perSwing += arguing;
    const drunkenActive = powers.some(p => p.installPower?.id === 'drunken-confidence' || p.id === 'jv2-p-hold-my-drink');
    const drunken = (drunkenActive && perSwing > 0) ? 1 : 0;
    if (drunken > 0) perSwing += drunken;
    // Annotation reduction, then Beetle absorb (both mutate the shared `raw`).
    const annAtkRed = annoFx('enemyAtkReduction');
    if (annAtkRed > 0) perSwing = Math.max(0, perSwing - annAtkRed);
    const beetle = beetleAbsorb > 0 ? Math.min(beetleAbsorb, perSwing) : 0;
    if (beetle > 0) perSwing = Math.max(0, perSwing - beetle);

    // Per-swing reduction (defense relics/equipment cap 2 + Long Thread cap 2).
    const rawReduction = effectSources().reduce((s, x) => s + (x.effect?.damageReduction || 0), 0)
                       + equipment.reduce((s, eq) => s + (eq.bonus?.damageReduction || 0), 0);
    const threadReduction = Math.min(2, longThread || 0);
    const reduction = Math.min(2, rawReduction) + threadReduction;
    const swingReduction = nextAttackSwingReduction > 0 ? nextAttackSwingReduction : 0;
    const holdOnReduce = holdOnArmed ? (holdOnValue || 0) : 0;

    // Simulate the swing loop deterministically (no dodge RNG, no reflects).
    let wBlock = block, wPoise = poise, wTempHp = tempHp;
    let wHp = hp, wComp = Math.max(0, composure - weaveFireDamageRef.current);
    let totalIncoming = 0, blockAbsorbed = 0, poiseAbsorbed = 0, tempHpAbsorbed = 0;
    for (let i = 0; i < hits; i++) {
      // Hold On reduces the FIRST swing's raw before per-swing reduction.
      let remaining = (i === 0 && holdOnReduce > 0) ? Math.max(0, perSwing - holdOnReduce) : perSwing;
      if (reduction > 0 && remaining > 0) remaining = Math.max(1, remaining - reduction);
      if (swingReduction > 0 && remaining > 0) remaining = Math.max(1, remaining - swingReduction);
      if (escalatingSwingReduction && remaining > 0) remaining = Math.max(0, remaining - i);
      totalIncoming += remaining;
      if (targetsComposure) {
        const ab = Math.min(wPoise, remaining); wPoise -= ab; remaining -= ab; poiseAbsorbed += ab;
        if (remaining > 0) { const b = wComp; wComp = Math.max(0, wComp - remaining); }
      } else {
        const ab = Math.min(wBlock, remaining); wBlock -= ab; remaining -= ab; blockAbsorbed += ab;
        if (remaining > 0 && wTempHp > 0) { const t = Math.min(wTempHp, remaining); wTempHp -= t; remaining -= t; tempHpAbsorbed += t; }
        if (remaining > 0) { wHp = Math.max(0, wHp - remaining); }
      }
      if (wHp <= 0 || wComp <= 0) break;
    }
    const netHp = hp - wHp;
    const netComposure = Math.max(0, composure - weaveFireDamageRef.current) - wComp;
    return {
      pool: targetsComposure ? 'composure' : 'hp',
      hits,
      baseSwing: intent.value,
      afterMult,            // per-swing after Weak/Vuln (+ self-vuln)
      amplified: afterMult > intent.value,
      reduced: afterMult < intent.value,
      arguing, drunken, annAtkRed, beetle,
      perSwingReduction: reduction,
      swingReduction,
      holdOn: holdOnReduce,
      stagger: !!staggerActive,
      totalIncoming,        // summed across swings, after all flat/per-swing reductions, before shields
      blockAbsorbed, poiseAbsorbed, tempHpAbsorbed,
      netHp, netComposure,
      maul: !!intent.maul,
    };
  }

  function applyEnemyIntent(intent) {
    const e = enemy;
    if (!e) return;
    // v3.4.59 — Speechless: enemy fully skips their turn (any intent kind).
    if (enemySkipNextTurn) {
      setEnemySkipNextTurn(false);
      setEnemySkipNextAttack(false);
      pushLog(`🤐 ${e.name} is speechless — turn skipped.`);
      return;
    }
    // Kangaroo pouch (Alan 2026-06-05): the player ducked in last turn, so this
    // enemy turn deals NO damage. The enemy still "acts" (the swing whiffs
    // against the pouch), but riders/damage are skipped entirely. Consumed here.
    if (pouchGuard) {
      setPouchGuard(false);
      pushLog(`🦘 Safe in the pouch — ${e.name}'s turn glances off. No damage.`);
      return;
    }
    // Sloth (slowsEnemy, Alan 2026-06-03): while a sloth hangs around, time
    // dilates — the enemy acts at half speed, skipping every OTHER turn. The
    // toggle ref alternates per enemy turn so the enemy still gets to act
    // half the time. Reads the post-tick board snapshot (boardForMaulRef),
    // which only holds animals that were already out during the player turn.
    const slothPresent = SLOT_ORDER.some(s => {
      const v = boardForMaulRef.current?.[s];
      return v?.kind === 'animal' && getAnimal(v.animalId)?.slowsEnemy;
    });
    if (slothPresent) {
      slothSkipToggleRef.current = !slothSkipToggleRef.current;
      if (slothSkipToggleRef.current) {
        pushLog(`🦥 Time dilates — ${e.name} moves too slowly to act this turn.`);
        return;
      }
    } else {
      slothSkipToggleRef.current = false;
    }
    // v3.3 unified scheduled-effects tick (enemy-turn-start trigger).
    // Handles: debuff-over-time (Weak/Vuln), dormant delayed payloads,
    // and Crescendo's bankDouble. DoT damage moved to the
    // enemy.dot Poison-style counter (v3.4) — see legacy enemy.dot
    // tick further down which now serves both handler's applyDot
    // and Slow Burn's addDotDamage etc. Self-boons (selfBlock /
    // selfDraw) trigger at player-turn-start (separate tick).
    if (scheduledEffects.length > 0) {
      const remaining = [];
      let weakStacks = 0;
      let vulnStacks = 0;
      let dormantBurst = 0;
      let bankDoubled = false;
      for (const eff of scheduledEffects) {
        if (eff.trigger !== 'enemy-turn-start') {
          remaining.push(eff);
          continue;
        }
        if      (eff.kind === 'weak')     weakStacks += eff.amount;
        else if (eff.kind === 'vuln')     vulnStacks += eff.amount;
        else if (eff.kind === 'bankDouble') bankDoubled = true;
        else if (eff.kind === 'dormantDamage' && eff.turnsRemaining <= 1) {
          dormantBurst += eff.amount;
        }
        if (eff.turnsRemaining > 1) {
          remaining.push({ ...eff, turnsRemaining: eff.turnsRemaining - 1 });
        }
      }
      if (weakStacks > 0) {
        applyExpiringWeak(weakStacks);
        pushLog(`🌡 Slow Burn: enemy weakened by ${weakStacks} stack${weakStacks > 1 ? 's' : ''} (3 turns).`);
      }
      if (vulnStacks > 0) {
        applyExpiringVuln(vulnStacks);
        pushLog(`🩸 Slow Burn: enemy Vulnerable +${vulnStacks} (your spells +${25 * vulnStacks}%, 3 turns).`);
      }
      if (dormantBurst > 0) {
        // v3.3 bugfix (same as DoT above): bypass block to avoid the
        // stale-closure stale-block restoration. Dormant burst lands
        // directly on composure — block has faded.
        setEnemyComposure(c => {
          const after = Math.max(0, c - dormantBurst);
          if (after === 0 && c > 0) setTimeout(() => onEnemyDefeated(), 200);
          return after;
        });
        showDamageFloater(dormantBurst, 'composure');
        pushLog(`💥 Festering Wound bursts — ${dormantBurst} composure damage.`);
      }
      if (bankDoubled) {
        setWordsBank(b => {
          const next = b * 2;
          if (next > b) pushLog(`📚 Crescendo: Words Bank doubled (${b} → ${next}).`);
          return Math.min(next, 40);
        });
      }
      setScheduledEffects(remaining);
    }
    // v2.97: Silk Wraith phase-shift regen — fires at the start of every
    // enemy turn once phase-shifted. Hard-coded by id for the prototype.
    if (e.id === 'e2-silk-wraith' && e.phaseShifted) {
      // v2.99.1: regen 3 → 1. The wit-resist post-shift already slows the
      // player down; +3/turn on top made the fight a stalemate.
      const regen = 1;
      const targetComp = Math.min(e.composureMax, enemyComposure + regen);
      const actualRegen = targetComp - enemyComposure;
      if (actualRegen > 0) {
        setEnemyComposure(targetComp);
        pushLog(`🕸 ${e.name}: re-weaves +${actualRegen} Composure.`);
      }
    }
    let playerDied = false;
    if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
      const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
      // v2.93: D-1 (Talking Over Them) — colorless flag that zeroes the
      // next enemy attack outright. Consumed before any other math.
      // v3.4.25 (Alan, gating-bug audit): the flag is gated to attack/
      // attack-multi intents only (intentional — "skip next attack").
      // The early `return` after consuming the flag skips damage AND the
      // intent.riders block below. That's correct: a skipped attack
      // shouldn't also apply the attack's Weak / Vuln / block riders.
      if (enemySkipNextAttack) {
        setEnemySkipNextAttack(false);
        // v3.4.42 — Thorns skipAndReturnNext: the cancelled attack damage
        // is dealt to the enemy instead. Resolves BEFORE the early return
        // so the player still escapes the hit AND the enemy eats it.
        if (skipAndReturnArmed) {
          setSkipAndReturnArmed(false);
          const returned = Math.round(intent.value * enemyDmgMult);
          if (returned > 0) {
            setEnemyComposure(c => {
              const after = Math.max(0, c - returned);
              if (after === 0 && c > 0) setTimeout(() => onEnemyDefeated(), 200);
              return after;
            });
            showDamageFloater(returned, 'composure');
            pushLog(`🪞 ${e.name}: their own ${returned} damage, handed back.`);
          }
        } else {
          pushLog(`🤐 ${e.name}: you spoke right through it. (Talking Over Them)`);
        }
        return;
      }
      // Spittle Peck (Rabid Scrubjay onExit): the enemy turns its own attack
      // on itself. Consumed synchronously via the ref so the redirect armed
      // during this same endTurn's animal tick isn't lost to stale state. The
      // full swing lands on the enemy's composure; the player takes no hit. We
      // bypass enemy Block here (its block has already faded for the player
      // turn — same assumption skipAndReturn relies on).
      if (redirectEnemyAttackRef.current) {
        redirectEnemyAttackRef.current = false;
        const swings = hits;
        const per = Math.round(intent.value * enemyDmgMult);
        const returned = Math.max(0, per * swings);
        if (returned > 0) {
          setEnemyComposure(c => {
            const after = Math.max(0, c - returned);
            if (after === 0 && c > 0) setTimeout(() => onEnemyDefeated(), 200);
            return after;
          });
          showDamageFloater(returned, 'composure');
        }
        pushLog(`🐦 Spittle Peck: ${e.name} attacks itself for ${returned} composure.`);
        return;
      }
      // v2.9: dual-shield routing.
      //   intent.pool === 'composure' → POISE absorbs, then composure pool
      //   default                     → BLOCK absorbs, then HP pool
      // Physical and composure defenses are NOW SEPARATE. A player who's
      // only built physical block has no answer to composure threats and
      // vice versa — forces dual defense management.
      let targetsComposure = intent.pool === 'composure';
      // v2.93: D-2 (Glancing Blow) — convert HP-target hits to Composure
      // for ONE swing. Flag is consumed when the conversion happens.
      let glancingApplied = false;
      if (swapNextHitToComp && !targetsComposure) {
        targetsComposure = true;
        glancingApplied = true;
      }
      let raw = Math.round(intent.value * enemyDmgMult * (playerIncomingMult || 1));
      // v2.36: ACTUALLY— arguing-back surcharge. Each Actually— played this
      // turn adds +1 to enemy raw damage value. Applied BEFORE annotation
      // reduction so a strong annotation can still scrub the surcharge (the
      // wit-defender's existing answer), but AFTER the enemyDmgMult roll so
      // the +1 is a clean flat bump, not multiplied by Vuln.
      if (arguingBackThisTurn > 0) raw += arguingBackThisTurn;
      // v2.47: DRUNKEN CONFIDENCE — while installed, every enemy attack
      // adds +2 raw damage BEFORE block routing. Block can still soak the
      // chunk; the +2 is partial-through-block by design (Stoneward-style
      // total bypass would be too punishing). Per-swing-loop check would
      // be more accurate for attack-multi, but the spec calls for a flat
      // pre-routing add — so we lift `raw` once and let the loop ride.
      const drunkenIncomingActive = powers.some(p => p.installPower?.id === 'drunken-confidence' || p.id === 'jv2-p-hold-my-drink');
      if (drunkenIncomingActive && raw > 0) {
        // v3.0 (cycle 2): incoming penalty +2 → +1. Drunken Confidence
        // installs 69% of jnsq runs but the lane has 0% sim win rate —
        // the +50% damage upside is real but the +2/swing-multi enemy
        // damage stacks fast on multi-attackers and burns through HP
        // before the bank cashes in. Halving the cost makes the install
        // a clearer "trade some HP for a lot more damage."
        raw += 1;
        setDrunkenTelemetry(t => ({ ...t, incomingPenalty: t.incomingPenalty + 1 }));
      }
      // v2.10: annotation reduces incoming attack BEFORE shield routing.
      const annAtkRed = annoFx('enemyAtkReduction');
      if (annAtkRed > 0) raw = Math.max(0, raw - annAtkRed);
      // v2.37: HOLD ON — reactive interrupt. If the player armed the
      // "Hold on, hold on —" skill, the next attack's FIRST swing is
      // reduced by holdOnValue (snapshotted at skill play time). On an
      // attack-multi we apply the reduction once to the pre-swing-loop
      // `raw` value: the loop reuses `raw` for every swing, so reducing
      // it once would persist the reduction to ALL swings. Instead, we
      // capture the reduced raw as a per-first-swing override and
      // restore the unreduced raw for swings 2..N. The flag clears
      // unconditionally — no free re-cast.
      let holdOnFirstSwingRaw = null;
      if (holdOnArmed) {
        const reduced = Math.max(0, raw - (holdOnValue || 0));
        const prevented = raw - reduced;
        holdOnFirstSwingRaw = reduced;
        pushLog(`🛑 Hold on — reduced damage by ${holdOnValue || 0}.`);
        logEvent('wit.holdOn', {
          longThreadAtPlay: holdOnValue || 0,
          damagePrevented: prevented,
          enemyId: enemy?.id, enemyTier: enemy?.tier,
        });
        setHoldOnArmed(false);
        setHoldOnValue(0);
      }
      const rawReduction = effectSources().reduce((s, x) => s + (x.effect?.damageReduction || 0), 0)
                         + equipment.reduce((s, eq) => s + (eq.bonus?.damageReduction || 0), 0);
      // v3.0 cycle 5: Long Thread is now defensive too. While LT > 0,
      // incoming damage is reduced by 1 per LT stack (cap at 3). Pairs
      // with the existing offensive thread-scaling rider — wit's
      // identity loop (build slow → finish big) becomes self-
      // reinforcing: more thread → less HP loss → easier to keep
      // thread alive. Resets when an unblocked hit breaks the thread.
      // Reads `longThread` directly from React state; the cap respects
      // existing damageReduction (2) so combined ceiling is 5 per swing.
      // v3.4.27 (Alan): Long Thread defensive cap 3 → 2. Combined with
      // annotation reduction (-2) and per-turn block + poise, LT3 made
      // every 4-damage swing whittle to the floor of 1. Capping LT
      // contribution at 2 keeps the school's identity loop intact but
      // stops the multi-layer stack from zero-ing out attacks entirely.
      const threadReduction = Math.min(2, longThread || 0);
      const reduction = Math.min(2, rawReduction) + threadReduction;
      // v3.4.26 (Alan: "I'm not taking damage" investigation) — log
      // every reduction layer that touches incoming damage so we can
      // SEE exactly where it's vanishing. Fires once per enemy attack
      // intent, before the per-swing loop. Telemetry only; no log line.
      logEvent('combat.intent_damage_calc', {
        intentKind: intent.kind,
        intentValue: intent.value,
        intentPool: intent.pool || 'hp',
        rawAfterMult: raw,                       // intent.value × enemyDmgMult + arguingBack + drunken − annAtkRed
        enemyDmgMult: Number((enemyDmgMult || 1).toFixed(3)),
        annAtkRed,
        rawReductionCap: Math.min(2, rawReduction),
        threadReduction,
        totalPerSwingReduction: reduction,
        playerBlock: block,
        playerPoise: poise,
        playerLongThread: longThread,
        beetleAbsorb,
        hits,
        enemyId: enemy?.id,
      });
      // v2.9: Beetle's first-hit absorb — applied BEFORE shield routing
      // so it works against both pool types. Consumed on first hit only.
      if (beetleAbsorb > 0 && raw > 0) {
        const absorbed = Math.min(beetleAbsorb, raw);
        raw = Math.max(0, raw - absorbed);
        setBeetleAbsorb(0);
        pushLog(`🪲 Beetle absorbs ${absorbed}.`);
      }
      let wBlock = block;
      let wPoise = poise;
      let wHp = hp;
      let wTempHp = tempHp; // v3.4.67 — Ballooning Temp HP buffer; committed below.
      let wComp = Math.max(0, composure - weaveFireDamageRef.current);
      // v2.27: Hit Me Again — per-swing recoil + charge accrual. Each swing
      // first eats `charges` self-damage on the enemy (composure if hp:999
      // sentinel, else HP — physical pool first if HP is real). Then resolves
      // its damage on the player. Then arms a new charge if the swing landed
      // (any damage > 0 reaching the player counts — block-absorbed still
      // counts per spec). Mutates local copies of enemy pools so the multi-
      // swing path doesn't lose state between swings.
      // Hit Me Again recoil charge tracking ripped 2026-05-31. Power gone.
      // v3.3 Thorns: per-swing reflect from FFT-armed thorns charges.
      // Capture closure snapshot of starting charges, track used count
      // locally, flush state update once after the loop.
      const initialThorns = thornsCharges;
      let thornsUsed = 0;
      // Porcupine (thorns, Alan 2026-06-03): every porcupine on the board
      // jabs the enemy for its `thorns` composure on each incoming swing.
      // Board read from the post-tick snapshot (same source Sloth/maul use).
      const porcupineThorns = SLOT_ORDER.reduce((sum, s) => {
        const v = boardForMaulRef.current?.[s];
        const a = v?.kind === 'animal' ? getAnimal(v.animalId) : null;
        return sum + (a?.thorns > 0 ? a.thorns : 0);
      }, 0);
      for (let i = 0; i < hits; i++) {
        // v2.37: HOLD ON applies ONLY to the first swing of an attack/
        // attack-multi. swings 1..N use the unreduced `raw`.
        let remaining = (i === 0 && holdOnFirstSwingRaw != null) ? holdOnFirstSwingRaw : raw;
        if (reduction > 0 && remaining > 0) remaining = Math.max(1, remaining - reduction);
        // v3.0 multi-hit cards: per-swing damage reduction from
        // Headbutt's `nextAttackSwingReduction` flag (flat per-swing
        // reduction — N off each swing).
        if (nextAttackSwingReduction > 0 && remaining > 0) {
          remaining = Math.max(1, remaining - nextAttackSwingReduction);
        }
        // v3.1 WORD IN EDGEWISE — escalating per-swing reduction. 1st
        // swing full damage, 2nd -1, 3rd -2, etc. Damage clamped at 0
        // (escalation can fully shut down later swings of a long combo).
        if (escalatingSwingReduction && remaining > 0) {
          remaining = Math.max(0, remaining - i);
        }
        // v3.1 NOVICE RETORT — escalating thorns. Nth swing (1-indexed)
        // deals N × base composure back to the attacker. A 4-swing
        // attack with base 1 returns 1+2+3+4 = 10 comp.
        const escalatingThorns = annoFx('escalatingThorns');
        if (escalatingThorns > 0) {
          applyDamageToEnemyComposure((i + 1) * escalatingThorns);
        }
        // v3.3 Thorns (FFT Thorns school): per-swing flat reflect from
        // armed charges. Fixed amount regardless of incoming damage.
        // Decrements charges; expires when count hits 0. v3.3 extension:
        // weakOnReflect amount applies Weak to enemy per charge consumed.
        // v3.4.22 — duration-aura reflect: while turnsRemaining > 0,
        // every hit reflects without depleting count (the school's new
        // "Defense over Time" identity beat).
        const auraActive = (initialThorns.turnsRemaining || 0) > 0;
        const chargesLeft = initialThorns.count - thornsUsed;
        if ((auraActive || chargesLeft > 0) && initialThorns.amount > 0) {
          applyDamageToEnemyComposure(initialThorns.amount);
          let logExtra = '';
          if (initialThorns.weakOnReflect > 0) {
            applyExpiringWeak(initialThorns.weakOnReflect);
            logExtra = ` + Weak ${initialThorns.weakOnReflect} (3 turns)`;
          }
          pushLog(`🌹 Thorns: ${initialThorns.amount} comp reflected${logExtra}.`);
          // Only decrement discrete count if the aura isn't paying for this hit.
          if (!auraActive) thornsUsed++;
        }
        // v3.4.42 — Mirror Reflect: charge-based, reflect 100% of THIS
        // swing's incoming raw damage capped per charge. Stacks ON TOP of
        // regular thorns. Consumes one charge per swing.
        if (mirrorReflectCharges.count > 0 && remaining > 0) {
          const reflected = Math.min(remaining, mirrorReflectCharges.capPerHit || 9999);
          applyDamageToEnemyComposure(reflected);
          pushLog(`🪞 Mirror: ${reflected} comp reflected (100% of incoming).`);
          setMirrorReflectCharges(m => ({ count: Math.max(0, (m?.count || 0) - 1), capPerHit: m?.capPerHit || 0 }));
        }
        // v2.52: DRUNKEN STAGGER — per-swing 50% dodge. Rolled BEFORE the
        // shield-routing block so a missed swing zeroes out completely (no
        // block consumed, no recoil arm, no LongThread reset). attack-multi
        // rolls per swing — partial dodges feel chaotic, which is the point.
        if (staggerActive && remaining > 0 && Math.random() < 0.5) {
          const avoided = remaining;
          remaining = 0;
          setStaggerTelemetry(t => ({
            ...t,
            missesAvoided: t.missesAvoided + 1,
            damageAvoided: t.damageAvoided + avoided,
          }));
          pushLog(`🌀 Missed! Drunken stagger.`);
          logEvent('jnsq.stagger.dodge', {
            damageAvoided: avoided, swingIndex: i,
            enemyId: enemy?.id, enemyTier: enemy?.tier,
          });
          // Skip to next swing — no block consumption, no landed flag.
          continue;
        }
        // Porcupine (quills, Alan 2026-06-05): absorb up to `porcupineThorns`
        // off this swing BEFORE Block — that much never reaches the player —
        // and reflect exactly the absorbed amount as composure. Quills-first so
        // it reflects reliably even when you're holding Block; multiple
        // porcupines stack the cap. Skipped swings (dodged above) never reach
        // here, so a missed hit absorbs/reflects nothing.
        if (porcupineThorns > 0 && remaining > 0) {
          const absorbed = Math.min(remaining, porcupineThorns);
          remaining -= absorbed;
          applyDamageToEnemyComposure(absorbed);
          pushLog(`🦔 Porcupine: absorbs ${absorbed} and jabs it back as composure.`);
        }
        let landed = false;
        if (targetsComposure) {
          if (wPoise > 0) {
            const absorbed = Math.min(wPoise, remaining);
            wPoise -= absorbed; remaining -= absorbed;
            if (absorbed > 0) landed = true;
          }
          if (remaining > 0) {
            const before = wComp;
            wComp = Math.max(0, wComp - remaining);
            if (before > wComp) landed = true;
          }
        } else {
          if (wBlock > 0) {
            const absorbed = Math.min(wBlock, remaining);
            wBlock -= absorbed; remaining -= absorbed;
            if (absorbed > 0) landed = true;
          }
          // v3.4.67 — Ballooning Temp HP buffer absorbs HP-pool damage
          // BEFORE real HP. Tracked via wTempHp local so multi-swing
          // attacks see consumed Temp HP from prior swings.
          if (remaining > 0 && wTempHp > 0) {
            const absorbed = Math.min(wTempHp, remaining);
            wTempHp -= absorbed;
            remaining -= absorbed;
            if (absorbed > 0) {
              landed = true;
              pushLog(`🎈 Temp HP absorbed ${absorbed} damage.`);
            }
          }
          if (remaining > 0) {
            const before = wHp;
            wHp = Math.max(0, wHp - remaining);
            if (before > wHp) landed = true;
          }
        }
        if (wHp <= 0 || wComp <= 0) break;
      }
      // Hit Me Again recoil commit removed 2026-05-31 (power ripped).
      // v3.3 Thorns flush: write back updated charge count.
      if (thornsUsed > 0) {
        setThornsCharges(t => ({ amount: t.amount, count: Math.max(0, t.count - thornsUsed) }));
      }
      setBlock(wBlock);
      setPoise(wPoise);
      setHp(wHp);
      setComposure(wComp);
      // v3.4.67 — commit Temp HP after the loop has consumed it.
      if (wTempHp !== tempHp) setTempHp(wTempHp);
      // Hit-shake the player HUD if either pool actually moved. Block-only
      // absorption (both pools unchanged) shouldn't shake — that beat is
      // "the bracing worked," visually distinct from "you got hit."
      if (wHp < hp || wComp < composure) setPlayerHitFlash(Date.now());
      // v2.34: LONG THREAD — record unblocked damage this turn so the
      // end-of-turn bookkeeping resets the meter. Block-absorbed-only
      // hits leave the thread intact (that's the wit defender's whole
      // point). Either pool moving downward counts as "the hit landed."
      if (wHp < hp || wComp < composure) setUnblockedThisTurn(true);
      pushLog(`👹 ${e.name}: ${intent.telegraph}`);
      // Maul rider: a mauling attack that leaks ANY HP past Block also tears
      // the strongest animal off the board. Fully blocked → menagerie safe.
      if (intent.maul && wHp < hp) maulStrongestAnimal();
      // v2.10: reactive annotation damage on enemy attack.
      const annReactive = annoFx('damageOnEnemyAttack');
      if (annReactive > 0) {
        applyDamageToEnemyComposure(annReactive);
        pushLog(`📝 Annotation lashes back: -${annReactive} comp.`);
      }
      // v2.93: D-3 (Settle the Score) — reactive reflect. If the player
      // armed it, the damage they just took comes back at the enemy as
      // Composure damage. Sum across both pools so an attack-multi
      // delivers the full quantity back. Consumed unconditionally.
      if (reflectNextHitAsComp) {
        const dealt = (hp - wHp) + (composure - wComp);
        if (dealt > 0) {
          applyDamageToEnemyComposure(dealt);
          pushLog(`🪞 Settled the score: ${dealt} comp dmg back to ${e.name}.`);
        }
        setReflectNextHitAsComp(false);
      }
      // v2.93: D-2 (Glancing Blow) — consume the swap flag after one swing.
      if (glancingApplied) {
        setSwapNextHitToComp(false);
        pushLog(`💢→🎭 Glancing Blow consumed.`);
      }
      // v2.97: track HP loss this turn for Brace's end-of-turn payout.
      const hpDelta = hp - wHp;
      if (hpDelta > 0) setHpLossThisTurn(n => n + hpDelta);
      // v2.97: Riposte — the next enemy attack that lands gets a
      // comp-damage counter equal to the charge. Consumes the charge.
      if (riposteCharge > 0 && (hpDelta > 0 || composure - wComp > 0)) {
        applyDamageToEnemyComposure(riposteCharge);
        pushLog(`🛡⚔ Riposte: ${riposteCharge} comp dmg back to ${e.name}.`);
        setRiposteCharge(0);
      }
      // v3.0 multi-hit: consume Headbutt's swing-reduction flag after the attack.
      if (nextAttackSwingReduction > 0) {
        setNextAttackSwingReduction(0);
      }
      // v3.1 multi-hit: consume Word in Edgewise after the attack.
      if (escalatingSwingReduction) {
        setEscalatingSwingReduction(false);
      }
      if (wHp <= 0 || wComp <= 0) playerDied = true;
    } else if (intent.kind === 'block') {
      setEnemyBlock(b => {
        logEvent(TE.ENEMY_BLOCK_CHANGE, {
          before: b, after: b + intent.value, reason: 'intent-block-add',
          enemyId: e.id, intentValue: intent.value,
        });
        return b + intent.value;
      });
      pushLog(`👹 ${e.name}: 🛡 +${intent.value}`);
    } else if (intent.kind === 'discard-hand') {
      // Hard cap: one steal per combat. If the loom already took a card this
      // fight, the intent does nothing rather than steal again. The ref reads
      // current synchronously, so this holds even if a second discard-hand
      // intent slips through the end-of-turn re-roll exclude.
      if (loomStoleThisCombatRef.current) {
        pushLog(`👹 ${e.name}: 🗑 ${intent.telegraph || 'reaches in'} — but it already has its thread. (nothing taken)`);
        return;
      }
      // v2.96: Loom Familiar — pulls a card out of the player's hand.
      // v3.1.2: prefer NON-SPELL cards. Spell pieces are rare singletons
      // and losing one to randomness locks players out of casts.
      // 2026-05-31 (Alan): the prior version read hand from the endTurn
      // closure AND committed with `setHand(handCopy)`. By the time this
      // fires the closure hand was stale (animal onAttack.draw / misstep
      // self-play had mutated state earlier in endTurn), and the snapshot
      // overwrite quietly put the "stolen" card right back in hand. New
      // pattern: pick taken cards from the closure snapshot, but remove
      // them from the LATEST hand via uid match in a functional updater.
      const requested = intent.value || 1;
      const n = Math.min(requested, hand.length);
      if (n > 0) {
        const isSpellPiece = (c) => c.slot === 'intro' || c.slot === 'subject' || c.slot === 'target';
        const handCopy = [...hand];
        const taken = [];
        for (let k = 0; k < n; k++) {
          if (handCopy.length === 0) break;
          const nonSpellIdxs = handCopy.map((c, i) => isSpellPiece(c) ? -1 : i).filter(i => i >= 0);
          const pool = nonSpellIdxs.length > 0 ? nonSpellIdxs : handCopy.map((_, i) => i);
          const pickedIdx = pool[Math.floor(Math.random() * pool.length)];
          taken.push(handCopy[pickedIdx]);
          handCopy.splice(pickedIdx, 1);
        }
        // Hand off to endTurn (see stolenCardsRef): endTurn recomposes piles
        // from closure values right after this, so any setHand/setDiscard here
        // gets clobbered and the card recycles back ("still in my hand" bug).
        // Recording the taken cards lets endTurn pull them OUT of the recycle
        // pipeline and exile them — the steal is finally felt.
        stolenCardsRef.current.push(...taken);
        loomStoleThisCombatRef.current = true;
        setEnemyDiscardCount(c => c + 1);
        pushLog(`👹 ${e.name}: 🗑 you lose ${taken.length} card${taken.length === 1 ? '' : 's'} (${taken.map(c => c.name || c.phrase || '?').join(', ')}).`);
        setCardLossNotice({ source: e.name, cards: taken });
      } else {
        pushLog(`👹 ${e.name}: 🗑 ${intent.telegraph || 'discard'} — no cards to take.`);
      }
    } else if (intent.kind === 'weave') {
      // Hollow Weaver — stacks Weave on the player. Lane-agnostic (Alan,
      // 2026-06-02): the end-of-turn check (in endTurn) fires ALL stacks as
      // composure damage unless the player dealt damage to the enemy that
      // turn, then clears. Wit neutralizes it by landing a cast; the Handler
      // by having an animal attack. Both lanes accumulate the same way — no
      // immediate-fire special case anymore.
      setWeaveStacks(w => w + (intent.value || 1));
      pushLog(`👹 ${e.name}: 🪡 Weave +${intent.value || 1} (total: ${weaveStacks + (intent.value || 1)}). Strike the Weaver next turn or it fires.`);
    } else if (intent.kind === 'vulnerable') {
      // Enemy applies vulnerable to player → enemy hits harder.
      // v2.32: NOT LISTENING — first debuff (Weak/Vuln) per combat is ignored.
      if (notListeningCharges > 0) {
        setNotListeningCharges(c => Math.max(0, c - 1));
        pushLog(`🙉 ${e.name}: ${intent.telegraph} — didn't hear it.`);
      } else {
        adjustEnemyDmg(+0.25 * intent.value);
        pushLog(`👹 ${e.name}: 💢 +${25*intent.value}% to incoming dmg.`);
        // v2.93: O-2 (And What About THAT Time) — reflect debuff to enemy.
        if (reflectNextDebuff > 0) {
          adjustPlayerDmg(+0.25 * intent.value);  // enemy becomes Vulnerable to your spells
          pushLog(`🪞 ...and what about THAT time → enemy Vulnerable +${intent.value} (your spells +${25*intent.value}%).`);
          setReflectNextDebuff(n => Math.max(0, n - 1));
        }
      }
    } else if (intent.kind === 'weak') {
      // Enemy applies weak to player → player spells weaker.
      // v2.32: NOT LISTENING absorb.
      if (notListeningCharges > 0) {
        setNotListeningCharges(c => Math.max(0, c - 1));
        pushLog(`🙉 ${e.name}: ${intent.telegraph} — didn't hear it.`);
      } else {
        adjustPlayerDmg(-0.25 * intent.value);
        pushLog(`👹 ${e.name}: 💢 −${25*intent.value}% to your spell potency.`);
        // v2.93: reflect Weak as enemy Weak (their attacks weaker).
        if (reflectNextDebuff > 0) {
          adjustEnemyDmg(-0.25 * intent.value);
          pushLog(`🪞 ...and what about THAT time → enemy Weak (−${25*intent.value}% atk).`);
          setReflectNextDebuff(n => Math.max(0, n - 1));
        }
      }
    }
    // Riders: a combo intent can attach extra side-effects that fire AFTER
    // the main effect. Keys: weak (player potency down), vulnerable (player
    // damage taken up), block (enemy gains block). Riders apply even on
    // lethal attacks — that's flavor, not bug. Keep telegraphs honest: the
    // intent.telegraph string above should already advertise the rider.
    if (intent.riders) {
      const r = intent.riders;
      // v2.32: NOT LISTENING absorbs the FIRST debuff (weak OR vuln) it sees.
      // Riders on attack intents check the live charge count too. We use a
      // local consume-counter so a swing that carries BOTH weak and vuln only
      // burns one charge (the first one), per the "one absorb per combat" rule.
      let nlConsumed = false;
      const tryNlAbsorb = (label) => {
        if (!nlConsumed && notListeningCharges > 0) {
          nlConsumed = true;
          setNotListeningCharges(c => Math.max(0, c - 1));
          pushLog(`🙉 ${label} rider — didn't hear it.`);
          return true;
        }
        return false;
      };
      if (r.weak) {
        if (!tryNlAbsorb('Weak')) adjustPlayerDmg(-0.25 * r.weak);
      }
      if (r.vulnerable) {
        if (!tryNlAbsorb('Vulnerable')) adjustEnemyDmg(+0.25 * r.vulnerable);
      }
      if (r.block) setEnemyBlock(b => b + r.block);
    }
    if (playerDied) {
      if (tutorialActive) { setHp(maxHp); setComposure(composureMax); return; }
      logEvent(TE.COMBAT_END, { enemyId: enemy?.id, outcome: 'lost', tier: enemy?.tier, hpAfter: 0, composureAfter: composure, piles: pilesSnapshot() });
      logEvent(TE.RUN_END, { outcome: 'lost', killedBy: enemy?.id, actIdx: currentActIdx, finalDeckSize: deck.length + hand.length + discard.length + exiled.length });
      setTimeout(() => setStage('defeat'), 200);
    }
  }


  function onEnemyDefeated() {
    if (!enemy) return;
    // Multiple kill-detection sites each schedule this on the same killing
    // blow; latch so only the first invocation resolves the combat. Without
    // this the boss-path pile fold below runs once per scheduled callback and
    // duplicates the entire deck. Reset in enterFight.
    if (enemyDefeatedHandledRef.current) return;
    enemyDefeatedHandledRef.current = true;
    logEvent(TE.COMBAT_END, { enemyId: enemy.id, outcome: 'won', tier: enemy.tier, hpAfter: hp, composureAfter: composure, piles: pilesSnapshot() });
    // Tutorial short-circuit: skip rewards, route to the wrap-up screen.
    if (tutorialActive) {
      pushLog(`✓ The Bursar concedes the match. "Well argued."`);
      setTutorialActive(false);
      setStage('tutorial-complete');
      return;
    }
    // v3.4.13 Lab Mode short-circuit: no rewards, no map. Show the
    // repeat prompt; the player decides whether to fight another or
    // return to the main menu. Keep stage on 'combat' under the modal
    // — labRepeatYes / labRepeatNo do the actual routing.
    if (labMode) {
      pushLog(`✓ ${enemy.name} defeated.`);
      setLabRepeatPrompt({ enemyName: enemy.name });
      return;
    }
    // Sidequest combat short-circuit: skip the reward draw and return
    // the player to the map. The current node is the spur combat node;
    // the next click walks forward to the next spur node.
    if (sidequestCombatActive && sidequestActive) {
      pushLog(`✓ ${enemy.name} resolved.`);
      setSidequestCombatActive(false);
      setSidequestActive(null);
      // Combat resolution returns to map via existing post-fight path.
      // Mark the combat node as cleared so the spur node turns 'spent'.
      if (currentNodeId && !clearedNodes.includes(currentNodeId)) {
        setClearedNodes(prev => [...prev, currentNodeId]);
      }
      returnToMap();
      return;
    }
    pushLog(`✓ ${enemy.name} defeated.`);
    // v2.22: post-combat heal nerfed 8% → 4% maxHp. Live playtest:
    // user finished act 1 hovering 50-70 HP, "truly hasn't worried about
    // damage taken once." Cutting to zero overshot in sim (0% wins).
    // 4% is a token recovery — meaningful only across many fights.
    const healHp = Math.floor(maxHp * 0.04);
    const healComp = Math.floor(composureMax * 0.04);
    if (healHp > 0) {
      setHp(h => clamp(h + healHp, 0, maxHp));
      setComposure(c => clamp(c + healComp, 0, composureMax));
      pushLog(`💚 Recovered +${healHp} HP, +${healComp} Composure.`);
    }
    const isBoss = enemy.tier === 'boss';
    // Fire relic onEnemyDefeated triggers (heal etc.). Not for bosses —
    // bosses already give a richer reward path.
    if (!isBoss) {
      for (const { effect, sourceName } of effectSources()) {
        const ed = effect?.onEnemyDefeated;
        if (!ed) continue;
        if (ed.heal) {
          setHp(h => clamp(h + ed.heal, 0, maxHp));
          pushLog(`📿 ${sourceName}: +${ed.heal} HP.`);
        }
      }
    }
    // Fire onCombatEnd triggers (heal etc.) for all kills incl. boss.
    for (const { effect, sourceName } of effectSources()) {
      const ce = effect?.onCombatEnd;
      if (!ce) continue;
      if (ce.heal) {
        setHp(h => clamp(h + ce.heal, 0, maxHp));
        pushLog(`📿 ${sourceName}: +${ce.heal} HP.`);
      }
    }
    if (isBoss) {
      // Boss kill — route to the crafting screen. The act's gathered
      // inventory + skill is bundled into the prompt; if the inventory
      // is empty, a salvaged scrap is dropped by the boss so the act
      // never feels broken. Crafting confirms → act-cleared.
      const slot = currentAct.slot;
      const skillName = currentAct.craft;
      const gathered = inventory[slot] || [];
      const materials = gathered.length > 0 ? gathered : [salvageMaterial(slot)];
      // Plus a random Rare relic from the boss chest. Skip duplicates.
      const rareRelic = pickRelicByRarity({ rare: 1 }, relics.map(r => r.id), selectedCharacter?.lane || null);
      if (rareRelic) {
        grantRelic(rareRelic, 'Boss chest');
      }
      // v3.1.3 BUGFIX: tray cards staged at combat end were being LOST
      // forever — enterFight resets the tray on next combat. Alan's
      // telemetry: ended Hollow Weaver with subject staged → Pattern
      // Maker started with no subject in deck → 0 casts across 4 turns.
      // 2026-05-31 follow-up: extractor now unwraps lure envelopes and
      // skips animal envelopes so handler combats don't leak blanks.
      const trayCards = extractTrayCardsForReturn(tray);
      setDeck(d => [...d, ...hand, ...discard, ...exiled, ...trayCards]);
      setHand([]); setDiscard([]); setExiled([]);
      setTray(initialV2Tray());
      pushLog(`👑 ${enemy.name} falls.`);
      const craftPrompt = {
        slot,
        skillName,
        materials,
        skill: skills[skillName] || 0,
        phase: 'choose',
        chosenMaterial: null,
        quality: null,
        result: null,
        salvaged: gathered.length === 0,
      };
      // v3.4.64 — if player owns at least one FFT row, offer an FFT row
      // upgrade choice BEFORE crafting. Wit-only (handler retired FFT
      // 2026-05-31; jnsq doesn't have row content built yet).
      const laneRowTable = selectedCharacter?.lane === 'wit' ? WIT_ROW_BY_ID : null;
      if (laneRowTable) {
        const owned = {};
        const fullDeckCheck = [...hand, ...discard, ...exiled, ...trayCards];
        for (const c of fullDeckCheck) {
          if (c.setId) owned[c.setId] = true;
        }
        const rowIds = Object.keys(owned);
        // Filter out rows that are already fully upgraded in every owned card.
        const eligibleRowIds = rowIds.filter(setId => {
          const allCardsOfRow = fullDeckCheck.filter(c => c.setId === setId);
          return allCardsOfRow.some(c => !c.upgraded);
        });
        const rows = eligibleRowIds.map(id => laneRowTable[id]).filter(Boolean);
        if (rows.length > 0) {
          setBossFftUpgradeChoice({ rows, pendingCraftPrompt: craftPrompt });
          pushLog(`📜 Choose an FFT row to upgrade (boss reward).`);
          setStage('boss-fft-upgrade');
          return;
        }
      }
      pushLog(`Time to craft your ${SLOT_LABEL[slot]}.`);
      setCraftingPrompt(craftPrompt);
      setStage('crafting');
      return;
    }
    // Elite kill → grant a random common/uncommon relic (no choice for MVP).
    if (enemy.tier === 'elite') {
      const r = pickRelicByRarity({ common: 2, uncommon: 3 }, relics.map(x => x.id), selectedCharacter?.lane || null);
      if (r) {
        grantRelic(r, 'Elite spoils');
      }
    }
    // v2.68: act-scaled rarity weights. Per playtest: Act 2 rewards
    // felt all-common. STS-style scaling — later acts shift toward
    // uncommons + rares. Act 1 = early commons dominate; Act 2 = mix
    // tilted to uncommons; Act 3 (final) = uncommons + rares.
    const actIdx = currentActIdx || 0;
    let weights;
    if (enemy.tier === 'elite') {
      // Elites always shift up: Act 1 = uncommon-favored, Act 2+ = rare-favored.
      weights = actIdx === 0
        ? { common: 1, uncommon: 4, rare: 1 }
        : { common: 1, uncommon: 3, rare: 2 };
    } else {
      // Normal enemies: scale with act.
      weights = actIdx === 0 ? { common: 4, uncommon: 1 }
              : actIdx === 1 ? { common: 2, uncommon: 3, rare: 1 }
              :                { common: 1, uncommon: 4, rare: 2 };
    }
    const choices = [];
    const lane = selectedCharacter?.lane || null;
    // v2.60: rewards never offer cards that are already in the starting
    // deck — every reward should bring a new mechanic, not a vanilla
    // duplicate of what you opened with.
    const starterIds = lane ? buildStarterDeckForLane(lane) : [];
    const used = [...starterIds];

    // v3.4.15 (Alan): FFT spells are now elite/boss rewards only. Normal
    // enemies grant support cards (modifiers/skills/gestures/annotations).
    // Elite enemies grant a choice of 3 T1 FFT rows; bosses grant 3 T2
    // rows. Each row is a bundle — picking adds all 3 cards at once.
    const isEliteOrBoss = enemy.tier === 'elite' || enemy.tier === 'boss';
    // Handler — lure reward on elite/boss kill. Three random lures from the
    // pool; player picks one (or skips). Standalone lure-pool flavor that
    // doesn't bias against drafting interplay cards in normal rewards.
    if (lane === 'handler' && isEliteOrBoss) {
      // Fish Food is a high-risk gamble reserved for ELITE rewards — never
      // offered after a boss (Alan, 2026-06-02). Only one copy is granted,
      // which the pick-one-of-three flow already enforces.
      const lurePool = (HANDLER_V2_BY_SLOT.lure || []).filter(c =>
        c.id !== 'cv2-l-fish-food' || enemy.tier === 'elite');
      const lureChoices = shuffle([...lurePool]).slice(0, 3).map(c => ({ ...c }));
      logEvent('combat.reward_offer', {
        playerLane: lane,
        offerKind: 'handler-lures',
        offered: lureChoices.map(c => ({ id: c.id, name: c.name })),
        enemyId: enemy.id, enemyTier: enemy.tier,
      });
      setRewardChoices(lureChoices);
      setRewardRowChoices([]);
      setStage('reward');
      return;
    }
    // Wit-only FFT-row bundle reward (handler retired FFT 2026-05-31).
    const laneRowsTable = lane === 'wit' ? WIT_ROWS : null;
    if (laneRowsTable && isEliteOrBoss) {
      // Pick 3 rows the player doesn't already fully own.
      const ownedRowSlots = {};
      for (const c of [...hand, ...deck, ...discard, ...exiled]) {
        if (!c.setId) continue;
        if (!ownedRowSlots[c.setId]) ownedRowSlots[c.setId] = new Set();
        ownedRowSlots[c.setId].add(c.setSlot);
      }
      const isFullyOwned = (r) => ownedRowSlots[r.id]?.size === 3;
      const eligibleRows = laneRowsTable.filter(r => !isFullyOwned(r));
      // Bias toward partial rows (1-2 slots already owned) — finishing a
      // row a player started feels better than starting fresh on a 4th.
      const partials = eligibleRows.filter(r => ownedRowSlots[r.id]?.size > 0);
      const fresh    = eligibleRows.filter(r => !ownedRowSlots[r.id]);
      const orderedPool = [...shuffle(partials), ...shuffle(fresh)];
      const rowPicks = orderedPool.slice(0, 3);
      const bumpTier = enemy.tier === 'boss';
      const rowChoices = rowPicks.map(row => {
        let cards = [row.introId, row.subjectId, row.targetId]
          .map(id => CARDS_BY_ID[id]).filter(Boolean)
          .map(c => ({ ...c }));
        if (bumpTier) cards = cards.map(c => upgradeCard(c));
        return { row, cards, tierBumped: bumpTier };
      });
      logEvent('combat.reward_offer', {
        playerLane: lane,
        offerKind: 'fft-rows',
        tierBumped: bumpTier,
        offered: rowChoices.map(rc => ({ rowId: rc.row.id, rowName: rc.row.name, schoolId: rc.row.schoolId })),
        enemyId: enemy.id, enemyTier: enemy.tier,
      });
      setRewardRowChoices(rowChoices);
      setRewardChoices([]);
      setStage('reward');
      return;
    }

    // Normal-enemy + non-wit reward path: 3 individual cards, no spell
    // pieces. The pickCardByRarity opts gate spell pieces out entirely.
    // Handler (Alan, 2026-06-03): exactly ONE of the three normal-combat
    // cards is a special utility lure (single named animal carrying a verb).
    // Prefer one the player doesn't already own; fall back to any if all
    // owned. The other two fill from the normal support pool below.
    if (lane === 'handler') {
      const owned = new Set([...hand, ...deck, ...discard, ...exiled].map(c => c.id));
      const unowned = SPECIAL_LURE_CARDS.filter(c => !owned.has(c.id));
      const pool = unowned.length > 0 ? unowned : SPECIAL_LURE_CARDS;
      const special = { ...shuffle([...pool])[0] };
      choices.push(special); used.push(special.id);
    }
    while (choices.length < 3) {
      const pick = pickCardByRarity(weights, used, lane, { excludeSpellPieces: true });
      if (!pick) break;
      choices.push(pick); used.push(pick.id);
    }
    // Keep the special lure from always landing in the same slot.
    if (lane === 'handler') { const s = shuffle(choices); choices.length = 0; choices.push(...s); }
    // v2.99.3: telemetry — record offered card lanes alongside player's
    // lane. Lets us detect bleed in real time (any offered.lane that
    // doesn't match player.lane and isn't undefined is a bug).
    logEvent('combat.reward_offer', {
      playerLane: lane,
      offerKind: 'cards',
      offered: choices.map(c => ({ id: c.id, lane: c.lane || null, rarity: c.rarity })),
      enemyId: enemy?.id,
      enemyTier: enemy?.tier,
    });
    setRewardChoices(choices);
    setRewardRowChoices([]);
    setStage('reward');
  }

  function applyEquipmentMaxHp(eq) {
    if (eq.bonus?.maxHp) {
      setMaxHp(m => m + eq.bonus.maxHp);
      setHp(h => h + eq.bonus.maxHp);
    }
  }

  function pickReward(cardOrSkip) {
    // v3.1.3 BUGFIX: include tray-staged cards in the merge. Without this,
    // any card staged at combat end (waiting for the next turn's cast)
    // got obliterated by enterFight's tray reset on the next combat.
    const trayCards = extractTrayCardsForReturn(tray);
    // v3.4.15 — FFT row pick. cardOrSkip is { row, cards, tierBumped }.
    // Add all three cards to the deck and bypass the single-card path.
    if (cardOrSkip && cardOrSkip.row && Array.isArray(cardOrSkip.cards)) {
      const fresh = cardOrSkip.cards.map(c => ({ ...c, uid: uid() }));
      logEvent(TE.CARD_PICK, {
        kind: 'fft-row',
        rowId: cardOrSkip.row.id,
        rowName: cardOrSkip.row.name,
        schoolId: cardOrSkip.row.schoolId,
        tierBumped: !!cardOrSkip.tierBumped,
        cardIds: fresh.map(c => c.id),
        source: 'combat-reward',
      });
      setDeck(d => [...d, ...hand, ...discard, ...exiled, ...trayCards, ...fresh]);
      pushLog(`+ ${cardOrSkip.row.name} (3 cards${cardOrSkip.tierBumped ? ', upgraded' : ''}) added to deck.`);
      setHand([]); setDiscard([]); setExiled([]);
      setTray(initialV2Tray());
      setRewardChoices([]); setRewardRowChoices([]);
      returnToMap();
      return;
    }
    if (cardOrSkip) {
      // v3.3: include FFT row affinity (setId/schoolId) + whether the
      // offered set looked like a school sampler. Lets snapshot 7+
      // measure "how often do players actually pick the synergy card
      // vs the stat card?" from telemetry.
      const samplerSig = (() => {
        const tags = rewardChoices.map(c => c?.setId).filter(Boolean);
        if (tags.length < 2) return null;
        const allMatch = tags.every(t => t === tags[0]);
        return allMatch ? tags[0] : null;
      })();
      logEvent(TE.CARD_PICK, {
        cardId: cardOrSkip.id, cardName: cardOrSkip.name, type: cardOrSkip.type,
        rarity: cardOrSkip.rarity,
        setId: cardOrSkip.setId || null,
        schoolId: cardOrSkip.schoolId || null,
        wasSampler: !!samplerSig,
        samplerRowId: samplerSig,
        offered: rewardChoices.map(c => ({ id: c?.id, setId: c?.setId || null, schoolId: c?.schoolId || null })),
        source: 'combat-reward',
      });
      // See PAIR_LURE_IDS (module scope): only Birdseed / Tender Greens pair.
      const copies = (cardOrSkip.slot === 'lure' && PAIR_LURE_IDS.has(cardOrSkip.id)) ? 2 : 1;
      const fresh = Array.from({ length: copies }, () => ({ ...cardOrSkip, uid: uid() }));
      setDeck(d => [...d, ...hand, ...discard, ...exiled, ...trayCards, ...fresh]);
      pushLog(`+ ${cardOrSkip.name}${copies > 1 ? ` ×${copies}` : ''} added to deck.`);
    } else {
      logEvent(TE.REWARD_SKIP, { offered: rewardChoices.map(c => c?.id), source: 'combat-reward' });
      setDeck(d => [...d, ...hand, ...discard, ...exiled, ...trayCards]);
      pushLog(`Skipped reward.`);
    }
    setHand([]); setDiscard([]); setExiled([]);
    setTray(initialV2Tray());
    setRewardChoices([]);
    setRewardRowChoices([]);
    returnToMap();
  }

  // ---------- EVENT / REST / FORGE ----------
  function resolveEventChoice(choice) {
    const fx = choice.effects || {};
    logEvent(TE.EVENT_CHOICE, { eventId: activeEvent?.id, eventTitle: activeEvent?.title, choiceLabel: choice.label, effects: Object.keys(fx), hp, composure });
    const logBits = [`📜 ${activeEvent.title}: ${choice.label}`];
    const { granted } = applyEffectsCore(fx, { logBits });
    pushLog(logBits.join(' · '));
    const eventTitle = activeEvent?.title;
    setActiveEvent(null);
    // If the event granted cards, queue them up in the modal and defer
    // returning to the map until the player acknowledges them.
    if (granted.length > 0) {
      setCardGrantPrompt({
        cards: granted,
        title: `${eventTitle} — added to your deck`,
      });
      setStage('card-grant');
      return;
    }
    returnToMap();
  }

  // Dismiss the card-grant modal. Routes back to the map.
  function dismissCardGrant() {
    setCardGrantPrompt(null);
    returnToMap();
  }

  // Crafting screen handlers. Three phases — choose / gauge / result —
  // tracked on craftingPrompt.phase. Confirm at the end commits the
  // crafted output (card or equipment) and routes to act-cleared.
  function craftingPickMaterial(materialId) {
    if (!craftingPrompt) return;
    const m = craftingPrompt.materials.find(x => x.id === materialId);
    if (!m) return;
    setCraftingPrompt(prev => ({ ...prev, chosenMaterial: m, phase: 'gauge' }));
  }

  // Called when the gauge minigame locks in. Position 0..1; target is
  // centered around 0.5 with width that grows with skill.
  function craftingResolveGauge(position) {
    if (!craftingPrompt) return;
    const skill = craftingPrompt.skill || 0;
    // Master zone: ±(0.06 + skill * 0.025) → 0.06 (skill 0) to 0.185 (skill 5)
    // Fine zone:   ±(0.18 + skill * 0.04)  → 0.18 (skill 0) to 0.38 (skill 5)
    const masterRadius = 0.06 + skill * 0.025;
    const fineRadius   = 0.18 + skill * 0.04;
    const offset = Math.abs(position - 0.5);
    const quality = craftingPrompt.salvaged ? 'rough'
                  : offset <= masterRadius   ? 'master'
                  : offset <= fineRadius     ? 'fine'
                  :                            'rough';
    const built = buildCraftedEquipment({
      slot: craftingPrompt.slot,
      material: craftingPrompt.chosenMaterial,
      quality,
      skill,
      lane: selectedCharacter?.lane,
    });
    setCraftingPrompt(prev => ({ ...prev, phase: 'result', quality, result: built }));
  }

  // Commit the crafted output — card to deck, equipment to equipment slot.
  // Clear the act's inventory for that slot (materials are spent) and
  // route to act-cleared.
  function craftingConfirm() {
    if (!craftingPrompt || !craftingPrompt.result) return;
    const r = craftingPrompt.result;
    if (r.kind === 'card') {
      setDeck(d => [...d, { ...r.card, uid: uid() }]);
      pushLog(`🛠 Crafted: ${r.card.name} — added to your deck.`);
    } else if (r.kind === 'equipment') {
      setEquipment(prev => [...prev, r.equipment]);
      applyEquipmentMaxHp(r.equipment);
      pushLog(`🛠 Crafted: ${r.equipment.name}.`);
    }
    // Spend materials for this slot (rest are kept for narrative? no —
    // simpler to clear: they were used in the workshop or set aside).
    const slot = craftingPrompt.slot;
    setInventory(prev => ({ ...prev, [slot]: [] }));
    setCraftingPrompt(null);
    setStage('act-cleared');
  }

  function resolveRestChoice(kind) {
    logEvent(TE.REST_CHOICE, { kind, hp, composure, deckSize: deck.length + hand.length + discard.length + exiled.length });
    if (kind === 'heal') {
      // Rest restores both pools at 30% of max. Composure recovers same
      // ratio as HP so the inn-before-boss guarantee actually tops you
      // off across both vital pools, not just physical health.
      const hpAmount   = Math.floor(maxHp * 0.3);
      const compAmount = Math.floor(composureMax * 0.3);
      setHp(h => clamp(h + hpAmount, 0, maxHp));
      setComposure(c => clamp(c + compAmount, 0, composureMax));
      pushLog(`🛏 Rest: +${hpAmount} HP, +${compAmount} Composure.`);
      setRestNode(null);
      returnToMap();
      return;
    }
    if (kind === 'upgrade') {
      // Open the upgrade picker. Rest node stays selected; the picker
      // returns to map on confirm or cancel.
      setUpgradeOpen(true);
      setStage('upgrade');
      return;
    }
    if (kind === 'forget') {
      // v2.8: card removal. Same flow as upgrade — pick one card and
      // remove it from the deck. Rest node stays selected; the picker
      // returns to map on confirm or cancel.
      setStage('forget');
      return;
    }
    if (kind === 'reflect') {
      // v2.92: grant a random Passing Thought (colorless one-shot card).
      // v3.1.4: surface the granted card via CardGrantScreen so the
      // player can actually SEE what they got, mirroring event-grant
      // and combat-reward flows. Was previously silently appended +
      // a log line — easy to miss.
      const picked = PASSING_THOUGHTS[Math.floor(Math.random() * PASSING_THOUGHTS.length)];
      const newCard = { ...picked, uid: uid() };
      setDeck(d => [...d, newCard]);
      pushLog(`💭 Reflect: a Passing Thought drifts up — ${picked.name}.`);
      logEvent('rest.reflect', { cardId: picked.id, cardName: picked.name });
      setRestNode(null);
      setCardGrantPrompt({ cards: [newCard], title: 'Reflection — a Passing Thought drifts up.' });
      setStage('card-grant');
      return;
    }
    if (kind === 'train-animal') {
      logEvent('rest.train_animal.open', {});
      setStage('train-animal');
      return;
    }
    if (kind === 'upgrade-spell') {
      // v3.4.15 — bump a complete FFT row's three cards in one go.
      // Wit-only; the rest screen gates the button. Picker lists the
      // rows the player has all 3 slots of, in any pile.
      logEvent('rest.upgrade_spell.open', {});
      setStage('upgrade-spell');
      return;
    }
  }

  // v3.2 Phase 5c: Reading Room confirm — apply HP cost, push picked cards
  // to discard (so they shuffle into the deck on next reshuffle), close the
  // rest node, return to map.
  function resolveReadingRoom(pickedCards, hpCost) {
    if (hpCost > 0) {
      setHp(h => Math.max(1, h - hpCost));
    }
    if (pickedCards.length > 0) {
      const fresh = pickedCards.map(c => ({ ...c, uid: uid() }));
      setDiscard(d => [...d, ...fresh]);
      const names = fresh.map(c => c.name || c.phrase).join(', ');
      pushLog(`📖 Reading Room: took ${fresh.length} card${fresh.length > 1 ? 's' : ''} (${names})${hpCost > 0 ? ` for ${hpCost} HP` : ''}.`);
      logEvent('rest.read.confirm', {
        count: fresh.length, hpCost,
        cardIds: fresh.map(c => c.id),
        setIds: fresh.map(c => c.setId).filter(Boolean),
      });
    } else {
      logEvent('rest.read.empty', {});
    }
    setRestNode(null);
    returnToMap();
  }

  function cancelReadingRoom() {
    // Cancel from Reading Room returns to the rest screen so the player
    // can pick a different rest option without losing the visit.
    logEvent('rest.read.cancel', {});
    setStage('rest');
  }

  // v2.8: Remove a card from the deck at a rest site. Mirrors
  // pickCardToUpgrade. cardUid === null cancels back to the rest screen.
  function pickCardToForget(cardUid) {
    if (cardUid === null) {
      logEvent('forget.cancel', { deckSize: deck.length });
      setStage('rest');
      return;
    }
    const target = deck.find(c => c.uid === cardUid);
    logEvent('forget.pick', { cardId: target?.id, cardName: target?.name, type: target?.type, deckSize: deck.length });
    setDeck(prev => prev.filter(c => c.uid !== cardUid));
    if (target) pushLog(`🛏 Forgot ${target.name || target.phrase}. Off the deck for good.`);
    setRestNode(null);
    returnToMap();
  }

  function pickCardToUpgrade(cardUid) {
    if (cardUid === null) {
      // Cancelled — go back to rest.
      logEvent('upgrade.cancel', { deckSize: deck.length });
      setUpgradeOpen(false);
      setStage('rest');
      return;
    }
    const target = deck.find(c => c.uid === cardUid);
    logEvent('upgrade.pick', { cardId: target?.id, cardName: target?.name, type: target?.type, deckSize: deck.length });
    setDeck(prev => prev.map(c => {
      if (c.uid !== cardUid) return c;
      const upgraded = upgradeCard(c);
      pushLog(`🛏 Upgraded ${c.name} → ${upgraded.name}.`);
      return upgraded;
    }));
    setUpgradeOpen(false);
    setRestNode(null);
    returnToMap();
  }

  // Which species can the player actually field right now? Seed from every
  // lure in the deck (and any other pile), then transitively follow the
  // engine's two species-transition edges — predatorChain (salmon → bear)
  // and adjacentSpawn (field-mouse → rabbit → bonzai) — including the T2
  // upgrade variants so a chain that only appears post-upgrade still counts.
  // Train an Animal filters its offer to this set so you can't burn a rest
  // bumping a species you have no lure to summon (Alan, 2026-06-02: trained
  // Salmon with no Fish Food in deck → dead pick).
  function summonableSpeciesSet() {
    const set = new Set();
    const lures = [...deck, ...hand, ...discard, ...exiled]
      .filter(c => c?.type === 'lure' && c.summon);
    for (const c of lures) {
      if (c.summon.animalId) set.add(c.summon.animalId);
      for (const id of (c.summon.animalIds || [])) set.add(id);
    }
    // Transitive closure over chain/spawn edges.
    let frontier = [...set];
    while (frontier.length) {
      const next = [];
      for (const id of frontier) {
        const def = ANIMALS[id];
        if (!def) continue;
        const edges = [
          def.predatorChain?.animalId,
          def.adjacentSpawn?.animalId,
          def.upgrade?.predatorChain?.animalId,
          def.upgrade?.adjacentSpawn?.animalId,
        ];
        for (const e of edges) {
          if (e && !set.has(e)) { set.add(e); next.push(e); }
        }
      }
      frontier = next;
    }
    return set;
  }

  // v3.4.15 — Upgrade-Spell handler. Walks every pile, upgrades every
  // card whose setId matches the chosen row. Multiple copies all upgrade.
  // Already-upgraded cards are no-ops (upgradeCard returns them unchanged).
  function pickAnimalToTrain(animalId) {
    if (animalId == null) {
      logEvent('train_animal.cancel', {});
      setStage('rest');
      return;
    }
    if (!ANIMALS[animalId]?.upgrade) return;
    setUpgradedAnimals(prev => new Set([...prev, animalId]));
    const def = ANIMALS[animalId];
    pushLog(`📚 You spend the evening training. ${def?.icon || ''} ${def?.name} is now T2 — stronger, smarter, hungrier.`);
    logEvent('train_animal.confirm', { animalId });
    setRestNode(null);
    returnToMap();
  }

  function pickSpellToUpgrade(rowId) {
    if (rowId === null) {
      logEvent('upgrade_spell.cancel', { deckSize: deck.length });
      setStage('rest');
      return;
    }
    const row = WIT_ROW_BY_ID[rowId];
    if (!row) return;
    // Count bumps via a side-effecting helper, but run it OUTSIDE the
    // setState updaters (closure-snapshot pattern). Per the React
    // purity rule: setState callbacks must be pure — StrictMode double-
    // invokes them which would double-count. So we compute the next
    // piles + counter eagerly here, then set state once with the
    // pre-computed value.
    let bumped = 0;
    const bumpedNames = [];
    const bumpOne = (c) => {
      if (!c || c.setId !== rowId) return c;
      const next = upgradeCard(c);
      if (next !== c) { bumped++; bumpedNames.push(next.name || next.phrase || next.id); }
      return next;
    };
    const nextDeck    = deck.map(bumpOne);
    const nextHand    = hand.map(bumpOne);
    const nextDiscard = discard.map(bumpOne);
    const nextExiled  = exiled.map(bumpOne);
    const nextTray = {
      ...tray,
      intro:     bumpOne(tray?.intro),
      subject:   bumpOne(tray?.subject),
      target:    bumpOne(tray?.target),
      modifiers: (tray?.modifiers || []).map(bumpOne),
    };
    setDeck(nextDeck);
    setHand(nextHand);
    setDiscard(nextDiscard);
    setExiled(nextExiled);
    setTray(nextTray);
    if (bumped > 0) {
      pushLog(`🎓 Rehearsed ${row.name} — ${bumped} card${bumped === 1 ? '' : 's'} upgraded: ${bumpedNames.join(', ')}.`);
    } else {
      // Defensive: eligibility filter should prevent this, but if every
      // copy was already T2 the player still ends up here on a click.
      pushLog(`🎓 ${row.name} is already fully rehearsed — nothing changed.`);
    }
    logEvent('upgrade_spell.pick', { rowId, rowName: row.name, bumpedCount: bumped, cards: bumpedNames });
    setRestNode(null);
    returnToMap();
  }

  // ---------- RENDER ----------
  // v2.99.4: top-level overlays (forget modal, chaos roll flash) rendered
  // AS A SIBLING of whatever stage content is active. Previously these
  // lived only in the combat-stage return; when an event resolver set
  // forgetTwoPrompt + cardGrantPrompt at the same time, the card-grant
  // screen's early-return hid the modal until the player navigated to
  // combat — at which point the forget modal "popped over" the combat
  // screen. Lifting the overlays out of the stage routing fixes that.
  const appOverlays = <>
    {forgetTwoPrompt && <ForgetTwoModal cards={forgetTwoPrompt.cards} onPick={resolveForgetTwoChoice} lane={selectedCharacter?.lane || null} />}
    {lurePickerSource && (
      <LurePicker
        source={lurePickerSource}
        cards={(lurePickerSource === 'deck' ? deck : discard).filter(c => c.type === 'lure')}
        onPick={pickLureFromPile}
        onCancel={() => setLurePickerSource(null)}
        lane={selectedCharacter?.lane || null} />
    )}
    {chaosRollFlash && <ChaosRollFlash flash={chaosRollFlash} onDismiss={() => setChaosRollFlash(null)} />}
    {relicToastQueue.length > 0 && (
      <RelicAcquiredOverlay
        relic={relicToastQueue[0].relic}
        source={relicToastQueue[0].source}
        onDismiss={() => setRelicToastQueue(q => q.slice(1))} />
    )}
  </>;
  const stageContent = (() => {
  if (stage === 'menu')               return <MenuScreen
    onStart={startRun} onTutorial={startTutorial}
    onContinue={hasSavedRun ? continueRun : null}
    onDiscardSave={hasSavedRun ? () => { clearSavedRun(); } : null}
    onCompendium={() => setStage('compendium')}
    onDevQuickStart={() => setStage('dev-quick-start')} />;
  if (stage === 'compendium')         return <CompendiumScreen onBack={() => setStage('menu')} />;
  if (stage === 'dev-quick-start')    return <DevQuickStartScreen
    onStart={startDevRun}
    onBack={() => setStage('menu')} />;
  if (stage === 'tutorial-complete')  return <TutorialCompleteScreen onStart={startRun} onMenu={() => setStage('menu')} />;
  if (stage === 'defeat')             return <EndScreen win={false} onRetry={startRun} />;
  if (stage === 'graduation')         return <GraduationScreen equipment={equipment} familiar={familiar} familiarName={familiarName} onRetry={startRun} />;
  // Card-grant modal sits on top of whatever stage triggered it — render
  // the modal as an overlay below.

  if (stage === 'character-select') return <CharacterSelectScreen characters={CHARACTERS.filter(c => c.lane !== 'jnsq')} onSelect={pickCharacter} onPractice={startTutorial} onLab={pickCharacterLab} />;
  if (stage === 'lab-deck-build')   return <LabDeckBuildScreen
    character={selectedCharacter} deck={deck}
    onAdd={labAddCard} onRemove={labRemoveCard}
    onStart={labGoToEnemySelect}
    onCancel={() => { setLabMode(false); setSelectedCharacter(null); setStage('menu'); }} />;
  if (stage === 'lab-enemy-select') return <LabEnemySelectScreen
    enemies={ENEMIES} onPick={labFightEnemy}
    onCancel={() => { setLabMode(false); setSelectedCharacter(null); setStage('menu'); }} />;
  if (stage === 'wit-row-select') return <WitRowSelectScreen onPick={pickStartingRow} />;
  if (stage === 'supply-shop')   return <SupplyShopScreen offers={supplyOffers} onPick={pickSupplyOffer} character={selectedCharacter} />;
  if (stage === 'familiar-shop') return <FamiliarShopScreen onPick={pickFamiliar} />;
  if (stage === 'familiar-name') return <FamiliarNameScreen familiar={familiar} onConfirm={confirmFamiliarName} />;
  if (stage === 'act-cleared') {
    return <ActClearedScreen act={currentAct} equipment={equipment}
      isFinalAct={currentActIdx === ACTS.length - 1}
      onContinue={() => {
        logEvent(TE.ACT_CLEARED, { actIdx: currentActIdx, hp, composure, deckSize: deck.length + hand.length + discard.length + exiled.length, equipment: equipment.map(eq => eq.id) });
        if (currentActIdx === ACTS.length - 1) {
          logEvent(TE.RUN_END, { outcome: 'won', actIdx: currentActIdx, finalDeckSize: deck.length + hand.length + discard.length + exiled.length, finalHp: hp });
          setStage('graduation');
        } else advanceToNextAct();
      }} />;
  }
  if (stage === 'reward') return <RewardScreen choices={rewardChoices} rowChoices={rewardRowChoices} onPick={pickReward}
    onOpenDeck={() => { setDeckViewOpen(true); logEvent(TE.DECKVIEW_OPEN, { source: 'reward' }); }}
    deckViewOpen={deckViewOpen}
    deck={deck} hand={hand} discard={discard} exiled={exiled} tray={tray}
    onCloseDeck={() => setDeckViewOpen(false)} lane={selectedCharacter?.lane || null} />;
  if (stage === 'card-grant') return <CardGrantScreen prompt={cardGrantPrompt} onDismiss={dismissCardGrant} lane={selectedCharacter?.lane || null} />;
  if (stage === 'material-choose') return <MaterialChooseScreen prompt={materialChoices} onPick={claimMaterial} onSkip={skipMaterial} />;
  if (stage === 'skill-event') return <SkillEventScreen event={activeSkillEvent} skills={skills} onChoose={resolveSkillChoice} />;
  if (stage === 'sidequest-node') {
    const active = sidequestActive ? { tpl: SIDEQUEST_TEMPLATES[sidequestActive.templateId], node: SIDEQUEST_TEMPLATES[sidequestActive.templateId]?.nodes[sidequestActive.nodeIdx], idx: sidequestActive.nodeIdx } : null;
    if (!active?.tpl || !active?.node) { returnToMap(); return null; }
    return <SidequestNodeScreen template={active.tpl} node={active.node} nodeIdx={active.idx}
      onChoose={resolveSidequestChoice} onNarrativeContinue={resolveSidequestNarrative}
      onAbandon={abandonSidequest} />;
  }
  if (stage === 'insult-prompt' && insultPrompt) return <InsultPromptScreen
    insultPrompt={insultPrompt} enemy={enemy}
    onPick={pickInsultWord} />;
  if (stage === 'skill-minigame' && skillMinigame?.kind === 'trace-whittling') return <TraceWhittlingMinigame
    eventTitle={skillMinigame.eventTitle}
    choiceLabel={skillMinigame.choiceLabel}
    onComplete={finalizeSkillMinigame} />;
  if (stage === 'boss-fft-upgrade') return <BossFftUpgradeScreen
    choice={bossFftUpgradeChoice}
    onPick={resolveBossFftUpgrade}
    onSkip={() => resolveBossFftUpgrade(null)} />;
  if (stage === 'crafting') return <CraftingScreen
    prompt={craftingPrompt}
    onPickMaterial={craftingPickMaterial}
    onResolveGauge={craftingResolveGauge}
    onConfirm={craftingConfirm}
  />;
  if (stage === 'event')  return <EventScreen event={activeEvent} onChoose={resolveEventChoice} />;
  if (stage === 'rest')   return <RestScreen onChoose={resolveRestChoice} hasFFTRows={selectedCharacter?.lane === 'wit'} isHandler={selectedCharacter?.lane === 'handler'} upgradedAnimals={upgradedAnimals} animals={ANIMALS} hp={hp} maxHp={maxHp} composure={composure} composureMax={composureMax} />;
  if (stage === 'upgrade') return <UpgradeCardScreen deck={deck} onPick={pickCardToUpgrade} lane={selectedCharacter?.lane || null} />;
  if (stage === 'train-animal') return <TrainAnimalScreen animals={ANIMALS} upgradedAnimals={upgradedAnimals} summonable={summonableSpeciesSet()} onPick={pickAnimalToTrain} />;
  if (stage === 'upgrade-spell') return <UpgradeSpellScreen
    hand={hand} deck={deck} discard={discard} exiled={exiled} tray={tray}
    onPick={pickSpellToUpgrade} />;
  if (stage === 'forget')  return <ForgetCardScreen deck={deck} onPick={pickCardToForget} lane={selectedCharacter?.lane || null} />;
  // Floating menu button (☰) + overlay. Only renders on play stages.
  // Save & Quit only allowed when stage === 'map' (combat / mid-event
  // state isn't safe to serialize). Give Up always available.
  // The mailbox postcard button piggybacks on this overlay block so
  // it persists across map/combat — it's intentionally not super
  // noticeable per the design ("a small mailbox, not super noticeable").
  const menuOverlay = <>
    {postcardMailboxVisible() && (
      <button onClick={() => setPostcardModalOpen(true)}
        title="A small mailbox catches your eye."
        className="fixed top-3 right-24 z-40 px-2 py-1 rounded bg-ink-800 border border-ink-600 text-parchment-400 text-xs hover:bg-ink-700 opacity-60 hover:opacity-100 transition-opacity">
        📮
      </button>
    )}
    {postcardModalOpen && (
      <PostcardModal
        state={postcardState}
        phrase={postcardPhrase}
        progress={postcardsCorrect}
        onSubmit={submitPostcard}
        onClose={() => setPostcardModalOpen(false)} />
    )}
    <button onClick={() => setGameMenuOpen(true)}
      title="Menu (resume / save / give up)"
      className="fixed top-3 right-3 z-40 px-3 py-1.5 rounded-md bg-ink-700 border border-ink-500 text-parchment-200 text-sm hover:bg-ink-600 shadow-lg">
      ☰ Menu
    </button>
    {gameMenuOpen && (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
        <div className="parchment-card-strong p-6 max-w-sm w-full flex flex-col gap-3">
          <h2 className="font-display text-2xl text-gold-300 text-center">Pause</h2>
          <button onClick={() => setGameMenuOpen(false)} className="btn btn-moss">Resume</button>
          <button onClick={saveAndQuit} disabled={stage !== 'map'}
            className={`btn ${stage === 'map' ? 'btn-iris' : 'bg-ink-600 text-parchment-400 cursor-not-allowed'}`}
            title={stage === 'map' ? 'Save the run and return to the main menu.' : 'Saving is only available on the map. Finish the current step first.'}>
            Save &amp; Quit {stage !== 'map' && <span className="text-xs">(not on this screen)</span>}
          </button>
          <button onClick={giveUpRun} className="btn btn-ember">Give Up (lose run)</button>
        </div>
      </div>
    )}
  </>;

  if (stage === 'map') {
    return <>
      <MapScreen
        map={map} act={currentAct} actIdx={currentActIdx} totalActs={ACTS.length}
        currentNodeId={currentNodeId} clearedNodes={clearedNodes}
        reachable={reachableFromCurrent()}
        mapFog={postcardState === 'failed'}
        player={{ hp, maxHp, composure, composureMax, equipment, relics, deckSize: deck.length, familiar, familiarName, inventory, skills }}
        onPick={pickNode} log={log} />
      <MaterialGainOverlay material={materialGainNotice}
                           onDismiss={() => setMaterialGainNotice(null)} />
      {menuOverlay}
    </>;
  }

  // Combat
  return <>
    {menuOverlay}
    <CombatScreen
      enemy={enemy} enemyComposure={enemyComposure} enemyHp={enemyHp}
      enemyBlock={enemyBlock} enemyIntent={enemyIntent} intentTick={intentTick}
      incomingProjection={projectIncomingDamage(enemyIntent)}
      peekedNextIntent={peekedNextIntent}
      enemyDmgMult={enemyDmgMult} playerDmgMult={playerDmgMult}
      enemyDmgTurns={enemyDmgTurns} playerDmgTurns={playerDmgTurns}
      enemyHitFlash={enemyHitFlash} playerHitFlash={playerHitFlash} dmgFloaters={dmgFloaters}
      hp={hp} maxHp={maxHp}
      playerComposure={composure} playerComposureMax={composureMax}
      block={block} poise={poise} energy={energy} hand={hand}
      amplifyPlaysThisCombat={amplifyPlaysThisCombat}
      getEffectiveCost={effectiveCardCost}
      deck={deck} discard={discard} exiled={exiled} tray={tray}
      energyMax={energyPerTurnRefill()}
      equipment={equipment} powers={powers} relics={relics}
      familiar={familiar} familiarName={familiarName}
      onPlayCard={playCard} onEndTurn={endTurn}
      onUnstage={unstageCard} onCast={castStagedSpell}
      castPreview={previewCastDamage()}
      castsThisTurn={castsThisTurn} maxCastsPerTurn={MAX_CASTS_PER_TURN}
      isHandler={selectedCharacter?.lane === 'handler'}
      isJnsq={selectedCharacter?.lane === 'jnsq'}
      rollOptIn={rollOptIn} setRollOptIn={setRollOptIn}
      lastRoll={lastRoll} combatRolls={combatRolls}
      longThread={longThread}
      wordsBank={wordsBank}
      crescendoBuildup={crescendoBuildup}
      crescendoBuildupRows={crescendoBuildupRows}
      scheduledEffects={scheduledEffects}
      thornsCharges={thornsCharges}
      mirrorReflectCharges={mirrorReflectCharges}
      tempHp={tempHp}
      tempHpTurns={tempHpTurns}
      playerIncomingMult={playerIncomingMult}
      enemyPressure={enemy?.pressure || 0}
      enemySkipNextAttack={enemySkipNextAttack}
      tutorFlash={tutorFlash}
      tutorArmed={tutorArmed}
      animals={effectiveAnimals}
      luresPlayedThisTurn={luresPlayedThisTurn}
      whistlePromptActive={whistlePromptActive}
      whistlePick1Slot={whistlePick1Slot}
      onWhistleClick={whistleClickSlot}
      onCancelWhistle={cancelWhistlePrompt}
      treatPromptActive={treatPromptActive}
      onTreatClick={treatClickSlot}
      onCancelTreat={cancelTreatPrompt}
      eatItPromptActive={eatItPromptActive}
      onEatItClick={eatItClickSlot}
      onCancelEatIt={cancelEatItPrompt}
      sacrificePromptActive={sacrificePromptActive}
      onSacrificeClick={sacrificeAnimalFromSlot}
      onCancelSacrifice={cancelSacrificePrompt}
      gorgePromptActive={gorgePromptActive}
      onGorgeClick={gorgeAnimalFromSlot}
      onCancelGorge={cancelGorgePrompt}
      wellDrilledPromptActive={wellDrilledPromptActive}
      onWellDrilledClick={wellDrilledClickSlot}
      onCancelWellDrilled={cancelWellDrilledPrompt}
      houseRulesPromptActive={houseRulesPromptActive}
      onHouseRulesClick={houseRulesClickSlot}
      onCancelHouseRules={cancelHouseRulesPrompt}
      onActivateAnimal={activateAnimalFromSlot}
      abilitiesUsedThisTurn={abilitiesUsedThisTurn}
      narrowChooserOpen={narrowChooserOpen}
      narrowCandidates={narrowChooserOpen ? buildNarrowCandidates() : []}
      onNarrowLure={addNarrowExclusion}
      onCancelNarrow={cancelNarrowChooser}
      buffetArmed={buffetArmed}
      onFeedAnimal={feedAnimalsWithLure}
      onDiscardTactic={discardActiveTactic}
      enemyAnnotation={enemy?.annotation || null}
      isWit={selectedCharacter?.lane === 'wit'}
      footnotePromptActive={footnotePromptActive}
      onApplyFootnote={applyFootnote}
      onCancelFootnote={cancelFootnotePrompt}
      lastCastSnapshot={lastCastSnapshot}
      arguingBackThisTurn={arguingBackThisTurn}
      holdOnArmed={holdOnArmed}
      holdOnValue={holdOnValue}
      pendingMissteps={pendingMissteps}
      combatTurn={combatTurn}
      pauseHeld={pauseHeld}
      pauseHeldActive={pauseHeldActive}
      wontShutUpArmed={wontShutUpArmed}
      staggerActive={staggerActive}
      notListeningCharges={notListeningCharges}
      weaveStacks={weaveStacks}
      riposteCharge={riposteCharge}
      braceArmedDraw={braceArmedDraw}
      log={log}
      onOpenCompendium={() => { setCompendiumOpen(true); logEvent(TE.COMPENDIUM_OPEN, { source: 'combat' }); }}
      onOpenDeckView={() => { setDeckViewOpen(true); logEvent(TE.DECKVIEW_OPEN, { source: 'combat' }); }}
    />
    <Compendium open={compendiumOpen} onClose={() => setCompendiumOpen(false)}
                hand={hand} deck={deck} discard={discard} exiled={exiled} tray={tray} />
    <DeckView open={deckViewOpen} onClose={() => setDeckViewOpen(false)}
              hand={hand} deck={deck} discard={discard} exiled={exiled} tray={tray} />
    <CardLossOverlay notice={cardLossNotice} onDismiss={() => setCardLossNotice(null)} lane={selectedCharacter?.lane || null} />
    {labRepeatPrompt && <LabRepeatPromptModal
      enemyName={labRepeatPrompt.enemyName}
      onYes={labRepeatYes} onNo={labRepeatNo} />}
    {tutorialActive && <TutorialOverlay
      step={tutorialStep}
      lane={tutorialLane}
      onAdvance={() => setTutorialStep(s => s + 1)}
      onExit={exitTutorial}
    />}
  </>;
  })();
  // v2.99.4: render the active stage content + universal overlays
  // (forget modal, chaos flash) as siblings. The overlays will appear
  // on top of any stage now, fixing the "forget modal pops over combat"
  // bug when an event grants a card AND requires forgetting one.
  return <>{stageContent}{appOverlays}</>;
}

// =============================================================================
// 4. SUB-SCREENS
// =============================================================================

function MenuScreen({ onStart, onTutorial, onContinue, onDiscardSave, onDevQuickStart, onCompendium }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="font-display text-6xl text-gold-300 tracking-widest text-center">Witch Mountain Bridge</h1>
      <p className="font-quill text-parchment-200 italic max-w-xl text-center">
        The school has taught you what it can. To graduate, you must walk the
        Path of Mastery — gather your staff, robes, gem, and ring, each from
        a trial worthier than the last.
      </p>
      <div className="flex flex-col gap-2 items-center">
        {onContinue && (
          <button onClick={onContinue} className="btn btn-iris text-lg px-8 py-3 animate-pulse">Continue Saved Run</button>
        )}
        <button onClick={onStart}    className="btn btn-gold text-lg px-8 py-3">{onContinue ? 'Begin a New Path (discards save)' : 'Begin the Path'}</button>
        {onCompendium && (
          <button onClick={onCompendium} className="btn bg-ink-700 hover:bg-ink-600 text-parchment-200 text-base px-6 py-2">📖 Compendium — browse cards & spells</button>
        )}
        {onDiscardSave && (
          <button onClick={onDiscardSave} className="text-xs text-parchment-500 italic hover:text-ember-300 mt-2">Discard saved run</button>
        )}
        {onDevQuickStart && (
          <button onClick={onDevQuickStart} className="text-xs text-parchment-500 italic hover:text-iris-300 mt-4 border-t border-ink-700 pt-3">🧪 Dev Quick-Start (pick lane + act)</button>
        )}
      </div>
      <p className="text-xs text-parchment-400">MVP 5 — verbal combat: words build spells, effects cast them.</p>
      <p className="text-[10px] text-parchment-500">
        Icons by Lorc, Delapouite, Skoll & Carl Olsen — <a href="https://game-icons.net" target="_blank" rel="noreferrer" className="underline hover:text-parchment-300">game-icons.net</a> (CC BY 3.0)
      </p>
    </div>
  );
}

function DevQuickStartScreen({ onStart, onBack }) {
  const [lane, setLane] = useState('handler');
  const [actIdx, setActIdx] = useState(0);
  const [dropAtBoss, setDropAtBoss] = useState(false);
  const lanes = [
    { id: 'wit',      name: 'Wit — The Scholar' },
    { id: 'handler', name: 'Handler — The Handler' },
    { id: 'jnsq',     name: 'Jnsq — The Fool' },
  ];
  const actLabels = ['Act 1 (start)', 'Act 2 (Thread Path)', 'Act 3 (Forge Path)', 'Final Act (Staff Path)'];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-2xl mx-auto">
      <h1 className="font-display text-4xl text-iris-300 tracking-widest text-center">🧪 Dev Quick-Start</h1>
      <p className="font-quill text-parchment-300 italic text-center">
        Jump to any act with a curated deck for that phase. Skips
        character-select, supply-shop, and familiar-name. Familiar
        defaults to Toad.
      </p>

      <div className="parchment-card-strong p-4 flex flex-col gap-4 w-full">
        <div>
          <div className="text-xs uppercase tracking-widest text-parchment-300 mb-2">Lane</div>
          <div className="flex flex-col gap-1.5">
            {lanes.map(l => (
              <button key={l.id} onClick={() => setLane(l.id)}
                className={`btn text-left ${lane === l.id ? 'btn-iris' : 'bg-ink-700 hover:bg-ink-600 text-parchment-200'}`}>
                {l.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-parchment-300 mb-2">Start at</div>
          <div className="flex flex-col gap-1.5">
            {actLabels.map((label, i) => (
              <button key={i} onClick={() => setActIdx(i)}
                className={`btn text-left ${actIdx === i ? 'btn-iris' : 'bg-ink-700 hover:bg-ink-600 text-parchment-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-parchment-200 cursor-pointer">
          <input type="checkbox" checked={dropAtBoss} onChange={e => setDropAtBoss(e.target.checked)} className="accent-iris-500" />
          Drop directly at the act's boss (skip map)
        </label>

        <div className="flex gap-2 mt-2">
          <button onClick={() => onStart(lane, actIdx, dropAtBoss)} className="btn btn-gold flex-1">
            ▶ Start
          </button>
          <button onClick={onBack} className="btn bg-ink-700 hover:bg-ink-600 text-parchment-200">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

// Tutorial overlay — fixed-position floating panel that walks the player
// through the verbal combat system. Step-gated content; step 1 and 2 wait
// on a specific player action (advanced by advanceTutorialStep); other
// steps advance via the Continue button.
function TutorialOverlay({ step, lane = 'wit', onAdvance, onExit }) {
  // Lane-flavored examples — same step structure, different signature
  // mechanic explainer at step 4.
  const laneName = lane === 'wit' ? 'Wit'
                 : lane === 'handler' ? 'Handler'
                 :                       'Je Ne Sais Quoi';
  const laneStat = lane === 'wit' ? '✨' : lane === 'handler' ? '🐾' : '🌀';
  // Lane-specific signature-mechanic explainer for the signature step.
  const signatureBody = lane === 'wit' ? (<>
        <p><b>🧵 Long Thread</b> — your defense engine. Every turn you cast a wit Effect AND take no unblocked HP damage, your thread grows by 1. While thread &gt; 0, incoming damage is reduced by <b>min(2, Thread)</b> per swing. The thread decays by 1 on an unblocked hit. Defend like your life depends on the build.</p>
        <p className="mt-2">Other wit-only tools you'll meet: <b>📖 Footnote</b> (attach +1 wit to a phrase permanently — sticks across casts), <b>🛑 Hold on, hold on —</b> (reactive skill: reduce the next enemy swing by your current Thread). Build patiently, finish big.</p>
      </>)
    : lane === 'handler' ? (<>
        <p><b>🪱 Lures &amp; 🐾 Animals</b> — your signature engine. You don't cast spells; you bait the woods. Play a <b>lure</b> card into one of the 3 stage slots. It ticks down for N turns, then transforms in place into the animal it summoned. The animal auto-attacks each turn until its duration expires.</p>
        <p className="mt-2"><b>Predator chains</b> — some animals are themselves bait. Leave a Salmon in its slot for 2 more turns and a Bear arrives. The "useless flopping fish" is actually a tier-2 setup move.</p>
        <p className="mt-2">Wait isn't waiting. Stage other lures in parallel slots, defend the active ones, and pick the moment.</p>
      </>)
    : (<>
        <p><b>🎲 Chaos Dice</b> — your signature gamble. After staging a full spell, the <b>🎲 ROLL?</b> toggle appears next to CAST. Toggle it ON to roll 1d6 on the cast:</p>
        <ul className="text-sm list-disc list-inside mt-1 leading-relaxed">
          <li><b>1 backfire</b> (0.5× dmg, -3 HP)</li>
          <li><b>2 spilled it</b> (1.0× dmg, discard 1 random hand card)</li>
          <li><b>3 half-baked</b> (0.75× dmg, +1 Energy)</li>
          <li><b>4 sticks</b> (1.0× dmg, draw 1)</li>
          <li><b>5 sings</b> (1.25× dmg, draw 1)</li>
          <li><b>6 COSMIC</b> (1.75× dmg, draw 2, +25% potency next cast)</li>
        </ul>
        <p className="mt-1 text-xs italic">Average outcome ≈ +4% damage on top of the spell. Statistically good over time, even with the 1-in-6 backfire. Cards like <i>"with loaded dice,"</i> (+1 to roll) and <i>"and the universe rolls a die,"</i> (forces a roll) shape the odds.</p>
        <p className="mt-2"><b>🌀 Tangent</b> — Skill cards like <i>"That reminds me,"</i> discard a random card from your draw pile and fire a random jnsq from your discard pile. Stack jnsq cards into discard so the chaos pool is rich.</p>
        <p className="mt-2">Other jnsq-only tools: <b>🤫 Awkward Pause</b> (hold the tray, double next cast), <b>🍺 Drunken Confidence</b> (Power — +50% damage but +2 incoming), <b>🌀 Stagger</b> (50% enemy miss chance).</p>
      </>);

  // v3.4.51 — wit tutorial is fully expanded so a single practice match
  // teaches the whole sentence-grammar + FFT + schools + buff system.
  // Other lanes still get a shorter shared structure (they need their
  // own treatment when those lanes are revisited).
  const witSteps = [
    {
      title: `Welcome — ${laneName} practice match.`,
      body: (<>
        <p>The Bursar has offered to spar with you. <i>Verbally</i>, of course — wizards prefer it that way. He's pulling his punches; you can't actually lose this match.</p>
        <p className="mt-2">Three card types: <b>Words</b> (intros / subjects / modifiers — stage into the Spell Tray) · <b>Effects</b> (targets — seal and cast the spell) · <b>Skills</b> (like Defend — do their thing immediately).</p>
        <p className="mt-2">Watch <b>HP</b> (❤), <b>Composure</b> (✨), <b>Block</b> (🛡), <b>Poise</b> (🪞), and <b>Energy</b> (⚡) at the bottom. Energy refills every turn — spend it on cards.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 1 — Play an INTRO word.',
      body: (<>
        <p>Look at your hand. <b>Word cards</b> have slot labels like INTRO, SUBJECT, or MODIFIER (top-left). They don't damage the enemy alone — they add stat points to your <b>Spell Tray</b> above the hand.</p>
        <p className="mt-2">Find a card labeled <b>INTRO</b> and play it. Watch the Tray fill the intro slot.</p>
      </>),
      cta: '(play an Intro card)',
      waitsForAction: true,
    },
    {
      title: 'Step 2 — Play a SUBJECT word.',
      body: (<>
        <p>Every spell needs three slots filled to cast: <b>intro + subject + target</b>.</p>
        <p className="mt-2">Many wit cards carry a small <b>row tag</b> (purple chip) — like <i>slowburn-4</i>. When all three staged cards share the same row tag, the cast becomes a <b>Fully Formed Thought</b> (FFT) and triggers a bonus rider on top of the cast.</p>
        <p className="mt-2">Find a card labeled <b>SUBJECT</b> in your hand and play it. Look at the row tag — your intro, subject, and (next step) target should all match.</p>
      </>),
      cta: '(play a Subject card)',
      waitsForAction: true,
    },
    {
      title: 'Step 3 — Stage a TARGET and CAST.',
      body: (<>
        <p>Both word slots are full. Now you need a <b>Target</b> card to seal and cast the spell.</p>
        <p className="mt-2">Click a <b>TARGET</b> card — it goes to the tray. The tray shows a <b>Predicted damage</b> number and a Math line showing where it comes from. Click the big <b>✨ CAST</b> button to fire.</p>
        <p className="mt-2">If all three staged cards share a row, the cast becomes a <b>Fully Formed Thought</b> and applies that row's rider effect — usually a damage-over-time stack or a special boon.</p>
      </>),
      cta: '(stage a Target, then click CAST)',
      waitsForAction: true,
    },
    {
      title: 'Step 4 — Fully Formed Thoughts and the three Schools.',
      body: (<>
        <p>You just cast a <b>Fully Formed Thought</b> — three cards from the same row landed together. The Bursar now has a <b>DoT counter</b> ticking down his Composure each turn (start with 3 / turn for 3 turns). DoTs are the lane's signature damage engine.</p>
        <p className="mt-2">There are three FFT <b>Schools</b>:</p>
        <ul className="list-disc list-inside text-sm mt-1 leading-relaxed">
          <li><b>🌡 Slow Burn</b> — stacking damage-over-time. Cast another Slow Burn FFT and the waves add together. <i>Your starter is here.</i></li>
          <li><b>🪞 Thorns</b> — counter-puncher. Casts route to player Block; reflect riders hurt the enemy when they attack.</li>
          <li><b>🎺 Crescendo</b> — Words Bank ticks composure damage each turn; spend the Bank on Crescendo cards for big spikes.</li>
        </ul>
        <p className="mt-2">You'll draft new rows from elite and boss combats (full 3-card bundles).</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 5 — Long Thread (your defense engine).',
      body: signatureBody,
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 6 — Resistances, defense, and pre-staging.',
      body: (<>
        <p><b>Effectiveness badges</b> next to the Intent show how the enemy reacts to each stat: <b>×1</b> baseline · <span className="text-moss-300">×1.5–2 susceptible</span> · <span className="text-ember-300">×0.5 resistant</span> · <span className="text-parchment-400">×0 immune</span>. Read it before you cast.</p>
        <p className="mt-2"><b>Defend</b> grants Block (🛡) — absorbs HP damage. <b>Compose Yourself</b> grants Poise (🪞) — absorbs composure damage. Both reset at start of YOUR next turn — spend them this turn or lose them.</p>
        <p className="mt-2"><b>Pre-staging cost:</b> staged cards <i>persist</i> across turns until you cast, but each one held over costs <b>1 Composure</b> per turn. Hold one card to set up cheap; hold three and bleed.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 7 — Buff cards you may draft.',
      body: (<>
        <p>Skill cards that extend, amplify, or set up your next cast. Most are no-ops without something active to amplify — and devastating with one. All exhaust.</p>
        <p className="mt-2 text-iris-200 font-bold">FFT setup:</p>
        <ul className="list-disc list-inside text-sm leading-relaxed">
          <li><b>The Tutor</b> (3E) — next time you stage an intro AND subject from the same row, the matching target is auto-pulled from deck/discard.</li>
          <li><b>You Know What I Meant</b> (2E) — your next half-formed (2-of-3) FFT counts as the full row.</li>
          <li><b>Myriad of Reasons</b> (2E) — pull a random intro AND subject from deck or discard.</li>
          <li><b>To the Rafters</b> (3E) — counts as a FFT of a random Crescendo spell in your hand or discard.</li>
        </ul>
        <p className="mt-2 text-iris-200 font-bold">DoT amplifiers:</p>
        <ul className="list-disc list-inside text-sm leading-relaxed">
          <li><b>And Another Thing</b> (2E) — +2 turns to your active enemy DoT.</li>
          <li><b>Hidden Meaning</b> (1E) — +2 damage to each remaining DoT tick.</li>
          <li><b>Blow to the Ego</b> (2E) — next offensive spell deals DOUBLE its DoT damage.</li>
        </ul>
        <p className="mt-2 text-iris-200 font-bold">Damage spikes:</p>
        <ul className="list-disc list-inside text-sm leading-relaxed">
          <li><b>Verbal Smack</b> (2E) — next offensive spell deals DOUBLE its initial composure damage.</li>
          <li><b>That Goes For All of You!</b> (2E) — next offensive spell hits every enemy (when multi-enemy lands).</li>
          <li><b>Solid Argument</b> (2E) — next offensive DoT also grants matching block-per-turn for you.</li>
        </ul>
        <p className="mt-2 text-iris-200 font-bold">Defense extenders:</p>
        <ul className="list-disc list-inside text-sm leading-relaxed">
          <li><b>I Already Thought of That</b> (2E) — extend your active Thorns aura by 2 turns.</li>
          <li><b>Enhanced Reasoning</b> (1E) — +2 reflect damage to each remaining Thorns aura tick.</li>
          <li><b>I Won't Hear of It</b> (2E) — next defensive spell DOUBLES its defensive-DoT amounts.</li>
        </ul>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 8 — Finish the match.',
      body: (<>
        <p>You've got the basics. Finish the Bursar at your leisure. Cards drift back into your deck via the discard pile; when your draw pile empties, the discard reshuffles in.</p>
        <p className="mt-2">After this match, you'll be returned to the wizard select. Choose a wizard and walk the path.</p>
      </>),
      cta: 'Got it — finish him',
      waitsForAction: false,
    },
  ];

  const otherLaneSteps = [
    {
      title: `Welcome — ${laneName} practice match.`,
      body: (<>
        <p>The Bursar has offered to spar with you. <i>Verbally</i>, of course — wizards prefer it that way. He's pulling his punches; you can't actually lose this match.</p>
        <p className="mt-2">Three things you'll need to know: <b>Words build spells</b>. <b>Effects (targets) cast them</b>. <b>Skills</b> (like Defend) do their thing immediately.</p>
        <p className="mt-2">Watch the <b>HP</b> (❤), <b>Composure</b> (✨), <b>Block</b> (🛡), <b>Poise</b> (🪞), and <b>Energy</b> (⚡) at the bottom of the screen. Energy refills every turn — spend it on cards.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 1 — Play an INTRO word.',
      body: (<>
        <p>Look at your hand. <b>Word cards</b> have slot labels like INTRO, SUBJECT, or MODIFIER (top-left). They don't damage the enemy alone — they add stat points to your <b>Spell Tray</b> above the hand.</p>
        <p className="mt-2">Find a card labeled <b>INTRO</b> and play it. Watch the Tray fill the intro slot.</p>
      </>),
      cta: '(play an Intro card)',
      waitsForAction: true,
    },
    {
      title: 'Step 2 — Now play a SUBJECT word.',
      body: (<>
        <p>Good — your sentence is starting. Every spell needs three slots filled to cast: <b>intro + subject + target</b>.</p>
        <p className="mt-2">Find a card labeled <b>SUBJECT</b> in your hand and play it. It adds another {laneStat} {laneName} point to the tray.</p>
      </>),
      cta: '(play a Subject card)',
      waitsForAction: true,
    },
    {
      title: 'Step 3 — Stage a TARGET and CAST.',
      body: (<>
        <p>Both word slots are full. Now you need a <b>Target</b> card to seal and cast the spell.</p>
        <p className="mt-2">Click a <b>TARGET</b> card — it goes to the tray. The tray shows a <b>Predicted damage</b> number and a Math line showing where it comes from. Click the big <b>✨ CAST</b> button to fire.</p>
        <p className="mt-2">You can also stage up to 2 optional modifiers for extra effects. Click a staged card to take it back.</p>
      </>),
      cta: '(stage a Target, then click CAST)',
      waitsForAction: true,
    },
    {
      title: 'Step 4 — Resistances, defense, and fizzling.',
      body: (<>
        <p>You drained some of the Bursar's <b>Composure</b> (the ✨ bar). Drain it to 0 and he concedes.</p>
        <p className="mt-2"><b>Effectiveness badges</b> next to the Intent show how the enemy reacts to each stat: <b>×1</b> baseline · <span className="text-moss-300">×1.5–2 susceptible</span> · <span className="text-ember-300">×0.5 resistant</span> · <span className="text-parchment-400">×0 immune</span>. Pick a wizard whose lane the enemy fears.</p>
        <p className="mt-2"><b>Defend</b> grants Block (🛡) — absorbs physical damage. <b>Compose Yourself</b> grants Poise (🪞) — absorbs composure damage. Block and Poise reset at start of YOUR next turn — spend them this turn or lose them.</p>
        <p className="mt-2"><b>Pre-staging cost:</b> staged cards <i>persist</i> into your next turn until you cast — but each card carried over costs <b>1 Composure</b> per turn. You're focusing on what you'll say next instead of paying attention to the enemy. Hold one card to set up next turn cheaply; hold three and bleed.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: `Step 5 — ${laneName}'s signature mechanic.`,
      body: signatureBody,
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 6 — Finish the match.',
      body: (<>
        <p>You've got the basics. Finish the Bursar at your leisure. Cards drift back into your deck via the discard pile; when your draw pile empties, the discard reshuffles in.</p>
        <p className="mt-2">After this match, you'll be returned to the wizard select. Choose a wizard for real and walk the path.</p>
      </>),
      cta: 'Got it — finish him',
      waitsForAction: false,
    },
  ];

  // Handler is mechanically nothing like wit/jnsq — no sentence grammar, no
  // casting. It bait-and-times animals onto the board. Its tutorial gets its
  // own dedicated flow: stage a lure → animals arrive & tick → feed the ones
  // about to leave → combines / tactics. Only one step is action-gated (stage
  // a lure); the rest advance on the Continue button because feeding requires
  // a 2-turn wait that can't be forced inside a scripted overlay.
  const handlerSteps = [
    {
      title: `Welcome — ${laneName} practice match.`,
      body: (<>
        <p>The Bursar has offered to spar with you. He's pulling his punches; you can't actually lose this match.</p>
        <p className="mt-2"><b>You don't cast spells — you bait the woods.</b> Play a <b>🪱 Lure</b> card into the <b>Summoning Pitch</b> (the 3 slots above your hand). It ticks down, then transforms into an <b>🐾 Animal</b> that fights for you every turn until it leaves.</p>
        <p className="mt-2">Watch <b>HP</b> (❤), <b>Composure</b> (✨), <b>Block</b> (🛡), and <b>Energy</b> (⚡) at the bottom. Energy refills every turn.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 1 — Stage a lure in the Summoning Pitch.',
      body: (<>
        <p>Look at your hand for a <b>🪱 Lure</b> card — <b>Fish Food</b>, <b>Birdseed</b>, or <b>Tender Greens</b>. Each one summons a different family of animal.</p>
        <p className="mt-2">Play one (or drag it onto an <i>available</i> slot in the Summoning Pitch). It won't do anything this turn — it's a countdown. That's the point: <b>wait is not waiting.</b></p>
      </>),
      cta: '(stage a Lure card)',
      waitsForAction: true,
    },
    {
      title: 'Step 2 — Arrival and the duration clock.',
      body: (<>
        <p>The lure now sits in its slot showing a <b>turns-to-arrive</b> countdown. At the end of your turns it ticks down; when it hits zero it <b>transforms in place</b> into its animal.</p>
        <p className="mt-2">Once an animal arrives it shows a <b>turns-left</b> counter and <b>auto-attacks at the end of each of your turns</b> until it expires. Stage more lures into the other two slots in parallel — a full pitch is three threats ticking at once.</p>
        <p className="mt-2"><b>🐻 Predator chains:</b> some animals are themselves bait. Leave a <b>🐟 Salmon</b> in its slot and a <b>🐻 Bear</b> arrives. The "useless flopping fish" is a tier-2 setup move.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 3 — Feeding & the exit bonus.',
      body: (<>
        <p>This is the Handler's signature decision. An animal on its <b>make-or-break turn</b> (one turn left before it leaves) shows a red <b>"feed now or no exit bonus"</b> badge and a feed slot.</p>
        <p className="mt-2"><b>Drag a 🌿 Tender Greens lure onto that feed slot</b> (matching the animal's food type) to feed it. Feeding does <i>not</i> extend its stay — it stamps the animal so that when it leaves, it pays out a powerful <b>exit bonus</b> (heal, block, a parting strike). Fed animals leave proud; unfed animals just wander off.</p>
        <p className="mt-2">Each animal eats its own food family: 🐭🐰🦌 small-land eat greens, 🐦🦅 birds eat seed, 🐟🐻 fish/bears eat fish food. You can only feed the animal that's actually about to leave — not the others.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 4 — Combines & pack tactics.',
      body: (<>
        <p><b>Three of a kind combine.</b> Get three of the same animal in the pitch and they merge into a powerhouse:</p>
        <ul className="list-disc list-inside text-sm mt-1 leading-relaxed">
          <li><b>🐭 3 Field Mice → Mouse House</b> — heavy hitter, heals 4 composure on exit.</li>
          <li><b>🐰 3 Rabbits → The Long Hare</b> — 8 dmg/turn, applies Weak, +5 block/turn.</li>
          <li><b>🦌 3 Young Bucks → McCloven</b> — 10 dmg/turn, +5 block/turn, heals 5 HP on exit.</li>
        </ul>
        <p className="mt-1"><b>Combines never need feeding</b> — they always stay their full duration and always pay their exit bonus.</p>
        <p className="mt-2"><b>🃏 Pack Tactics</b> — you start each run with one random tactic (Birds of a Feather, Fountain of Youth, Nurture…). It lives in its own tray slot and reshapes how your summons behave. <b>On Three!</b> commits all your active animals' attacks at once.</p>
      </>),
      cta: 'Continue',
      waitsForAction: false,
    },
    {
      title: 'Step 5 — Defense, and finish the match.',
      body: (<>
        <p>While the animals do the hurting, you stay standing. <b>Defend</b> grants Block (🛡) to absorb HP damage; <b>Steady</b> and other skills clear pressure. Block resets at the start of your next turn — spend it.</p>
        <p className="mt-2">Cards drift back into your deck via the discard pile; when your draw pile empties, the discard reshuffles in.</p>
        <p className="mt-2">Bait early, defend the slots, feed the leavers, and let the woods win it. Finish the Bursar at your leisure — then pick your wizard for real.</p>
      </>),
      cta: 'Got it — finish him',
      waitsForAction: false,
    },
  ];

  const STEPS = lane === 'wit' ? witSteps
              : lane === 'handler' ? handlerSteps
              : otherLaneSteps;
  const data = STEPS[Math.min(step, STEPS.length - 1)];
  if (step >= STEPS.length) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto parchment-card-strong border-2 border-iris-500 bg-ink-700 p-4 shadow-2xl">
        <div className="flex justify-between items-start mb-2">
          <div className="font-display text-lg text-iris-300">🎓 {data.title}</div>
          <button onClick={onExit} className="text-xs text-parchment-400 hover:text-parchment-200" title="Exit tutorial">✕ Exit</button>
        </div>
        <div className="text-sm font-quill text-parchment-100 space-y-1">{data.body}</div>
        <div className="mt-3 flex justify-end">
          {data.waitsForAction
            ? <span className="text-xs italic text-iris-300">{data.cta}</span>
            : <button onClick={onAdvance} className="btn btn-iris text-sm">{data.cta}</button>
          }
        </div>
      </div>
    </div>
  );
}

// Played after the player drains the Bursar's Composure to 0.
function TutorialCompleteScreen({ onStart, onMenu }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-2xl mx-auto">
      <h2 className="font-display text-5xl text-gold-300 tracking-widest text-center">Practice Match Won</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">
        The Bursar inclines his head. "Reasonable," he says. "Mostly. We'll
        see if it holds up in the field." He goes back to his ledger.
      </p>
      <div className="parchment-card-strong p-4 w-full">
        <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">What you just learned</div>
        <ul className="text-sm font-quill text-parchment-100 space-y-1 list-disc list-inside">
          <li><b>Word cards</b> add stat points + themes to the Spell Tray.</li>
          <li><b>Effect cards</b> cast a spell scaling off one stat — damage = (base + stat × multiplier) × effectiveness.</li>
          <li><b>Themes ✦</b> — match an Effect's resonance with words in your tray for a flat bonus per match. Build a "lawyer deck", a "drunkard deck", a "bully deck" — the LLM is in your corner.</li>
          <li>Enemies have per-stat resistance / susceptibility / immunity. Check the badges.</li>
          <li>Play words without an Effect → spell <b>fizzles</b> at end of turn.</li>
          <li>Most enemies are physical-immune by default; a few aren't (Spark / Magic Missile / Sword Logic).</li>
          <li>Block still works. Defend still defends.</li>
        </ul>
      </div>
      <div className="flex gap-2">
        <button onClick={onStart} className="btn btn-gold text-lg px-8 py-3">Begin the Path</button>
        <button onClick={onMenu}  className="btn btn-ink  px-6 py-3">Back to Menu</button>
      </div>
    </div>
  );
}

// ---- CHARACTER SELECT ----

// v2.54: per-character tutorial content rewritten for the
// conv-mechanics arc (v2.24-v2.53). Each lane teaches its NEW
// signature mechanics — Rage / Long Thread / Tangent — plus the
// 6-8 supporting primitives that landed across the 30 cycles.
// Surfaced under the character cards on the selection screen.
const WIZARD_TUTORIALS = {
  wit: {
    color: 'iris',
    icon: '🧵',
    title: 'The Wit Playstyle',
    subtitle: 'Build the thread. Defend the thread with itself.',
    overview: 'Wit wins by NOT taking unblocked hits. Every clean turn fattens the Long Thread, and every wit Effect card scales off it. You footnote your favorite phrases until they\'re crushing, you interrupt the fight to protect the argument you\'re still building, and you finish with a single in-summary capstone that quotes everything you\'ve already said. You are an unkindly correct librarian who refuses to be interrupted.',
    sections: [
      {
        heading: '🧵 LONG THREAD (the signature)',
        body: 'A persistent meter shown as 🧵 in your stat block (below the hand). Tick +1 at end of every turn where you cast a wit Effect AND took zero unblocked damage. Take ANY unblocked hit and it resets to zero. Wit Effect cards then read "+N per Long Thread" — at 3+ Thread your big casts are huge. The whole lane is about defending this number with your life.',
        examples: [
          { name: 'as I was saying,', text: 'Cheap intro. Adds +1 wit per Long Thread to this cast.' },
          { name: 'is, perhaps, the natural conclusion.', text: 'Mid-tier target. Final damage scales with current Thread.' },
        ],
      },
      {
        heading: '📌 FOOTNOTE — pin a phrase',
        body: 'A Skill card. Pick any Word in your hand or discard and stamp a permanent +1 wit footnote on it for the rest of combat. Stacks — the same phrase can be footnoted three or four times until it\'s a sledgehammer. Choose the word you plan to keep re-saying.',
        examples: [
          { name: 'As Hewn-Greaves notes in his footnotes,', text: 'The Footnote skill. Pick the word, mark it forever.' },
          { name: 'On reflection,', text: 'Self-footnotes itself — a phrase that gets sharper every reread.' },
        ],
      },
      {
        heading: '🗣 "ACTUALLY—" and HOLD ON —',
        body: 'Two conversational moves. Actually— re-fires your last cast at +50% scaling, but stacks an "arguing back" debuff that adds damage to enemy attacks until your turn ends. Hold On — plays REACTIVELY during the enemy intent reveal and reduces the incoming hit by your Long Thread. The Thread that\'s about to be broken protects itself.',
        examples: [
          { name: 'Actually—', text: 'Re-fire last cast +50%. Enemies hit harder this turn. Worth it on a kill.' },
          { name: 'Hold on, hold on —', text: 'Reactive interrupt. Negates X damage where X = your Long Thread.' },
        ],
      },
      {
        heading: '⏳ OPENING STATEMENT',
        body: 'Tempo tool. Opening Statement gives you turn-1 scaling on the first wit Effect you cast — and "to revisit my opening point," brings the bonus back later in combat. Wit rewards CHOOSING when to speak, not speaking constantly.',
      },
      {
        heading: '⚠ SAYING SOMETHING WRONG',
        body: 'High-scaling wit Effects queue a "Misstep" token that auto-plays from your hand 2 turns later — 3 damage to you, exhausts. Pay 1 energy on it the turn it lands to scrub it. The big cast is real damage NOW; the cost lands when you\'ve hopefully won.',
      },
      {
        heading: '🏛 CAPSTONE — "in summary,"',
        body: 'The synergy target "is, in summary, the inescapable conclusion." reads the WHOLE turn back: Long Thread scaling + opening-statement bonus + a delayed Misstep on the back end. Three of the lane\'s mechanics converge in one line. Build the engine, then say it.',
      },
      {
        heading: 'Your job, in one line',
        body: 'Block everything. Stack the Thread. Footnote your best Word. When the Thread is fat and you have an opening callback ready, fire the in-summary capstone and accept the Misstep.',
      },
    ],
  },
  handler: {
    color: 'moss',
    icon: '🐾',
    title: 'The Handler Playstyle',
    subtitle: 'Bait the woods. Let the woods do the work.',
    overview: "The Handler wins by NOT fighting personally. You stage lures (food, bait), the lures attract animals over time, and the animals fight for you. Feed the ones about to leave to claim their exit bonus, line up three of a kind to combine them into a powerhouse, and let patience pay in bears. You are the Pratchett menagerie-keeper who knows a guy with a goose.",
    sections: [
      {
        heading: '🪱 LURES → 🐾 ANIMALS (the signature)',
        body: 'You play lure cards into one of the 3 Summoning Pitch slots. The lure ticks down for N turns, then transforms in place into the animal it summons. The animal auto-attacks at the end of each of your turns until its duration expires. Stage multiple lures into the other slots in parallel — a full pitch is three threats ticking at once.',
        examples: [
          { name: 'Birdseed (1E)', text: '1-turn wait → 🐦 Sparrow. Feeds: birds.' },
          { name: 'Tender Greens (1E)', text: '1-turn wait → 🐭 Field Mouse, 🐰 Rabbit, or 🦌 Young Buck. Feeds: small-land animals.' },
        ],
      },
      {
        heading: '🌿 FEEDING & THE EXIT BONUS',
        body: "An animal on its make-or-break turn (one turn left) flags a red \"feed now or no exit bonus\" badge and a feed slot. Drag a matching food lure onto it to feed it. Feeding does NOT extend the animal's stay — it stamps the animal so that when it leaves it pays out a powerful exit bonus (heal, block, a parting strike). Each animal eats its own family: small-land eat greens, birds eat seed, fish/bears eat fish food. You can only feed the animal that's actually about to leave.",
        examples: [
          { name: 'Fed Young Buck', text: 'Leaves on schedule but pays its exit bonus: heal 1 HP. Unfed, it just wanders off.' },
        ],
      },
      {
        heading: '🐻 PREDATOR CHAINS — bait the bait',
        body: "Some animals are themselves lures. Fish Food summons a Salmon — a weak, flopping fish. But leave the Salmon in its slot and a BEAR arrives. The bait-the-bait pattern is the Handler's depth: the 'useless' early animal is actually a tier-2 setup move.",
        examples: [
          { name: 'Fish Food → 🐟 Salmon → 🐻 Bear', text: 'The keystone chain. Salmon flops. Bear hunts the flopper.' },
        ],
      },
      {
        heading: '🤝 COMBINES — three of a kind',
        body: 'Get three of the same animal in the pitch and they merge into a powerhouse. Combines never need feeding — they always stay their full duration and always pay their exit bonus. 3 Field Mice → Mouse House (heals 4 comp on exit) · 3 Rabbits → The Long Hare (8 dmg/turn, Weak, +5 block) · 3 Young Bucks → McCloven (10 dmg/turn, +5 block, heals 5 HP on exit).',
      },
      {
        heading: '🃏 PACK TACTICS',
        body: 'You start each run with one random pack tactic in its own tray slot — Birds of a Feather, Fountain of Youth, Nurture, and more — each reshaping how your summons behave. On Three! commits all your active animals\' attacks at once. While the animals do the hurting, you stay standing with Defend (🛡 Block) and clear pressure with skills.',
      },
      {
        heading: 'Your job, in one line',
        body: 'Bait early, defend the slots, feed the leavers, line up three of a kind, and let the woods win it.',
      },
    ],
  },
  jnsq: {
    color: 'moss',
    icon: '🌀',
    title: 'The Jnsq Playstyle',
    subtitle: 'Commit to the detour. The detour pays.',
    overview: 'Jnsq wins by leaning into chaos with AGENCY: you decide WHEN to spin, the universe decides what spills out. You stack jnsq cards in your discard so Tangent can fish from a richer pool. You install Drunken Confidence to scale everything +50% at the cost of taking +2 from every hit. You apologize when you over-commit and restart clean. You are Kramer entering every room sideways with a half-finished thought.',
    sections: [
      {
        heading: '🌀 TANGENT (the signature)',
        body: 'A Skill card. On play: discard a random card from your draw pile, then fire a random Jnsq card from your DISCARD pile this turn — costs 0 energy, resolves normally. AGENCY is the trick: you choose WHEN to take the detour, but not what surfaces. Stack jnsq into discard before you fire it.',
        examples: [
          { name: 'That reminds me,', text: 'The Tangent skill. Discard one, fire one jnsq from discard.' },
          { name: 'speaking of which,', text: 'Modifier — the same detour, mid-spell.' },
        ],
      },
      {
        heading: '🙇 THE APOLOGY — reset valve',
        body: 'When you\'ve over-committed and the tray is going sideways, an Apology clears it: discard the spell tray, heal 4 HP, apply +1 Vulnerable to the enemy. The trade is offense-for-survival, plus a debuff for the enemy. Use it when the carry-over cost (1 Composure per staged card) outweighs the value of the staged setup.',
        examples: [
          { name: "I shouldn't have said that — have you eaten?", text: 'The Apology skill — clear, heal, vuln.' },
          { name: 'sorry, restarting,', text: 'Cheaper apology intro — opens a clean tray.' },
        ],
      },
      {
        heading: '🗨 WON\'T SHUT UP — commitment chain',
        body: 'Powerful jnsq Effects carry `mustPlayAnotherJnsq`. Cast one, and if you don\'t follow up with a SECOND jnsq this turn, you eat 3 damage at end of turn. The card is great, but only if your deck can chain. Build the jnsq pool before you cast.',
        examples: [
          { name: 'the soup, you see, was never the point.', text: 'Big payload. Commit-or-bleed clause attached.' },
        ],
      },
      {
        heading: '🥃 DRUNKEN CONFIDENCE (Power)',
        body: 'A Power that scales ALL your Effect cards +50%, at the cost of +2 incoming damage from every enemy attack. Discardable for free if it stops being worth it. Turn-by-turn judgment: when the enemy isn\'t hitting hard, the +50% is free money.',
      },
      {
        heading: '⏸ AWKWARD PAUSE & BABBLING',
        body: 'Two tempo levers borrowed from the gambler\'s mindset. Awkward Pause skips a casting turn — but the spell tray persists into next turn at DOUBLED stat values. Babbling (Power) gives you a 60% chance of a SECOND cast each turn. Both reward jnsq-heavy decks that don\'t mind variance.',
        examples: [
          { name: '"...go on, I\'m listening."', text: 'Awkward Pause skill — hold the tray, double next turn.' },
          { name: '"Wait — and another thing,"', text: 'Babbling power — installs the 60%-chance second cast.' },
        ],
      },
      {
        heading: '🌫 DRUNKEN STAGGER — chaotic defense',
        body: 'A Skill that grants a one-turn 50% miss chance on enemy attacks. Your defense is "the enemy whiffed." Pairs perfectly with Drunken Confidence — the +2 damage tax matters less when half the hits don\'t land.',
        examples: [
          { name: 'sorry, I lost my balance for a second,', text: 'Drunken Stagger — coin-flip incoming attacks this turn.' },
          { name: 'in the dimmest possible terms,', text: 'Modifier — works under the stagger to keep the cast affordable.' },
        ],
      },
      {
        heading: '🌌 CAPSTONE — "the universe went sideways."',
        body: 'The synergy target "and then the entire universe — and I mean THIS universe — went sideways." combines tangent-on-cast, per-tag jnsq bonus, AND the must-play-another-jnsq clause. Three mechanics, one line. Pair with "oh — actually, three things, sorry," for the extra chain piece.',
      },
      {
        heading: 'Your job, in one line',
        body: 'Stuff jnsq into discard. Install Drunken Confidence. Fire Tangents when the discard is fat. Apologize when the tray spirals. End on the universe-sideways capstone with a follow-up ready.',
      },
    ],
  },
};

// v3.4.7 — Wit-only starter row picker.
// v3.4.15 (Alan): trimmed from 15 rows to 3 entry rows — one per school.
// FFT rows are now earned: elites grant a T1 row, bosses grant a T2 row.
// The starter pick is just "which school do I want to build around?",
// not a full row-shopping menu.
const WIT_STARTER_ROW_IDS = ['slowburn-4', 'thorns-1', 'crescendo-1'];
function WitRowSelectScreen({ onPick }) {
  const TIER_NAMES = { slowburn: 'Slow Burn', thorns: 'Thorns', crescendo: 'Crescendo' };
  const TIER_ICONS = { slowburn: '🔥', thorns: '🌹', crescendo: '📚' };
  const TIER_FLAVOR = {
    slowburn: 'DoT-school. Stack composure damage over many turns; finish with a multiply or detonate.',
    thorns: 'Reflect-school. Each enemy hit answers itself; arm charges to redirect their attacks.',
    crescendo: 'Buildup-school. Every card you play banks a word. Finishers spend the bank for big payoff.',
  };
  const entryRows = WIT_STARTER_ROW_IDS
    .map(id => WIT_ROWS.find(r => r.id === id))
    .filter(Boolean);
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-4 max-w-6xl mx-auto">
      <h2 className="font-display text-4xl text-iris-300 tracking-widest text-center">Choose Your Starter Spell</h2>
      <p className="font-quill italic text-parchment-300 text-center max-w-3xl">
        Pick the school you want to build around. The row's three cards enter your deck at Tier 1.
        Elites drop new full rows; bosses drop them upgraded. Inns let you bump a row's tier.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        {entryRows.map(row => (
          <button key={row.id} onClick={() => onPick(row.id)}
                  className="parchment-card p-4 text-left hover:scale-[1.02] hover:shadow-2xl transition cursor-pointer flex flex-col gap-2">
            <div className="text-center">
              <div className="font-display text-2xl text-parchment-100">{TIER_ICONS[row.schoolId]} {TIER_NAMES[row.schoolId]}</div>
              <div className="text-[11px] italic text-parchment-300 leading-snug mt-1">{TIER_FLAVOR[row.schoolId]}</div>
            </div>
            <div className="border-t border-ink-400 pt-2">
              <div className="font-display text-lg text-iris-200">{row.name}</div>
              <div className="text-[13px] italic text-parchment-100 leading-snug mt-1">"{row.canonical}"</div>
              <div className="text-[12px] text-gold-300 mt-2 font-bold">★ {row.riderDesc || '(rider)'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BossFftUpgradeScreen({ choice, onPick, onSkip }) {
  if (!choice) return null;
  const rows = choice.rows || [];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 max-w-3xl mx-auto">
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-gold-300 font-display">👑 Boss reward</div>
        <h1 className="text-3xl font-display text-iris-200 mt-1">Upgrade an FFT row</h1>
        <p className="text-sm text-parchment-300 mt-2">All 3 cards in the chosen row gain their tier-2 stats. Skip to take no upgrade.</p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        {rows.map(row => (
          <button key={row.id}
            onClick={() => onPick(row.id)}
            className="parchment-card-strong p-4 text-left hover:border-iris-400 border-2 border-transparent transition-colors">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-display text-lg text-iris-200">{row.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-parchment-400">
                {row.schoolId}
              </div>
            </div>
            {row.canonical && (
              <div className="text-sm font-quill italic text-parchment-300 mt-1">"{row.canonical}"</div>
            )}
            {row.riderDesc && (
              <div className="text-xs text-parchment-300 mt-2">
                <span className="text-iris-300 uppercase tracking-wider">Rider:</span> {row.riderDesc}
              </div>
            )}
          </button>
        ))}
      </div>
      <button onClick={onSkip}
        className="text-xs text-parchment-400 hover:text-parchment-200 uppercase tracking-widest mt-2">
        Skip (no upgrade)
      </button>
    </div>
  );
}

function CharacterSelectScreen({ characters, onSelect, onPractice, onLab }) {
  const [tutorialLane, setTutorialLane] = useState(null);
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-6 max-w-6xl mx-auto">
      <h2 className="font-display text-5xl text-gold-300 tracking-widest text-center">Choose Your Wizard</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-2xl">
        The school taught you words. The graduation requires that you commit
        to one voice and walk the path with it. The path is the same path.
        The voice changes everything.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4 w-full">
        {characters.map(c => {
          const tut = WIZARD_TUTORIALS[c.lane];
          // Static class strings per lane so Tailwind's purge keeps them.
          const tutBtnClass = c.lane === 'wit'      ? 'border-iris-500 bg-iris-900 text-iris-200 hover:bg-iris-800'
                            : c.lane === 'handler' ? 'border-ember-500 bg-ember-900 text-ember-200 hover:bg-ember-800'
                            :                         'border-moss-500 bg-moss-900 text-moss-200 hover:bg-moss-800';
          return (
            <div key={c.id}
              className="flex flex-col gap-3 p-6 bg-ink-700 border-2 border-ink-500 rounded-lg shadow-lg">
              {/* Bitmap portrait slot — appears once /art/characters/<lane>.png
                  exists (see design/ART_PROMPTS.md); hidden until then. */}
              <ArtSlot src={`/art/characters/${c.lane}.png`} alt={c.name}
                       className="w-full aspect-[4/3] rounded-md border-2 border-gold-600 object-cover" />
              <div className="text-xs uppercase tracking-widest text-gold-500">{c.lane === 'jnsq' ? 'Je Ne Sais Quoi' : c.lane}</div>
              <h3 className="font-display text-3xl text-gold-300">{c.name}</h3>
              <div className="text-sm italic text-parchment-200">{c.title}</div>
              <p className="font-quill text-parchment-100 leading-relaxed text-sm">{c.desc}</p>
              <div className="flex flex-wrap gap-1 mt-auto pt-3 border-t border-ink-500">
                {c.tagPalette.map(t => (
                  <span key={t} className="text-[10px] uppercase tracking-wide bg-ink-600 text-parchment-300 px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => onSelect(c.id)}
                  className="flex-1 btn btn-gold text-sm py-2">
                  Choose
                </button>
                {onPractice && (
                  <button onClick={() => onPractice(c.lane)}
                    className={`text-sm py-2 px-3 border-2 rounded ${tutBtnClass}`}
                    title={`Run a practice match as the ${c.lane} wizard — teaches the symbols, spell-tray, and lane signature.`}>
                    ⚔ Practice
                  </button>
                )}
                {tut && (
                  <button onClick={() => setTutorialLane(c.lane)}
                    className={`text-xs py-2 px-2 border-2 rounded ${tutBtnClass}`}
                    title={`Read a summary of the ${c.lane} playstyle.`}>
                    📖 Read
                  </button>
                )}
                {onLab && (
                  <button onClick={() => onLab(c.id)}
                    className="text-xs py-2 px-2 border-2 rounded border-gold-500 bg-ink-800 text-gold-300 hover:bg-ink-700"
                    title="Lab Mode: standard starter + custom additions, pick any enemy, repeat until you say stop.">
                    🧪 Lab
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="font-quill italic text-stone-400 text-xs text-center max-w-2xl mt-4">
        Each character has a unique combat mechanic. Click <b>How to play</b> for a walkthrough before committing.
      </p>
      {tutorialLane && (
        <WizardTutorialModal lane={tutorialLane} onClose={() => setTutorialLane(null)} />
      )}
    </div>
  );
}

function WizardTutorialModal({ lane, onClose }) {
  const tut = WIZARD_TUTORIALS[lane];
  if (!tut) return null;
  // Static class literals per lane so Tailwind's purge keeps them.
  const c = lane === 'wit'      ? { border: 'border-iris-500',  bg: 'bg-iris-900',   accent: 'text-iris-300' }
          : lane === 'handler' ? { border: 'border-ember-500', bg: 'bg-ember-900',  accent: 'text-ember-300' }
          :                       { border: 'border-moss-500',  bg: 'bg-moss-900',   accent: 'text-moss-300' };
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`parchment-card-strong p-6 max-w-3xl w-full flex flex-col gap-4 border-2 ${c.border} my-4`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`text-xs uppercase tracking-widest ${c.accent}`}>{tut.icon} How to play</div>
            <h3 className={`font-display text-3xl ${c.accent}`}>{tut.title}</h3>
            <p className="font-quill italic text-parchment-300 text-base">{tut.subtitle}</p>
          </div>
          <button onClick={onClose} className="btn bg-ink-700 text-parchment-200 text-sm px-3 py-1">Close</button>
        </div>
        <p className="font-quill text-parchment-100 leading-relaxed text-base">{tut.overview}</p>
        <div className="flex flex-col gap-3">
          {tut.sections.map((s, i) => (
            <div key={i} className={`p-3 rounded border ${c.border} ${c.bg} bg-opacity-30`}>
              <div className={`font-display text-lg ${c.accent}`}>{s.heading}</div>
              <p className="text-sm font-quill text-parchment-100 leading-relaxed mt-1">{s.body}</p>
              {s.examples && s.examples.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {s.examples.map((ex, j) => (
                    <li key={j} className="text-xs text-parchment-200">
                      <span className={`font-bold ${c.accent}`}>{ex.name}</span>
                      <span className="text-parchment-300"> — {ex.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-2">
          <button onClick={onClose} className="btn btn-gold text-base px-8 py-2">Got it</button>
        </div>
      </div>
    </div>
  );
}

function SupplyShopScreen({ offers, onPick, character }) {
  if (!offers) return null;
  const { card, relic, boon } = offers;
  const laneColor = character?.lane === 'wit' ? 'text-iris-300'
                  : character?.lane === 'handler' ? 'text-ember-300'
                  : 'text-moss-300';
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-5 max-w-5xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300">The Supply Shop</h2>
      {character && (
        <div className="text-sm text-gold-500 italic">
          For: <span className={laneColor}>{character.name}</span> · {character.lane}
        </div>
      )}
      <p className="font-quill italic text-parchment-200 text-center max-w-2xl">
        The proprietor lays out three things on the long table. "On the
        house," he says, with the conviction of a man who has watched many
        apprentices die. "<i>One</i>. Pick well."
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        {/* --- CARD OFFER --- */}
        {card && (
          <button onClick={() => onPick('card')}
            className="w-64 min-h-[320px] rounded-lg border-2 p-4 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 border-iris-500 hover:scale-105 hover:shadow-2xl cursor-pointer transition">
            <div className="text-[10px] uppercase tracking-widest text-iris-700 font-bold">📜 Card · Uncommon</div>
            <div className="flex justify-between items-center">
              <div className="font-display text-lg leading-tight">{card.name || card.phrase || ''}</div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">{card.cost}</div>
            </div>
            <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">
              {(card.slot || card.type)}{card.tier ? ` · T${card.tier}` : ''}
            </div>
            {card.stats && (card.stats.handler || card.stats.wit || card.stats.jnsq) && (
              <div className="flex gap-1 flex-wrap text-xs font-mono">
                {card.stats.handler ? <span className="px-1.5 py-0.5 rounded bg-ember-100 text-ember-800">💪 {card.stats.handler}</span> : null}
                {card.stats.wit      ? <span className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800">✨ {card.stats.wit}</span> : null}
                {card.stats.jnsq     ? <span className="px-1.5 py-0.5 rounded bg-moss-100 text-moss-800">🌀 {card.stats.jnsq}</span> : null}
              </div>
            )}
            {(card.slot === 'target' || card.type === 'effect') && card.effect && (
              <div className="text-xs font-mono text-ink-700">
                {card.effect.base} + {(card.effect.scaleBy || card.lane || 'wit').toUpperCase()}×{card.effect.multiplier}
              </div>
            )}
            {card.tags && card.tags.length > 0 && (
              <div className="text-[11px] italic text-ink-500">✦ {card.tags.join(' · ')}</div>
            )}
            <div className="text-xs font-quill">{card.desc || ''}</div>
            {card.flavor && (
              <div className="text-[11px] italic opacity-70 mt-auto pt-1 border-t border-ink-300">"{card.flavor}"</div>
            )}
            <div className="text-[10px] italic text-iris-700 mt-1">Joins your deck.</div>
          </button>
        )}
        {/* --- RELIC OFFER --- */}
        {relic && (
          <button onClick={() => onPick('relic')}
            className="w-64 min-h-[320px] rounded-lg border-2 p-4 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl cursor-pointer transition">
            <div className="text-[10px] uppercase tracking-widest text-gold-700 font-bold">💎 Relic · Common</div>
            <div className="font-display text-lg leading-tight">{relic.name}</div>
            <div className="text-xs font-quill">{relic.desc}</div>
            {relic.flavor && (
              <div className="text-[11px] italic opacity-70 mt-auto pt-1 border-t border-ink-300">"{relic.flavor}"</div>
            )}
            <div className="text-[10px] italic text-gold-700 mt-1">Passive — lasts the whole run.</div>
          </button>
        )}
        {/* --- BOON OFFER --- */}
        {boon && (
          <button onClick={() => onPick('boon')}
            className="w-64 min-h-[320px] rounded-lg border-2 p-4 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 border-moss-500 hover:scale-105 hover:shadow-2xl cursor-pointer transition">
            <div className="text-[10px] uppercase tracking-widest text-moss-700 font-bold">✨ Boon · Permanent</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl">{boon.icon}</div>
              <div className="font-display text-lg leading-tight">{boon.name}</div>
            </div>
            <div className="text-xs font-quill">{boon.desc}</div>
            <div className="text-[10px] italic text-moss-700 mt-auto">Applied immediately and forever.</div>
          </button>
        )}
      </div>
    </div>
  );
}

function FamiliarShopScreen({ onPick }) {
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-5 max-w-6xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300">The Familiar Shop</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-2xl">
        A narrow shop with a low door, smelling of straw and disagreement. Ten
        creatures occupy ten various surfaces. The proprietor is asleep, or
        pretending to be. Either way, the cat is in charge.
      </p>
      <p className="text-sm text-gold-300">Pick one familiar. (You can name it next.)</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
        {FAMILIARS.map(fam => (
          <button key={fam.id} onClick={() => onPick(fam.id)}
            className="rounded-lg border-2 border-ink-500 bg-ink-700 hover:border-gold-500 hover:bg-ink-600 transition p-3 text-left flex flex-col gap-2 cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-3xl leading-none">{fam.emoji}</span>
              <div className="font-display text-lg text-gold-300">{fam.species}</div>
            </div>
            <div className="text-xs text-parchment-200">{fam.desc}</div>
            <div className="text-[11px] italic text-parchment-400">"{fam.flavor}"</div>
            <div className="mt-1 pt-2 border-t border-ink-500">
              <div className="text-[10px] uppercase tracking-widest text-gold-400">Signature card</div>
              <div className="text-xs"><b className="text-parchment-50">{fam.card.name}</b> <span className="text-parchment-300">({fam.card.cost}⚡) — {fam.card.desc}</span></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FamiliarNameScreen({ familiar, onConfirm }) {
  const [name, setName] = useState('');
  if (!familiar) return null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-md mx-auto">
      <h2 className="font-display text-4xl text-gold-300">A Naming</h2>
      <div className="text-7xl">{familiar.emoji}</div>
      <p className="font-quill italic text-parchment-200 text-center">
        Your {familiar.species.toLowerCase()} looks at you with an expression that
        is either expectant or hungry, or possibly both at once. A name would
        help with the paperwork.
      </p>
      <input
        type="text" value={name} onChange={e => setName(e.target.value)}
        placeholder={`(default: ${familiar.species})`}
        maxLength={24}
        className="w-full px-3 py-2 rounded-md bg-parchment-50 text-ink-800 border-2 border-gold-500 font-quill text-lg"
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') onConfirm(name); }}
      />
      <div className="flex gap-2 w-full">
        <button onClick={() => onConfirm(name)} className="btn btn-gold flex-1">Confirm</button>
        <button onClick={() => onConfirm('')} className="btn btn-ink flex-1">Use "{familiar.species}"</button>
      </div>
    </div>
  );
}

function MapScreen({ map, act, actIdx, totalActs, currentNodeId, clearedNodes, reachable, player, onPick, log, mapFog }) {
  // Scroll the player's current node into the middle of the viewport
  // whenever this screen mounts or the position changes. Otherwise the
  // page lands at the top of the act and the player has to manually
  // scroll down to find themselves after every combat/event.
  // On row 0 (act start, before any pick) there's no current node — we
  // fall back to scrolling to the top.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!currentNodeId) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    // requestAnimationFrame so the SVG has actually painted by the time
    // we query it. Without this the lookup runs before the SVG mounts.
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-node-id="${currentNodeId}"]`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [currentNodeId]);

  if (!map || !act) return null;
  // Map viewBox: ~90 viewBox-units between rows so nodes (r=18) have a
  // generous gap that survives CSS scaling. W bumped to 900 so the
  // aspect ratio stays workable (taller maps stretched too vertically
  // at W=600).
  const W = 900, padding = 40;
  const rows = act.rows;
  const cols = act.width;
  const ROW_SPACING = 90;
  const H = padding * 2 + Math.max(1, rows - 1) * ROW_SPACING;
  const xScale = (x) => padding + (x * (W - 2 * padding)) / cols;
  const yScale = (y) => padding + (y * (H - 2 * padding)) / (rows - 1);

  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-6xl mx-auto">
      {/* Sticky top HUD — scroll-to-current jumps you below the fold;
          this keeps HP/Composure visible regardless of scroll position. */}
      <div className="sticky top-0 z-10 flex justify-between items-center parchment-card px-4 py-2 shadow-lg">
        <div>
          <h1 className="font-display text-xl text-gold-300">{act.name}</h1>
          <div className="text-[10px] uppercase text-parchment-400 tracking-widest">Act {actIdx + 1} of {totalActs} · prize: master {SLOT_LABEL[act.slot]}</div>
        </div>
        <div className="text-sm flex gap-3 items-center">
          {player.familiar && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-ink-600 border border-ink-400 text-xs"
                  title={player.familiar.desc}>
              <span className="text-base leading-none">{player.familiar.emoji}</span>
              <span className="text-gold-300">{player.familiarName || player.familiar.species}</span>
            </span>
          )}
          <span className="font-mono text-moss-300" title="HP — your physical health. Drops to 0 and you fail.">
            ❤ {player.hp}<span className="text-parchment-400 text-xs"> / {player.maxHp}</span>
          </span>
          {player.composureMax != null && (
            <span className="font-mono text-iris-200" title="Composure — your nerve. Drops to 0 and you fail by losing your nerve.">
              🎭 {player.composure}<span className="text-parchment-400 text-xs"> / {player.composureMax}</span>
            </span>
          )}
          <span className="text-xs text-parchment-300">📜 {player.deckSize}</span>
          <span className="text-xs text-parchment-300">⚜ {player.equipment.length}</span>
        </div>
      </div>

      <div className="parchment-card p-4 flex flex-col items-center">
        {(() => {
          // Fog-of-war visibility per node:
          //   cleared : in clearedNodes — path you've already walked
          //   current : your current spot
          //   next    : directly reachable from current — clickable
          //   visible : everything else, shown fully (STS-style — no fog)
          // The player sees the entire act up front and can plan a route
          // around the material/skill nodes they want.
          const reachableSet = new Set(reachable);
          const clearedSet = new Set(clearedNodes);
          const visibilityOf = (nodeId) => {
            if (clearedSet.has(nodeId))   return 'cleared';
            if (nodeId === currentNodeId) return 'current';
            if (reachableSet.has(nodeId)) return 'next';
            return 'visible';
          };
          return (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl" preserveAspectRatio="xMidYMid meet">
              {Object.entries(map.edges).map(([fromId, tos]) => {
                const from = map.nodes.find(n => n.id === fromId);
                return tos.map(toId => {
                  const to = map.nodes.find(n => n.id === toId);
                  if (!from || !to) return null;
                  const fromVis = visibilityOf(fromId);
                  const toVis   = visibilityOf(toId);
                  const cleared = fromVis === 'cleared' && toVis === 'cleared';
                  const onCurrentPath = currentNodeId === fromId;
                  let stroke, strokeWidth, opacity, dash;
                  if (cleared)               { stroke = '#5d7e3f'; strokeWidth = 1.5; opacity = 0.55; dash = '6,3'; }
                  else if (onCurrentPath)    { stroke = '#c79d44'; strokeWidth = 3;   opacity = 1;    dash = '0';   }
                  else                       { stroke = '#3d3325'; strokeWidth = 1.5; opacity = 0.7;  dash = '0';   }
                  return (
                    <line key={`${fromId}->${toId}`}
                      x1={xScale(from.x)} y1={yScale(from.y)}
                      x2={xScale(to.x)} y2={yScale(to.y)}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      strokeDasharray={dash} />
                  );
                });
              })}
              {map.nodes.map(n => {
                const vis = visibilityOf(n.id);
                // All nodes show their type up front (STS-style, no fog).
                // Reachable nodes get a gold halo + clickability; cleared
                // nodes desaturate; everything else renders fully but
                // inert until the path reaches it.
                const isCurrent   = vis === 'current';
                const isCleared   = vis === 'cleared';
                const isReachable = vis === 'next';
                const isFuture    = vis === 'visible';
                const fill   = nodeColor(n.type, isCleared, isCurrent);
                const stroke = isReachable ? '#dbb45f'
                             : isCurrent   ? '#c79d44'
                             :               '#5a4d3a';
                const strokeWidth = isReachable ? 3 : isCurrent ? 2.5 : 1.5;
                const opacity = isCleared ? 0.55
                              : isFuture ? 0.85
                              :            1;
                return (
                  <g key={n.id}
                    data-node-id={n.id}
                    style={{ cursor: isReachable ? 'pointer' : 'default' }}
                    onClick={() => isReachable && onPick(n.id)}>
                    <title>{nodeTooltip(n.type)}</title>
                    <circle cx={xScale(n.x)} cy={yScale(n.y)} r={n.type === 'boss' ? 26 : 18}
                      fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                      opacity={opacity} />
                    <text x={xScale(n.x)} y={yScale(n.y) + 5} textAnchor="middle"
                      className="select-none" fill="#f7eed3"
                      fontSize={n.type === 'boss' ? 18 : 14}
                      opacity={isFuture ? 0.9 : 1}>
                      {/* Postcard penalty: fog hides node types until lifted. */}
                      {mapFog && !isCurrent && !isCleared ? '?' : nodeGlyph(n.type)}
                    </text>
                  </g>
                );
              })}
            </svg>
          );
        })()}
        <div className="mt-3 text-xs text-parchment-300 flex gap-3 flex-wrap justify-center">
          <Legend glyph="⚔" label="Combat" />
          <Legend glyph="☠" label="Elite" />
          <Legend glyph="🛏" label="Rest" />
          <Legend glyph="📜" label="Event" />
          <Legend glyph="🪵" label="Material" />
          <Legend glyph="🛠" label="Skill" />
          <Legend glyph="🏘" label="Town" />
          <Legend glyph="👑" label="Boss" />
        </div>
        {!currentNodeId && (
          <div className="mt-2 text-sm text-gold-300 italic">Pick a starting trail. The path beyond is hearsay.</div>
        )}
      </div>

      {(player.equipment.length > 0 || (player.relics?.length || 0) > 0) && (
        <div className="parchment-card p-3 text-xs flex gap-3 flex-wrap">
          {player.equipment.length > 0 && (
            <>
              <span className="uppercase text-parchment-300">Equipment:</span>
              {player.equipment.map(eq => (
                <span key={eq.id} className="text-gold-300" title={eq.desc}>⚜ {eq.name}</span>
              ))}
            </>
          )}
          {(player.relics?.length || 0) > 0 && (
            <>
              <span className="uppercase text-parchment-300 ml-2">Relics:</span>
              {player.relics.map(r => (
                <span key={r.id}
                  className={`px-1.5 py-0.5 rounded border cursor-help ${
                    r.rarity === 'rare' ? 'border-gold-400 text-gold-300'
                    : r.rarity === 'uncommon' ? 'border-iris-400 text-iris-300'
                    : 'border-ink-500 text-parchment-200'}`}
                  title={`${r.desc}${r.flavor ? '\n\n' + r.flavor : ''}`}><Icon name="relic" /> {r.name}</span>
              ))}
            </>
          )}
        </div>
      )}

      {/* Inventory + skill summary — visible so the player can plan
          route choices around what they still need for the act's
          crafting screen at the boss. */}
      {(player.inventory || player.skills) && (
        <div className="parchment-card p-3 flex flex-col gap-1.5">
          {player.inventory && Object.values(player.inventory).some(arr => arr.length > 0) && (
            <div className="text-xs flex gap-2 flex-wrap items-center">
              <span className="uppercase text-parchment-300">Gathered:</span>
              {Object.entries(player.inventory).map(([slot, mats]) =>
                mats.length > 0 ? (
                  <span key={slot} className="text-gold-300" title={mats.map(m => m.name).join(', ')}>
                    {slot === 'staff' ? '🪵' : slot === 'robes' ? '🧵' : slot === 'ring' ? '⚒' : '🎩'}{' '}
                    {mats.map(m => m.name).join(', ')}
                  </span>
                ) : null
              )}
            </div>
          )}
          {player.skills && Object.values(player.skills).some(v => v > 0) && (
            <div className="text-xs flex gap-2 flex-wrap items-center">
              <span className="uppercase text-parchment-300">Skills:</span>
              {Object.entries(player.skills).map(([sk, lvl]) =>
                lvl > 0 ? (
                  <span key={sk} className="text-moss-300">
                    🛠 {sk[0].toUpperCase() + sk.slice(1)} {lvl}
                  </span>
                ) : null
              )}
            </div>
          )}
        </div>
      )}

      <div className="parchment-card p-3 max-h-40 overflow-y-auto text-sm font-quill text-parchment-200 space-y-0.5">
        {log.slice(-10).map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}
function nodeColor(type, isCleared, isCurrent) {
  if (isCurrent) return '#c79d44';
  if (isCleared) return '#2f481e';
  if (type === 'boss') return '#7b1f15';
  if (type === 'elite') return '#a8412f';
  if (type === 'rest') return '#43622c';
  if (type === 'event') return '#523a8b';
  if (type === 'material') return '#7c5e2e';
  if (type === 'skill') return '#5a6e2a';
  if (type === 'start' || type === 'town') return '#5d4a2a';
  return '#2b2418';
}
function nodeGlyph(type) {
  return {
    combat: '⚔', elite: '☠', rest: '🛏', event: '📜',
    material: '🪵', skill: '🛠',
    boss: '👑', town: '🏘', start: '·',
  }[type] || '?';
}
function nodeLabel(n) {
  return ({
    combat: 'a combat tile', elite: 'an elite tile', rest: 'a rest tile',
    event: 'an event', start: 'the trailhead', town: 'the town', boss: 'the boss',
    material: 'a gather', skill: 'a craft lesson',
  }[n.type]) || 'a tile';
}
// Plain-language tooltip body for a map node — appears on hover. Tells
// the player exactly what will happen when they step on the tile.
function nodeTooltip(type) {
  return ({
    combat:   '⚔ Combat — face a normal enemy. Drop their composure or HP to win and pick a card reward.',
    elite:    '☠ Elite — tougher enemy with more behaviors. Higher-quality reward on victory.',
    rest:     '🛏 Rest — restore 30% of both HP and Composure, OR upgrade a card from your deck.',
    event:    '📜 Event — a story moment with 2-3 choices, usually a trade (heal/card/max-HP up for HP/max-HP/card down).',
    material: '🪵 Gather — pick a raw material for this act\'s slot. Drives the end-of-act craft.',
    skill:    '🛠 Craft lesson — bump a craft skill. Safe pick: +2 skill, -8 HP. Risky pick: +4 skill, -8 max HP.',
    boss:     '👑 Boss — the act\'s final fight. Required to advance.',
    town:     '🏘 Town — the act\'s hub. Three paths radiate outward; pick a route. (Sidequests and NPC offers planned here in a later slice.)',
    start:    'Trailhead — the starting point of the act.',
  }[type]) || 'A tile.';
}
function Legend({ glyph, label }) {
  return <span><span className="mr-1">{glyph}</span>{label}</span>;
}


function RewardScreen({ choices, rowChoices = [], onPick, onOpenDeck, deckViewOpen, onCloseDeck,
                       deck = [], hand = [], discard = [], exiled = [], tray = null, lane = null }) {
  // v3.4.15 — FFT row reward variant. Bosses bump T2 (already applied
  // to the cards before they reach this screen). Click a row → grant
  // all 3 cards.
  if (rowChoices.length > 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 max-w-6xl mx-auto">
        <h2 className="font-display text-3xl text-gold-300">A Fully Formed Thought</h2>
        <p className="text-sm text-parchment-300 italic">Choose one spell — its three cards join your deck together.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {rowChoices.map((rc, i) => {
            const row = rc.row;
            const schoolBorder = row.schoolId === 'slowburn' ? 'border-emerald-400'
              : row.schoolId === 'thorns' ? 'border-rose-400' : 'border-amber-400';
            return (
              <button key={i} onClick={() => onPick(rc)}
                      className={`rounded-lg border-2 ${schoolBorder} bg-ink-700 hover:bg-ink-600 hover:scale-[1.02] transition p-4 text-left flex flex-col gap-2`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display text-xl text-iris-200">{row.name}</div>
                  {rc.tierBumped && <span className="text-[10px] uppercase bg-gold-700 text-gold-100 px-2 py-0.5 rounded">T2 bonus</span>}
                </div>
                <div className="text-[12px] italic text-parchment-200 leading-snug">"{row.canonical}"</div>
                <div className="text-[11px] text-gold-300 font-bold">★ {row.riderDesc || '(rider)'}</div>
                <div className="flex flex-col gap-1 mt-1">
                  {rc.cards.map((c, j) => (
                    <div key={j} className="text-[11px] bg-ink-800 border border-ink-600 rounded px-2 py-1">
                      <div className="text-parchment-100">{c.name || c.phrase || c.id}{c.upgraded ? ' (upgraded)' : ''}</div>
                      <div className="text-[10px] italic text-parchment-400 truncate">"{c.phrase || c.desc || ''}"</div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex gap-3 mt-2">
          {onOpenDeck && (
            <button onClick={onOpenDeck} className="btn btn-moss">🗂 View Deck</button>
          )}
          <button onClick={() => onPick(null)} className="btn btn-ink">Skip</button>
        </div>
        {onOpenDeck && (
          <DeckView open={deckViewOpen} onClose={onCloseDeck}
                    hand={hand} deck={deck} discard={discard} exiled={exiled} tray={tray} />
        )}
      </div>
    );
  }
  // v3.3 row-aware draft chips: for each offered card with setId,
  // compute how much of that row the player already owns. If
  // picking this card would complete (3/3) or advance (1→2 or
  // 2→3) the row, surface a prominent highlight + rider description
  // — so the player can read "+1 wit stat" vs "completes Slow Decay
  // → DoT 2/turn × 3 + Weak each turn" as comparable values at the
  // draft decision point.
  const allOwned = [...hand, ...deck, ...discard, ...exiled,
                    ...(tray ? [tray.intro, tray.subject, tray.target, ...(tray.modifiers || [])].filter(Boolean) : [])];
  const ownedSlotsByRow = {};
  for (const c of allOwned) {
    if (!c.setId) continue;
    if (!ownedSlotsByRow[c.setId]) ownedSlotsByRow[c.setId] = new Set();
    ownedSlotsByRow[c.setId].add(c.setSlot);
  }
  const synergyForCard = (card) => {
    if (!card.setId) return null;
    const row = WIT_ROW_BY_ID[card.setId];
    if (!row) return null;
    const owned = (ownedSlotsByRow[card.setId] && ownedSlotsByRow[card.setId].size) || 0;
    const alreadyHaveSlot = ownedSlotsByRow[card.setId] && ownedSlotsByRow[card.setId].has(card.setSlot);
    if (alreadyHaveSlot) return null;
    const afterPick = owned + 1;
    const completes = afterPick === 3;
    const partial = afterPick === 2;
    return { row, owned, afterPick, completes, partial };
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-5xl mx-auto">
      <h2 className="font-display text-3xl text-gold-300">Card Reward</h2>
      <p className="text-sm text-parchment-300 italic">Choose one to add to your deck — or skip.</p>
      <div className="flex gap-4 flex-wrap justify-center">
        {choices.map((card, i) => {
          const syn = synergyForCard(card);
          const borderClass = syn?.completes ? 'border-gold-400 ring-2 ring-gold-300 shadow-gold-300/40'
                            : syn?.partial   ? 'border-iris-400 ring-2 ring-iris-300'
                            :                  'border-gold-500';
          return (
            <button key={i} onClick={() => onPick(card)}
              className={`w-52 min-h-[300px] rounded-lg border-2 p-3 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 hover:scale-105 hover:shadow-2xl transition ${borderClass}`}>
              {syn && (
                <div className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded text-center leading-tight ${
                  syn.completes ? 'bg-gold-200 text-gold-900 border border-gold-500'
                                : 'bg-iris-100 text-iris-900 border border-iris-400'
                }`}>
                  {syn.completes
                    ? `★ Completes ${syn.row.name} (3/3)`
                    : `${syn.afterPick}/3 — ${syn.row.name}`}
                  <div className="text-[10px] font-normal normal-case mt-0.5 text-ink-700">
                    {syn.row.riderDesc || '(rider)'}
                  </div>
                </div>
              )}
              {card.slot === 'lure' && PAIR_LURE_IDS.has(card.id) && (
                <div className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded text-center leading-tight bg-moss-200 text-moss-900 border border-moss-500">
                  🪱 comes as a pair (×2)
                </div>
              )}
              <CardFullBody card={card} lane={lane || null} />
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 mt-4">
        {onOpenDeck && (
          <button onClick={onOpenDeck} className="btn btn-moss"
                  title="See every card in your deck (hand + draw + discard + exiled + tray), grouped by FFT row">
            🗂 View Deck
          </button>
        )}
        <button onClick={() => onPick(null)} className="btn btn-ink">Skip</button>
      </div>
      {onOpenDeck && (
        <DeckView open={deckViewOpen} onClose={onCloseDeck}
                  hand={hand} deck={deck} discard={discard} exiled={exiled} tray={tray} />
      )}
    </div>
  );
}

// Played when an event / shop / familiar hands the player one or more
// cards. Shows them face-up with a single "Got it" button. Prompt shape:
// { cards: [card objects], title: string }
// v3.2: Overlay popup that surfaces cards involuntarily taken from the
// player's hand mid-combat (currently Loom Familiar's discard-hand). The
// in-log line was easy to miss — Alan playtest: "it's confusing to be
// waiting on a card in your draw that you don't know you've lost." This
// pauses combat until the player clicks Acknowledged.
function CardLossOverlay({ notice, onDismiss, lane = null }) {
  if (!notice) return null;
  const { source, cards } = notice;
  return (
    <div className="fixed inset-0 bg-ink-900 bg-opacity-80 z-50 flex items-center justify-center p-4"
         onClick={onDismiss}>
      <div className="parchment-card-strong max-w-3xl p-6 relative"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl text-ember-300 text-center mb-1">
          🪡 {source} reaches into your hand
        </h2>
        <div className="text-sm text-parchment-300 italic text-center mb-4">
          {cards.length === 1 ? 'You lost a card:' : `You lost ${cards.length} cards:`}
        </div>
        <div className="flex gap-4 flex-wrap justify-center mb-4">
          {cards.map((card, i) => (
            <div key={i}
              className="w-52 min-h-[280px] rounded-lg border-2 border-ember-500 p-3 text-left flex flex-col gap-2 shadow-xl bg-parchment-50 text-ink-800 relative">
              <CardFullBody card={card} lane={lane || null} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-ember-700 font-display text-3xl tracking-widest font-bold transform -rotate-12 bg-parchment-50/90 px-3 py-1 rounded border-2 border-ember-700">
                  TAKEN
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-[11px] text-parchment-300 italic mb-3">
          The card moves to your discard pile — it returns to your deck on the next reshuffle.
        </div>
        <div className="text-center">
          <button onClick={onDismiss} className="btn btn-iris">Acknowledged</button>
        </div>
      </div>
    </div>
  );
}

// v3.4.13 — Lab Mode deck builder.
// v3.4.14 — Rebuilt with filter chips + FFT-row quick-add.
// Wit pool is 164 cards; flat list is unusable. Now:
//   • "By FFT Row" tab — 15 rows × 3 schools, +Row adds all 3 cards
//     at once. Each card in a row is individually clickable too.
//   • "All Cards" tab — chip filters for slot / rarity / school +
//     text search. Compact one-line entries with hover details.
function LabDeckBuildScreen({ character, deck, onAdd, onRemove, onStart, onCancel }) {
  const [view, setView] = useState(character?.lane === 'wit' ? 'rows' : 'all');
  const [slotFilter, setSlotFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [filter, setFilter] = useState('');
  if (!character) return null;
  const lane = character.lane;
  // Pool = the lane word-pool PLUS the colorless utility cards usable by
  // this lane (Treat / Buffet / Rummage / tactics, etc.) and the
  // truly-laneless skills/powers (e.g. Food in the Pocket). Those live in
  // CARDS, not the lane word-pool, so without this the handler could only
  // add lures. Lets Lab build & test a full kit, not just bait.
  const pool = useMemo(() => {
    const base = LANE_POOL[lane] || [];
    const seen = new Set(base.map(c => c.id));
    const extras = CARDS.filter(c =>
      !seen.has(c.id) && c.rarity !== 'basic' &&
      (c.lane === lane || (!c.lane && (c.type === 'skill' || c.type === 'power')))
    );
    return [...base, ...extras];
  }, [lane]);
  // Static lane color class strings for Tailwind purge safety.
  const laneAccent = lane === 'wit' ? 'text-iris-300' : lane === 'handler' ? 'text-ember-300' : 'text-moss-300';
  const rarityColor = (r) => r === 'basic' ? 'text-parchment-400'
    : r === 'common' ? 'text-parchment-100'
    : r === 'uncommon' ? 'text-iris-200'
    : r === 'rare' ? 'text-gold-300' : 'text-parchment-200';
  const schoolColor = (s) => s === 'slowburn' ? 'text-emerald-300'
    : s === 'thorns' ? 'text-rose-300'
    : s === 'crescendo' ? 'text-amber-300' : 'text-parchment-400';
  const slotIcon = { intro: '«', subject: '◆', target: '»', modifier: '✦', skill: '⚙', gesture: '✊', annotation: '📝' };

  const f = filter.trim().toLowerCase();
  const matchesText = (c) => !f || (c.name || '').toLowerCase().includes(f)
    || (c.phrase || '').toLowerCase().includes(f) || (c.id || '').toLowerCase().includes(f)
    || (c.desc || '').toLowerCase().includes(f);
  const matchesSlot = (c) => slotFilter === 'all' || (c.slot || c.type) === slotFilter;
  const matchesRarity = (c) => rarityFilter === 'all' || c.rarity === rarityFilter;
  const matchesSchool = (c) => {
    if (schoolFilter === 'all') return true;
    if (schoolFilter === 'none') return !c.schoolId;
    return c.schoolId === schoolFilter;
  };
  const filtered = pool.filter(c => matchesText(c) && matchesSlot(c) && matchesRarity(c) && matchesSchool(c));

  // FFT rows view (wit only).
  const rowsBySchool = useMemo(() => {
    const out = { slowburn: [], thorns: [], crescendo: [] };
    if (lane !== 'wit') return out;
    for (const r of WIT_ROWS) {
      if (out[r.schoolId]) out[r.schoolId].push(r);
    }
    return out;
  }, [lane]);

  // For each row, look up the actual card objects so we can show them.
  const cardsForRow = (row) => {
    const ids = [row.introId, row.subjectId, row.targetId];
    return ids.map(id => pool.find(c => c.id === id)).filter(Boolean);
  };

  const addRow = (row) => {
    for (const id of [row.introId, row.subjectId, row.targetId]) {
      if (CARDS_BY_ID[id]) onAdd(id);
    }
  };

  const Chip = ({ active, onClick, children, color = 'text-parchment-200' }) => (
    <button onClick={onClick}
            className={`text-[11px] uppercase tracking-wide border rounded px-2 py-0.5 transition
              ${active ? 'border-gold-500 bg-ink-700 ' + color : 'border-ink-500 bg-ink-800 text-parchment-400 hover:border-parchment-400'}`}>
      {children}
    </button>
  );

  const CardEntry = ({ c }) => (
    <button onClick={() => onAdd(c.id)}
            data-testid="pool-card" data-card-id={c.id}
            className="text-left bg-ink-700 hover:bg-ink-600 border border-ink-500 rounded px-2 py-1
                       flex items-center gap-2 w-full"
            title={`${c.desc || c.flavor || ''}${c.phrase ? `\n"${c.phrase}"` : ''}`}>
      <span className="text-parchment-400 text-[11px]" title={c.slot || c.type}>{slotIcon[c.slot || c.type] || '·'}</span>
      <span className={`flex-1 truncate text-xs font-semibold ${rarityColor(c.rarity)}`}>{c.name || c.phrase || c.id}</span>
      {c.schoolId && <span className={`text-[10px] ${schoolColor(c.schoolId)}`}>{c.schoolId}</span>}
      <span className="text-parchment-400 text-[10px]">{c.cost ?? '?'}⚡</span>
      <span className="text-gold-400 text-sm leading-none">+</span>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center p-4 gap-3 max-w-7xl mx-auto">
      <div className="flex items-center justify-between w-full gap-4">
        <h2 className={`font-display text-3xl ${laneAccent} tracking-widest`}>🧪 Lab — {character.name}</h2>
        <div className="flex items-center gap-2">
          <button onClick={onStart} className="btn btn-gold px-5 py-2 text-sm">⚔ Enter Combat ({deck.length})</button>
          <button onClick={onCancel} className="btn bg-ink-700 text-parchment-200 text-sm px-3 py-1">← Menu</button>
        </div>
      </div>
      <p className="font-quill italic text-parchment-300 text-xs text-center max-w-3xl">
        Standard starter loaded. Add cards from the {lane} pool, then fight any enemy. Cards stack — add the same one twice for 2 copies.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 w-full">
        <div className="flex flex-col gap-2 min-w-0">
          {lane === 'wit' && (
            <div className="flex gap-1">
              <Chip active={view === 'rows'} onClick={() => setView('rows')} color="text-iris-300">📜 By FFT Row</Chip>
              <Chip active={view === 'all'} onClick={() => setView('all')} color="text-iris-300">🗂 All Cards</Chip>
            </div>
          )}

          {view === 'rows' && lane === 'wit' && (
            <div className="flex flex-col gap-3">
              {['slowburn', 'thorns', 'crescendo'].map(school => (
                <div key={school} className="flex flex-col gap-1">
                  <div className={`text-xs uppercase tracking-widest font-bold ${schoolColor(school)}`}>
                    {school === 'slowburn' ? '🔥 Slow Burn' : school === 'thorns' ? '🌹 Thorns' : '🔔 Crescendo'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {rowsBySchool[school].map(row => {
                      const cards = cardsForRow(row);
                      return (
                        <div key={row.id} className="border border-ink-500 bg-ink-800 rounded p-2 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-1">
                            <div className="font-display text-sm text-parchment-100 truncate">{row.name}</div>
                            <button onClick={() => addRow(row)}
                                    className="text-[10px] uppercase tracking-wide border border-gold-500 bg-ink-700 text-gold-300 hover:bg-ink-600 rounded px-2 py-0.5">
                              +Row
                            </button>
                          </div>
                          <div className="text-[10px] italic text-parchment-400 truncate" title={row.canonical}>"{row.canonical}"</div>
                          {cards.map(c => <CardEntry key={c.id} c={c} />)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'all' && (
            <>
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-parchment-400 mr-1">Slot:</span>
                {['all', 'intro', 'subject', 'target', 'modifier', 'skill', 'gesture', 'annotation'].map(s => (
                  <Chip key={s} active={slotFilter === s} onClick={() => setSlotFilter(s)}>{s}</Chip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-parchment-400 mr-1">Rarity:</span>
                {['all', 'basic', 'common', 'uncommon', 'rare'].map(r => (
                  <Chip key={r} active={rarityFilter === r} onClick={() => setRarityFilter(r)}
                        color={rarityColor(r)}>{r}</Chip>
                ))}
              </div>
              {lane === 'wit' && (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-parchment-400 mr-1">School:</span>
                  {['all', 'slowburn', 'thorns', 'crescendo', 'none'].map(s => (
                    <Chip key={s} active={schoolFilter === s} onClick={() => setSchoolFilter(s)}
                          color={schoolColor(s)}>{s}</Chip>
                  ))}
                </div>
              )}
              <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
                     placeholder="Search name, phrase, id, description…"
                     className="bg-ink-800 border border-ink-500 text-parchment-100 px-2 py-1 rounded text-xs w-full" />
              <div className="text-[10px] text-parchment-400">{filtered.length} of {pool.length} cards</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1 max-h-[65vh] overflow-y-auto pr-1">
                {filtered.map(c => <CardEntry key={c.id} c={c} />)}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <h3 className="font-display text-lg text-parchment-100">Deck ({deck.length})</h3>
          <div className="flex flex-col gap-1 max-h-[75vh] overflow-y-auto pr-1">
            {deck.map(c => (
              <div key={c.uid} className="flex items-center gap-2 text-[11px] bg-ink-800 border border-ink-600 rounded px-2 py-1">
                <span className="text-parchment-500 text-[10px]">{slotIcon[c.slot || c.type] || '·'}</span>
                <span className={`flex-1 truncate ${rarityColor(c.rarity)}`}>{c.name || c.phrase || c.id}</span>
                <span className="text-parchment-400 text-[10px]">{c.cost ?? '?'}⚡</span>
                <button onClick={() => onRemove(c.uid)} className="text-ember-300 hover:text-ember-200 text-sm leading-none px-1"
                        title="Remove">×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// v3.4.13 — Lab Mode enemy picker. Lists every enemy in the game grouped
// by act and tier (normal / elite / boss). One click → enterFight.
function LabEnemySelectScreen({ enemies, onPick, onCancel }) {
  const byAct = {};
  for (const e of enemies) {
    const act = e.act ?? 0;
    if (!byAct[act]) byAct[act] = { normal: [], elite: [], boss: [] };
    const tier = e.tier || 'normal';
    if (!byAct[act][tier]) byAct[act][tier] = [];
    byAct[act][tier].push(e);
  }
  const actIds = Object.keys(byAct).sort();
  const tierColor = (t) => t === 'boss' ? 'border-ember-500 bg-ember-900 text-ember-200'
    : t === 'elite' ? 'border-gold-500 bg-ink-700 text-gold-200'
    : 'border-ink-500 bg-ink-700 text-parchment-200';
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between w-full gap-4">
        <h2 className="font-display text-3xl text-gold-300 tracking-widest">🧪 Lab — Pick an Enemy</h2>
        <button onClick={onCancel} className="btn bg-ink-700 text-parchment-200 text-sm px-3 py-1">← Menu</button>
      </div>
      <div className="flex flex-col gap-5 w-full">
        {actIds.map(actId => (
          <div key={actId} className="flex flex-col gap-2">
            <div className="text-xs uppercase tracking-widest text-gold-500">Act {actId}</div>
            {['normal', 'elite', 'boss'].map(tier => byAct[actId][tier].length > 0 && (
              <div key={tier} className="flex flex-col gap-1">
                <div className="text-[11px] uppercase tracking-wide text-parchment-400">{tier}</div>
                <div className="flex flex-wrap gap-2">
                  {byAct[actId][tier].map(e => (
                    <button key={e.id} onClick={() => onPick(e.id)}
                            className={`text-left text-sm border-2 rounded px-3 py-2 hover:scale-[1.02] transition ${tierColor(tier)}`}
                            title={`Composure ${e.composureMax}${e.hpMax < 999 ? ` · HP ${e.hpMax}` : ''}`}>
                      <div className="font-display">{e.name}</div>
                      <div className="text-xs opacity-80">🎭 {e.composureMax}{e.hpMax < 999 ? ` · ❤ ${e.hpMax}` : ''}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// v3.4.13 — Lab Mode post-fight modal. Shown when an enemy is defeated
// while labMode is on. Yes → back to enemy select with fresh HP, No →
// back to the main menu.
function LabRepeatPromptModal({ enemyName, onYes, onNo }) {
  return (
    <div className="fixed inset-0 bg-ink-900 bg-opacity-85 z-50 flex items-center justify-center p-4">
      <div className="parchment-card-strong max-w-md p-6 flex flex-col gap-4 items-center text-center">
        <h2 className="font-display text-2xl text-gold-300">✓ {enemyName} defeated</h2>
        <p className="font-quill italic text-parchment-200">Fight another?</p>
        <div className="flex gap-3">
          <button onClick={onYes} className="btn btn-gold px-6 py-2">Yes — pick again</button>
          <button onClick={onNo} className="btn bg-ink-700 text-parchment-200 px-6 py-2">No — back to menu</button>
        </div>
      </div>
    </div>
  );
}

// v3.4.15 — Compendium. Main-menu accessible browser for every card in
// the game + the 15 FFT spell rows. Same layout DNA as the Lab deck
// picker (lane tabs, filter chips, FFT-row sections) but read-only:
// clicking a card opens an inline detail pane with the full body /
// effect text. Each FFT row in the row view lists the full rider
// description for the spell as a whole, plus the three component cards.
function CompendiumScreen({ onBack }) {
  const [lane, setLane] = useState('wit');
  const [view, setView] = useState('rows');
  const [slotFilter, setSlotFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [filter, setFilter] = useState('');
  const [selectedCardId, setSelectedCardId] = useState(null);
  // v3.4.16 — Tier preview toggle. T1 = base; T2 = upgradeCard applied.
  // Two tiers only — every card has the same cap.
  const [tierView, setTierView] = useState('t1');
  const displayCard = (c) => (c && tierView === 't2') ? upgradeCard(c) : c;
  const pool = LANE_POOL[lane] || [];
  const selectedCard = selectedCardId ? pool.find(c => c.id === selectedCardId) : null;

  const rarityColor = (r) => r === 'basic' ? 'text-parchment-400'
    : r === 'common' ? 'text-parchment-100'
    : r === 'uncommon' ? 'text-iris-200'
    : r === 'rare' ? 'text-gold-300' : 'text-parchment-200';
  const schoolColor = (s) => s === 'slowburn' ? 'text-emerald-300'
    : s === 'thorns' ? 'text-rose-300'
    : s === 'crescendo' ? 'text-amber-300' : 'text-parchment-400';
  const slotIcon = { intro: '«', subject: '◆', target: '»', modifier: '✦', skill: '⚙', gesture: '✊', annotation: '📝' };

  const f = filter.trim().toLowerCase();
  const matchesText = (c) => !f || (c.name || '').toLowerCase().includes(f)
    || (c.phrase || '').toLowerCase().includes(f) || (c.id || '').toLowerCase().includes(f)
    || (c.desc || '').toLowerCase().includes(f);
  const matchesSlot = (c) => slotFilter === 'all' || (c.slot || c.type) === slotFilter;
  const matchesRarity = (c) => rarityFilter === 'all' || c.rarity === rarityFilter;
  const matchesSchool = (c) => {
    if (schoolFilter === 'all') return true;
    if (schoolFilter === 'none') return !c.schoolId;
    return c.schoolId === schoolFilter;
  };
  const filtered = pool.filter(c => matchesText(c) && matchesSlot(c) && matchesRarity(c) && matchesSchool(c));

  const rowsBySchool = { slowburn: [], thorns: [], crescendo: [] };
  if (lane === 'wit') {
    for (const r of WIT_ROWS) if (rowsBySchool[r.schoolId]) rowsBySchool[r.schoolId].push(r);
  }
  const cardsForRow = (row) => [row.introId, row.subjectId, row.targetId]
    .map(id => pool.find(c => c.id === id)).filter(Boolean);

  const Chip = ({ active, onClick, children, color = 'text-parchment-200' }) => (
    <button onClick={onClick}
            className={`text-[11px] uppercase tracking-wide border rounded px-2 py-0.5 transition
              ${active ? 'border-gold-500 bg-ink-700 ' + color : 'border-ink-500 bg-ink-800 text-parchment-400 hover:border-parchment-400'}`}>
      {children}
    </button>
  );

  // Card entries display the tier-shifted card so name/cost reflect the
  // T2/T3 form when the toggle is active. Selection key still uses the
  // base card.id (which doesn't change across tiers).
  const CardEntry = ({ c }) => {
    const d = displayCard(c);
    return (
      <button onClick={() => setSelectedCardId(c.id)}
              className={`text-left bg-ink-700 hover:bg-ink-600 border rounded px-2 py-1 flex items-center gap-2 w-full
                         ${selectedCardId === c.id ? 'border-gold-400 ring-1 ring-gold-300' : 'border-ink-500'}`}>
        <span className="text-parchment-400 text-[11px]">{slotIcon[c.slot || c.type] || '·'}</span>
        <span className={`flex-1 truncate text-xs font-semibold ${rarityColor(c.rarity)}`}>{d.name || d.phrase || c.id}</span>
        {c.schoolId && <span className={`text-[10px] ${schoolColor(c.schoolId)}`}>{c.schoolId}</span>}
        <span className="text-parchment-400 text-[10px]">{d.cost ?? '?'}⚡</span>
      </button>
    );
  };

  const laneAccent = lane === 'wit' ? 'text-iris-300' : lane === 'handler' ? 'text-ember-300' : 'text-moss-300';

  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between gap-4">
        <h2 className={`font-display text-3xl ${laneAccent} tracking-widest`}>📖 Compendium</h2>
        <button onClick={onBack} className="btn bg-ink-700 text-parchment-200 text-sm px-3 py-1">← Menu</button>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {[{ id: 'wit', label: 'Wit' }, { id: 'handler', label: 'Handler' }, { id: 'jnsq', label: 'Jnsq' }].map(l => (
            <button key={l.id} onClick={() => { setLane(l.id); setSelectedCardId(null); setView(l.id === 'wit' ? 'rows' : 'all'); }}
                    className={`text-sm uppercase tracking-wide border-2 rounded px-3 py-1 transition
                      ${lane === l.id ? 'border-gold-500 bg-ink-700 text-gold-200' : 'border-ink-500 bg-ink-800 text-parchment-400 hover:border-parchment-300'}`}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-[10px] uppercase text-parchment-400 mr-1">Show at tier:</span>
          {[{ id: 't1', label: 'T1' }, { id: 't2', label: 'T2' }].map(t => (
            <button key={t.id} onClick={() => setTierView(t.id)}
                    className={`text-xs uppercase tracking-wide border-2 rounded px-2 py-1 transition
                      ${tierView === t.id ? 'border-gold-500 bg-ink-700 text-gold-200' : 'border-ink-500 bg-ink-800 text-parchment-400 hover:border-parchment-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-4 w-full">
        <div className="flex flex-col gap-2 min-w-0">
          {lane === 'wit' && (
            <div className="flex gap-1">
              <Chip active={view === 'rows'} onClick={() => setView('rows')} color="text-iris-300">📜 By FFT Row</Chip>
              <Chip active={view === 'all'} onClick={() => setView('all')} color="text-iris-300">🗂 All Cards</Chip>
            </div>
          )}

          {view === 'rows' && lane === 'wit' && (
            <div className="flex flex-col gap-3 max-h-[78vh] overflow-y-auto pr-1">
              {['slowburn', 'thorns', 'crescendo'].map(school => (
                <div key={school} className="flex flex-col gap-1">
                  <div className={`text-xs uppercase tracking-widest font-bold ${schoolColor(school)}`}>
                    {school === 'slowburn' ? '🔥 Slow Burn' : school === 'thorns' ? '🌹 Thorns' : '🔔 Crescendo'}
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    {rowsBySchool[school].map(row => {
                      const cards = cardsForRow(row);
                      return (
                        <div key={row.id} className="border border-ink-500 bg-ink-800 rounded p-2 flex flex-col gap-1">
                          <div className="font-display text-base text-iris-200">{row.name}</div>
                          <div className="text-[11px] italic text-parchment-200">"{row.canonical}"</div>
                          <div className="text-[11px] text-gold-300">★ {row.riderDesc || '(rider)'}</div>
                          <div className="border-t border-ink-600 mt-1 pt-1 flex flex-col gap-1">
                            {cards.map(c => <CardEntry key={c.id} c={c} />)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'all' && (
            <>
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-parchment-400 mr-1">Slot:</span>
                {['all', 'intro', 'subject', 'target', 'modifier', 'skill', 'gesture', 'annotation'].map(s => (
                  <Chip key={s} active={slotFilter === s} onClick={() => setSlotFilter(s)}>{s}</Chip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-parchment-400 mr-1">Rarity:</span>
                {['all', 'basic', 'common', 'uncommon', 'rare'].map(r => (
                  <Chip key={r} active={rarityFilter === r} onClick={() => setRarityFilter(r)} color={rarityColor(r)}>{r}</Chip>
                ))}
              </div>
              {lane === 'wit' && (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-parchment-400 mr-1">School:</span>
                  {['all', 'slowburn', 'thorns', 'crescendo', 'none'].map(s => (
                    <Chip key={s} active={schoolFilter === s} onClick={() => setSchoolFilter(s)} color={schoolColor(s)}>{s}</Chip>
                  ))}
                </div>
              )}
              <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
                     placeholder="Search name, phrase, id, description…"
                     className="bg-ink-800 border border-ink-500 text-parchment-100 px-2 py-1 rounded text-xs w-full" />
              <div className="text-[10px] text-parchment-400">{filtered.length} of {pool.length} cards</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1 max-h-[65vh] overflow-y-auto pr-1">
                {filtered.map(c => <CardEntry key={c.id} c={c} />)}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          {selectedCard ? (() => {
            const shown = displayCard(selectedCard);
            return (
              <div className="parchment-card p-3 flex flex-col gap-2">
                <div className="text-[10px] uppercase tracking-widest text-gold-500">Showing {tierView.toUpperCase()}</div>
                <div className="bg-parchment-50 text-ink-800 rounded p-2">
                  <CardFullBody card={shown} lane={lane || null} />
                </div>
                <div className="text-[11px] text-parchment-300 italic">"{selectedCard.flavor || ''}"</div>
                {selectedCard.setId && (() => {
                  const row = WIT_ROW_BY_ID[selectedCard.setId];
                  if (!row) return null;
                  return (
                    <div className="border-t border-ink-600 pt-2 flex flex-col gap-1">
                      <div className="text-[10px] uppercase tracking-widest text-gold-500">Belongs to spell</div>
                      <div className="font-display text-base text-iris-200">{row.name}</div>
                      <div className="text-[11px] italic text-parchment-200">"{row.canonical}"</div>
                      <div className="text-[11px] text-gold-300">★ {row.riderDesc || '(rider)'}</div>
                    </div>
                  );
                })()}
                <button onClick={() => setSelectedCardId(null)} className="text-[10px] text-parchment-400 hover:text-parchment-200 self-end">close ×</button>
              </div>
            );
          })() : (
            <div className="parchment-card p-4 text-sm italic text-parchment-300">
              Click any card to see its full effect and which spell it belongs to. Use the tier toggle to preview upgraded versions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// v3.3: Material-gain notice. Pops up after auto-harvest to show the
// material the road decided for them (Alan: "needs a popup modal to
// show what it is I got"). Click backdrop or Continue to dismiss and
// return to map.
function MaterialGainOverlay({ material, onDismiss }) {
  if (!material) return null;
  const stats = material.stats || {};
  const statSummary = Object.entries(stats)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  return (
    <div className="fixed inset-0 bg-ink-900 bg-opacity-80 z-50 flex items-center justify-center p-4"
         onClick={onDismiss}>
      <div className="parchment-card-strong max-w-md p-6 relative"
           onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-3">
          <div className="text-[11px] uppercase tracking-widest text-moss-300">
            🪵 You gathered ({material.slot})
          </div>
          <h2 className="font-display text-3xl text-moss-200 mt-1">
            {material.name}
          </h2>
        </div>
        {material.flavor && (
          <div className="text-sm font-quill italic text-parchment-200 text-center mb-3 leading-snug">
            "{material.flavor}"
          </div>
        )}
        {statSummary && (
          <div className="text-xs font-mono text-center text-gold-300 mb-3">
            {statSummary}
          </div>
        )}
        <div className="text-center text-[11px] text-parchment-400 italic mb-4">
          Held in your inventory. Crafted at the end of the act.
        </div>
        <div className="text-center">
          <button onClick={onDismiss} className="btn btn-moss">Continue</button>
        </div>
      </div>
    </div>
  );
}

function CardGrantScreen({ prompt, onDismiss, lane = null }) {
  if (!prompt) return null;
  const { cards, title } = prompt;
  const tint = (card) =>
    card.type === 'word'   ? 'border-iris-500' :
    card.type === 'effect' ? 'border-ember-500' :
    card.type === 'power'  ? 'border-gold-500' :
                             'border-moss-500';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-4xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300 text-center">📜 You gained {cards.length === 1 ? 'a card' : `${cards.length} cards`}</h2>
      <div className="text-sm text-parchment-300 italic">{title}</div>
      <div className="flex gap-4 flex-wrap justify-center">
        {cards.map((card, i) => (
          <div key={i}
            className={`w-52 min-h-[280px] rounded-lg border-2 p-3 text-left flex flex-col gap-2 shadow-xl bg-parchment-50 text-ink-800 ${tint(card)}`}>
            <CardFullBody card={card} lane={lane || null} />
          </div>
        ))}
      </div>
      <button onClick={onDismiss} className="btn btn-gold text-lg px-8 py-3">Got it</button>
    </div>
  );
}

function EventScreen({ event, onChoose }) {
  if (!event) return null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-2xl mx-auto">
      <h2 className="font-display text-3xl text-iris-300">{event.title}</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">"{event.flavor}"</p>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {event.choices.map((c, i) => (
          <button key={i} onClick={() => onChoose(c)}
            className="btn bg-ink-600 hover:bg-ink-500 text-parchment-100 text-left">{c.label}</button>
        ))}
      </div>
    </div>
  );
}

// Friendly label + tooltip for a raw material-stat key. Material
// data uses internal keys (`defense`, `regen`, `handler`, etc.);
// the UI shows what the player will actually get when crafted.
function materialStatChip(key, value) {
  const labels = {
    handler: { label: 'Handler', tip: `On a Staff: scales the spell's base and multiplier (more raw damage).` },
    loseHp:   { label: 'Risk',     tip: `On a Staff: cast costs ${value} HP (Handler glass-cannon archetype).` },
    defense:  { label: 'Defense',  tip: `Permanent damage reduction (-${value} per incoming hit, engine caps total at 2, min 1 damage taken). On a Staff: also adds rider Block on cast.` },
    regen:    { label: 'Regen',    tip: `On Robes: heals ${value * 2} HP at the start of every combat.` },
    draw:     { label: 'Draw',     tip: `On Robes/Ring: +${value} card drawn on turn 1. On a Hat: +${value} card every turn.` },
    energy:   { label: 'Energy',   tip: `On a Ring: +${value} permanent Energy per turn. On a Hat: +${value} Energy every turn.` },
    block:    { label: 'Block',    tip: `On a Hat: +${value} Block at the start of every turn.` },
    dot:      { label: 'Weak rider', tip: `On a Staff: cast applies ${value} Weak to the enemy (control archetype).` },
    chance:   { label: 'Chance',   tip: `On a Staff: cast has a 50% chance to apply 2 Vuln; 50% chance you gain 1 Weak (Jnsq gamble).` },
    vuln:     { label: 'Vulnerable', tip: `On Robes: applies ${value} Vulnerable to the enemy at combat start. On a Hat: applies it every turn.` },
    weak:     { label: 'Weak',     tip: `On a Ring: applies ${value} Weak to the enemy at combat start.` },
    jnsq:     { label: 'Jnsq',     tip: `On a Staff: adds the 'absurd' resonance tag.` },
    wit:      { label: 'Wit',      tip: `Material flavor stat. (Currently unused in equipment outputs.)` },
  };
  return labels[key] || { label: key, tip: `${key} +${value}` };
}

// Material chooser — shown when the player visits a Material node.
// Three random variants of the current act's slot pool. The player
// picks one; the material lands in their inventory and is consumed
// at the act's crafting screen (Commit 3).
const SLOT_HEADLINE = {
  staff: 'A clearing of timber',
  robes: 'A rack of threads',
  ring:  'A cache of ore',
  hat:   'A press of felts',
};
const SLOT_EMOJI = { staff: '🪵', robes: '🧵', ring: '⚒', hat: '🎩' };

function MaterialChooseScreen({ prompt, onPick, onSkip }) {
  if (!prompt) return null;
  const { slot, choices } = prompt;
  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-5 max-w-4xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300 text-center">
        {SLOT_EMOJI[slot]} {SLOT_HEADLINE[slot] || 'A gather'}
      </h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">
        Three things you might take from here. The act's crafting screen will use whatever you've gathered when the boss falls — bring back what feels right.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        {choices.map((m) => (
          <button key={m.id} onClick={() => onPick(m.id)}
            className="w-56 min-h-[14rem] rounded-lg border-2 border-gold-500 bg-parchment-50 text-ink-800 p-3 text-left hover:scale-105 hover:shadow-2xl transition flex flex-col gap-2">
            <div className="font-display text-lg">{m.name}</div>
            <div className="text-xs uppercase tracking-wider text-ink-400">{SLOT_LABEL[m.slot] || m.slot} material</div>
            <div className="flex flex-wrap gap-1 text-xs font-mono">
              {Object.entries(m.stats || {}).map(([k, v]) => {
                const c = materialStatChip(k, v);
                return (
                  <span key={k} className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800" title={c.tip}>
                    {c.label} +{v}
                  </span>
                );
              })}
            </div>
            <div className="text-sm font-quill italic text-ink-500 mt-auto pt-2 border-t border-ink-300">"{m.flavor}"</div>
          </button>
        ))}
      </div>
      <button onClick={onSkip} className="btn btn-ink mt-2">Take none. Push on.</button>
    </div>
  );
}

// Skill event — same shape as a regular event but lives on its own
// stage so the skill bumps are visually distinct from the generic
// event pool. Shows the player's current skill levels at the top for
// context.
function SkillEventScreen({ event, skills, onChoose }) {
  if (!event) return null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-2xl mx-auto">
      <h2 className="font-display text-3xl text-moss-300">🛠 {event.title}</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">"{event.flavor}"</p>
      <div className="text-xs text-parchment-300 flex gap-3 flex-wrap justify-center">
        {Object.entries(skills || {}).map(([sk, lvl]) => (
          <span key={sk} className={lvl > 0 ? 'text-moss-300' : 'text-parchment-400'}>
            {sk}: {lvl}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {event.choices.map((c, i) => (
          <button key={i} onClick={() => onChoose(c)}
            className="btn bg-ink-600 hover:bg-ink-500 text-parchment-100 text-left">{c.label}</button>
        ))}
      </div>
    </div>
  );
}

// SIDEQUEST OFFER — appears on Town arrival when a sidequest seeds.
// Shows the template intro + an Accept / Decline pair.
function SidequestOfferScreen({ template, onAccept, onDecline }) {
  if (!template) return null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-moss-300">A diversion offers itself</div>
      <h2 className="font-display text-3xl text-gold-300">🌿 {template.title}</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">{template.intro}</p>
      <p className="text-[11px] text-parchment-400 italic max-w-xl text-center">
        {template.nodes.length} node{template.nodes.length === 1 ? '' : 's'} · {template.bossShortcut ? 'leads directly to the act boss' : 'returns you to the map'}
      </p>
      <div className="flex gap-3">
        <button className="btn btn-iris" onClick={onAccept}>Get involved</button>
        <button className="btn btn-ink" onClick={onDecline}>Keep walking</button>
      </div>
    </div>
  );
}

// SIDEQUEST NODE — renders the current node in an active sidequest.
// Choice nodes show options; narrative nodes show one Continue button.
// `canAbandon: true` on the node adds an Abandon button that ends the
// quest and returns to the map.
function SidequestNodeScreen({ template, node, nodeIdx, onChoose, onNarrativeContinue, onAbandon }) {
  const progress = `Node ${nodeIdx + 1} of ${template.nodes.length}`;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-moss-300">🌿 {template.title} · {progress}</div>
      {node.title && <h2 className="font-display text-2xl text-gold-300">{node.title}</h2>}
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">{node.flavor}</p>
      {node.kind === 'choice' && (
        <div className="flex flex-col gap-2 w-full max-w-md">
          {node.choices.map((c, i) => (
            <button key={i} onClick={() => onChoose(c)}
              className="btn bg-ink-600 hover:bg-ink-500 text-parchment-100 text-left">{c.label}</button>
          ))}
        </div>
      )}
      {node.kind === 'narrative' && (
        <button className="btn btn-moss mt-2" onClick={onNarrativeContinue}>Continue</button>
      )}
      {node.canAbandon && (
        <button className="text-xs text-parchment-400 italic hover:text-ember-300 mt-3" onClick={onAbandon}>
          Abandon the diversion (return to the map)
        </button>
      )}
    </div>
  );
}

// POSTCARD MODAL — appears when the mailbox button is clicked. Three
// faces depending on postcardState:
//   active    — input box for the phrase; submit verifies exact match
//   completed — the "My cat forgives you" postcard (heal + max HP reward)
//   failed    — the "You have disgraced my cat" rebuke (clears the fog)
function PostcardModal({ state, phrase, progress, onSubmit, onClose }) {
  const [text, setText] = useState('');
  const isActive = state === 'active';
  const isCompleted = state === 'completed';
  const isFailed = state === 'failed';
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-amber-50 text-ink-800 rounded-lg shadow-2xl p-6 border-4 border-amber-200">
        {isCompleted ? (
          <>
            <div className="text-xs uppercase tracking-widest text-ink-500 text-center">A postcard arrives</div>
            <div className="font-display text-2xl text-center mt-2">My cat forgives you</div>
            <div className="font-quill italic text-center text-ink-600 mt-3">A small drawing of a cat at a window.</div>
            <button onClick={() => onSubmit('')} className="btn btn-iris w-full mt-4">Read it</button>
          </>
        ) : isFailed ? (
          <>
            <div className="text-xs uppercase tracking-widest text-ink-500 text-center">A postcard arrives</div>
            <div className="font-display text-2xl text-center mt-2">You have disgraced my cat.</div>
            <div className="font-display text-base text-center mt-1">We will not speak again.</div>
            <div className="font-quill italic text-center text-ink-600 mt-3">No drawing. Just the words.</div>
            <button onClick={() => onSubmit('')} className="btn btn-ember w-full mt-4">Set it down</button>
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-widest text-ink-500 text-center">A blank postcard</div>
            <div className="font-display text-lg text-center text-ink-700 mt-2">Write the phrase. Exactly.</div>
            <div className="text-xs italic text-center text-ink-500 mt-1">(Sent so far: {progress}/3)</div>
            <input type="text" value={text} onChange={e => setText(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') onSubmit(text); }}
              placeholder="five-word phrase..."
              className="w-full mt-4 px-3 py-2 rounded border-2 border-ink-300 bg-amber-100 text-ink-800 font-mono" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => onSubmit(text)} className="btn btn-iris flex-1">Send</button>
              <button onClick={onClose} className="btn btn-ink">Cancel</button>
            </div>
            <div className="text-[10px] italic text-ink-400 text-center mt-3">Any extra word or punctuation will be noticed.</div>
          </>
        )}
      </div>
    </div>
  );
}

// INSULT PROMPT — three sequential choice screens (noun / verb / adjective),
// each with three pre-classified word options and a 4-second timer. On
// timer expiry, auto-picks the first option (penalty for hesitation).
// The picks land or backfire based on alignment with the enemy's
// insultVulnerabilities — finalizeInsult does the math.
function InsultPromptScreen({ insultPrompt, enemy, onPick }) {
  const TIMER_SECONDS = 4;
  const phaseLabel = ['Noun', 'Verb', 'Adjective'][insultPrompt.phase] || '?';
  const phaseKey   = ['noun', 'verb', 'adjective'][insultPrompt.phase];
  const phasePrompt = [
    'What you call them:',
    'What they do:',
    'How they are:',
  ][insultPrompt.phase] || '';
  const samples = insultPrompt.samples?.[phaseKey] || [];
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);

  // Re-arm the timer on every phase change. The auto-pick side-effect
  // lives in the interval body (with a fired-ref guard) instead of inside
  // a setSecondsLeft updater — pure updaters per the saved-feedback rule
  // ([[feedback_react_pure_updaters]]).
  const firedRef = useRef(false);
  useEffect(() => {
    setSecondsLeft(TIMER_SECONDS);
    firedRef.current = false;
    const interval = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 0.1));
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insultPrompt.phase]);

  // When the timer hits zero, fire the auto-pick exactly once.
  useEffect(() => {
    if (secondsLeft <= 0 && !firedRef.current && samples.length > 0) {
      firedRef.current = true;
      onPick(samples[0]);
    }
  }, [secondsLeft, samples, onPick]);

  const tBar = (secondsLeft / TIMER_SECONDS) * 100;
  const timerColor = secondsLeft > 2 ? 'bg-moss-500' : secondsLeft > 1 ? 'bg-gold-500' : 'bg-ember-500';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-ember-300">💢 Insulting {enemy?.name || 'them'}</div>
      <h2 className="font-display text-2xl text-gold-300">Step {insultPrompt.phase + 1} of 3 — {phaseLabel}</h2>
      <p className="font-quill italic text-parchment-200 text-center">{phasePrompt}</p>
      <div className="w-full max-w-sm h-2 bg-ink-700 rounded-full overflow-hidden">
        <div className={`h-full ${timerColor} transition-all`} style={{ width: `${tBar}%` }} />
      </div>
      <div className="text-[10px] text-parchment-400">{secondsLeft.toFixed(1)}s — auto-picks first option if you stall</div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {samples.map((s, i) => (
          <button key={i} onClick={() => onPick(s)}
            className="btn bg-ink-600 hover:bg-ember-700 text-parchment-100 text-left">
            <span className="font-display text-base">{s.word}</span>
            <span className="ml-2 text-[10px] text-parchment-400 italic">{(s.tags || []).join(' · ')}</span>
          </button>
        ))}
      </div>
      {insultPrompt.picks.length > 0 && (
        <div className="text-xs text-parchment-400 mt-2">
          So far: <span className="text-iris-200">{insultPrompt.picks.map(p => p.word).join(' / ')}</span>
        </div>
      )}
    </div>
  );
}

// TRACE-WHITTLING MINIGAME — slice 1 of skill-event minigames. Player
// drags their cursor along a curved carve-line in an SVG. Tracks distance
// from the line each frame, averages it at completion, maps to Master/
// Fine/Rough. Grade fed back to finalizeSkillMinigame which scales the
// skill bump and applies the labeled max-HP cost.
function TraceWhittlingMinigame({ eventTitle, choiceLabel, onComplete }) {
  const VB_W = 720, VB_H = 220;
  // Curve as a list of {x, y} control points. The drawn path uses smooth
  // SVG curves between these. Discretized to fine samples for distance
  // checks. Two curves to vary across reloads — picks one per mount.
  const curves = useMemo(() => ([
    [
      { x: 50,  y: 110 },
      { x: 180, y: 60  },
      { x: 280, y: 150 },
      { x: 410, y: 80  },
      { x: 540, y: 140 },
      { x: 670, y: 95  },
    ],
    [
      { x: 50,  y: 140 },
      { x: 200, y: 80  },
      { x: 350, y: 130 },
      { x: 500, y: 70  },
      { x: 670, y: 130 },
    ],
  ]), []);
  const controlPoints = useMemo(() => curves[Math.floor(Math.random() * curves.length)], [curves]);

  // Discretize the control polyline into many small samples so the
  // distance test is just "nearest sample" — cheap and good enough.
  const pathSamples = useMemo(() => {
    const samples = [];
    const segs = 80;
    for (let i = 0; i < controlPoints.length - 1; i++) {
      const a = controlPoints[i];
      const b = controlPoints[i + 1];
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        samples.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          idx: samples.length,
        });
      }
    }
    samples.push({ ...controlPoints[controlPoints.length - 1], idx: samples.length });
    return samples;
  }, [controlPoints]);

  const svgRef = useRef(null);
  const stateRef = useRef({
    tracing: false,
    totalError: 0,
    samples: 0,
    progressIdx: 0,
    cursor: null,
    startTime: 0,
  });
  const [tracing, setTracing] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [progress, setProgress] = useState(0); // 0..1
  const [errorBucket, setErrorBucket] = useState('fine'); // current proximity feedback
  // v2.5: time-based grading. Player clicks "Ready" to start a live
  // timer; finish under 5s for master, under 7.5s for fine, slower for
  // rough. Accuracy still matters as a tie-breaker (must complete ≥70%
  // of the path to qualify above rough), but speed is the headline.
  const [phase, setPhase] = useState('idle'); // 'idle' | 'tracing' | 'done'
  const [elapsedTime, setElapsedTime] = useState(0); // live seconds display

  // Tick the live timer ~20fps while tracing.
  useEffect(() => {
    if (phase !== 'tracing') return;
    const id = setInterval(() => {
      const t = (Date.now() - stateRef.current.startTime) / 1000;
      setElapsedTime(t);
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  function startTrace() {
    stateRef.current = { tracing: false, totalError: 0, samples: 0, progressIdx: 0, cursor: null, startTime: Date.now() };
    setPhase('tracing');
    setProgress(0);
    setElapsedTime(0);
  }

  function svgPointFrom(e) {
    if (!svgRef.current) return null;
    const r = svgRef.current.getBoundingClientRect();
    const sx = VB_W / r.width;
    const sy = VB_H / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function findNearest(x, y) {
    let best = Infinity, bestIdx = 0;
    for (let i = 0; i < pathSamples.length; i++) {
      const dx = pathSamples[i].x - x;
      const dy = pathSamples[i].y - y;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; bestIdx = i; }
    }
    return { idx: bestIdx, dist: Math.sqrt(best) };
  }

  function onPointerDown(e) {
    if (phase !== 'tracing') return; // must hit "Ready" first to start the timer
    const p = svgPointFrom(e);
    if (!p) return;
    const s = stateRef.current;
    // First press: must start near the green START dot.
    // Resume after pause (progress > 0): allow starting anywhere along the
    // traced portion so the player doesn't have to re-trace from scratch.
    if (s.progressIdx === 0) {
      const start = pathSamples[0];
      const startDist = Math.sqrt((p.x - start.x) ** 2 + (p.y - start.y) ** 2);
      if (startDist > 60) return;
    } else {
      // Resuming — must press near the current progress frontier (within
      // 60px of the last traced sample) so the trace continues forward.
      const head = pathSamples[s.progressIdx];
      const headDist = Math.sqrt((p.x - head.x) ** 2 + (p.y - head.y) ** 2);
      if (headDist > 60) return;
    }
    s.tracing = true;
    s.cursor = p;
    setTracing(true);
    setCursor(p);
  }

  function onPointerMove(e) {
    if (!stateRef.current.tracing) return;
    const p = svgPointFrom(e);
    if (!p) return;
    const near = findNearest(p.x, p.y);
    // Progress only advances forward (don't reward going backward).
    if (near.idx > stateRef.current.progressIdx) {
      stateRef.current.progressIdx = near.idx;
      setProgress(near.idx / (pathSamples.length - 1));
    }
    stateRef.current.totalError += near.dist;
    stateRef.current.samples += 1;
    stateRef.current.cursor = p;
    setCursor(p);
    setErrorBucket(near.dist < 12 ? 'master' : near.dist < 28 ? 'fine' : 'rough');
  }

  // v2.20: if the player clicked the START dot and lifted without
  // dragging (or dragged a tiny amount), DON'T auto-finalize. Reset the
  // attempt so they can try again.
  // v2.58: separate "pause tracing" (released pointer mid-drag) from
  // "finalize" (commit to a grade). Pointer-up only PAUSES — the player
  // explicitly clicks "Finish the cut" to lock in their grade. This lets
  // them resume tracing if they missed a section. Auto-finalize is gone;
  // mid-drag release no longer eats the run.
  function pauseTrace() {
    const s = stateRef.current;
    if (!s.tracing) return;
    const completion = s.progressIdx / (pathSamples.length - 1);
    // Mis-click guard: < 10% completion = treat as no attempt, reset.
    if (completion < 0.10) {
      s.tracing = false;
      s.progressIdx = 0;
      s.totalError = 0;
      s.samples = 0;
      s.cursor = null;
      setTracing(false);
      setCursor(null);
      setProgress(0);
      return;
    }
    // Pause — keep the progress so the player can either resume by
    // pressing-and-holding from the green dot OR click "Finish the cut".
    s.tracing = false;
    setTracing(false);
  }

  function finish() {
    const s = stateRef.current;
    const completion = s.progressIdx / (pathSamples.length - 1);
    s.tracing = false;
    setTracing(false);
    const elapsed = (Date.now() - s.startTime) / 1000;
    let grade;
    if (completion < 0.7) {
      grade = 'rough';
    } else if (elapsed < 5.0) {
      grade = 'master';
    } else if (elapsed < 7.5) {
      grade = 'fine';
    } else {
      grade = 'rough';
    }
    setPhase('done');
    setElapsedTime(elapsed);
    setTimeout(() => onComplete(grade), 600);
  }

  function onPointerUp() { pauseTrace(); }
  function onPointerLeave() { if (stateRef.current.tracing) pauseTrace(); }

  const pathD = (() => {
    const [first, ...rest] = controlPoints;
    return `M ${first.x} ${first.y} ` + rest.map(p => `L ${p.x} ${p.y}`).join(' ');
  })();

  // v2.58: traced-portion overlay. Built from pathSamples up to
  // progressIdx so the line visibly "lights up" as the player drags
  // through. Recomputed every render — cheap, samples are ~400 points.
  const tracedD = (() => {
    const upTo = stateRef.current.progressIdx || Math.round(progress * (pathSamples.length - 1));
    if (upTo <= 0) return '';
    const head = pathSamples.slice(0, upTo + 1);
    return `M ${head[0].x} ${head[0].y} ` + head.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  })();

  const proximityColor = errorBucket === 'master' ? '#7a9b3a'
                       : errorBucket === 'fine'   ? '#c79d44'
                       :                            '#a44a3f';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4 max-w-4xl mx-auto">
      <h2 className="font-display text-2xl text-moss-300">🛠 {eventTitle}</h2>
      <p className="text-sm text-parchment-300 italic max-w-xl text-center">{choiceLabel}</p>
      <p className="text-xs text-parchment-400 max-w-xl text-center">
        Click READY, then press and hold from the green START dot and drag to the red END dot.
        Release to pause; press again at the frontier of your traced line to resume.
        Click <b>Finish the cut</b> when done. Speed grading: <b className="text-moss-300">&lt; 5s = Master</b> · <b className="text-gold-300">&lt; 7.5s = Fine</b> · slower = Rough. Must trace ≥ 70% of the line.
      </p>
      {/* Timer + Ready button. */}
      <div className="flex items-center gap-4">
        {phase === 'idle' && (
          <button onClick={startTrace} className="btn btn-iris text-lg px-8 py-3 animate-pulse">
            ▶ Ready — Start Timer
          </button>
        )}
        {phase !== 'idle' && (
          <div className={`font-mono text-3xl font-bold ${elapsedTime < 5 ? 'text-moss-300' : elapsedTime < 7.5 ? 'text-gold-300' : 'text-ember-400'}`}>
            {elapsedTime.toFixed(2)}s
          </div>
        )}
      </div>
      <div className="parchment-card-strong p-3 select-none">
        <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`}
             className="w-full max-w-3xl block cursor-crosshair touch-none"
             onPointerDown={onPointerDown}
             onPointerMove={onPointerMove}
             onPointerUp={onPointerUp}
             onPointerLeave={onPointerLeave}>
          {/* Wood-grain background hint */}
          <rect x={0} y={0} width={VB_W} height={VB_H} fill="#3a2d1c" />
          {/* Safe band — the player should stay within this. */}
          <path d={pathD} fill="none" stroke="#6b563a" strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />
          {/* The actual carve line — dotted, the target. */}
          <path d={pathD} fill="none" stroke="#dbb45f" strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
          {/* v2.58: traced overlay — bright solid line over the dotted
              target, drawn up to the player's furthest progress. Gives
              clear feedback that the cut is registering. */}
          {tracedD && (
            <path d={tracedD} fill="none" stroke="#dbb45f" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 0 4px #f4d77a)' }} />
          )}
          {/* Start marker */}
          <circle cx={pathSamples[0].x} cy={pathSamples[0].y} r={10} fill="#5d7e3f" stroke="#dbb45f" strokeWidth={2} />
          <text x={pathSamples[0].x} y={pathSamples[0].y + 28} fontSize={11} fill="#dbb45f" textAnchor="middle">START</text>
          {/* End marker */}
          <circle cx={pathSamples[pathSamples.length-1].x} cy={pathSamples[pathSamples.length-1].y} r={8} fill="#a44a3f" stroke="#dbb45f" strokeWidth={2} />
          <text x={pathSamples[pathSamples.length-1].x} y={pathSamples[pathSamples.length-1].y - 16} fontSize={11} fill="#dbb45f" textAnchor="middle">END</text>
          {/* Cursor halo while tracing */}
          {tracing && cursor && (
            <circle cx={cursor.x} cy={cursor.y} r={10} fill={proximityColor} fillOpacity={0.8} stroke={proximityColor} strokeWidth={2} />
          )}
        </svg>
      </div>
      <div className="flex gap-4 items-center flex-wrap justify-center">
        <div className="text-xs text-parchment-300">Progress: <span className="font-mono text-gold-300">{Math.round(progress * 100)}%</span></div>
        <div className="text-xs text-parchment-300">Cut quality: <span className="font-mono" style={{ color: proximityColor }}>{errorBucket.toUpperCase()}</span></div>
        {phase === 'tracing' && !tracing && progress === 0 && (
          <div className="text-xs text-parchment-400 italic">Press and hold from the green dot.</div>
        )}
        {phase === 'tracing' && tracing && (
          <div className="text-xs text-parchment-400 italic">Tracing… release to pause.</div>
        )}
        {phase === 'tracing' && !tracing && progress > 0 && (
          <>
            <div className="text-xs text-parchment-400 italic">Paused — resume from the green dot or finish.</div>
            <button className="btn btn-iris text-sm" onClick={() => finish()}>Finish the cut</button>
          </>
        )}
      </div>
    </div>
  );
}

// CRAFTING SCREEN — three phases (choose material → gauge → result).
// `prompt` shape:
//   { slot, skillName, materials, skill, phase, chosenMaterial,
//     quality, result, salvaged }
function CraftingScreen({ prompt, onPickMaterial, onResolveGauge, onConfirm }) {
  if (!prompt) return null;
  const { slot, skillName, materials, skill, phase, chosenMaterial, quality, result, salvaged } = prompt;
  const slotLabel = SLOT_LABEL[slot] || slot;
  const craftLabel = CRAFT_LABEL[skillName] || skillName;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-4 max-w-5xl mx-auto">
      <h2 className="font-display text-4xl text-gold-300 text-center">
        {SLOT_EMOJI[slot]} The {slotLabel} Workshop
      </h2>
      <div className="text-base text-parchment-300 italic text-center max-w-xl">
        {salvaged
          ? `You arrive with nothing in hand. The boss had this, ${slotLabel === 'Robes' ? 'wrapped around a regret' : 'shoved into a corner'}. It will have to do.`
          : `Your gather, on the bench. Your ${craftLabel} skill, in your hands. Make the thing.`}
      </div>
      <div className="text-sm text-moss-300">
        {craftLabel} skill: <b>{skill}</b> / {SKILL_MAX}
        {skill === 0 && <span className="text-parchment-400 italic"> — untrained. The gauge will be narrow.</span>}
      </div>

      {phase === 'choose' && (
        <CraftingChooseMaterial materials={materials} onPick={onPickMaterial} />
      )}

      {phase === 'gauge' && chosenMaterial && (
        <CraftingGauge skill={skill} material={chosenMaterial} salvaged={salvaged} onLock={onResolveGauge} />
      )}

      {phase === 'result' && result && (
        <CraftingResult quality={quality} material={chosenMaterial} result={result} onConfirm={onConfirm} />
      )}
    </div>
  );
}

function CraftingChooseMaterial({ materials, onPick }) {
  return (
    <>
      <div className="text-sm text-parchment-300 uppercase tracking-widest">Step 1 — pick the primary material</div>
      <div className="flex gap-4 flex-wrap justify-center">
        {materials.map((m) => (
          <button key={m.id + m.name} onClick={() => onPick(m.id)}
            className="w-56 min-h-[14rem] rounded-lg border-2 border-gold-500 bg-parchment-50 text-ink-800 p-3 text-left hover:scale-105 hover:shadow-2xl transition flex flex-col gap-2">
            <div className="font-display text-lg">{m.name}</div>
            <div className="text-xs uppercase tracking-wider text-ink-400">{SLOT_LABEL[m.slot] || m.slot} material</div>
            <div className="flex flex-wrap gap-1 text-xs font-mono">
              {Object.entries(m.stats || {}).map(([k, v]) => {
                const c = materialStatChip(k, v);
                return (
                  <span key={k} className="px-1.5 py-0.5 rounded bg-iris-100 text-iris-800" title={c.tip}>
                    {c.label} +{v}
                  </span>
                );
              })}
            </div>
            <div className="text-sm font-quill italic text-ink-500 mt-auto pt-2 border-t border-ink-300">"{m.flavor}"</div>
          </button>
        ))}
      </div>
    </>
  );
}

function CraftingGauge({ skill, material, salvaged, onLock }) {
  // Cursor oscillates 0..1 with a sine wave. Speed slows slightly as
  // skill rises so high-skill players get more thinking time. Click
  // STOP to lock — the result feeds quality via the parent's resolve.
  const [pos, setPos] = useState(0);
  const [locked, setLocked] = useState(false);
  const rafRef = useRef(null);
  const speed = 1.6 - skill * 0.12; // cycles per second-ish
  useEffect(() => {
    if (locked) return;
    let t0 = performance.now();
    const tick = (t) => {
      const elapsed = (t - t0) / 1000;
      // Triangle wave on [0,1]
      const phase = (elapsed * speed) % 2;
      const p = phase <= 1 ? phase : 2 - phase;
      setPos(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [locked, speed]);

  // Master + fine zone widths mirror the resolver's logic.
  const masterRadius = 0.06 + skill * 0.025;
  const fineRadius   = 0.18 + skill * 0.04;
  // Convert to percent for CSS.
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const lock = () => {
    if (locked) return;
    setLocked(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    // Briefly hold the result, then route up.
    setTimeout(() => onLock(pos), 250);
  };
  return (
    <>
      <div className="text-sm text-parchment-300 uppercase tracking-widest">Step 2 — settle the {material.name.toLowerCase()}</div>
      <div className="text-sm text-parchment-200 italic">
        {salvaged ? 'You will salvage no matter how steady the hand.' : 'Stop the cursor over the green zone. The wider band rewards a Fine result; the narrow centre rewards Master.'}
      </div>
      <div className="relative w-full max-w-2xl h-14 bg-ink-700 rounded-full border-2 border-ink-500 overflow-hidden shadow-inner">
        {/* Fine zone */}
        <div className="absolute top-0 bottom-0 bg-moss-700 opacity-60"
             style={{ left: pct(0.5 - fineRadius), width: pct(fineRadius * 2) }} />
        {/* Master zone */}
        <div className="absolute top-0 bottom-0 bg-gold-500 opacity-80"
             style={{ left: pct(0.5 - masterRadius), width: pct(masterRadius * 2) }} />
        {/* Centre line */}
        <div className="absolute top-0 bottom-0 w-px bg-parchment-100 opacity-40" style={{ left: '50%' }} />
        {/* Cursor */}
        <div className={`absolute top-0 bottom-0 w-1 ${locked ? 'bg-ember-300' : 'bg-parchment-50'} shadow-lg transition-colors`}
             style={{ left: pct(pos), transform: 'translateX(-50%)' }} />
      </div>
      <button onClick={lock} disabled={locked}
        className={`btn text-lg px-10 py-3 ${locked ? 'btn-ink' : 'btn-gold'}`}>
        {locked ? '…' : 'STOP'}
      </button>
    </>
  );
}

function CraftingResult({ quality, material, result, onConfirm }) {
  const qTone =
    quality === 'master' ? 'text-gold-300' :
    quality === 'fine'   ? 'text-moss-300' :
                           'text-ember-300';
  const isCard = result.kind === 'card';
  const item = isCard ? result.card : result.equipment;
  return (
    <>
      <div className={`font-display text-3xl ${qTone}`}>
        {QUALITY_LABEL[quality]}!
      </div>
      <div className="parchment-card-strong p-5 max-w-md w-full">
        <div className="text-xs uppercase tracking-widest text-parchment-300 mb-2">{isCard ? 'New card in your deck' : 'New equipment installed'}</div>
        <div className="font-display text-2xl text-gold-300">{item.name}</div>
        <div className="text-sm text-parchment-200 mt-2">{item.desc}</div>
        {/* v2.80: equipment install breakdown — mirror the spell-tray math
            pattern. Each bonus and material-derived effect surfaces as its
            own hoverable chip so the player sees exactly what the install
            grants, not just the prose desc. */}
        {!isCard && <EquipmentEffectBreakdown equipment={item} />}
        {item.flavor && <div className="text-sm font-quill italic text-parchment-400 mt-2 pt-2 border-t border-ink-500">"{item.flavor}"</div>}
        {isCard && item.effect?.resonatesWith?.length > 0 && (
          <div className="text-sm text-iris-300 italic mt-2">
            ✦ resonates: {item.effect.resonatesWith.join(', ')} (+{item.effect.resonanceBonus?.perTag || 0}/match)
          </div>
        )}
      </div>
      <button onClick={onConfirm} className="btn btn-gold text-lg px-8 py-3">Take it and move on</button>
    </>
  );
}

// v2.80: equipment effect chips. Mirrors the v2.79 spell-tray math
// pattern — every bonus key gets its own hoverable chip with an
// explanation. Used on the CraftingResult screen AND the act-cleared
// summary. New keys must be added here to be visible to players.


function RelicEffectBreakdown({ relic }) {
  const e = relic?.effect || {};
  const chips = [];
  if (e.passiveStrikeBonus)        chips.push({ icon: '⚔',  label: `+${e.passiveStrikeBonus} dmg on Strike casts`, title: `Any Effect card named "Strike" gets +${e.passiveStrikeBonus} base damage.` });
  if (e.permanentEnergyBonus)      chips.push({ icon: '⚡',  label: `+${e.permanentEnergyBonus} Energy every turn`, title: `Permanent: your Energy refill is +${e.permanentEnergyBonus} above baseline every turn.` });
  if (e.onCombatStart) {
    const oc = e.onCombatStart;
    if (oc.block)  chips.push({ icon: '🛡', label: `+${oc.block} Block at combat start`, title: `Every combat begins with ${oc.block} Block.` });
    if (oc.draw)   chips.push({ icon: '🃏', label: `+${oc.draw} draw at combat start`,   title: `Draw ${oc.draw} extra cards on turn 1 of every combat.` });
    if (oc.energy) chips.push({ icon: '⚡', label: `+${oc.energy} Energy on turn 1`,     title: `Gain ${oc.energy} extra Energy on turn 1 (one-shot per combat).` });
    if (oc.hp)     chips.push({ icon: '💚', label: `+${oc.hp} HP at combat start`,        title: `Heal ${oc.hp} HP at the start of every combat.` });
  }
  if (e.onEnemyDefeated) {
    const od = e.onEnemyDefeated;
    if (od.heal)   chips.push({ icon: '💚', label: `+${od.heal} HP per enemy defeated`, title: `Heal ${od.heal} HP each time you defeat an enemy.` });
    if (od.draw)   chips.push({ icon: '🃏', label: `+${od.draw} draw per enemy defeated`, title: `Draw ${od.draw} when you defeat an enemy.` });
    if (od.energy) chips.push({ icon: '⚡', label: `+${od.energy} Energy per enemy defeated`, title: `+${od.energy} Energy when you defeat an enemy.` });
  }
  if (e.onCombatEnd) {
    const ce = e.onCombatEnd;
    if (ce.heal)   chips.push({ icon: '💚', label: `+${ce.heal} HP at combat end`,      title: `Heal ${ce.heal} HP at the end of every combat won.` });
  }
  if (e.everyNthEffect) {
    const en = e.everyNthEffect;
    chips.push({ icon: '✦', label: `Every ${en.n}th cast +${en.extraDamage} dmg`, title: `Every ${en.n}th Effect you cast deals +${en.extraDamage} bonus damage.` });
  }
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 pt-2 border-t border-ink-500">
      <div className="text-[10px] uppercase tracking-widest text-gold-300 font-bold mb-1.5">Effects</div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <span key={i} title={c.title}
            className="text-[11px] font-mono px-2 py-1 rounded bg-gold-800/50 border border-gold-600 text-parchment-100 cursor-help">
            {c.icon} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function EquipmentEffectBreakdown({ equipment }) {
  const bonus = equipment?.bonus || {};
  const effect = equipment?.effect || {};
  const chips = [];
  // ---- bonus.* (standard install keys) ----
  if (bonus.maxHp)                 chips.push({ icon: '❤',  label: `+${bonus.maxHp} max HP`,                       title: `Permanent: your maximum HP is raised by ${bonus.maxHp}.` });
  if (bonus.startBlock)            chips.push({ icon: '🛡',  label: `+${bonus.startBlock} Block at combat start`,   title: `Every combat begins with ${bonus.startBlock} Block already up.` });
  if (bonus.healOnCombatStart)     chips.push({ icon: '💚',  label: `+${bonus.healOnCombatStart} HP at combat start`, title: `Heal ${bonus.healOnCombatStart} HP at the start of every combat.` });
  if (bonus.extraStartHand)        chips.push({ icon: '🃏',  label: `+${bonus.extraStartHand} draw on turn 1`,       title: `Draw ${bonus.extraStartHand} extra card on the first turn of every combat.` });
  if (bonus.energyOnCombatStart)   chips.push({ icon: '⚡',  label: `+${bonus.energyOnCombatStart} Energy on turn 1`, title: `Gain ${bonus.energyOnCombatStart} extra Energy on turn 1 of each combat (one-shot).` });
  if (bonus.permanentEnergyBonus)  chips.push({ icon: '⚡',  label: `+${bonus.permanentEnergyBonus} Energy every turn`, title: `Permanent: your Energy refills to +${bonus.permanentEnergyBonus} above baseline every turn.` });
  if (bonus.damageReduction)       chips.push({ icon: '🛡✦', label: `−${bonus.damageReduction} damage per hit`,       title: `Every incoming damage instance is reduced by ${bonus.damageReduction} (min 1 dmg taken). Capped at 2 total across equipment.` });
  if (bonus.startCombatVulnerable) chips.push({ icon: '🩸',  label: `+${bonus.startCombatVulnerable} Vuln to enemy at start`, title: `Enemy starts every combat at +${bonus.startCombatVulnerable * 25}% incoming damage (Vulnerable).` });
  if (bonus.startCombatWeak)       chips.push({ icon: '⛧',  label: `+${bonus.startCombatWeak} Weak to enemy at start`, title: `Enemy attacks deal -${bonus.startCombatWeak * 25}% damage at the start of every combat.` });
  if (bonus.strikeBonus)           chips.push({ icon: '⚔',  label: `+${bonus.strikeBonus} dmg to Strike casts`,       title: `Any Effect card named "Strike" gets +${bonus.strikeBonus} base damage on cast.` });
  // ---- effect.* (material-derived hooks read by the combat loop) ----
  if (effect.startOfTurnBlock)     chips.push({ icon: '🛡',  label: `+${effect.startOfTurnBlock} Block every turn`,   title: `At the start of every turn, gain ${effect.startOfTurnBlock} Block.` });
  if (effect.firstHitReduction)    chips.push({ icon: '🪨',  label: `−${effect.firstHitReduction} damage on first hit per combat`, title: `The very first enemy hit each combat is reduced by ${effect.firstHitReduction}.` });
  if (effect.combatEndHeal)        chips.push({ icon: '💚',  label: `+${effect.combatEndHeal} HP at combat end`,      title: `Heal ${effect.combatEndHeal} HP at the end of every combat (win or lose).` });
  if (effect.startCombatPoise)     chips.push({ icon: '🪞',  label: `+${effect.startCombatPoise} Poise at combat start`, title: `Every combat begins with ${effect.startCombatPoise} Poise (absorbs composure damage).` });
  if (effect.startCombatVulnerable) chips.push({ icon: '🩸',  label: `+${effect.startCombatVulnerable} Vuln to enemy at start`, title: `Enemy starts every combat at +${effect.startCombatVulnerable * 25}% incoming damage.` });
  if (effect.startCombatWeak)      chips.push({ icon: '⛧',  label: `+${effect.startCombatWeak} Weak to enemy at start`, title: `Enemy attacks deal -${effect.startCombatWeak * 25}% damage at the start of every combat.` });
  if (effect.onCombatStart) {
    const oc = effect.onCombatStart;
    if (oc.block)  chips.push({ icon: '🛡', label: `+${oc.block} Block at combat start`,  title: `Every combat begins with ${oc.block} Block.` });
    if (oc.draw)   chips.push({ icon: '🃏', label: `+${oc.draw} draw at combat start`,    title: `Draw ${oc.draw} extra cards on the first turn of every combat.` });
    if (oc.energy) chips.push({ icon: '⚡', label: `+${oc.energy} Energy at combat start`, title: `Gain ${oc.energy} extra Energy on turn 1 (one-shot).` });
    if (oc.hp)     chips.push({ icon: '💚', label: `+${oc.hp} HP at combat start`,         title: `Heal ${oc.hp} HP at the start of every combat.` });
  }
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 pt-2 border-t border-ink-500">
      <div className="text-[10px] uppercase tracking-widest text-iris-300 font-bold mb-1.5">Effects</div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <span key={i} title={c.title}
            className="text-[11px] font-mono px-2 py-1 rounded bg-iris-800/50 border border-iris-600 text-parchment-100 cursor-help">
            {c.icon} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RestScreen({ onChoose, hasFFTRows = false, isHandler = false, upgradedAnimals = new Set(), animals = {}, hp = 0, maxHp = 0, composure = 0, composureMax = 0 }) {
  // Handler: "Train an animal" is available when there's at least one
  // species not yet upgraded that has an upgrade defined.
  const hasTrainable = isHandler && Object.entries(animals).some(([id, def]) => def.upgrade && !upgradedAnimals.has(id));
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-md mx-auto">
      <h2 className="font-display text-3xl text-moss-300">A Rest Site</h2>
      <p className="font-quill italic text-parchment-200 text-center">A small campfire, a flat rock, the unmistakable feeling that someone has Recently Camped Here. The path will still be there in the morning. It's that kind of path.</p>
      <div className="flex gap-5">
        <span title="HP — physical health. 0 = defeat." className="font-mono text-moss-300">{hp}<span className="text-xs text-parchment-400">/{maxHp}</span><span className="text-[10px] uppercase text-parchment-400 ml-0.5">HP</span></span>
        <span title="Composure — verbal HP. 0 = lose your nerve." className="font-mono text-iris-200">{composure}<span className="text-xs text-parchment-400">/{composureMax}</span><span className="text-[10px] uppercase text-parchment-400 ml-0.5">Comp</span></span>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <button onClick={() => onChoose('heal')}    className="btn btn-moss">Sleep — restore 30% HP and Composure</button>
        <button onClick={() => onChoose('upgrade')} className="btn btn-gold">Study a card — upgrade one in your deck</button>
        {hasFFTRows && (
          <button onClick={() => onChoose('upgrade-spell')} className="btn btn-gold">Rehearse a spell — upgrade all 3 cards of one FFT row</button>
        )}
        {hasTrainable && (
          <button onClick={() => onChoose('train-animal')} className="btn btn-gold">Train an animal — bump a species from T1 to T2</button>
        )}
        <button onClick={() => onChoose('forget')}  className="btn btn-iris">Forget a card — remove one from your deck</button>
        <button onClick={() => onChoose('reflect')} className="btn btn-ember">Reflect — gain a random Passing Thought (one-shot)</button>
      </div>
    </div>
  );
}

function TrainAnimalScreen({ animals, upgradedAnimals, summonable, onPick }) {
  // Only offer species the player can actually field — i.e. summonable from a
  // lure in their deck (or a chain/spawn output of one). `summonable` is a Set;
  // when absent (older callers) fall back to no filter.
  const canField = (id) => !summonable || summonable.has(id);
  const eligible = Object.entries(animals)
    .filter(([id, def]) => def.upgrade && !upgradedAnimals.has(id) && !def.name?.includes('elite-only') && canField(id))
    .map(([id, def]) => ({ id, def }));
  return (
    <div className="min-h-screen flex flex-col p-6 gap-4 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="font-display text-4xl text-gold-300">Train an Animal</h2>
        <p className="text-base text-parchment-300 italic mt-1">Pick one species. From now on, summons of that animal arrive stronger.</p>
      </div>
      <div className="parchment-card p-3">
        {eligible.length === 0 ? (
          <div className="text-sm italic text-parchment-400">No animal here to train — you've either trained everything your lures can summon, or your deck holds no lure for a trainable species yet. Pick another option.</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {eligible.map(({ id, def }) => {
              const before = def;
              const after = { ...def, ...def.upgrade };
              const changes = [];
              if (after.attack !== before.attack) changes.push(`Atk ${before.attack} → ${after.attack}`);
              if (after.duration !== before.duration) changes.push(`Duration ${before.duration} → ${after.duration}`);
              if (before.onExit?.block !== after.onExit?.block) changes.push(`Exit Block ${before.onExit?.block || 0} → ${after.onExit?.block || 0}`);
              if (before.onExit?.damage !== after.onExit?.damage) changes.push(`Exit Dmg ${before.onExit?.damage || 0} → ${after.onExit?.damage || 0}`);
              if (before.onExit?.applyWeak !== after.onExit?.applyWeak) changes.push(`Exit Weak ${before.onExit?.applyWeak || 0} → ${after.onExit?.applyWeak || 0}`);
              if (before.adjacentSpawn?.extendSelfTurns !== after.adjacentSpawn?.extendSelfTurns) changes.push(`Spawn extend ${before.adjacentSpawn?.extendSelfTurns} → ${after.adjacentSpawn?.extendSelfTurns}`);
              if (before.predatorChain?.turnsToTrigger !== after.predatorChain?.turnsToTrigger) changes.push(`Chain ${before.predatorChain?.turnsToTrigger}T → ${after.predatorChain?.turnsToTrigger}T`);
              return (
                <button key={id} onClick={() => onPick(id)}
                  className="w-56 text-left rounded-lg border-2 border-gold-500 bg-ink-700 hover:bg-ink-600 hover:scale-[1.02] transition p-4 flex flex-col gap-1">
                  <div className="font-display text-xl text-parchment-50">{def.icon} {def.name}</div>
                  <div className="text-[11px] italic text-parchment-300">{def.flavor}</div>
                  <div className="text-[12px] text-gold-300 mt-1 leading-tight">{changes.join(' · ')}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button onClick={() => onPick(null)} className="btn btn-ink self-center">Back to rest</button>
    </div>
  );
}

function UpgradeCardScreen({ deck, onPick, lane = null }) {
  // Show NON-upgraded cards. v2 sentence cards are upgradable via the
  // auto-derived path in upgradeCard(), so the eligibility check now
  // accepts either an explicit `upgrade` field OR a v2 `slot` field.
  const isUpgradable = (c) => !c.upgraded && (c.upgrade || (c.slot && c.lane));
  const eligible = deck.filter(isUpgradable);
  const ineligible = deck.filter(c => !isUpgradable(c));
  // pendingUid: which card is queued for upgrade-confirmation. null =
  // browsing the list. When set, the confirm-modal renders over the
  // list and the player can commit or back out.
  const [pendingUid, setPendingUid] = useState(null);
  const pendingCard = pendingUid ? eligible.find(c => c.uid === pendingUid) : null;
  const pendingUpgraded = pendingCard ? upgradeCard(pendingCard) : null;
  return (
    <div className="min-h-screen flex flex-col p-6 gap-4 max-w-5xl mx-auto">
      <div className="text-center">
        <h2 className="font-display text-4xl text-gold-300">Study a Card</h2>
        <p className="text-base text-parchment-300 italic mt-1">Pick one to commit to memory. Click a card to preview the upgrade — then confirm.</p>
      </div>
      <div className="parchment-card p-3">
        <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">Eligible ({eligible.length})</div>
        <div className="flex flex-wrap gap-3">
          {eligible.length === 0 && (
            <div className="text-sm italic text-parchment-400">Nothing left to study — every card has been upgraded already. Sleep instead?</div>
          )}
          {eligible.map(card => {
            const upgraded = upgradeCard(card);
            const upDispName = upgraded.name || upgraded.phrase || card.name || card.phrase || '';
            return (
              <button key={card.uid} onClick={() => setPendingUid(card.uid)}
                className="w-52 min-h-[290px] rounded-md border-2 p-3 text-left bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl transition flex flex-col gap-1.5">
                {/* v3.1.4: full card body (Alan: "Study a Card screen
                    is still only showing stubs of cards. Show the whole card") */}
                <CardFullBody card={card} lane={lane || null} />
                <div className="text-xs mt-auto pt-2 border-t border-ink-300 text-moss-700">
                  → <b>{upDispName}</b>{(() => {
                    if (upgraded.effect && card.effect) {
                      const dBase = (upgraded.effect.base || 0) - (card.effect.base || 0);
                      if (dBase > 0) return `: base ${card.effect.base} → ${upgraded.effect.base}`;
                    }
                    if (upgraded.stats && card.stats) {
                      const k = ['handler','wit','jnsq'].find(s => (upgraded.stats[s] || 0) > (card.stats[s] || 0));
                      if (k) return `: ${k} ${card.stats[k]} → ${upgraded.stats[k]}`;
                    }
                    return summarizeEffects(upgraded.effects, upgraded.power, upgraded.cost, upgraded.stats, upgraded.effect);
                  })()}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {ineligible.length > 0 && (
        <div className="parchment-card p-3">
          <div className="text-xs uppercase text-parchment-400 mb-1 tracking-widest">Already studied or no upgrade path ({ineligible.length})</div>
          <div className="text-sm text-parchment-400 italic flex flex-wrap gap-2">
            {ineligible.map(c => <span key={c.uid}>{c.name || c.phrase || c.id}</span>)}
          </div>
        </div>
      )}
      <button onClick={() => onPick(null)} className="btn btn-ink self-center">Back to rest</button>

      {/* Confirm modal — fires when the player has clicked an eligible
          card. Shows the current card and the upgraded card side-by-side
          with a Confirm / Pick a different card pair of buttons. */}
      {pendingCard && pendingUpgraded && (
        <UpgradeConfirmModal
          before={pendingCard}
          after={pendingUpgraded}
          onConfirm={() => { const uid = pendingUid; setPendingUid(null); onPick(uid); }}
          onCancel={() => setPendingUid(null)}
          lane={lane}
        />
      )}
    </div>
  );
}

// v2.8: Remove a card from the deck at a rest site. Click → confirm.
// Same layout as the upgrade picker so the player recognizes the flow.

// v2.89: chaos-roll flash. Big centered modal showing the die face +
// outcome name + multiplier + side effects when a jnsq player rolls.
// Auto-dismisses after 3.5s via the parent's useEffect timer; click
// backdrop to dismiss early.
function ChaosRollFlash({ flash, onDismiss }) {
  const { roll, outcome, effectiveMult } = flash;
  const dieFace = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][roll - 1] || '🎲';
  const isGood = effectiveMult >= 1.0;
  const tone = roll === 6 ? 'text-gold-300 border-gold-400'
             : roll === 5 ? 'text-moss-300 border-moss-500'
             : roll === 4 ? 'text-iris-200 border-iris-500'
             : roll === 3 ? 'text-amber-300 border-amber-500'
             : roll === 2 ? 'text-amber-400 border-amber-600'
             :              'text-ember-300 border-ember-500';
  const sideEffects = [];
  if (outcome.hpDelta)       sideEffects.push(`${outcome.hpDelta > 0 ? '+' : ''}${outcome.hpDelta} HP`);
  if (outcome.draw)          sideEffects.push(`Draw ${outcome.draw}`);
  if (outcome.energyNext)    sideEffects.push(`+${outcome.energyNext} Energy`);
  if (outcome.discardRandom) sideEffects.push(`Discard ${outcome.discardRandom} random`);
  if (outcome.vuln)          sideEffects.push(`+${outcome.vuln} Vuln on enemy`);
  return (
    <div onClick={onDismiss}
         className="fixed inset-0 z-50 bg-ink-900 bg-opacity-70 flex items-center justify-center cursor-pointer">
      <div className={`parchment-card-strong p-6 border-2 ${tone} flex flex-col items-center gap-2 max-w-md animate-pulse`}>
        <div className="text-[10px] uppercase tracking-widest text-parchment-300">Chaos Dice</div>
        <div className={`text-7xl font-mono ${tone.split(' ')[0]}`}>{dieFace}</div>
        <div className={`font-display text-3xl ${tone.split(' ')[0]}`}>{outcome.name}</div>
        <div className="text-sm font-mono text-parchment-200">
          Damage <b className={isGood ? 'text-moss-300' : 'text-ember-300'}>×{effectiveMult.toFixed(2)}</b>
        </div>
        {sideEffects.length > 0 && (
          <div className="text-xs text-parchment-300 italic mt-1">
            {sideEffects.join(' · ')}
          </div>
        )}
        <div className="text-[10px] text-parchment-500 italic mt-2">click to dismiss</div>
      </div>
    </div>
  );
}

// Relic Acquired announcement. Full-screen click-to-dismiss overlay so a
// relic pickup is an EVENT, not a line in the log. Shows what the thing
// actually does (desc) front-and-center — that's the part players were
// missing when relics silently appeared in the state bar.
function RelicAcquiredOverlay({ relic, source, onDismiss }) {
  const tone = relic.rarity === 'rare'     ? { text: 'text-gold-300',   border: 'border-gold-400',   badge: 'bg-gold-600 text-ink-800' }
             : relic.rarity === 'uncommon' ? { text: 'text-iris-300',   border: 'border-iris-400',   badge: 'bg-iris-700 text-parchment-50' }
             :                               { text: 'text-parchment-200', border: 'border-parchment-500', badge: 'bg-ink-600 text-parchment-200' };
  return (
    <div onClick={onDismiss}
         className="fixed inset-0 z-50 bg-ink-900 bg-opacity-80 flex items-center justify-center cursor-pointer p-4">
      <div className={`parchment-card-strong p-6 border-2 ${tone.border} flex flex-col items-center gap-2 max-w-md text-center`}>
        <div className="text-[10px] uppercase tracking-widest text-parchment-300">Relic Acquired — {source}</div>
        <div className={tone.text}><Icon name="relic" size="3.5rem" /></div>
        <div className={`font-display text-3xl ${tone.text}`}>{relic.name}</div>
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold ${tone.badge}`}>{relic.rarity}</span>
        <div className="text-sm text-parchment-100 mt-1">{relic.desc}</div>
        {relic.flavor && <div className="text-xs text-parchment-400 italic">“{relic.flavor}”</div>}
        <div className="text-[10px] text-parchment-500 italic mt-2">click to continue</div>
      </div>
    </div>
  );
}

// v2.85: pick-one-of-two-to-forget modal. Used when an event triggers
// loseRandomCard — instead of silently dropping a random card, the
// player sees two candidates and explicitly chooses which to forget.
// No back button: the consequence has to land.
function ForgetTwoModal({ cards, onPick, lane = null }) {
  return (
    <div className="fixed inset-0 bg-ink-900 bg-opacity-85 flex items-center justify-center z-50 p-6">
      <div className="parchment-card-strong p-6 max-w-3xl w-full flex flex-col gap-4">
        <div className="text-center">
          <h2 className="font-display text-3xl text-ember-300">Forget a Card</h2>
          <p className="text-sm text-parchment-300 italic mt-1">
            Pick one of the two. The other returns to your deck. The chosen card is gone for the rest of this run.
          </p>
        </div>
        <div className="flex gap-4 justify-center flex-wrap">
          {cards.map(card => (
            <button key={card.uid} onClick={() => onPick(card.uid)}
              className="w-[200px] min-h-[290px] rounded-md border-2 p-3 text-left bg-parchment-50 text-ink-800 border-ember-500 hover:scale-105 hover:shadow-2xl transition flex flex-col gap-1.5">
              <CardFullBody card={card} lane={lane || null} />
            </button>
          ))}
        </div>
        <div className="text-[11px] text-parchment-400 italic text-center">Click the card you'd rather lose.</div>
      </div>
    </div>
  );
}

// Lure tutor picker — shows the lures available in a source pile (draw pile
// or discard) and pulls the clicked one to hand. Cancel closes without a
// pick (the tutor card is already spent). Modeled on ForgetTwoModal.
function LurePicker({ cards, source, onPick, onCancel, lane = null }) {
  const label = source === 'deck' ? 'draw pile' : 'discard';
  return (
    <div className="fixed inset-0 bg-ink-900 bg-opacity-85 flex items-center justify-center z-50 p-6"
         data-testid="lure-picker"
         onClick={onCancel}>
      <div className="parchment-card-strong p-6 max-w-3xl w-full flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <h2 className="font-display text-3xl text-moss-300">Pick a Lure</h2>
          <p className="text-sm text-parchment-300 italic mt-1">
            From your {label} — the lure you choose goes to your hand.
          </p>
        </div>
        <div className="flex gap-4 justify-center flex-wrap">
          {cards.map(card => (
            <button key={card.uid} onClick={() => onPick(card.uid)}
              data-testid="lure-picker-card" data-card-id={card.id}
              className="w-[200px] min-h-[290px] rounded-md border-2 p-3 text-left bg-parchment-50 text-ink-800 border-moss-500 hover:scale-105 hover:shadow-2xl transition flex flex-col gap-1.5">
              <CardFullBody card={card} lane={lane || null} />
            </button>
          ))}
        </div>
        <button onClick={onCancel}
          className="self-center text-[11px] text-parchment-400 italic hover:text-parchment-200 underline">
          Never mind. (The card is already spent.)
        </button>
      </div>
    </div>
  );
}

// v3.4.15 — Rehearse-a-Spell rest picker. Shows every FFT row the player
// owns ALL 3 cards of (across hand/deck/discard/exiled/tray). Picking
// upgrades each owned copy of the row's cards. Already-upgraded cards
// are no-ops.
function UpgradeSpellScreen({ hand, deck, discard, exiled, tray, onPick }) {
  const allOwned = [...hand, ...deck, ...discard, ...exiled,
                    ...(tray ? [tray.intro, tray.subject, tray.target, ...(tray.modifiers || [])].filter(Boolean) : [])];
  // Build per-row ownership snapshot: which slots are owned, how many
  // copies, and whether the player still has any non-upgraded ones.
  const byRow = {};
  for (const c of allOwned) {
    if (!c.setId) continue;
    if (!byRow[c.setId]) byRow[c.setId] = { slots: new Set(), cards: [] };
    byRow[c.setId].slots.add(c.setSlot);
    byRow[c.setId].cards.push(c);
  }
  // Eligible: at least 3 slots filled (a complete row) AND at least one
  // card in the row is still unupgraded. Wit-only since handler retired
  // FFT 2026-05-31.
  const eligibleRows = WIT_ROWS.filter(r => {
    const own = byRow[r.id];
    if (!own || own.slots.size < 3) return false;
    return own.cards.some(c => !c.upgraded);
  });
  const allOwnedRows = WIT_ROWS.filter(r => byRow[r.id]?.slots.size === 3);
  return (
    <div className="min-h-screen flex flex-col p-6 gap-4 max-w-5xl mx-auto">
      <div className="text-center">
        <h2 className="font-display text-4xl text-gold-300">Rehearse a Spell</h2>
        <p className="text-base text-parchment-300 italic mt-1">Pick one fully-formed thought. Every copy of its three cards in your deck upgrades together.</p>
      </div>
      <div className="parchment-card p-3">
        <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">Eligible spells ({eligibleRows.length})</div>
        {eligibleRows.length === 0 && (
          <div className="text-sm italic text-parchment-400">
            {allOwnedRows.length === 0
              ? 'No complete FFT row in your deck yet. Defeat an elite to earn one.'
              : 'Every spell you own is already fully upgraded. Sleep instead?'}
          </div>
        )}
        <div className="flex flex-col gap-3">
          {eligibleRows.map(row => {
            const own = byRow[row.id];
            const copies = own.cards.length;
            const upgradedCount = own.cards.filter(c => c.upgraded).length;
            const schoolColor = row.schoolId === 'slowburn' ? 'text-emerald-300'
              : row.schoolId === 'thorns' ? 'text-rose-300'
              : row.schoolId === 'crescendo' ? 'text-amber-300'
              : row.schoolId === 'bluster' ? 'text-ember-300'
              : row.schoolId === 'ballooning' ? 'text-sky-300'
              : row.schoolId === 'ballistic' ? 'text-rose-400'
              : 'text-amber-300';
            return (
              <button key={row.id} onClick={() => onPick(row.id)}
                      className="text-left rounded-lg border-2 border-gold-500 bg-ink-700 hover:bg-ink-600 hover:scale-[1.01] transition p-4 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display text-xl text-iris-200">{row.name}</div>
                  <div className={`text-[11px] uppercase ${schoolColor}`}>{row.schoolId}</div>
                </div>
                <div className="text-sm italic text-parchment-100">"{row.canonical}"</div>
                <div className="text-[12px] text-gold-300 mt-1">★ {row.riderDesc || '(rider)'}</div>
                <div className="text-[11px] text-parchment-400 mt-1">
                  {copies} card{copies === 1 ? '' : 's'} in deck · {upgradedCount}/{copies} already upgraded
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <button onClick={() => onPick(null)} className="btn btn-ink self-center">Back to rest</button>
    </div>
  );
}

function ForgetCardScreen({ deck, onPick, lane = null }) {
  const [pendingUid, setPendingUid] = useState(null);
  const pendingCard = pendingUid ? deck.find(c => c.uid === pendingUid) : null;
  return (
    <div className="min-h-screen flex flex-col p-6 gap-4 max-w-5xl mx-auto">
      <div className="text-center">
        <h2 className="font-display text-4xl text-iris-300">Forget a Card</h2>
        <p className="text-base text-parchment-300 italic mt-1">Pick one to lose forever. Slim decks hit harder.</p>
      </div>
      <div className="parchment-card p-3">
        <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">Your deck ({deck.length})</div>
        <div className="flex flex-wrap gap-3">
          {deck.length === 0 && (
            <div className="text-sm italic text-parchment-400">Empty deck. Nothing to forget.</div>
          )}
          {deck.map(card => (
            <button key={card.uid} onClick={() => setPendingUid(card.uid)}
              className="w-[200px] min-h-[290px] rounded-md border-2 p-3 text-left bg-parchment-50 text-ink-800 border-iris-500 hover:scale-105 hover:shadow-2xl transition flex flex-col gap-1.5">
              <CardFullBody card={card} lane={lane || null} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        <button onClick={() => onPick(null)} className="btn bg-ink-700 text-parchment-200">Back</button>
      </div>
      {pendingCard && (
        <div className="fixed inset-0 bg-ink-900 bg-opacity-80 flex items-center justify-center z-50 p-6">
          <div className="parchment-card-strong p-6 max-w-md flex flex-col gap-4 items-center">
            <h3 className="font-display text-2xl text-iris-300">Forget this card?</h3>
            <div className="font-display text-lg">{pendingCard.name || pendingCard.phrase}</div>
            <div className="text-xs italic text-parchment-300">Once forgotten, it's out of your deck for the rest of the run.</div>
            <div className="flex gap-3">
              <button onClick={() => setPendingUid(null)} className="btn bg-ink-700 text-parchment-200">Cancel</button>
              <button onClick={() => onPick(pendingUid)} className="btn btn-iris">Forget</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Side-by-side "before / after" card preview that locks the upgrade-at-
// rest decision behind an explicit confirm step. Renders a full-screen
// dim overlay so the choice is unambiguous.
function UpgradeConfirmModal({ before, after, onConfirm, onCancel, lane = null }) {
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-6">
      <div className="parchment-card-strong p-6 max-w-3xl w-full flex flex-col gap-4 border-2 border-gold-500">
        <h3 className="font-display text-3xl text-gold-300 text-center">Confirm upgrade?</h3>
        <p className="text-base text-parchment-200 italic text-center">You can study only one card at this rest. Make sure this is the one.</p>
        <div className="flex gap-4 justify-center items-stretch flex-wrap">
          <UpgradePreviewCard card={before} label="Current" tone="ink" lane={lane} />
          <div className="self-center font-display text-4xl text-gold-400 px-2">→</div>
          <UpgradePreviewCard card={after} label="Upgraded" tone="moss" lane={lane} />
        </div>
        <div className="flex gap-3 justify-center mt-2">
          <button onClick={onConfirm} className="btn btn-gold text-lg px-8 py-3">Confirm upgrade</button>
          <button onClick={onCancel}  className="btn btn-ink  text-base px-6 py-3">Pick a different card</button>
        </div>
      </div>
    </div>
  );
}

// Detail card-face used inside the upgrade confirm modal. Same shape as
// the hand-card display but slightly larger and always-bright (the
// modal sits over a dimmed backdrop).
function UpgradePreviewCard({ card, label, tone, lane = null }) {
  const border = tone === 'moss' ? 'border-moss-500' : 'border-ink-500';
  const labelColor = tone === 'moss' ? 'text-moss-300' : 'text-parchment-300';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-xs uppercase tracking-widest ${labelColor}`}>{label}</div>
      <div className={`w-56 min-h-[18rem] rounded-lg border-2 p-3 bg-parchment-50 text-ink-800 ${border} flex flex-col gap-2`}>
        <CardFullBody card={card} lane={lane || null} />
      </div>
    </div>
  );
}

// Format a card's upgraded effects/power/cost as a human-readable summary
// for the upgrade picker. Doesn't aim to be exhaustive — just enough to
// see what the upgrade changes.
function summarizeEffects(effects, power, cost, stats, effect) {
  const bits = [];
  if (cost !== undefined) bits.push(`cost ${cost}`);
  if (stats) {
    if (stats.handler) bits.push(`+${stats.handler} Handler`);
    if (stats.wit)      bits.push(`+${stats.wit} Wit`);
    if (stats.jnsq)     bits.push(`+${stats.jnsq} Jnsq`);
  }
  if (effect) {
    const dmgType = effect.damageType === 'physical' ? 'phys' : 'comp';
    bits.push(`${effect.base} + ${effect.scaleBy}×${effect.multiplier} ${dmgType}`);
    if (effect.rider) {
      if (effect.rider.weak)       bits.push(`+${effect.rider.weak} Weak`);
      if (effect.rider.vulnerable) bits.push(`+${effect.rider.vulnerable} Vuln`);
      if (effect.rider.block)      bits.push(`${effect.rider.block} Block`);
      if (effect.rider.draw)       bits.push(`draw ${effect.rider.draw}`);
    }
    if (effect.exhaust) bits.push('Exhaust');
  }
  if (effects) {
    if (effects.block)      bits.push(`${effects.block} Block`);
    if (effects.draw)       bits.push(`draw ${effects.draw}`);
    if (effects.energy)     bits.push(`+${effects.energy} Energy`);
    if (effects.vulnerable) bits.push(`${effects.vulnerable} Vuln`);
    if (effects.weak)       bits.push(`${effects.weak} Weak`);
    if (effects.hp)         bits.push(`+${effects.hp} HP`);
    if (effects.exhaust)    bits.push('Exhaust');
  }
  if (power) {
    const k = power.startOfTurn ? 'turn start'
            : power.endOfTurn ? 'turn end'
            : power.onEffectCardPlayed ? 'per effect'
            : '';
    const fx = power.startOfTurn || power.endOfTurn || power.onEffectCardPlayed || {};
    const fxBits = [];
    if (fx.composure)  fxBits.push(`${fx.composure} comp`);
    if (fx.block)      fxBits.push(`${fx.block} Block`);
    if (fx.draw)       fxBits.push(`draw ${fx.draw}`);
    if (fx.energy)     fxBits.push(`+${fx.energy} Energy`);
    if (fx.vulnerable) fxBits.push(`${fx.vulnerable} Vuln`);
    if (fx.weak)       fxBits.push(`${fx.weak} Weak`);
    if (fxBits.length) bits.push(`${k}: ${fxBits.join(', ')}`);
  }
  return bits.join(' · ');
}

function ActClearedScreen({ act, equipment, isFinalAct, onContinue }) {
  const claimed = equipment[equipment.length - 1];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-xl mx-auto">
      <h2 className="font-display text-5xl text-moss-300">{act.name} — Cleared</h2>
      <p className="font-quill italic text-parchment-300 text-center">
        {act.flavor}
      </p>
      <div className="parchment-card-strong p-4 w-full">
        <div className="text-xs uppercase text-parchment-300 mb-1">Equipment earned this act</div>
        <div className="text-gold-300 font-display text-lg">⚜ {claimed?.name}</div>
        <div className="text-sm font-quill text-parchment-200">{claimed?.desc}</div>
      </div>
      <button onClick={onContinue} className="btn btn-gold text-lg px-8 py-3">
        {isFinalAct ? 'See your Graduation' : `Continue to ${ACTS[ACTS.findIndex(a => a.id === act.id) + 1]?.name || 'the next path'}`}
      </button>
    </div>
  );
}

function GraduationScreen({ equipment, familiar, familiarName, onRetry }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-2xl mx-auto">
      <h2 className="font-display text-6xl text-gold-300 tracking-widest text-center">Graduation Achieved</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">
        You return to the school, hands full of trophies. The robes settle on
        your shoulders. The staff knows your weight. The gem warms in your
        pocket. The ring sits cold against your knuckle. You have graduated.
      </p>
      <div className="parchment-card-strong p-4 w-full">
        <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">Final Loadout</div>
        <ul className="text-sm font-quill space-y-1">
          {equipment.map(eq => (
            <li key={eq.id}>
              <span className="text-gold-300">⚜ {eq.name}</span>
              <span className="text-parchment-300 ml-2">— {eq.desc}</span>
            </li>
          ))}
        </ul>
      </div>
      {familiar && (
        <div className="parchment-card-strong p-4 w-full">
          <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">Loyal Familiar</div>
          <div className="flex items-center gap-3">
            <div className="text-4xl">{familiar.emoji}</div>
            <div className="text-sm font-quill">
              <div><span className="text-gold-300">{familiarName || familiar.species}</span> <span className="text-parchment-300">the {familiar.species}</span></div>
              <div className="text-parchment-300 text-xs">{familiar.desc}</div>
            </div>
          </div>
        </div>
      )}
      <button onClick={onRetry} className="btn btn-gold text-lg px-8 py-3">Walk the Path Again</button>
    </div>
  );
}

function EndScreen({ win, onRetry }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h2 className={`font-display text-5xl ${win ? 'text-moss-300' : 'text-ember-400'}`}>
        {win ? 'Graduation Achieved' : 'The Path Ends Here'}
      </h2>
      <p className="font-quill italic text-parchment-300 max-w-xl text-center">
        {win ? 'You return to the school, hands full of trophies.' : 'Your story ends in failure — for now. The school will receive another apprentice tomorrow.'}
      </p>
      <button onClick={onRetry} className="btn btn-gold text-lg px-8 py-3">
        {win ? 'Walk the Path Again' : 'Try Again'}
      </button>
    </div>
  );
}
