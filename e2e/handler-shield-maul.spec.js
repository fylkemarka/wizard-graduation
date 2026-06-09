// Regression for the Summoned Shield stale-closure bug (Alan, 2026-06-06):
// the shield tactic routes animal attacks into Block & Poise during the
// end-turn pre-pass, but applyEnemyIntent runs synchronously in the SAME
// pass and read `block` from the stale closure — so brace block was
// invisible to the enemy swing (and its absolute setBlock(wBlock) commit
// then clobbered the brace entirely). Player report: a maul tore an animal
// through a full brace. Fixed via shieldBraceRef.
//
// Determinism: seed 7 + forceSpecies=goose (6 atk each → 12 brace).
// Silk Wraith's forced maul swings 7. Fully braced → ZERO HP leak. The
// no-leak assertion also covers the no-tear rule (maul only tears when
// HP leaks), without depending on unfed-exit timing of the birds.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

const BIRDSEED = 'cv2-l-birdseed';
const SHIELD = 'c-tactic-shield';

const readHp = async (page) => {
  const txt = await page.locator('[title^="HP — physical health"]').first().innerText();
  return parseInt(txt, 10);
};

test('a fully-braced maul (Summoned Shield) leaks no HP', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'goose' });
  for (let i = 0; i < 12; i++) await addCard(page, BIRDSEED);
  for (let i = 0; i < 4; i++) await addCard(page, SHIELD);
  await fightEnemy(page, 'Silk Wraith');

  // Arm the forced maul — consumed by the end-of-turn-1 intent roll, so the
  // maul telegraphs as turn 2's intent (by which point both geese are out).
  await page.evaluate(() => { window.__forceMaul = true; });

  const playIfHeld = async (cardId, max = 1) => {
    for (let p = 0; p < max; p++) {
      const c = handCardById(page, cardId).first();
      if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') {
        await c.click();
      }
    }
  };

  // Turn 1: stage two birds; set the Shield stance when drawn (tactics are
  // per-combat stances — playing it early keeps it active for the maul turn).
  await playIfHeld(BIRDSEED, 2);
  await playIfHeld(SHIELD);
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();

  // BOTH geese arrived (brace 12 ≥ maul); maul telegraphed next.
  await expect(page.locator('[data-testid="board-animal"][data-animal-id="goose"]')).toHaveCount(2);
  await expect(page.getByText(/🦷/).first()).toBeVisible();

  // Turn 2: ensure the stance is set, then resolve. The pre-pass braces
  // 2 × 6 = 12 Block; the maul's 7 must be fully absorbed.
  await playIfHeld(SHIELD);
  const hpBefore = await readHp(page);
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible(); // no render crash

  // The brace held: not a point of HP leaked, and — since the maul only
  // tears on a leak — BOTH geese are still on the board.
  const hpAfter = await readHp(page);
  expect(hpAfter).toBe(hpBefore);
  await expect(page.locator('[data-testid="board-animal"][data-animal-id="goose"]')).toHaveCount(2);
});
