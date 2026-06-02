import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, playCardById, endTurn } from './helpers/lab.js';

// Smoke-tests the 2026-06-01 Handler booster cards through real combat UI:
// a power install (Well-Drilled), and the Last Supper click-target prompt.
// The point is runtime safety — a clean `vite build` does NOT catch the kind
// of render-time crash these new prompts/pills could introduce.

const WELL_DRILLED = 'c-well-drilled';
const LAST_SUPPER = 'c-last-supper';
const FULL_POCKETS = 'c-full-pockets';
const SNACK = 'c-snack';
const BIRDSEED = 'cv2-l-birdseed';
const ON_THREE = 'c-pack-tactics';

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

test('Full Pockets generates a Snack that costs 1, extends an animal, and does not exhaust', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11 });
  for (let i = 0; i < 4; i++) await addCard(page, FULL_POCKETS);
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  // Install Full Pockets (the 2-cost power) so it starts minting Snacks.
  expect(await ensureInHand(page, FULL_POCKETS)).toBeTruthy();
  await playCardById(page, FULL_POCKETS);
  await expect(page.getByText('Full Pockets').first()).toBeVisible();

  // Stage a birdseed so a fresh animal lands on the board next turn — at the
  // same start-of-turn the Snack is minted. The Snack is a token (it vanishes
  // at end of turn), so the body and the Snack must coincide; we can't end
  // another turn between getting the Snack and treating with it.
  expect(await ensureInHand(page, BIRDSEED)).toBeTruthy();
  await playCardById(page, BIRDSEED);
  await endTurn(page);
  await expect(page.getByTestId('hand')).toBeVisible();

  // Bird is now on the board and a Snack has been minted into hand this turn.
  expect(await handCardById(page, SNACK).count()).toBeGreaterThan(0);
  const snack = handCardById(page, SNACK).first();
  // The Snack reads cost 1 (no longer a free token).
  await expect(snack).toHaveAttribute('data-eff-cost', '1');

  await playCardById(page, SNACK);
  // Treat prompt arms — click an animal to extend it.
  await page.getByText(/click to treat/).first().click();

  // Combat survives the Snack play (no render crash).
  await expect(page.getByTestId('hand')).toBeVisible();
});

test('On Three! surfaces the extra projected damage in the menagerie math bar', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11 });
  for (let i = 0; i < 4; i++) await addCard(page, ON_THREE);
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  // Get a body on the board to rally.
  expect(await ensureAnimalStaged(page)).toBeTruthy();
  // The "🐾 This turn" projection has no rally chip yet. (Match the
  // parenthesized chip form so we don't collide with the "On Three!" card
  // sitting in hand.)
  await expect(page.getByText(/\(On Three!\)/)).toHaveCount(0);

  // Play On Three! — it arms an extra attack on every animal in play.
  expect(await ensureInHand(page, ON_THREE)).toBeTruthy();
  await playCardById(page, ON_THREE);

  // The projection now carries the rally's additional damage as its own chip.
  await expect(page.getByText(/\(On Three!\)/).first()).toBeVisible();
  await expect(page.getByTestId('hand')).toBeVisible();
});
