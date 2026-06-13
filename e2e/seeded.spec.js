import { test, expect } from '@playwright/test';
import { gotoLab, fightEnemy, handCards, endTurn } from './helpers/lab.js';

// The deterministic-RNG hook (src/devSeed.js): ?seed=N swaps Math.random for a
// seeded PRNG, so the opening shuffle/draw is reproducible. Lane-agnostic; uses
// the wit starter (Menagerie v4 retired the lure deck this once relied on).
async function openingHand(page, seed) {
  await gotoLab(page, 'wit', { seed });
  await fightEnemy(page, 'Loom Familiar');
  await expect(page.getByTestId('hand')).toBeVisible();
  return handCards(page).evaluateAll(els => els.map(e => e.getAttribute('data-card-id')));
}

test('same seed yields an identical opening hand', async ({ page }) => {
  const a = await openingHand(page, 12345);
  expect(a.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__seed)).toBe(12345);
  const b = await openingHand(page, 12345);
  expect(b).toEqual(a);
});

test('a different seed can change the draw', async ({ page }) => {
  async function firstTwoHands(page, seed) {
    await gotoLab(page, 'wit', { seed });
    await fightEnemy(page, 'Loom Familiar');
    const h1 = await handCards(page).evaluateAll(els => els.map(e => e.getAttribute('data-card-id')));
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
    const h2 = await handCards(page).evaluateAll(els => els.map(e => e.getAttribute('data-card-id')));
    return h1.join(',') + '|' + h2.join(',');
  }
  const a = await firstTwoHands(page, 1);
  const b = await firstTwoHands(page, 999999);
  expect(a).not.toEqual(b);
});
