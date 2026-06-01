import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCards, endTurn } from './helpers/lab.js';

// Verifies the deterministic-RNG hook (src/devSeed.js): loading with ?seed=N
// swaps Math.random for a seeded PRNG, so the shuffle/draw of the opening hand
// is reproducible. Same seed → identical opening hand; this is the foundation
// that makes RNG-sensitive mechanic tests (e.g. enemy-intent timing) testable.

const FISH = 'cv2-l-fish-food';

// Build a fixed deck, enter combat at a seed, and read the opening hand as an
// ordered list of card ids.
async function openingHand(page, seed) {
  await gotoLab(page, 'handler', { seed });
  // A varied-enough deck that a reshuffle actually permutes things.
  for (let i = 0; i < 5; i++) await addCard(page, FISH);
  for (let i = 0; i < 5; i++) await addCard(page, 'c-buffet');
  for (let i = 0; i < 5; i++) await addCard(page, 'c-treat');
  await fightEnemy(page, 'Loom Familiar');
  await expect(page.getByTestId('hand')).toBeVisible();
  return handCards(page).evaluateAll(els => els.map(e => e.getAttribute('data-card-id')));
}

test('same seed yields an identical opening hand', async ({ page }) => {
  const a = await openingHand(page, 12345);
  expect(a.length).toBeGreaterThan(0);

  // Confirm the seed actually installed (sanity on the hook itself).
  expect(await page.evaluate(() => window.__seed)).toBe(12345);

  const b = await openingHand(page, 12345);
  expect(b).toEqual(a);
});

test('a different seed can change the draw', async ({ page }) => {
  // Not guaranteed for every seed pair, but two well-separated seeds over a
  // 15-card deck should differ in opening hand or the first few draws. We
  // compare the first two hands' concatenation to make a false failure
  // astronomically unlikely.
  async function firstTwoHands(page, seed) {
    await gotoLab(page, 'handler', { seed });
    for (let i = 0; i < 5; i++) await addCard(page, FISH);
    for (let i = 0; i < 5; i++) await addCard(page, 'c-buffet');
    for (let i = 0; i < 5; i++) await addCard(page, 'c-treat');
    await fightEnemy(page, 'Loom Familiar');
    const h1 = await handCards(page).evaluateAll(els => els.map(e => e.getAttribute('data-card-uid')));
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
    const h2 = await handCards(page).evaluateAll(els => els.map(e => e.getAttribute('data-card-id')));
    return [...h1.map(() => ''), ...h2].join(',') + '|' + h2.join(',');
  }
  const a = await firstTwoHands(page, 1);
  const b = await firstTwoHands(page, 999999);
  expect(a).not.toEqual(b);
});
