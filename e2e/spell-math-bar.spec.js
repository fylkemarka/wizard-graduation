// The spell-tray "Math" bar (rebuilt 2026-06-06 in uniform-pill language)
// renders only when a full intro+subject+target tray is staged — a path no
// other spec exercised. Stage a complete wit spell and confirm the bar
// appears with its cast pill and final → total pill.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, playCardById, endTurn } from './helpers/lab.js';

const INTRO   = 'wv2-i-frankly';
const SUBJECT = 'wv2-s-your-reasoning';
const TARGET  = 'wv2-t-thats-not-it';

async function ensureInHand(page, cardId, maxTurns = 4) {
  for (let i = 0; i < maxTurns; i++) {
    if (await handCardById(page, cardId).count() > 0) return true;
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
  }
  return (await handCardById(page, cardId).count()) > 0;
}

test('a full staged tray renders the Math pill bar', async ({ page }) => {
  await gotoLab(page, 'wit', { seed: 11 });
  // Wit's deck-build defaults to the FFT-row view, which has no search box.
  await page.getByRole('button', { name: /All Cards/ }).click();
  for (let i = 0; i < 6; i++) {
    await addCard(page, INTRO);
    await addCard(page, SUBJECT);
    await addCard(page, TARGET);
  }
  await fightEnemy(page, 'Loom Familiar');

  expect(await ensureInHand(page, INTRO)).toBeTruthy();
  await playCardById(page, INTRO);
  expect(await ensureInHand(page, SUBJECT)).toBeTruthy();
  await playCardById(page, SUBJECT);
  expect(await ensureInHand(page, TARGET)).toBeTruthy();
  await playCardById(page, TARGET);

  // Bar is up: label, the cast pill, and the final predicted pill.
  await expect(page.getByText('Math', { exact: true })).toBeVisible();
  await expect(page.getByText(/🪄 cast \d+/).first()).toBeVisible();
  await expect(page.getByText(/^→ \d+$/).first()).toBeVisible();

  // Combat is still alive — nothing crashed.
  await expect(page.getByTestId('hand')).toBeVisible();
});
