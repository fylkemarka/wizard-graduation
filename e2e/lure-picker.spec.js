import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, playCardById, endTurn } from './helpers/lab.js';

// Verifies the lure-tutor flow: "Rummage the Satchel" opens the LurePicker,
// and choosing a lure puts it in hand.
//
// Determinism: a seed fixes shuffles/draws so the run is reproducible, and we
// pick the Fish Food by id in the picker rather than the .first() button — the
// draw pile also holds the starter Tender Greens, so first-button order is
// shuffle-dependent and would flake.

const RUMMAGE = 'c-rummage';
const FISH = 'cv2-l-fish-food';

async function ensureInHand(page, cardId, maxTurns = 4) {
  for (let i = 0; i < maxTurns; i++) {
    if (await handCardById(page, cardId).count() > 0) return true;
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
  }
  return (await handCardById(page, cardId).count()) > 0;
}

test('Rummage the Satchel opens the lure picker and pulls a lure to hand', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7 });
  // Exactly ONE Rummage so the exhaust check below is unambiguous: with
  // duplicates, leftover copies discard at end of turn and pollute the count.
  await addCard(page, RUMMAGE);
  for (let i = 0; i < 8; i++) await addCard(page, FISH);
  // Silk Wraith, not Loom Familiar: over a long draw loop the Loom's steal
  // modal would pop and intercept clicks. The Wraith never interrupts.
  await fightEnemy(page, 'Silk Wraith');

  expect(await ensureInHand(page, RUMMAGE, 15)).toBeTruthy();

  const fishBefore = await handCardById(page, FISH).count();

  await playCardById(page, RUMMAGE);

  // Picker opens.
  const picker = page.getByTestId('lure-picker');
  await expect(picker).toBeVisible();

  // Pick the Fish Food specifically (8 were stacked into the deck, so one is
  // reliably in the draw pile for Rummage to offer).
  await picker.locator(`[data-card-id="${FISH}"]`).first().click();

  // Picker closes and a Fish Food landed in hand.
  await expect(picker).toHaveCount(0);
  expect(await handCardById(page, FISH).count()).toBeGreaterThan(fishBefore);

  // Rummage is now 0-cost + exhaust (Alan, 2026-06-08): it should be in the
  // exiled pile, NOT recycled to discard. Open the discard pile and confirm
  // no Rummage card is listed there.
  await page.getByTestId('discard-pile-btn').click();
  await expect(page.getByText('🗑 Discard pile', { exact: false })).toBeVisible();
  expect(await page.locator(`[data-card-id="${RUMMAGE}"]`).count()).toBe(0);
  await page.getByRole('button', { name: '✕' }).click();
});
