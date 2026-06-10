// Regression: FLEX words (cycle-8, the missing-slot hold answer) were shipped
// dead-on-arrival. `playCard` declared `const card`, but the FLEX branch
// reassigns `card` to a clone with its resolved slot — that threw "Assignment
// to constant variable" on EVERY flex play, AFTER the card_play telemetry fired
// but BEFORE the card staged. Net effect in-game: clicking a flex word did
// nothing (energy + hand frozen). Found in telemetry 2026-06-10 (a player
// clicked `by-which-i-mean` 4× in a row to no effect). This proves a flex word
// now actually stages into a slot.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, playCardById, endTurn } from './helpers/lab.js';

const FLEX    = 'wv2-x-by-which-i-mean'; // FLEX word: fills intro or subject
const SUBJECT = 'wv2-s-your-reasoning';

async function ensureInHand(page, cardId, maxTurns = 5) {
  for (let i = 0; i < maxTurns; i++) {
    if (await handCardById(page, cardId).count() > 0) return true;
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
  }
  return (await handCardById(page, cardId).count()) > 0;
}

test('a FLEX word stages without throwing (leaves hand, fills a slot)', async ({ page }) => {
  await gotoLab(page, 'wit', { seed: 11 });
  await page.getByRole('button', { name: /All Cards/ }).click();
  for (let i = 0; i < 6; i++) {
    await addCard(page, FLEX);
    await addCard(page, SUBJECT);
  }
  await fightEnemy(page, 'Loom Familiar');

  expect(await ensureInHand(page, FLEX)).toBeTruthy();
  const handBefore = await page.getByTestId('hand-card').count();

  // The bug: this click threw and aborted, so the flex never left the hand.
  await playCardById(page, FLEX);

  // Flex resolved into the empty intro slot → it left the hand. (Pre-fix the
  // count was unchanged because the play threw before the setHand removal.)
  await expect
    .poll(async () => page.getByTestId('hand-card').count())
    .toBeLessThan(handBefore);

  // Combat still alive — no uncaught crash took the tree down.
  await expect(page.getByTestId('hand')).toBeVisible();
});

test('a displaced FLEX word re-flexes into the open slot instead of bouncing to hand', async ({ page }) => {
  await gotoLab(page, 'wit', { seed: 11 });
  await page.getByRole('button', { name: /All Cards/ }).click();
  for (let i = 0; i < 6; i++) {
    await addCard(page, FLEX);
    await addCard(page, 'wv2-i-frankly'); // a real intro
  }
  await fightEnemy(page, 'Loom Familiar');

  // Stage the flex first — with an empty tray it resolves into the intro slot.
  expect(await ensureInHand(page, FLEX)).toBeTruthy();
  await playCardById(page, FLEX);
  // Now play the real intro: the flex should RE-FLEX into the subject slot
  // (v3.9.1) rather than bounce back to hand.
  expect(await ensureInHand(page, 'wv2-i-frankly')).toBeTruthy();
  const handBefore = await page.getByTestId('hand-card').count();
  await playCardById(page, 'wv2-i-frankly');
  // Hand shrank by exactly the intro played — the flex did NOT come back.
  await expect
    .poll(async () => page.getByTestId('hand-card').count())
    .toBe(handBefore - 1);
  // Combat alive, no crash.
  await expect(page.getByTestId('hand')).toBeVisible();
});
