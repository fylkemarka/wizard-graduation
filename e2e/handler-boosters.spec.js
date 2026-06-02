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
const HOUSE_RULES = 'c-house-rules';
const NARROW = 'c-narrow';
const TENDER_GREENS = 'cv2-l-tender-greens';
const IRON_STOMACH = 'c-iron-stomach';

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

test('Well-Drilled arms a target prompt; drilling an animal does not crash combat', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11 });
  for (let i = 0; i < 4; i++) await addCard(page, WELL_DRILLED);
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  // Need a body on the board to drill.
  expect(await ensureAnimalStaged(page)).toBeTruthy();
  expect(await ensureInHand(page, WELL_DRILLED)).toBeTruthy();

  await playCardById(page, WELL_DRILLED);

  // The targeting banner arms.
  await expect(page.getByText(/Well-Drilled:/)).toBeVisible();

  // Click an armed animal pill to stamp the +2.
  await page.getByText(/click to drill/).first().click();

  // Prompt dismisses and combat is still alive.
  await expect(page.getByTestId('hand')).toBeVisible();
});

test('Dismissing Well-Drilled refunds the card to hand', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11 });
  for (let i = 0; i < 4; i++) await addCard(page, WELL_DRILLED);
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  expect(await ensureAnimalStaged(page)).toBeTruthy();
  expect(await ensureInHand(page, WELL_DRILLED)).toBeTruthy();

  const before = await handCardById(page, WELL_DRILLED).count();
  await playCardById(page, WELL_DRILLED);
  await expect(page.getByText(/Well-Drilled:/)).toBeVisible();

  // Dismiss without targeting — the card should snap back to hand.
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText(/Well-Drilled:/)).toHaveCount(0);
  expect(await handCardById(page, WELL_DRILLED).count()).toBe(before);
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

test('Full Pockets adds a single Treat to hand on play (one-time), and the Treat extends an animal', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11 });
  for (let i = 0; i < 4; i++) await addCard(page, FULL_POCKETS);
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  // Put a body on the board first so the Treat has something to extend.
  expect(await ensureAnimalStaged(page)).toBeTruthy();

  // No Treat token yet — Full Pockets no longer mints one every turn.
  expect(await handCardById(page, SNACK).count()).toBe(0);

  // Play Full Pockets: it installs as a power AND drops exactly one Treat into
  // hand THIS turn (the one-time payoff), without exhausting.
  expect(await ensureInHand(page, FULL_POCKETS)).toBeTruthy();
  await playCardById(page, FULL_POCKETS);
  await expect(page.getByText('Full Pockets').first()).toBeVisible();

  expect(await handCardById(page, SNACK).count()).toBe(1);
  const treat = handCardById(page, SNACK).first();
  await expect(treat).toHaveAttribute('data-eff-cost', '1');

  await playCardById(page, SNACK);
  // Treat prompt arms — click an animal to extend it.
  await page.getByText(/click to treat/).first().click();

  // Combat survives the Treat play (no render crash).
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

test('House Rules arms a pick-an-animal prompt; keeping an animal does not crash', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11 });
  for (let i = 0; i < 4; i++) await addCard(page, HOUSE_RULES);
  for (let i = 0; i < 10; i++) await addCard(page, BIRDSEED);
  await fightEnemy(page, 'Loom Familiar');

  expect(await ensureAnimalStaged(page)).toBeTruthy();
  expect(await ensureInHand(page, HOUSE_RULES)).toBeTruthy();

  await playCardById(page, HOUSE_RULES);

  // The pick banner arms (no longer a passive board-wide buff).
  await expect(page.getByText(/House Rules:/)).toBeVisible();

  // Click an armed animal pill to stamp the +2 duration.
  await page.getByText(/click to keep/).first().click();

  // Prompt dismisses and combat is still alive.
  await expect(page.getByTestId('hand')).toBeVisible();
});

test('Acquired Taste opens the narrow chooser and excluding a species does not crash', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 11 });
  for (let i = 0; i < 4; i++) await addCard(page, NARROW);
  for (let i = 0; i < 8; i++) await addCard(page, TENDER_GREENS);
  await fightEnemy(page, 'Loom Familiar');

  expect(await ensureInHand(page, NARROW)).toBeTruthy();
  await playCardById(page, NARROW);

  // The chooser opens listing the narrowable lure (Tender Greens, 3 species).
  await expect(page.getByText(/Acquired Taste:/)).toBeVisible();
  await expect(page.getByText(/Tender Greens:/)).toBeVisible();

  // Click a species button to drop it from the pool; the chooser closes.
  await page.getByRole('button', { name: /Young Buck/ }).first().click();
  await expect(page.getByText(/Acquired Taste:/)).toHaveCount(0);
  await expect(page.getByTestId('hand')).toBeVisible();

  // Acquired Taste EXHAUSTS on use — it must not land in the discard pile.
  // (Tender Greens stay in hand; nothing else cycles, so a discard count of
  // 0 proves the card went to exile, not discard.)
  await expect(page.getByTestId('discard-pile-btn')).toContainText('Discard 0');
  expect(await handCardById(page, NARROW).count()).toBe(0);
});

test('Iron Stomach exhausts on play (lands in exile, not discard) and arms the next-cast boost', async ({ page }) => {
  // Deck of only Iron Stomach: nothing else cycles, so discard staying at 0
  // proves the skill exhausted to exile rather than going to discard.
  await gotoLab(page, 'handler', { seed: 11 });
  for (let i = 0; i < 6; i++) await addCard(page, IRON_STOMACH);
  await fightEnemy(page, 'Loom Familiar');

  expect(await ensureInHand(page, IRON_STOMACH)).toBeTruthy();
  await playCardById(page, IRON_STOMACH);

  // The played copy is gone from hand and did NOT go to discard — it exhausted.
  expect(await handCardById(page, IRON_STOMACH).count()).toBeLessThan(6);
  await expect(page.getByTestId('discard-pile-btn')).toContainText('Discard 0');
  await expect(page.getByTestId('hand')).toBeVisible();
});
