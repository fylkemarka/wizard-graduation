// Handler v3 slice 4 — keeper taunt / interception (Alan, 2026-06-08; FIRST PASS).
//
// HARD CONSTRAINT: animals have NO HP. "Targeting an animal" = the existing
// maul mechanic — a strike absorbed by Block, removing an animal only if it
// breaks through. This slice adds: a defensive KEEPER (the Drystone Ox) on the
// board INTERCEPTS the maul. It takes the hit for the team and is the one torn,
// ahead of the strongest animal. A fully-blocked maul still tears nobody.
//
// Determinism: forceSpecies=goose pins Birdseed → goose; lures arrive in 1
// turn; ?forceMaul makes the NEXT intent roll the enemy's maul (consumed once)
// so we control exactly when it lands — no waiting on Silk Wraith's own
// weighted mauls.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const BIRDSEED = 'cv2-l-birdseed';      // → goose (atk 6) under forceSpecies
const OATS = 'cv2-l-bag-of-oats';       // → Drystone Ox (atk 2, keeper)
const STEP_BACK = 'c-defend-handler';   // handler starter: +6 player Block

const oxPill = (page) => page.locator('[data-testid="board-animal"][data-animal-id="ox"]');
const goosePill = (page) => page.locator('[data-testid="board-animal"][data-animal-id="goose"]');

async function ack(page) {
  const a = page.getByRole('button', { name: 'Acknowledged' });
  if ((await a.count()) > 0) await a.click();
}

// Play a card whenever it's playable; otherwise pass turns until it shows up.
// Keeps the Ox keeper (dur 6) alive across the wait since no maul is armed yet.
async function ensurePlay(page, cardId, maxTurns = 8) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
    await endTurn(page); await ack(page);
  }
  return false;
}

// Play a card if it's in hand and playable THIS turn — never ends the turn.
async function playOnce(page, cardId) {
  const c = handCardById(page, cardId).first();
  if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') { await c.click(); return true; }
  return false;
}

test('an unblocked maul removes the KEEPER (intercepts) instead of the stronger animal', async ({ page }) => {
  // An Ox (atk 2, keeper) beside a Goose (atk 6). Vanilla maul tears the
  // STRONGEST → the goose. Keeper taunt flips it: the OX is torn, goose lives.
  await gotoLab(page, 'handler', { seed: 7, forceSpecies: 'goose' });
  for (let i = 0; i < 4; i++) await addCard(page, OATS);
  for (let i = 0; i < 6; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Silk Wraith');

  // Get the Ox out first (keeper — it persists while we set up the goose).
  expect(await ensurePlay(page, OATS)).toBeTruthy();
  await endTurn(page); await ack(page);
  await expect(oxPill(page).first()).toBeVisible();

  // Stage a goose, arm the maul for next turn, end the turn (goose arrives).
  expect(await ensurePlay(page, BIRDSEED)).toBeTruthy();
  await page.evaluate(() => { window.__forceMaul = true; });
  await endTurn(page); await ack(page);

  // Both animals out, maul telegraphed.
  await expect(oxPill(page).first()).toBeVisible();
  await expect(goosePill(page).first()).toBeVisible();
  await expect(page.getByText(/🦷/).first()).toBeVisible();

  // Resolve the maul with no extra Block. The Ox braces 6/turn but the maul is
  // 7, so 1 leaks past Block → it fires. Keeper taunt → the OX is torn.
  await endTurn(page); await ack(page);
  await expect(page.getByTestId('hand')).toBeVisible(); // no render crash

  // Interception: the keeper took the hit. Ox gone, goose still on the board.
  await expect(oxPill(page)).toHaveCount(0);
  await expect(goosePill(page).first()).toBeVisible();
});

test('a fully-blocked maul tears nobody — not even the keeper', async ({ page }) => {
  // The Ox keeper on the board vs The Moth Choir — one of slice 4's new
  // animal-targeting enemies, whose maul is a MODEST 5 (pressure not erase).
  // The player covers it with a single Step Back (+6 PLAYER Block — committed
  // during the player turn, so fully visible to the maul's leak check). Nothing
  // leaks → the maul tears no animal, keeper included. This proves the
  // Block-absorbs-the-maul path is preserved under interception.
  await gotoLab(page, 'handler', { seed: 7 });
  for (let i = 0; i < 4; i++) await addCard(page, OATS);
  await fightEnemy(page, 'The Moth Choir');

  // Get the Ox out, then arm the maul the SAME turn it arrives — keep the turn
  // count low so the Ox's 6-turn life doesn't lapse. Maul telegraphs next turn.
  expect(await ensurePlay(page, OATS)).toBeTruthy();
  await page.evaluate(() => { window.__forceMaul = true; });
  await endTurn(page); await ack(page);
  await expect(oxPill(page).first()).toBeVisible();
  await expect(page.getByText(/🦷/).first()).toBeVisible();

  // Maul turn: play a Step Back (+6 Block ≥ the 5 maul) WITHOUT ending the turn
  // first (block must be up when the maul resolves), then resolve.
  expect(await playOnce(page, STEP_BACK)).toBeTruthy();
  await endTurn(page); await ack(page);
  await expect(page.getByTestId('hand')).toBeVisible();

  // Block held: the keeper survives — a fully-blocked maul tears nobody.
  await expect(oxPill(page).first()).toBeVisible();
});
