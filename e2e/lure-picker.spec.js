import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, playCardById, endTurn } from './helpers/lab.js';

// Verifies the lure-tutor flow: "Rummage the Satchel" opens the LurePicker,
// and choosing a lure puts it in hand.
//
// Determinism: stack Rummage + extra Fish Food so the opening hand holds a
// Rummage AND the draw pile still holds a lure for it to fetch.

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
  await gotoLab(page, 'handler');
  for (let i = 0; i < 6; i++) await addCard(page, RUMMAGE);
  for (let i = 0; i < 8; i++) await addCard(page, FISH);
  await fightEnemy(page, 'Loom Familiar');

  expect(await ensureInHand(page, RUMMAGE)).toBeTruthy();

  const fishBefore = await handCardById(page, FISH).count();

  await playCardById(page, RUMMAGE);

  // Picker opens.
  const picker = page.getByTestId('lure-picker');
  await expect(picker).toBeVisible();

  // Choose the first lure offered.
  await picker.locator('button').first().click();

  // Picker closes and a lure landed in hand.
  await expect(picker).toHaveCount(0);
  expect(await handCardById(page, FISH).count()).toBeGreaterThan(fishBefore);
});
