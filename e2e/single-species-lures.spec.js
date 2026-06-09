// Handler v3 slice 5 — single-species special lures (Alan, 2026-06-08). When
// the foundational pools narrowed 3→2, the dropped animals survived as their
// own dedicated lures: "A Clover Patch" (always a Rabbit, THE SWARM) and
// "A Shiny Bauble" (always a Rabid Scrubjay, THE DISRUPTOR). These are
// single-species, so they summon their named animal with no RNG pool roll.

import { test, expect } from '@playwright/test';
import { gotoLab, addCard, fightEnemy, handCardById, endTurn } from './helpers/lab.js';

async function ackIfPresent(page) {
  const a = page.getByRole('button', { name: 'Acknowledged' });
  if ((await a.count()) > 0) await a.click();
}

async function ensurePlay(page, cardId, maxTurns = 6) {
  for (let t = 0; t < maxTurns; t++) {
    const c = handCardById(page, cardId).first();
    if ((await c.count()) > 0 && (await c.getAttribute('data-playable')) === 'true') {
      await c.click();
      return true;
    }
    await endTurn(page);
    await ackIfPresent(page);
  }
  return false;
}

async function summonsItsAnimal(page, lureId, animalId) {
  await addCard(page, lureId);
  await fightEnemy(page, 'Silk Wraith');
  expect(await ensurePlay(page, lureId)).toBeTruthy();
  // Lure arrives in 1 turn — end the turn and it transforms in place.
  await endTurn(page);
  await ackIfPresent(page);
  const animal = page
    .locator(`[data-testid="board-animal"][data-animal-id="${animalId}"]`)
    .first();
  await expect(animal).toBeVisible();
}

test('A Clover Patch summons a Rabbit', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 4 });
  await summonsItsAnimal(page, 'cv2-l-clover-patch', 'rabbit');
});

test('A Shiny Bauble summons a Rabid Scrubjay', async ({ page }) => {
  await gotoLab(page, 'handler', { seed: 4 });
  await summonsItsAnimal(page, 'cv2-l-shiny-bauble', 'rabid-scrubjay');
});
