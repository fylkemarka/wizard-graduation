// Smoke-tests the 2026-06-07 handler bonus cards through real combat UI —
// the point is runtime safety (no render crash in the new prompts/powers)
// plus the core behavior of each. RNG-deep tuning stays in the sim.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

async function ensureInHand(page, cardId, maxTurns = 5) {
  for (let i = 0; i < maxTurns; i++) {
    const ack = page.getByRole('button', { name: 'Acknowledged' });
    if ((await ack.count()) > 0) await ack.click();
    if (await handCardById(page, cardId).count() > 0) return true;
    await endTurn(page);
    await expect(page.getByTestId('hand')).toBeVisible();
  }
  return (await handCardById(page, cardId).count()) > 0;
}

// Play a card on a fresh full-energy turn (cycle once first so prior plays
// don't starve a cost-2/3 card).
async function playFresh(page, cardId) {
  await endTurn(page);
  const ack = page.getByRole('button', { name: 'Acknowledged' });
  if ((await ack.count()) > 0) await ack.click();
  await expect(page.getByTestId('hand')).toBeVisible();
  if (!(await ensureInHand(page, cardId))) return false;
  const c = handCardById(page, cardId).first();
  if ((await c.getAttribute('data-playable')) !== 'true') return false;
  await c.click();
  return true;
}

test('Animal Midnight installs as a power without crashing', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1 });
  for (let i = 0; i < 4; i++) await addCard(page, 'c-animal-midnight');
  for (let i = 0; i < 6; i++) await addCard(page, 'cv2-l-tender-greens');
  await fightEnemy(page, 'Loom Familiar');
  expect(await ensureInHand(page, 'c-animal-midnight')).toBeTruthy();
  await handCardById(page, 'c-animal-midnight').first().click();
  await expect(page.getByText('Animal Midnight').first()).toBeVisible();
  await expect(page.getByTestId('hand')).toBeVisible();
});

test('Trough arms and The Horde / Herds prompts open without crashing', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'field-mouse' });
  for (let i = 0; i < 3; i++) await addCard(page, 'c-trough');
  for (let i = 0; i < 3; i++) await addCard(page, 'c-the-horde');
  for (let i = 0; i < 3; i++) await addCard(page, 'c-move-in-herds');
  for (let i = 0; i < 6; i++) await addCard(page, 'cv2-l-tender-greens');
  await fightEnemy(page, 'Loom Familiar');

  // Each on its own fresh turn so a cost-2/3 card isn't energy-starved.
  expect(await playFresh(page, 'c-trough')).toBeTruthy();
  await expect(page.getByTestId('hand')).toBeVisible();

  expect(await playFresh(page, 'c-the-horde')).toBeTruthy();
  await expect(page.getByTestId('hand')).toBeVisible();

  expect(await playFresh(page, 'c-move-in-herds')).toBeTruthy();
  await expect(page.getByText(/They DO Move in Herds/).first()).toBeVisible();
  await expect(page.getByTestId('hand')).toBeVisible();
});

test('Sacrifice button grants Block and feeds Light the Mound', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 1, forceSpecies: 'goose' });
  for (let i = 0; i < 8; i++) await addCard(page, 'cv2-l-birdseed');
  for (let i = 0; i < 3; i++) await addCard(page, 'c-light-the-mound');
  await fightEnemy(page, 'Loom Familiar');

  // Summon a goose (attack 6), then sacrifice it via the always-on button.
  for (let p = 0; p < 1; p++) {
    const c = handCardById(page, 'cv2-l-birdseed').first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') await c.click();
  }
  await endTurn(page);
  const ack = page.getByRole('button', { name: 'Acknowledged' });
  if ((await ack.count()) > 0) await ack.click();
  await expect(page.getByTestId('hand')).toBeVisible();

  const readBlock = async () =>
    parseInt((await page.locator('[title^="Block — absorbs"]').first().innerText()).replace(/\D/g, '') || '0', 10);

  // The sacrifice button is present on the goose; click it.
  const sac = page.getByTestId('sacrifice-animal').first();
  await expect(sac).toBeVisible();
  const blockBefore = await readBlock();
  await sac.click();
  // Block went up; the goose is gone.
  expect(await readBlock()).toBeGreaterThan(blockBefore);
  await expect(page.getByText(/🪿 Goose/)).toHaveCount(0);

  // Light the Mound now deals damage (1 sacrifice × 2). Plays without crash.
  if (await ensureInHand(page, 'c-light-the-mound')) {
    const m = handCardById(page, 'c-light-the-mound').first();
    if ((await m.getAttribute('data-playable')) === 'true') await m.click();
  }
  await expect(page.getByTestId('hand')).toBeVisible();
});
