import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, playCardById, endTurn } from './helpers/lab.js';

// Smoke-tests the 2026-06-01 Handler booster cards through real combat UI:
// a power install (Well-Drilled), and the Last Supper click-target prompt.
// The point is runtime safety — a clean `vite build` does NOT catch the kind
// of render-time crash these new prompts/pills could introduce.

const WELL_DRILLED = 'c-well-drilled';
const LAST_SUPPER = 'c-last-supper';
const BIRDSEED = 'cv2-l-birdseed';

async function ensureInHand(page, cardId, maxTurns = 5) {
  for (let i = 0; i < maxTurns; i++) {
    if (await handCardById(page, cardId).count() > 0) return true;
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
  }
  return (await handCardById(page, cardId).count()) > 0;
}

// Wait until a summoned animal pill appears in the spell tray. Birdseed
// arrives in 1 turn, so a couple of end-turns guarantees a body.
async function ensureAnimalStaged(page, maxTurns = 5) {
  for (let i = 0; i < maxTurns; i++) {
    // Animal pills carry their attack/flop readout — match the "/ turn" or
    // "(flops)" text the V2SpellTray renders for a standing animal.
    if (await page.getByText(/\/ turn|\(flops\)/).count() > 0) return true;
    // Stage a birdseed if one is in hand to seed the board.
    if (await handCardById(page, BIRDSEED).count() > 0) {
      const card = handCardById(page, BIRDSEED).first();
      if ((await card.getAttribute('data-playable')) === 'true') await card.click();
    }
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
  }
  return (await page.getByText(/\/ turn|\(flops\)/).count()) > 0;
}

test('Well-Drilled installs as a power without crashing combat', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 7 });
  for (let i = 0; i < 4; i++) await addCard(page, WELL_DRILLED);
  for (let i = 0; i < 8; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  expect(await ensureInHand(page, WELL_DRILLED)).toBeTruthy();
  await playCardById(page, WELL_DRILLED);

  // Power installs — the power row should now show it, and combat is intact.
  await expect(page.getByText('Well-Drilled').first()).toBeVisible();
  await expect(page.getByTestId('hand')).toBeVisible();
});

test('Last Supper opens the sacrifice prompt and cashing in an animal does not crash', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11 });
  for (let i = 0; i < 4; i++) await addCard(page, LAST_SUPPER);
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  // Get a body on the board first.
  expect(await ensureAnimalStaged(page)).toBeTruthy();
  // Then make sure Last Supper is in hand.
  expect(await ensureInHand(page, LAST_SUPPER)).toBeTruthy();

  await playCardById(page, LAST_SUPPER);

  // The sacrifice banner arms.
  const banner = page.getByText(/Last Supper:/);
  await expect(banner).toBeVisible();

  // Click the first armed animal pill to cash it in.
  await page.getByText(/click to cash in/).first().click();

  // Prompt dismisses and combat is still alive (hand still rendered).
  await expect(page.getByTestId('hand')).toBeVisible();
});
